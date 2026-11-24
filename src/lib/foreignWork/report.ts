import { countDays, summarizeInstaller, docStatus, STATUS_RANK, STATUS_LABEL, DOC_STATUS_LABEL, VERIFICATION_LABEL, countryName, type ForeignDay, type ForeignRule, type FlagStatus, type DocStatus, type Verification } from './index';
import { docForCountry, type ForeignDoc } from './data';

export interface ReportRow {
  installerId: string; installer: string; installerType: string; home: string; country: string; work: number; presence: number;
  confirmedPresence: number | null; inferredPresence: number; verifiedWork: number; derivedWork: number;
  period: string; first: string; last: string; status: FlagStatus; nextThreshold: string; remaining: number | null; a1: DocStatus; verification: Verification; orders: string;
}
export function makeReportRows(installers: {id: string; name: string; type: string; home_country: string | null}[], days: ForeignDay[], rules: ForeignRule[], docs: ForeignDoc[], period: {from: string; to: string}, asOf: string, projectName: (id: string) => string): ReportRow[] {
  return installers.flatMap(i => {
    const summaries = summarizeInstaller(i.id, days, rules, period, asOf, !!i.home_country);
    if (!summaries.length && !i.home_country) summaries.push({country: 'UNKNOWN',counter: countDays([]),flags: [],status: 'NOT_VERIFIED',next: null});
    return summaries.map(s => ({ installerId: i.id, installer: i.name, installerType: i.type, home: i.home_country ? countryName(i.home_country) : 'Ej angivet', country: s.country,
      work: s.counter.work, presence: s.counter.presence, confirmedPresence: s.counter.presenceVerified ? s.counter.confirmedPresence : null, inferredPresence: s.counter.inferredPresence,
      verifiedWork: s.counter.verifiedWork, derivedWork: s.counter.derivedWork, period: `${period.from} – ${period.to}`,first: s.counter.first ?? '',last: s.counter.last ?? '',status: s.status,
      nextThreshold: s.next ? `${s.next.nextThreshold} (${s.next.rule.name}, ${countryName(s.country)})` : '',remaining: s.next?.remaining ?? null,
      a1: docStatus(docForCountry(docs,i.id,s.country),asOf),verification: s.counter.verification,orders: s.counter.projectIds.map(projectName).sort().join(', '),
    }));
  });
}
const docRank: Record<DocStatus,number> = {NOT_REQUIRED:0,VALID:1,EXPIRING:2,NOT_VERIFIED:3,MISSING:4,EXPIRED:5};
const verRank: Record<Verification,number> = {VERIFIED:0,MANUALLY_CONFIRMED:1,DERIVED:2,INSUFFICIENT_DATA:3,VOIDED:4};
export function groupReportRows(rows: ReportRow[], group: 'both' | 'person' | 'country'): ReportRow[] {
  if (group === 'both') return rows;
  const map = new Map<string, ReportRow[]>();
  for (const r of rows) { const k = group === 'person' ? r.installerId : r.country; map.set(k,[...(map.get(k) ?? []),r]); }
  return [...map.values()].map(items => {
    const base = items[0];
    const next = items.filter(r => r.remaining != null).sort((a,b)=>(a.remaining ?? Infinity)-(b.remaining ?? Infinity))[0];
    return {...base,installerId: group === 'person' ? base.installerId : '',installer: group === 'person' ? base.installer : '—',country:group==='country'?base.country:'—',
      installerType: [...new Set(items.map(r=>r.installerType))].join(', '),home:[...new Set(items.map(r=>r.home))].join(', '),
      work:items.reduce((n,r)=>n+r.work,0),presence:items.reduce((n,r)=>n+r.presence,0),inferredPresence:items.reduce((n,r)=>n+r.inferredPresence,0),
      verifiedWork:items.reduce((n,r)=>n+r.verifiedWork,0),derivedWork:items.reduce((n,r)=>n+r.derivedWork,0),
      confirmedPresence:items.every(r=>r.confirmedPresence!=null)?items.reduce((n,r)=>n+(r.confirmedPresence ?? 0),0):null,
      first:items.map(r=>r.first).filter(Boolean).sort()[0] ?? '',last:items.map(r=>r.last).filter(Boolean).sort().pop() ?? '',
      status:items.reduce<FlagStatus>((s,r)=>STATUS_RANK[r.status]>STATUS_RANK[s]?r.status:s,'NORMAL'),
      nextThreshold:next?.nextThreshold ?? '',remaining:next?.remaining ?? null,
      a1:items.reduce<DocStatus>((s,r)=>docRank[r.a1]>docRank[s]?r.a1:s,'NOT_REQUIRED'),
      verification:items.reduce<Verification>((s,r)=>verRank[r.verification]>verRank[s]?r.verification:s,'VERIFIED'),
      orders:[...new Set(items.map(r=>r.orders).filter(Boolean))].sort().join('; '),
    };
  });
}
export function exportReportRows(rows: ReportRow[]) {
  return rows.map(r=>({'Montör-ID':r.installerId,'Montör':r.installer,'Typ':r.installerType,'Hemland':r.home,'Destinationsland':r.country==='—'?'—':countryName(r.country),'Landskod':r.country,
    'Arbetsdagar':r.work,'Verifierade arbetsdagar':r.verifiedWork,'Härledda arbetsdagar':r.derivedWork,'Bekräftad vistelse':r.confirmedPresence ?? 'EJ VERIFIERAD','Härledd vistelse':r.inferredPresence,
    'Mätperiod':r.period,'Första datum':r.first,'Senaste datum':r.last,'Ordrar':r.orders,'Status':STATUS_LABEL[r.status],'Nästa gräns':r.nextThreshold,'Dagar kvar':r.remaining ?? '',
    'A1':DOC_STATUS_LABEL[r.a1],'Verifiering':VERIFICATION_LABEL[r.verification]}));
}