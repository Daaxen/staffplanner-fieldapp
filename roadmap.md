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
- [ ] Slutför A–M-acceptans och inloggad tidregistrering med tillgängliga syntetiska uppgifter; det syntetiska kundvalet filtrerades bort, ingen tidsrad sparades.
- [ ] Bekräfta borttagning av tillfälligt auth-konto; roller, montör, kund och regel är borttagna, nio skyddade auditposter behållna. Kontoborttagning väntar på plattformens avslutningsstädning.
- [ ] Releasenyhet och publicering hålls tills acceptans och kontostädning verifierats; release är NOT READY. Se slutrapporten för begränsningar.
- [ ] Bakåtfyllning av historik – väntar på godkännande (ingen körd; arbetsdagar från tidsposter räknas redan automatiskt)
