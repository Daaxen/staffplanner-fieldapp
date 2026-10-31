"""Wave 1 regression suite – backend integrity layer.

Replays the exact write paths the app uses (see src/lib/appData.ts, src/lib/bookings.ts,
src/components/timereporting/MyTime.tsx, src/lib/offline/fieldWork.ts) against the real
backend, signed in as the TEST users, and asserts what is stored afterwards.

Only TEST-tagged data is created. Everything created is deleted at the end (and leftovers
from earlier runs at the start). Run:  python3 e2e/wave1/backend_suite.py
Sessions: /tmp/wave1-sessions/{testa,testb}.json  (minted with `lovable auth-session`).
"""
import json, os, sys, time, uuid, traceback
from concurrent.futures import ThreadPoolExecutor
import requests

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ENV = dict(l.strip().split("=", 1) for l in open(os.path.join(ROOT, ".env")) if "=" in l)
URL = ENV["VITE_SUPABASE_URL"].strip('"') + "/rest/v1"
KEY = ENV["VITE_SUPABASE_PUBLISHABLE_KEY"].strip('"')
RUN = time.strftime("%m%d%H%M")
TAG = f"TEST-W1-{RUN}"
CUSTOMER = "TEST – Golden Customer"
PROJECT = "TEST – Golden Project"
A_INST = "bdddd674-c3dc-426f-b47c-0c600ddb51cc"   # TEST W1 A (admin + installer)
B_INST = "2051a80c-db38-465b-b077-01a629feb981"   # TEST W1 B (installer)


def token(name):
    return json.load(open(f"/tmp/wave1-sessions/{name}.json"))["session"]["access_token"]


class Api:
    def __init__(self, who):
        self.who = who
        self.h = {"apikey": KEY, "Authorization": "Bearer " + token(who),
                  "Content-Type": "application/json", "Prefer": "return=representation"}

    def _r(self, m, table, params=None, body=None, prefer=None):
        h = dict(self.h)
        if prefer: h["Prefer"] = prefer
        r = requests.request(m, f"{URL}/{table}", headers=h, params=params, json=body, timeout=30)
        try: data = r.json() if r.text else None
        except ValueError: data = r.text
        return r.status_code, data

    def get(self, t, **p): return self._r("GET", t, p)
    def post(self, t, b, **p): return self._r("POST", t, p, b)
    def upsert(self, t, b, on): return self._r("POST", t, {"on_conflict": on}, b,
                                               "return=representation,resolution=merge-duplicates")
    def patch(self, t, b, **p): return self._r("PATCH", t, p, b)
    def delete(self, t, **p): return self._r("DELETE", t, p)


A, B = Api("testa"), Api("testb")
RESULTS, CTX = [], {}


def test(tid, area, prio, pre, actions, expected):
    def wrap(fn):
        def run():
            rec = dict(id=tid, area=area, priority=prio, preconditions=pre, actions=actions,
                       expected=expected, status="PASS", detail="")
            try:
                fn()
            except Blocked as e:
                rec.update(status="BLOCKED", detail=str(e))
            except AssertionError as e:
                rec.update(status="FAIL", detail=str(e))
            except Exception as e:  # noqa
                rec.update(status="ERROR", detail=f"{e}\n{traceback.format_exc(limit=2)}")
            RESULTS.append(rec)
            print(f"[{rec['status']}] {tid} {area}" + (f"\n    {rec['detail']}" if rec["detail"] else ""))
        run.tid = tid
        return run
    return wrap


class Blocked(Exception): pass


def check(cond, op, expected, actual):
    if not cond:
        raise AssertionError(f"operation: {op} | expected: {expected} | actual: {actual} | "
                             f"order={CTX.get('pid')} ref={CTX.get('ref')}")


def ok(res, op):
    code, data = res
    check(200 <= code < 300, op, "2xx", f"{code} {data}")
    return data


# ---------------------------------------------------------------- helpers
def project_row(): return ok(A.get("projects", id=f"eq.{CTX['pid']}", select="*"), "read order")[0]
def assignments(api=A): return ok(api.get("assignments", project_id=f"eq.{CTX['pid']}", select="*"), "read bookings")
def assignees(): return ok(A.get("project_assignees", project_id=f"eq.{CTX['pid']}", select="installer_id"), "read assignees")


