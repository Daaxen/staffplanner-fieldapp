# Tydligare mobilapp för montörer

## 1. Menyn flyttas till toppen
- Flikraden (Aktiva jobb, Rapportering, Avvikelser, Avsluta, Mer) flyttas från botten till toppen av skärmen, direkt under rubriken.
- Större text och tydligare markering av vald flik. Svenska namn på alla flikar.
- Inga vyer tas bort i detta steg.

## 2. Lättare att starta ett jobb
- Stor grön knapp **"Starta jobb"** direkt på varje jobbkort i Aktiva jobb och högst upp på ordern, så man inte behöver leta i flikar.
- Knappen startar klockan för idag. När den går visas "Pågår sedan 07:12" och knappen blir **"Stoppa"**.
- Ett jobb som inte går att starta (t.ex. inte idag, eller annan dag än montörens egna dagar) visar en kort förklaring på svenska i stället för ett tekniskt fel.
- Om klockan redan går på ett annat jobb frågas montören om den ska stoppas först.

## 3. Felsökning först
- Innan ändringen i steg 2 tar jag fram vilka fel som visas vid start idag (testa som montör i förhandsvisningen) och åtgärdar orsaken, inte bara texten.

## Tekniskt
- `src/pages/InstallerApp.tsx`: TabsList flyttas överst (ta bort `order-last`, border-b).
- Startknapp återanvänder befintlig timerlogik i `useInstallerLogs` / `ProjectLogTab`; inga nya tabeller.
- Verifiera i mobilvy 390x844 med Playwright: start, stopp, felmeddelande.
