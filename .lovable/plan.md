# Uppdraget blir "In progress" när någon loggar tid

## Vad ändras
- Första gången någon sparar arbetstid eller restid på ett uppdrag som är **Planerat** (eller **Ej tilldelat**) byter uppdraget automatiskt status till **In progress** (gult).
- Det gäller oavsett var tiden sparas: teknikerappen, timer, Mina tider, underleverantörslänken eller admin.
- Uppdrag som är **On hold**, **Completed** eller **Cancelled** behåller sin status. En order på paus ska inte öppnas igen bara för att någon loggar tid.
- Statusbytet syns i orderns historik precis som ett manuellt byte, märkt som automatiskt.
- Planeringen och teknikerappen visar den nya färgen direkt när de laddas om eller uppdateras.
- Befintliga uppdrag som redan har tid men fortfarande står som Planerat uppdateras en gång till In progress.

## Tekniska detaljer
- Ny databastrigger `AFTER INSERT ON time_entries` (SECURITY DEFINER): om `project_id` finns och `hours + travel_hours > 0` och projektets status är `scheduled` eller `open`, sätt status till `in-progress`. Från `open` går den via `scheduled`, så de tillåtna statusövergångarna och historiken i `validate_project_status_change` följs utan att reglerna ändras. `app.actor_type` sätts till `system` och `app.actor_name` till "Automatiskt: tid loggad".
- En engångsuppdatering via datafrågeverktyget flyttar dagens Planerat/Ej tilldelat-uppdrag med tid till In progress.
- En regel i AGENTS.md: statusen sätts av triggern i databasen så att alla vägar där tid sparas beter sig likadant.
- Kontroll: logga tid på ett testuppdrag och se att statusen blir In progress och att en rad finns i historiken.