def sync_order(installers, start, end, st="08:00:00", et="16:00:00", status=None):
    """Same sequence as appData.persist + bookings.syncProjectBookings."""
    pid = CTX["pid"]
    body = {"start_date": start, "end_date": end, "start_time": st, "end_time": et}
    if status: body["status"] = status
    ok(A.patch("projects", body, id=f"eq.{pid}"), "update order")
    ok(A.delete("project_assignees", project_id=f"eq.{pid}"), "clear assignees")
    if installers:
        ok(A.post("project_assignees", [{"project_id": pid, "installer_id": i} for i in installers]), "add assignees")
    q = {"project_id": f"eq.{pid}"}
    if installers: q["installer_id"] = f"not.in.({','.join(installers)})"
    ok(A.delete("assignments", **q), "drop stale bookings")
    if installers:
        rows = [{"project_id": pid, "installer_id": i, "planned_start_at": f"{start}T{st}+01:00",
                 "planned_end_at": f"{end}T{et}+01:00", "assignment_status": "planned"} for i in installers]
        ok(A.upsert("assignments", rows, "project_id,installer_id"), "upsert bookings")


def cleanup(label):
    cs = ok(A.get("clients", name=f"eq.{CUSTOMER}", select="id"), "find test customers")
    cids = [c["id"] for c in cs]
    ps = ok(A.get("projects", name=f"like.TEST – Golden*", select="id"), "find test orders")
    pids = [p["id"] for p in ps]
    if pids:
        inn = f"in.({','.join(pids)})"
        for t in ["time_entries", "field_reports", "assignments", "project_assignees",
                  "mileage_entries", "expense_entries", "deviations", "documents", "reminders", "active_timers"]:
            A.delete(t, project_id=inn)
        A.delete("projects", id=inn)
    for i in (A_INST, B_INST):  # unlinked test time rows (customer-level)
        if cids: A.delete("time_entries", installer_id=f"eq.{i}", client_id=f"in.({','.join(cids)})")
    if cids: A.delete("clients", id=f"in.({','.join(cids)})")
    left = ok(A.get("projects", name="like.TEST – Golden*", select="id"), "verify cleanup")
    print(f"cleanup[{label}]: removed {len(pids)} orders, {len(cids)} customers, leftovers={len(left)}")
    return pids, left


# ---------------------------------------------------------------- tests
@test("P0-01", "Customer → Work order", "P0", "TEST A is admin", "create customer, create order linked by client_id, re-read",
      "one order, client_id = customer id, same UUID on re-read")
def p0_01():
    c = ok(A.post("clients", {"name": CUSTOMER, "sandbox": False}), "create customer")[0]
    CTX["cid"] = c["id"]
    types = ok(A.get("ref_project_type", select="code", limit=1), "read order types")
    CTX["ref"] = TAG
    p = ok(A.upsert("projects", {"ref": TAG, "name": PROJECT, "project_number": TAG,
                                 "project_type": types[0]["code"], "status": "open", "client_id": c["id"],
                                 "client_name": CUSTOMER, "start_date": "2027-03-01", "end_date": "2027-03-03",
                                 "start_time": "08:00:00", "end_time": "16:00:00", "estimated_hours": 24,
                                 "hourly_rate": 600, "data": {}}, "ref"), "create order")[0]
    CTX["pid"] = p["id"]
    # second save with same ref (= app saving again) must not duplicate
    ok(A.upsert("projects", {"ref": TAG, "name": PROJECT, "project_type": types[0]["code"], "data": {}}, "ref"), "re-save order")
    rows = ok(A.get("projects", ref=f"eq.{TAG}", select="id,client_id,client_name"), "find order by ref")
    check(len(rows) == 1, "dedupe on ref", "1 row", len(rows))
    check(rows[0]["id"] == p["id"], "stable UUID", p["id"], rows[0]["id"])
    check(rows[0]["client_id"] == c["id"], "customer link", c["id"], rows[0]["client_id"])


@test("P0-02", "Booking sync", "P0", "P0-01 order", "assign A+B, move dates, remove B",
      "assignments == project_assignees after each step; no orphans; B sees nothing after removal")
def p0_02():
    sync_order([A_INST, B_INST], "2027-03-01", "2027-03-03", status="scheduled")
    check({a["installer_id"] for a in assignments()} == {A_INST, B_INST}, "assign A+B", "A,B booked", assignments())
    check({a["installer_id"] for a in assignees()} == {A_INST, B_INST}, "assignees A+B", "A,B", assignees())
    check(len(assignments(B)) == 1, "B sees own booking", 1, len(assignments(B)))
    sync_order([A_INST, B_INST], "2027-03-02", "2027-03-04", st="07:00:00")
    for a in assignments():
        check(a["planned_start_at"].startswith("2027-03-02T06:00"), "move dates", "start 2027-03-02 07:00 CET", a["planned_start_at"])
    check(len(assignments()) == 2, "no duplicate on move", 2, len(assignments()))
    sync_order([A_INST], "2027-03-02", "2027-03-04", st="07:00:00")
    check([a["installer_id"] for a in assignments()] == [A_INST], "remove B", "only A", assignments())
    check(len(assignments(B)) == 0, "B booking gone for B", 0, assignments(B))
    sync_order([A_INST, B_INST], "2027-03-02", "2027-03-04", st="07:00:00")  # B back for later tests


