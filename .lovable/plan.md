# Färgkodad montörsvy med högre kontrast

Mockup: montor-farger-mockup.jpg (Files). Layout och knappar behålls – bara färg och kontrast ändras.

## Färgskala (samma betydelse överallt)
- Grön = klart (avslutad order, ifyllt rapportsteg, sparad tid)
- Gul = pågår / påbörjat men ej klart
- Blå = planerad / att göra
- Röd = fel, saknas, avvikelse
- Grå = avbruten eller valfritt

## Var färgen syns
1. **Jobblistan:** tjock färgad vänsterkant på varje kort + färgad statusbricka med ikon (Klar, Pågår, Planerad, Avvikelse, Avbruten).
2. **Ordern:** de sex Rapportera-knapparna får tonad bakgrund, färgad ikon och en statusprick/bock (Klar / Ej klar / Valfritt).
3. **Saknas-ruta:** röd ruta med varningsikon när något obligatoriskt fattas (t.ex. installationsrapport).
4. **Framsteg:** grön förloppsstapel "4 av 5 klara".
5. **Toppmenyn:** mörk marinblå med tydlig ljus markering på aktiv flik.
6. **Tid-fliken / låsta rader:** sparade tider gröna bockar, låst tid grå låsikon, fel i formulär röda.
7. **Text:** mörkare grå för sekundärtext så det syns i solljus.

## Tekniskt
- Nya färgtokens i index.css/tailwind (success, warning, info, danger + "surface"-varianter, ljust och mörkt läge) baserade på befintliga --status-*.
- Liten hjälpare `installerTone(state)` som ger klasser för kant/bricka/bakgrund, återanvänds i InstallerSchedule, InstallerProjectDetail, TechnicianJob, LogsOverview, ProjectLogTab, InstallerApp-flikar.
- Ingen ändring av logik, data eller layout. Test för att statusmappningen (klar→grön, avvikelse→röd osv.) är korrekt.
