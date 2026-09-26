# Enklare tidsredovisning i montörsappen

## Vad ändras (på orderns flik för tid/kostnader)

1. **Välj dag med ett tryck**
   - Överst visas en rad med dagknappar för orderns dagar (t.ex. "Ons 23", "Tor 24", "Fre 25"), idag förvald.
   - Knappen "Annan dag" öppnar datumväljaren för dagar utanför ordern.
   - Under dagraden syns vad som redan är redovisat den dagen (t.ex. "6,5 h + 1 h restid").

2. **Start/stopp-klockan gäller per dag**
   - Check in/out knyts till vald dag och visar "Incheckad sedan 07:12 idag".
   - Glöms utcheckning och klockan passerar midnatt stoppas den automatiskt vid dagens slut (23:59), så varje dag blir en egen tidrad. Montören får en påminnelse att kontrollera sluttiden.
   - Klockan kan bara startas på dagens datum; för andra dagar används manuell inmatning.

3. **Förenklad manuell inmatning**
   - Fält: Start, Slut, Timmar (fylls i automatiskt från tiderna, kan ändras), Restid, Anteckning.
   - Svenska etiketter genomgående.

4. **Restid i timmar**
   - "Restid (timmar)" med steg 0,25 och snabbknappar 0,5 / 1 / 1,5 / 2 h — både vid manuell inmatning och vid utcheckning.
   - Komma och punkt accepteras som decimaltecken.

## Preview
Efter godkännande byggs ändringen och jag delar länken till förhandsvisningen (mobilvyn), samt publicerar om du vill testa i telefonen.

## Tekniska detaljer
- Endast `src/components/installer/reporting/ProjectLogTab.tsx` (+ ev. liten hjälpfunktion i timer-logiken i `useWorkLogs`/motsv.) ändras.
- `minutesToHours` ersätts av `parseHours` (decimal, komma/punkt, 0–12 h enligt befintlig CHECK).
- Dagknappar genereras från orderns startDate–endDate (max 14 dagar, annars bara datumväljare).
- Timer: vid stopp, om startdatum ≠ idag, sparas raden på startdatumet med sluttid 23:59.
- Inga databasändringar; befintliga `time_entries` och validering återanvänds.
