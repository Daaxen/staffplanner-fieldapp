# Superuser – växla vy och titta som en montör

## Mål
En ny, högre roll **Superuser** med tillgång till allt. En superuser kan växla mellan admin-vy och montörsvy, och i montörsvyn välja vilken montör hen ser appen som – bara för att titta.

## Vad som byggs
1. **Rollen Superuser**
   - Finns bredvid Admin, Installer och HR och kan kombineras med dem.
   - Superuser har alltid allt admin och HR har.
   - Du (Daniel) blir superuser först. Därefter kan bara en superuser göra andra till superuser eller ta bort rollen. Vanliga admins kan inte det.
   - Den sista superusern kan inte tas bort, så ingen låser ute sig.
   - I Användare (Users) visas en fjärde knapp "Superuser" som bara superusers ser.

2. **Vyväxlare** (överst i menyn och i mobilappen under More)
   - "Admin-vy" eller "Montörsvy".
   - I montörsvyn finns en lista "Visa som": din egen montörsprofil eller valfri montör.

3. **Titta som en montör (bara läsläge)**
   - Mobilappen visar exakt den montörens ordrar, dagar, schema, påminnelser, dokument och tid.
   - En tydlig gul list överst: "Du tittar som Thea – endast läsläge" med knappen "Avsluta".
   - Allt som sparar är avstängt: start/stopp av klocka, tid, utlägg, mil, rapporter, signaturer, foton, avvikelser och att plocka upp ordrar.
   - Varje gång någon börjar titta som en montör loggas det i revisionsloggen (vem, vilken montör, när).

## Säkerhet
- Rollen ligger i rolltabellen som de andra rollerna och kontrolleras i databasen, aldrig bara i webbläsaren.
- Läsläget säkras även i databasen: en superuser kan inte skriva tid eller rapporter på en annan montör, även om knapparna skulle gå runt.

## Tester
- Bara en superuser kan tilldela eller ta bort superuser. En admin får nej.
- Den sista superusern går inte att ta bort.
- I läsläget går det inte att spara något åt en annan montör.

## Teknisk sektion
- Migration: `ALTER TYPE app_role ADD VALUE 'superuser'`. Daniels konto får rollen. `has_role(uid,'admin')` och `has_hr_access` returnerar true även för superuser, så alla befintliga regler gäller direkt. `admin_set_user_role` kräver superuser när rollen är 'superuser' och stoppar borttagning av den sista. Edge function `admin-invite-user` får samma regel. Ny RPC `log_view_as(_installer_id)` skriver till audit_log.
- Läsläge per montör: superuser får läsrätt till alla montörers rader (redan via admin). Skrivregler för time/expense/mileage/field_reports/deviations är oförändrade: de kräver `current_installer_id()` eller en admin-väg, och appen skickar aldrig skrivningar i läsläge.
- `useAuth`: `isSuperuser`. Ny kontext `ViewAsProvider` med `viewMode` ('admin'|'installer') och `viewAsInstallerId` i sessionStorage. `useCurrentInstaller` returnerar vald montör plus `readOnly`. Komponenter i montörsappen döljer eller inaktiverar sparknappar när `readOnly`, och `useInstallerLogs`/`useFieldWork` avvisar skrivning i läsläge.
- `navigation.ts`/`AppSidebar`: vyväxlaren. `Index.tsx`: superuser i montörsvy hamnar på /installer.
- Tester i `src/test/superuser.test.ts` (migration-SQL + hjälpfunktioner för läsläge).
