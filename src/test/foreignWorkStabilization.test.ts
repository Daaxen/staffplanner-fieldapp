import { describe, it, expect } from 'vitest';
import { normalizeCountry, destinationEvidence, countDays, dedupeDays, datesInRange, ruleWindow, evaluateRule, summarizeInstaller, projectBooking, docStatus, reportWindow, type ForeignDay, type ForeignRule } from '@/lib/foreignWork';
import { groupReportRows, exportReportRows, makeReportRows, type ReportRow } from '@/lib/foreignWork/report';
import { defaultFactWindow, factWindowForRules } from '@/lib/foreignWork/data';
import { buildOrdersForSeries, type RecurringSeries } from '@/lib/recurringOrders';

const day = (date: string, extra: Partial<ForeignDay> = {}): ForeignDay => ({installer_id:'i1',country:'FI',day:date,is_work:true,is_presence:true,work_source:'time_entry',presence_source:'work_day',verification:'DERIVED',project_ids:['p1'],conflict:false,...extra});
const rule = (extra: Partial<ForeignRule> = {}): ForeignRule => ({id:'r1',name:'Bevakning',countries:[],metric:'WORK_DAYS',window_type:'CALENDAR_YEAR',window_start:null,window_end:null,watch_threshold:3,review_threshold:5,critical_threshold:8,effective_from:'2020-01-01',effective_to:null,enabled:true,explanation:null,...extra});
const row = (extra: Partial<ReportRow> = {}): ReportRow => ({installerId:'i1',installer:'Samma namn',installerType:'intern',home:'Sverige',country:'FI',work:4,presence:4,confirmedPresence:null,inferredPresence:4,verifiedWork:0,derivedWork:4,period:'2026',first:'2026-03-02',last:'2026-03-05',status:'WATCH',nextThreshold:'5 (Finland)',remaining:1,a1:'NOT_VERIFIED',verification:'DERIVED',orders:'P-1',...extra});

