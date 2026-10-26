# Foton rekommenderas, men krävs inte för att avsluta en order

## Hur det fungerar för montören
- Foton blockerar inte längre "Avsluta jobb" eller sign-off.
- Saknas foton visas en gul rekommendation, inte ett rött stopp: "Foton rekommenderas (0/2)".
- Trycker montören på Avsluta utan foton öppnas en ruta: **"Inga foton tillagda"** med knapparna **"Lägg till foton"** (öppnar fotodelen) och **"Avsluta utan foton"**.
- Valet att hoppa över måste göras aktivt. Det sparas på ordern, med tid och namn, och visas för admin på ordern som "Avslutad utan foton".
- Gäller både vanliga ordervyn och teknikerläget i mobilappen. Checklista, sign-off och rapport krävs fortfarande som idag.

## Teknisk del
- `completionRequirements.ts`: krav-typen får `severity: 'required' | 'recommended'`. Foton blir `recommended`. `missingRequirements`/`canComplete` räknar bara `required`. Ny `missingRecommendations()`.
- `FieldWork` får `photosSkipped?: { at: string; by?: string }`, sparas offline och synkas med fältrapporten (i befintlig rapportrad, ingen ny tabell; lagras i `sign_offs`-JSON under nyckeln `_photosSkipped` om ingen kolumn finns).
- `TechnicianJob.tsx` och `InstallerProjectDetail.tsx`: rekommendationschips i gult, bekräftelsedialog före avslut när foton saknas och inte redan hoppats över.
- Adminsidan (orderpanelen) visar markeringen när den finns.
- Tester i `src/test/fieldReportPersistence.test.ts`: order utan foton men med allt annat klart kan avslutas; foto saknas listas som rekommendation; checklista/signatur/rapport krävs fortfarande.
