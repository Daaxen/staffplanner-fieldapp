"""Wave1 UI runner. Writes only TEST entities, cleanup by captured UUIDs."""
import json, re, time, urllib.request, urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('/tmp/browser/wave1'); OUT.mkdir(exist_ok=True,parents=True)
RUN='1793440688'; TAG='TEST-W1-'+RUN
SESSION=json.load(open('/tmp/wave1-sessions/testa.json'))
ENV=Path('/dev-server/.env').read_text(); KEY=re.search(r'VITE_SUPABASE_PUBLISHABLE_KEY=["\']?([^\n"\']+)',ENV).group(1)
def rest(table,query='',method='GET',body=None):
 req=urllib.request.Request('https://piubkkipultepevxbxuv.supabase.co/rest/v1/'+table+'?'+urllib.parse.quote(query,safe='=,*().-'),data=json.dumps(body).encode() if body else None,method=method,headers={'apikey':KEY,'Authorization':'Bearer '+SESSION['session']['access_token'],'Content-Type':'application/json','Prefer':'return=representation'})
 with urllib.request.urlopen(req) as r: return json.load(r)
def snap(page,name):
 page.screenshot(path=str(OUT/(name+'.png')),full_page=True); (OUT/(name+'.txt')).write_text(page.locator('body').inner_text())
def goto(page,route):
 page.goto('http://localhost:8080/'+route); page.wait_for_timeout(2200)
def context(b,who):
 c=b.new_context(viewport={'width':1440,'height':1100}); c.tracing.start(screenshots=True,snapshots=True); p=c.new_page(); goto(p,''); s=json.load(open('/tmp/wave1-sessions/'+who+'.json')); p.evaluate('s=>localStorage.setItem(s.storage_key,JSON.stringify(s.session))',s); return c,p
if __name__=='__main__':
 with sync_playwright() as pw:
  b=pw.chromium.launch(); c,p=context(b,'testa')
  rows=rest('clients','customer_number=eq.'+TAG)
  goto(p,'app/planner'); p.get_by_role('button',name='Create work order',exact=True).click(); p.locator('#order-name').fill('TEST – Golden Project'); p.locator('#order-number').fill(TAG); p.locator('#order-client').fill('TEST – Golden'); p.get_by_role('button',name=re.compile('TEST – Golden Customer '+TAG)).click()
  for i in range(2):
   p.get_by_role('button',name='Pick',exact=True).first.click(); p.locator('button[name="day"]').filter(has_text=re.compile('^28$')).first.click()
  p.get_by_role('button',name='Create Project',exact=True).click(); p.wait_for_timeout(3500); snap(p,'created-project'); print('PROJECTS',json.dumps(rest('projects','project_number=eq.'+TAG))); c.tracing.stop(path=str(OUT/'creation.zip')); b.close()
