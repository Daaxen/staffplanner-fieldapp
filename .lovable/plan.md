# Guardian-verifiering av senaste ändringen (färgkodad montörsvy)

Filen du laddade upp är slutet av Guardian-instruktionen (regler, slutomdöme, principen att inte blockera i onödan). Jag tolkar den som: verifiera den senaste ändringen proportionerligt och ge ett slutomdöme. Inget nytt byggs.

## Risknivå: LÅG
Bara färger och text-kontrast har ändrats. Ingen logik, inga data, inga behörigheter, ingen databas. En ändring når utanför montörsappen: den grå hjälptexten blev mörkare i hela systemet.

## Kontroller (proportionerliga)
1. Kör alla automatiska tester och typkontrollen, så att ingenting annat har gått sönder.
2. Logga in som TEST W1 B i telefonvy (390×844) och ta skärmbilder av:
   - jobblistan (färgad kant och statusbricka per status)
   - en order (färgade Rapportera-knappar och röd "saker kvar"-ruta)
   - toppmenyn (aktiv flik syns tydligt)
3. Kontrollera kontrasten: att den gula brickan och texten på mörkblå meny går att läsa.
4. Snabbkoll av admin-vyn (Planning och Orders), så att den mörkare grå texten inte ser fel ut där.
5. Bekräfta att statusreglerna (klar = grön, pågår = gul, planerad = blå, paus = röd, avbruten = grå) har test, och att de går igenom.

## Leverans
- Slutomdöme: VERIFIED / VERIFIED WITH KNOWN ISSUES / NOT VERIFIED / RELEASE BLOCKING.
- Konsekvenser listas tydligt.
- Rekommendationer listas separat under "Ytterligare arbete". De genomförs inte automatiskt, bara om något blockerar.

Kända punkter att bedöma:
- Rapportera-knapparnas färger visar vilken typ av rapport det är (Tid grön, Avvikelse röd). De visar inte om rapporten är gjord, utom "Rapport & signering".
- "On hold" visas som röd (problem).
