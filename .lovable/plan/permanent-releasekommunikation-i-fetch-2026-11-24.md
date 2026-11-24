# Permanent releasekommunikation i FETCH

## Status

**REDO FÖR GODKÄNNANDE – INGEN IMPLEMENTATION ÄNNU.**

Den uppladdade regeln är sparad som en permanent projektregel. Detta förslag inför releasekommunikation som en separat funktion och ändrar inte befintliga arbetsflöden, behörigheter eller affärslogik.

## Mål och minimalt användarflöde

- Vid inloggning eller när appen öppnas hämtas aktiva nyheter som passar användarens roll och som ännu inte kvitterats.
- En nyhet visas i taget med titel, kort förklaring, **Vad betyder detta för dig?**, **Hur fungerar det?**, versions-/releasedatum, nivå och knappen **Jag förstår**.
- Knappen sparar kvitteringen i databasen för aktuell användare och nyhet. Samma nyhet visas inte igen efter lyckad kvittering, heller inte på annan enhet eller i annan session.
- Fel vid hämtning stoppar inte användningen av FETCH. Om kvitteringen inte kan sparas markeras nyheten inte som läst; användaren kan försöka igen eller stänga tillfälligt och få nyheten vid nästa öppning.
- Ingen kvittering bygger på localStorage. Offline visar inga nya nyheter och skapar ingen lokal lästmarkering.

## Målgrupper och nivåer

Första versionen använder befintliga roller: **alla med personalroll**, **montörer**, **administratörer**, **HR** och **superuser**. Planerare, projektledare och ekonomi nås genom administratörsrollen; inga nya behörighetsroller införs.

Nivåerna blir **Info**, **Viktigt** och **Åtgärd krävs**, med tydlig men återhållsam visuell markering i befintligt FETCH-formspråk.

## Administration

En ny administratörsvy **Nyheter** under Administration ska kunna:

- skapa och redigera utkast med alla obligatoriska svenska texter
- välja målgrupper, nivå, version, releasedatum och valfritt slutdatum
- förhandsgranska exakt den ruta användarna får
- publicera och stänga av nyheter
- se antal kvitteringar och vilka användare som kvitterat
- behålla historik; borttagning ersätts av avaktivering

Endast administratörer kan hantera nyheter. Superuser behåller sitt befintliga adminarv.

## Permanent releasegrind

Vid varje framtida ändring klassificeras den först som användarsynlig eller tyst teknisk. För användarsynliga ändringar skapas en relevant svensk nyhet innan releasen kan kallas klar. Slutrapporten ska alltid innehålla:

- USER-VISIBLE CHANGE: YES / NO
- RELEASE ANNOUNCEMENT REQUIRED: YES / NO
- TARGET AUDIENCE
- ANNOUNCEMENT SEVERITY
- ANNOUNCEMENT CREATED: YES / NO
- ACKNOWLEDGEMENT TRACKING: VERIFIED / NOT VERIFIED

Implementationen av den här funktionen är själv användarsynlig. Dess första nyhet ska därför riktas till **alla med personalroll**, nivå **Info**, och kort förklara att nyheter i FETCH numera visas vid inloggning och kvitteras med **Jag förstår**.

## Teknisk implementation

### Nya databastabeller

**`public.release_announcements`**
- identitet, unik version och releasedatum
- titel, kort förklaring, användarnyttan och hur funktionen används
- nivå: `info`, `important`, `action_required`
- `target_roles public.app_role[]`; tom lista betyder alla med personalroll
- aktiv status, publiceringstid och valfri stopptid
- skapad av samt skapad/ändrad-tid

**`public.release_announcement_acknowledgements`**
- nyhets-ID och användar-ID, unika tillsammans
- kvitteringstid

Kvitteringar får inte ändras eller tas bort via appen. Nyheter raderas inte via appen, så historik och kvitteringar bevaras.

### Grants och RLS

- Inga `anon`-rättigheter.
- Personal läser endast aktiva, publicerade, inte utgångna nyheter för någon av sina roller. Konton utan personalroll får inga nyheter.
- Administratörer läser alla nyheter samt skapar och ändrar dem via `public.has_role(auth.uid(), 'admin')`.
- Användare läser och skapar endast egna kvitteringar, och endast för en nyhet de får läsa.
- Administratörer läser alla kvitteringar för uppföljning.
- Inga vanliga update/delete-policyer på kvitteringar och ingen delete-policy på nyheter.
- Varje ny tabell får uttryckliga grants till `authenticated` och `service_role` i samma migration.

### Gränssnitt och berörda filer

Nya filer:
- `src/components/releases/ReleaseAnnouncementGate.tsx` – gemensam modal/kö
- `src/components/releases/ReleaseAnnouncementsManager.tsx` – administration och förhandsgranskning
- `src/hooks/useReleaseAnnouncements.ts` – hämtning och kvittering
- `src/lib/releaseAnnouncements.ts` – typer, rollmålning och aktiva-periodregler
- `src/test/releaseAnnouncements.test.ts` – regeltester

Små tillägg:
- `src/App.tsx` – montera nyhetsvisningen en gång för inloggade personalanvändare, utanför enskilda arbetsordrar och formulär
- `src/pages/Index.tsx` – visa administrationsvyn
- `src/lib/navigation.ts` – adminlänken Nyheter
- `src/components/admin/AuditTimeline.tsx` – svenska etiketter för nyhetshändelser
- `src/integrations/supabase/types.ts` – endast automatiskt genererad uppdatering

Befintlig `public.audit_row_change()` återanvänds för spårbara skapanden/ändringar av nyheter. Kvitteringsraderna är själva kvittospåret. Ingen ny auth-lösning eller backend-server behövs.

## Verifiering

1. Enhetstesta målgrupper, flera roller, superuser-arv, aktiva datum och att redan kvitterade nyheter inte väljs.
2. Testa databasregler direkt: anonym och rollös användare blockeras; montör ser bara alla/montör; HR ser bara alla/HR; admin kan hantera; ingen kan läsa eller ändra andras kvitteringar.
3. Skapa och publicera en TEST-nyhet som administratör och kontrollera att andra målgrupper inte ser den.
4. Verifiera i både kontors- och montörsvy att rutan har rätt svenska delar och att **Jag förstår** sparar.
5. Logga in med samma konto i en ny webbläsarkontext och bekräfta att nyheten inte visas igen. Bekräfta även efter omladdning.
6. Kontrollera att avaktivering stoppar visning men behåller historik och kvittering.
7. Röktesta inloggning, planering, montörsapp och tidrapportering samt kör befintliga tester och byggkontroll.
8. Rensa allt TEST-material efter kontrollen; behåll endast avsedda produktionsnyheter och deras verkliga kvitteringar.

## Regressionrisker och skydd

- **Blockerande ruta:** låg risk; hämtningsfel får inte blockera appen och misslyckad kvittering får inte bli en falsk lästmarkering.
- **Fel målgrupp:** låg risk; rollurval säkerställs i databasen, inte bara i gränssnittet.
- **Dubbla rutor:** låg risk; en enda gemensam kö monteras i appen.
- **Påverkan på arbete/data:** ingen förändring av order-, planerings-, tid-, kvittons-, löne- eller kundlogik.
- **Säkerhetsarbete:** inga befintliga policyer, security findings, auth-flöden eller auditregler ändras.

## Godkännandepunkt

Efter godkännande implementeras ovanstående som en separat ändring. Innan dess skapas inga tabeller, policyer, skärmar eller produktionsnyheter.