describe('targeted foreign-work stabilization', () => {
  it('C01 all GB aliases normalize to GB',()=>{ for(const x of ['GB','UK','Storbritannien','Storbritannien och Nordirland','United Kingdom','Great Britain']) expect(normalizeCountry(x)).toBe('GB'); });
  it('C02 Swedish/English supported aliases agree',()=>{ for(const pair of [['Sverige','Sweden','SE'],['Norge','Norway','NO'],['Tyskland','Germany','DE'],['Tjeckien','Czech Republic','CZ']]) { expect(normalizeCountry(pair[0])).toBe(pair[2]); expect(normalizeCountry(pair[1])).toBe(pair[2]); } });
  it('C03 unknown destination remains unknown',()=>expect(destinationEvidence('Atlantis','CONFIRMED')).toEqual({code:null,provenance:'UNKNOWN'}));
  it('C04 missing country never defaults to Sweden',()=>expect(normalizeCountry(null)).toBeNull());
  it('C05 valid ISO codes retain identity, invalid codes do not',()=>{for(const c of ['SE','NO','FI','GB','US','JP','ZA']) expect(normalizeCountry(c)).toBe(c); expect(normalizeCountry('ZZ')).toBeNull();});
  it('D01 explicit evidence is confirmed',()=>expect(destinationEvidence('Finland','CONFIRMED')).toEqual({code:'FI',provenance:'CONFIRMED'}));
  it('D02 address evidence stays derived',()=>expect(destinationEvidence('NO','DERIVED').provenance).toBe('DERIVED'));
  it('D03 defaulted Sweden is not verified evidence',()=>expect(destinationEvidence('Sverige','DEFAULTED').provenance).toBe('DEFAULTED'));
  it('D04 recurring occurrences preserve canonical country and provenance',()=>{
    const series: RecurringSeries={id:'s1',name:'TEST',projectType:'installation',weekdays:[1],intervalWeeks:1,seriesStart:'2026-03-02',seriesEnd:'2026-03-02',skipHolidays:false,pauses:[],active:true,countryCode:'FI',countryProvenance:'CONFIRMED'};
    expect(buildOrdersForSeries(series,[])[0]).toMatchObject({country:'Finland',countryCode:'FI',countryProvenance:'CONFIRMED'});
  });
  it('D05 incomplete country never yields NORMAL',()=>expect(summarizeInstaller('i1',[day('2026-03-02',{country:'UNKNOWN',is_work:false,is_presence:false,verification:'INSUFFICIENT_DATA'})],[],{from:'2026-01-01',to:'2026-11-24'},'2026-11-24',true)[0].status).toBe('NOT_VERIFIED'));
  it('E04 five work days plus explicit Sunday-Friday presence is 5/6',()=>{
    const work=datesInRange('2026-03-02','2026-03-06').map(d=>day(d));
    const presence=datesInRange('2026-03-01','2026-03-06').map(d=>day(d,{is_work:false,presence_source:'presence_period',verification:'MANUALLY_CONFIRMED'}));
    expect(countDays([...work,...presence])).toMatchObject({work:5,presence:6,confirmedPresence:6,inferredPresence:0,presenceVerified:true});
  });
  it('E05 absent presence is NOT VERIFIED, not confirmed zero',()=>expect(evaluateRule(rule({metric:'PRESENCE_DAYS'}),'FI',[day('2026-03-02')],'2026-04-01')?.status).toBe('NOT_VERIFIED'));
  it('E06 matching work/manual days count once',()=>expect(countDays([day('2026-03-02'),day('2026-03-02',{presence_source:'presence_period',verification:'MANUALLY_CONFIRMED'})])).toMatchObject({work:1,presence:1,confirmedPresence:1,inferredPresence:0}));
  it('E07 deduplication is deterministic regardless of source order',()=>{
    const a=day('2026-03-02'), b=day('2026-03-02',{project_ids:['p2'],presence_source:'presence_period',verification:'MANUALLY_CONFIRMED'});
    expect(dedupeDays([a,b])).toEqual(dedupeDays([b,a]));
  });
  it('F02 travel-only evidence counts no work or confirmed presence',()=>expect(countDays([day('2026-03-02',{is_work:false,is_presence:false,work_source:'travel_only',presence_source:null,verification:'INSUFFICIENT_DATA'})])).toMatchObject({work:0,confirmedPresence:0,presenceVerified:false}));
  it('F03 unresolved destination is not verified',()=>expect(countDays([day('2026-03-02',{country:'UNKNOWN',is_work:false,is_presence:false,verification:'INSUFFICIENT_DATA'})]).unresolved).toBe(1));
  it('J01 forecast is explicitly projected',()=>expect(projectBooking(rule(),'FI',[],'2026-03-01',{installer_id:'i1',start:'2026-03-02',end:'2026-03-06'})?.projectedOnly).toBe(true));
  it('J02 forecast does not mutate historical facts',()=>{const facts=[day('2026-03-02')]; const before=structuredClone(facts);projectBooking(rule(),'FI',facts,'2026-03-01',{installer_id:'i1',start:'2026-03-02',end:'2026-03-08'});expect(facts).toEqual(before);});
  it('J03 weekend span adds only five projected work days',()=>expect(projectBooking(rule(),'FI',[],'2026-03-01',{installer_id:'i1',start:'2026-03-02',end:'2026-03-08'})?.added).toBe(5));
  it('J04 presence forecast requires explicit presence dates',()=>expect(projectBooking(rule({metric:'PRESENCE_DAYS'}),'FI',[],'2026-03-01',{installer_id:'i1',start:'2026-03-02',end:'2026-03-06'})?.status).toBe('NOT_VERIFIED'));
  it('J05 advisory result has no booking-block side effect',()=>{const booking={installer_id:'i1',start:'2026-03-02',end:'2026-03-06'};projectBooking(rule(),'FI',[],'2026-03-01',booking);expect(booking).toEqual({installer_id:'i1',start:'2026-03-02',end:'2026-03-06'});});
  it('K01 rolling report/rule use identical calendar windows including leap years',()=>{for(const d of ['2026-11-24','2024-02-29','2025-02-28']) expect(reportWindow('rolling','', {from:'',to:''},d)).toEqual(ruleWindow(rule({window_type:'ROLLING_12_MONTHS'}),d));});
  it('K02 calendar year ends at as-of date',()=>expect(ruleWindow(rule(),'2026-11-24')).toEqual({from:'2026-01-01',to:'2026-11-24'}));
  it('K03 future actual facts are excluded from card/report summaries',()=>expect(summarizeInstaller('i1',[day('2026-11-24'),day('2026-11-25')],[],{from:'2026-01-01',to:'2026-12-31'},'2026-11-24',true)[0].counter.work).toBe(1));
  it('K04 loaders do not ask for future historical facts',()=>expect(defaultFactWindow('2026-11-24').to).toBe('2026-11-24'));
  it('K05 continuous interval must be explicit and bounded',()=>{expect(ruleWindow(rule({window_type:'CONTINUOUS_ASSIGNMENT'}),'2026-11-24')).toBeNull();expect(ruleWindow(rule({window_type:'CONTINUOUS_ASSIGNMENT',window_start:'2026-03-01',window_end:'2026-03-31'}),'2026-11-24')).toEqual({from:'2026-03-01',to:'2026-03-31'});});
  it('K06 report and export have identical counters',()=>{const rows=groupReportRows([row(),row({country:'NO',work:2,inferredPresence:2})],'person');const exported=exportReportRows(rows);expect(exported[0]['Arbetsdagar']).toBe(rows[0].work);expect(exported[0]['Härledd vistelse']).toBe(rows[0].inferredPresence);expect(exported[0]['Bekräftad vistelse']).toBe('EJ VERIFIERAD');});
  it('L01 explicit NOT_REQUIRED remains unchanged',()=>expect(docStatus({status:'NOT_REQUIRED',valid_from:'2026-01-01',valid_to:'2026-01-02'},'2026-11-24')).toBe('NOT_REQUIRED'));
  it('L02 dates do not override NOT_VERIFIED',()=>expect(docStatus({status:'NOT_VERIFIED',valid_from:'2026-01-01',valid_to:'2026-12-31'},'2026-11-24')).toBe('NOT_VERIFIED'));
  it('L03 valid verified dates are VALID',()=>expect(docStatus({status:'VALID',valid_from:'2026-01-01',valid_to:'2026-12-31'},'2026-11-24')).toBe('VALID'));
  it('L04 configured expiry window is respected',()=>{const d={status:'VALID' as const,valid_from:'2026-01-01',valid_to:'2026-12-10'};expect(docStatus(d,'2026-11-24',14)).toBe('VALID');expect(docStatus(d,'2026-11-24',20)).toBe('EXPIRING');});
  it('L05 expired verified dates are EXPIRED',()=>expect(docStatus({status:'VALID',valid_from:'2026-01-01',valid_to:'2026-11-23'},'2026-11-24')).toBe('EXPIRED'));
  it('M01 names are not identity keys',()=>expect(groupReportRows([row(),row({installerId:'i2'})],'person')).toHaveLength(2));
  it('M02 grouped status is the highest active status',()=>expect(groupReportRows([row(),row({country:'NO',status:'REACHED'})],'person')[0].status).toBe('REACHED'));
  it('M03 grouped next threshold is chosen by minimum remaining days',()=>expect(groupReportRows([row({remaining:4,nextThreshold:'8 (FI)'}),row({country:'NO',remaining:1,nextThreshold:'5 (NO)'})],'person')[0]).toMatchObject({remaining:1,nextThreshold:'5 (NO)'}));
  it('M04 grouped screen totals equal exported totals',()=>{const screen=groupReportRows([row(),row({installerId:'i2',country:'NO',work:3})],'country');expect(exportReportRows(screen).reduce((n,r)=>n+r['Arbetsdagar'],0)).toBe(7);expect(exportReportRows(screen).reduce((n,r)=>n+r['Arbetsdagar'],0)).toBe(screen.reduce((n,r)=>n+r.work,0));});
  it('M05 filtered rows produce identical exported dataset',()=>{const selected=[row(),row({installerId:'i2',country:'NO'})].filter(r=>r.country==='NO');expect(exportReportRows(selected)).toHaveLength(1);expect(exportReportRows(selected)[0]['Montör-ID']).toBe('i2');});
  it('all rule windows are requested for report/card evaluation',()=>expect(factWindowForRules([rule({window_type:'FIXED_DATE_RANGE',window_start:'2025-06-01',window_end:'2026-05-01'})],{from:'2026-01-01',to:'2026-11-24'},'2026-11-24').from).toBe('2025-06-01'));
  it('missing home-country person remains visible as unverified',()=>expect(makeReportRows([{id:'i1',name:'Person',type:'intern',home_country:null}],[],[],[],{from:'2026-01-01',to:'2026-11-24'},'2026-11-24',x=>x)[0].status).toBe('NOT_VERIFIED'));
});