@test("P0-03", "Time reporting + correction", "P0", "A,B booked", "A and B report, A corrects",
      "3 rows → still 2 after correction, totals right")
def p0_03():
    acts = ok(A.get("time_activity_types", select="id", active="eq.true", limit=1), "activity")[0]["id"]
    def row(inst, h): return {"entry_date": "2027-03-02", "client_id": CTX["cid"], "project_id": CTX["pid"],
                              "activity_type_id": acts, "hours": h, "installer_id": inst, "source": "manual",
                              "travel_hours": 0, "description": TAG}
    ea = ok(A.post("time_entries", row(A_INST, 8)), "A reports 8h")[0]
    ok(B.post("time_entries", row(B_INST, 6)), "B reports 6h")
    ok(A.patch("time_entries", {"hours": 7.5}, id=f"eq.{ea['id']}"), "A corrects to 7.5h")
    rows = ok(A.get("time_entries", project_id=f"eq.{CTX['pid']}", select="id,installer_id,hours"), "read time")
    check(len(rows) == 2, "no duplicate after correction", 2, rows)
    check(sum(float(r["hours"]) for r in rows) == 13.5, "project total", 13.5, rows)
    own_b = ok(B.get("time_entries", project_id=f"eq.{CTX['pid']}", select="id"), "B reads time")
    check(len(own_b) == 1, "B sees only own time", 1, own_b)
    # B must not be able to change A's time
    B.patch("time_entries", {"hours": 1}, id=f"eq.{ea['id']}")
    now = ok(A.get("time_entries", id=f"eq.{ea['id']}", select="hours"), "re-read A")[0]
    check(float(now["hours"]) == 7.5, "B cannot edit A's time", 7.5, now)


@test("P0-04", "Report + sign-off", "P0", "A booked", "A submits written report + sign-off, re-read; start+complete order",
      "report persists on correct order; status transitions accepted")
def p0_04():
    body = {"project_id": CTX["pid"], "project_ref": TAG, "installer_id": A_INST, "checked_items": [],
            "signature": None, "sign_offs": {"client": {"name": "TEST Kund", "at": "2027-03-04T15:00:00Z"}},
            "report_text": f"{TAG} installation klar", "photo_paths": [], "photo_meta": [],
            "submitted_at": "2027-03-04T15:00:00Z"}
    ok(A.upsert("field_reports", body, "project_id,installer_id"), "submit report")
    r = ok(A.get("field_reports", project_id=f"eq.{CTX['pid']}", select="*"), "re-read report")
    check(len(r) == 1 and r[0]["submitted_at"], "report persisted+submitted", "1 submitted", r)
    check(r[0]["report_text"].startswith(TAG), "report text", TAG, r[0]["report_text"])
    check("client" in r[0]["sign_offs"], "sign-off persisted", "client sign-off", r[0]["sign_offs"])
    ok(A.patch("projects", {"status": "in-progress"}, id=f"eq.{CTX['pid']}"), "scheduled → in-progress")
    ok(A.patch("projects", {"status": "completed"}, id=f"eq.{CTX['pid']}"), "in-progress → completed")
    check(project_row()["status"] == "completed", "status completed", "completed", project_row()["status"])


@test("P0-05", "Invoice preparation inputs", "P0", "completed order with time", "read what InvoicePrep reads",
      "hours = corrected total, rate from order, report present")
def p0_05():
    rows = ok(A.get("time_entries", project_id=f"eq.{CTX['pid']}", select="hours,travel_hours"), "time for invoice")
    hrs = sum(float(r["hours"]) for r in rows)
    check(hrs == 13.5, "invoice hours use correction", 13.5, hrs)
    check(float(project_row()["hourly_rate"]) == 600, "rate", 600, project_row()["hourly_rate"])
    check(abs(hrs * 600 - 8100) < 0.01, "work line amount", 8100, hrs * 600)


@test("P1-06", "Double submission", "P1", "order exists", "5 parallel identical saves on order/booking/report",
      "no duplicate rows")
