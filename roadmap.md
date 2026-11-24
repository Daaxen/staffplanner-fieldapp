# Roadmap
- [x] Work order reports page (multi-select, client/internal, exclude checklist, PDF/Excel)
- [x] Planning board: week view = 7 days, weekend highlight, dashed weekend segments, works_weekends switch

## Traktamente & logi
- [x] Inrikes + utlandstraktamente per land (Skatteverket 2026), måltider "vem betalade", nattraktamente, låsning
- [x] Land på work order; visning i Field report
- [ ] Traktamente på sub-vendor-länken
- [x] Traktamente i PDF/Excel-export
- [ ] Traktamente i Tidsöversikt
- [ ] Admin-sida för att uppdatera belopp nästa år
- [x] Work order reports v2: Markera alla, FETCH-PDF-mall, platt Excel, förhandsgranskning, traktamente-val
- [x] Behåll transportval i Skapa uppdrag

## Releasekommunikation
- [x] Rollriktade svenska nyheter, bestående kvitteringar, administration och verifiering

## Utlandsarbete (compliance)
- [x] Hemland, räknare, regler, vistelseperioder, A1-metadata, adminrapport + XLSX, bokningsvarning, montörens egen vy
- [x] Riktad stabilisering: granskning av angiven version, aktiv databas och påverkan; 338 befintliga tester passerar.
- [x] Godkänd evidensuppdelning: 91 arbetsdagar och 91 härledda vistelsedagar bevarade; bekräftad vistelse visas separat, ingen historisk bakåtfyllning.
- [x] 39 nya riktade tester, 33 transaktionsisolerade databasfall och full regression 377/377; adminrapport/export jämförda rad för rad, HR och montörsvy öppnade inloggade.
- [x] Inloggad tidregistrering i ordinarie orderlogg: syntetiska 1,25 h sparade, återlästa i ny sidöppning och exakt en härledd utlandsdag; testpost borttagen.
- [ ] Fullständig A–M-acceptans: väntar på System Owner efter stoppad final-exit-kontroll; inga autonoma rättningar.
- [x] Bekräfta borttagning av föregående tillfälligt auth-konto; inloggningskonto, profil, roller och montör saknas vid ny databaskontroll. Skyddade auditposter behållna.
- [x] Final-exit-kontroll körd och stoppad: 108 roll/API-kontroller passerade, administratörens utökade regeländringskontroll nekades (fältet updated_at saknar läsgrant); ordinarie redigering ej slutverifierad, ingen policy ändrad.
- [x] Slutstädning bekräftad: tillfälliga konto, profil, roller, två montörer, kund, två order, testtid och regel borttagna; audit bevarad, verklig tid och 91 härledda dagar identiska; full regression 377/377.
- [ ] Fortsatt adminredigeringskontroll, fylld dokument-/periodmatris, audit, bokningsvarning och ny report/export-matchning väntar på System Owner efter stoppet.
- [ ] Releasenyhet och publicering hålls tills återstående acceptans passerar; release är NOT READY. Se final-exit-rapporten.
- [ ] Bakåtfyllning av historik – väntar på godkännande (ingen körd; arbetsdagar från tidsposter räknas redan automatiskt)
