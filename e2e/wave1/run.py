"""Safety-gated Wave 1 browser/DB runner. Never substitutes real identities."""
import json, subprocess, datetime
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('/tmp/browser/wave1'); OUT.mkdir(parents=True,exist_ok=True)
CASES=[('P0-01','Customer/order','Create tagged customer/order; reopen/reload; compare UUID and row count'),('P0-02','Booking sync','Assign dedicated A+B; change dates and B days; remove B; compare both booking tables'),('P0-03','Time reporting','A+B report; correct A in place; verify totals after reload/relogin'),('P0-04','Report/sign-off','Submit written report/checklist/sign-off; reopen and verify persistence'),('P0-05','Invoice preparation','Compare current corrected hours with invoice suggestion'),('P1-06','Double submit','Rapid submit order/booking/time/report; assert single intended row'),('P1-07','Interrupted flow','Edit then navigate/reload; compare UI and stored values'),('P1-08','Status flow','Exercise allowed forward/back and rejected transitions'),('P1-09','Stale data','Two authorized contexts edit same tagged order; compare last persisted values'),('P2-10','Installer role','Dedicated A sees assigned only and cannot access finance/admin'),('GOLDEN','Full workflow','Run all 13 approved steps and verify persistence')]
def db(sql):
 p=subprocess.run(['lovable','supabase','query',sql,'--json'],capture_output=True,text=True)
 if p.returncode: raise RuntimeError('DB query unavailable (details withheld)')
 return json.loads(p.stdout)['rows']
def cleanup_check(stage):
 # No DELETE is available through the required read-only query interface.
 # Existing tagged rows are not assumed to belong to this invocation.
 rows=db("select id,ref,name from projects where name='TEST – Golden Project' or ref like 'TEST-W1-%'")
 clients=db("select id,ref,name from clients where name='TEST – Golden Customer'")
 (OUT/f'{stage}-cleanup-check.json').write_text(json.dumps(dict(projects=rows,clients=clients,deleted=0),indent=2))
 return rows,clients
def restore_session(context):
 p=subprocess.run(['lovable','auth-session','--json','--self'],capture_output=True,text=True)
 if p.returncode: return False,'Self session unavailable: no matching app account; no alternate user used'
 a=json.loads((Path.home()/'.cache/lovable-auth/session.json').read_text())
 context.add_init_script('localStorage.setItem('+json.dumps(a['storage_key'])+','+json.dumps(json.dumps(a['session']))+');')
 return True,''
def assert_db(operation,sql,expected,ids):
 actual=db(sql)
 if actual!=expected: raise AssertionError(json.dumps(dict(operation=operation,expected=expected,actual=actual,ids=ids)))
def main():
 cleanup_check('start'); results=[]
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(headless=True)
   ctx=browser.new_context(viewport={'width':1280,'height':1800}); ok,reason=restore_session(ctx)
   page=ctx.new_page()
   for ident,area,actions in CASES:
    ctx.tracing.start(screenshots=True,snapshots=True,sources=True)
    try:
     page.goto('http://localhost:8080/app/orders',wait_until='networkidle')
     page.screenshot(path=str(OUT/f'{ident}.png'),full_page=True)
     actual={'url':page.url,'self_session':ok,'mutations':0}
     # Authentication alone is insufficient: tagged cleanup must also be writable.
     why=reason or 'Required cleanup SQL interface is read-only; safe fixture lifecycle unavailable'
     row=dict(id=ident,area=area,priority=ident.split('-')[0],preconditions='Authorized self admin; writable tagged cleanup; dedicated installer A+B where needed',actions=actions,expected='UI actions agree with persisted tagged rows; no unintended duplicates',pass_fail='Pass only after all actions and DB assertions complete',status='Blocked',classification='D',operation='Authenticate and establish safe fixture lifecycle',actual=actual,reason=why,ids={'run':'TEST-W1-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'),'project':None,'users':[]})
    except Exception as e:
     row=dict(id=ident,area=area,status='Blocked',classification='D',operation='Open browser precondition',expected='Reachable app',actual=str(e),ids={})
    finally: ctx.tracing.stop(path=str(OUT/f'{ident}.zip'))
    results.append(row); print(json.dumps(row))
   browser.close()
 finally:
  cleanup_check('end')
  (OUT/'results.json').write_text(json.dumps(results,indent=2))
if __name__=='__main__': main()