def p1_06():
    with ThreadPoolExecutor(5) as ex:
        list(ex.map(lambda _: A.upsert("assignments", [{"project_id": CTX["pid"], "installer_id": A_INST,
             "planned_start_at": "2027-03-02T07:00:00+01:00", "planned_end_at": "2027-03-04T16:00:00+01:00",
             "assignment_status": "planned"}], "project_id,installer_id"), range(5)))
        list(ex.map(lambda _: A.upsert("field_reports", {"project_id": CTX["pid"], "project_ref": TAG,
             "installer_id": A_INST, "report_text": f"{TAG} installation klar"}, "project_id,installer_id"), range(5)))
        list(ex.map(lambda _: A.upsert("projects", {"ref": TAG, "name": PROJECT, "data": {}}, "ref"), range(5)))
    check(len([a for a in assignments() if a["installer_id"] == A_INST]) == 1, "booking dup", 1, assignments())
    check(len(ok(A.get("field_reports", project_id=f"eq.{CTX['pid']}", select="id"), "r")) == 1, "report dup", 1, "")
    check(len(ok(A.get("projects", ref=f"eq.{TAG}", select="id"), "p")) == 1, "order dup", 1, "")
    # time entries have no natural key: a double-tap on "Spara" posts twice — record the behaviour
    acts = ok(A.get("time_activity_types", select="id", limit=1), "a")[0]["id"]
    row = {"entry_date": "2027-03-03", "client_id": CTX["cid"], "project_id": CTX["pid"], "activity_type_id": acts,
           "hours": 1, "installer_id": A_INST, "source": "manual", "travel_hours": 0, "description": TAG + "-dbl"}
    with ThreadPoolExecutor(2) as ex: list(ex.map(lambda _: A.post("time_entries", row), range(2)))
    n = ok(A.get("time_entries", description=f"eq.{TAG}-dbl", select="id"), "dbl")
    for r in n: A.delete("time_entries", id=f"eq.{r['id']}")
    check(len(n) == 1, "time entry double-submit (backend has no guard; UI relies on 'saving' flag)", 1, len(n))


@test("P1-08", "Status flow", "P1", "completed order", "try invalid + valid transitions",
      "only rows in ref_project_status_transition accepted")
def p1_08():
    code, _ = A.patch("projects", {"status": "open"}, id=f"eq.{CTX['pid']}")
    check(project_row()["status"] == "completed", "completed → open must be rejected", "still completed",
          f"{code} {project_row()['status']}")
    ok(A.patch("projects", {"status": "in-progress"}, id=f"eq.{CTX['pid']}"), "completed → in-progress (allowed)")
    ok(A.patch("projects", {"status": "completed"}, id=f"eq.{CTX['pid']}"), "back to completed")
    ev = ok(A.get("project_status_events", project_id=f"eq.{CTX['pid']}", select="to_status"), "history")
    check(len(ev) >= 4, "status history recorded", ">=4 events", ev)


@test("P1-09", "Stale data", "P1", "two sessions", "A reads order, other session edits, A writes old copy",
      "detect whether newer edit is overwritten")
def p1_09():
    stale = project_row()
    ok(A.patch("projects", {"description": "newer edit"}, id=f"eq.{CTX['pid']}"), "session 2 edit")
    ok(A.upsert("projects", {"ref": TAG, "name": stale["name"], "description": stale["description"], "data": {}}, "ref"),
       "session 1 saves stale copy")
    check(project_row()["description"] == "newer edit", "stale overwrite", "newer edit kept",
          project_row()["description"])


@test("P2-10", "Installer role", "P2", "B installer only", "B tries admin reads/writes",
      "B sees only assigned order, cannot edit order or see client rates")
def p2_10():
    mine = ok(B.get("projects", name="like.TEST – Golden*", select="id"), "B list orders")
    check([p["id"] for p in mine] == [CTX["pid"]], "B sees assigned order", CTX["pid"], mine)
    B.patch("projects", {"name": "hacked"}, id=f"eq.{CTX['pid']}")
    check(project_row()["name"] == PROJECT, "B cannot edit order", PROJECT, project_row()["name"])
    code, c = B.get("clients", id=f"eq.{CTX['cid']}", select="hourly_rate")
    check(code >= 400 or not c, "B cannot read client rates", "denied/empty", f"{code} {c}")
    code, _ = B.post("clients", {"name": CUSTOMER + " B", "sandbox": False})
    check(code >= 400, "B cannot create customer", "denied", code)


TESTS = [p0_01, p0_02, p0_03, p0_04, p0_05, p1_06, p1_08, p1_09, p2_10]

if __name__ == "__main__":
    cleanup("start")
    try:
        for t in TESTS:
            if t.tid != "P0-01" and "pid" not in CTX:
                RESULTS.append(dict(id=t.tid, status="BLOCKED", detail="P0-01 failed")); continue
            t()
    finally:
        _, left = cleanup("end")
    os.makedirs("/tmp/browser/wave1", exist_ok=True)
    json.dump(dict(run=TAG, results=RESULTS, leftovers=left), open("/tmp/browser/wave1/backend_results.json", "w"), indent=1)
    sys.exit(0 if all(r["status"] == "PASS" for r in RESULTS) else 1)
