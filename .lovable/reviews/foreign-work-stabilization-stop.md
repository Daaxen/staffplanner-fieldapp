# FETCH – stopp inför riktad stabilisering

Granskning: 24 november 2026. Granskad version: `6deee1c70940da6c16bd97da032d88818fa7cc30`.

## Beslut som behövs

Underlagets stoppvillkor har utlösts: en korrigering av vistelseräkningen förändrar historiska rapporter materiellt. Inga rättningar har därför utförts i appen, databasen eller behörigheterna. Inga tidsposter, historiska orderstatusar eller skyddade loggar har ändrats.

**Föreslagen fortsättning:** behåll de 91 dagarna som uttryckligen **härledd vistelse**, separera dem från **bekräftad vistelse**, och visa bekräftad vistelse som **EJ VERIFIERAD** när underlag saknas. Behåll de 91 arbetsdagarna. Frys länder och deras ursprung för ny verifierad evidens med en liten tilläggsändring, utan att bakåtfylla befintlig historik. Historiska rättningar ska vara uttryckliga, avgränsade och auditerade.

Ett godkännande av denna fortsättning innebär inte godkännande att ändra faktiska tidsposter eller bakåtfylla äldre vistelser. Alla andra stoppvillkor fortsätter gälla.

## Påverkansanalys – endast läsning

Period: **2026-01-01–2026-11-24**, verkliga montörer och verkliga order. Beräkningen är en läsande konsekvensanalys av tidsposter och nuvarande länder; den är inte en körning av rapporten med inloggad användare.

| Montör | Land | Arbetsdagar, oförändrat | Vistelsedagar enligt nuvarande regel | Föreslagen bekräftad vistelse | Härledd vistelse som behålls |
|---|---|---:|---:|---|---:|
| Thea Palmér | Finland | 8 | 8 | EJ VERIFIERAD | 8 |
| Felix Örneklint | Finland | 13 | 13 | EJ VERIFIERAD | 13 |
| Dennis | Norge | 16 | 16 | EJ VERIFIERAD | 16 |
| Stella Kolgjini | Norge | 18 | 18 | EJ VERIFIERAD | 18 |
| Martin Olsson | Norge | 19 | 19 | EJ VERIFIERAD | 19 |
| Teddy | Finland | 17 | 17 | EJ VERIFIERAD | 17 |
| **Totalt: 6 montörer** | **2 länder** | **91** | **91** | **EJ VERIFIERAD** | **91** |

Det finns **inga aktiva manuella arbets-/vistelseperioder**, **inga bevakningsregler** och **inga compliance-dokumentposter** i den granskade databasen. Ingen bekräftad vistelseevidens hittades. Detta betyder inte att personerna hade noll faktisk vistelse utomlands.

**Orsak till skillnaden:** den aktiva funktionen sätter `is_presence = true` för varje arbetsdag, även utan rese- eller vistelseunderlag. En enda gemensam verifieringsetikett kan dessutom inte skilja arbetsbevis från vistelsebevis.

Ytterligare datafråga: **167 positiva arbetstidsposter utan orderkoppling** finns för verkliga montörer. Den nuvarande funktionen utesluter dem genom sin orderkoppling. De får inte automatiskt räknas som utländska eller svenska. Inga framtida positiva arbetstidsposter eller rese-only-poster hittades i samma läsande inventering.

## Bekräftat i den aktiva databasen

- Den kanoniska orderstatusen är `completed`. Funktionen jämför med `Completed`, vilket inte matchar. Ingen av de 91 analyserade utlandsdagarna hörde till en slutförd order, så statusrättningen har ingen identifierad effekt på just denna delmängd.
- Den aktiva landsfunktionen känner igen `Storbritannien` men saknar det svenska visningsnamnet `Storbritannien och Nordirland` som används av landväljaren. Ingen ändring av normaliseringen är gjord.
- Klassificeringen läser aktuella `projects.country` och `installers.home_country`; det saknas frysta landuppgifter i dessa härledda fakta.
- `projects.country` har databasstandardvärdet `Sverige`. Ingen kolumn för bekräftat/härlett/standardvärde finns i destinationens landsfält.
- RLS är aktiverat på samtliga tre skyddade utlandstabeller. Funktionen är `SECURITY DEFINER`, har `search_path=public`, och ger exekveringsrätt till autentiserade, inte anonyma. Dess rollkontroller granskades men testades inte med tillfälliga konton.
- HR får läsa perioder, regler och dokumentmetadata, men inte skriva dem. Vyn visar ändå redigeringskontroller. Montörlistans policy ger inte HR en sammanhängande fullständig företagslista; inga extra personalbehörigheter har tilldelats.
- Regeltabellen ger montörer radläsning inklusive `internal_note`, och laddaren använder `select('*')`. Ingen skyddsrättning är gjord; ett direkt API-test återstår.
- Aktiva auditeringstriggers för perioder och dokument saknar bl.a. ändringar av montörkoppling och anteckningar i sina fältlistor. Ingen ny exportauditering är införd.

## Versions- och databasläge

Drizzle är den aktuella vägen för nya databasändringar. Verktygets läsande historikkontroll gav **inga historikavvikelser** och visar ändringarna `0019_foreign_work_compliance` och `0020_set_installer_home_country_rpc`. Äldre databasändringar finns också i den tidigare historiken. Inga dubbla utlandsdefinitioner hittades i den äldre migrationskatalogen. De aktiva definitionerna för landsfunktion, dagfunktion, relevanta policies och utlandstriggers lästes direkt från databasen; versionsfiler användes inte som enda belägg. Ingen ny migration skapades.

## Om en bakåtfyllning senare övervägs

CANDIDATE RECORDS: 91 härledda person/land/dag-fakta i den granskade perioden; antal bakomliggande rader för en konkret bakåtfyllning måste först inventeras separat.

ASSUMPTIONS: Nuvarande hemland och orderland är masterdata, inte bevis på hur historiska länder fastställdes. Avslutad order är inte i sig ett tidsgodkännande.

AMBIGUOUS RECORDS: Alla 91 dagars fullständiga vistelseunderlag saknas; 167 orderlösa arbetstidsposter saknar destinationskoppling. Dessa grupper är olika och ska inte summeras som en gemensam faktamängd.

REVERSIBILITY: Föreslagen fortsättning behåller befintliga tidsposter och härledda fakta; inga äldre fakta omklassas till bekräftade genom automatisk bakåtfyllning.

AUDIT METHOD: Ny verifiering och uttryckliga rättningar ska loggas med före/efter, skäl och koppling till berörd evidens. Befintliga skyddade loggar lämnas orörda. Exakt modell återstår att implementera och testa efter godkännande.

## Testutfall före stoppet

- Befintlig full regressionssvit kördes: **338 PASS / 0 FAIL**, 53 testfiler, inklusive samtliga **22 befintliga utlandstester**.
- Nya målriktade tester A–M har inte körts: **75 NOT VERIFIED**. Befintliga tester täcker inte alla riskerna i underlaget och är inte bevis för att dessa är åtgärdade.
- Databaskataloger och verkliga data lästes; detta ersätter inte SQL/RLS-sviter med inloggade konton.
- Inga tillfälliga användare eller syntetiska data skapades. Därför fanns ingenting att radera och inga nya skyddade auditposter att behålla.
- Inloggad UI-, export- och direkt-API-verifiering återstår och är **NOT VERIFIED**.

## Required final report

FETCH FOREIGN WORK STABILIZATION:
NOT VERIFIED

REVIEWED COMMIT:
6deee1c70940da6c16bd97da032d88818fa7cc30

COMPLETION STATUS FIX:
NOT VERIFIED

COUNTRY NORMALIZATION:
NOT VERIFIED

HISTORICAL COUNTRY STABILITY:
NOT VERIFIED

WORK-DAY PROVENANCE:
NOT VERIFIED

PRESENCE-DAY PROVENANCE:
FAIL

HR/RLS CONSISTENCY:
NOT VERIFIED

INTERNAL NOTE PROTECTION:
NOT VERIFIED

AUDIT COVERAGE:
NOT VERIFIED

FORECAST/HISTORY SEPARATION:
NOT VERIFIED

WINDOW CONSISTENCY:
NOT VERIFIED

DOCUMENT STATUS:
NOT VERIFIED

REPORT GROUPING:
NOT VERIFIED

EXPORT:
NOT VERIFIED

MIGRATION STATE:
NOT VERIFIED

NEW TARGETED TESTS:
0 PASS / 0 FAIL / 75 NOT VERIFIED

FULL REGRESSION:
338 PASS / 0 FAIL

SQL/RLS SUITES:
0 PASS / 0 FAIL / 8 NOT VERIFIED

AUTHENTICATED UI TESTS:
0 PASS / 0 FAIL / 3 NOT VERIFIED

ANONYMOUS ACCESS:
NOT VERIFIED

ROLELESS ACCESS:
NOT VERIFIED

INSTALLER ACCESS:
NOT VERIFIED

HR ACCESS:
NOT VERIFIED

ADMIN ACCESS:
NOT VERIFIED

TEMP TEST USERS REMOVED:
NOT APPLICABLE

SYNTHETIC DATA REMOVED:
NOT APPLICABLE

PROTECTED AUDIT RECORDS RETAINED:
0 nya; samtliga befintliga lämnades orörda (befintligt totalantal ej inventerat)

TIME REPORTING:
UNCHANGED

TIME APPROVAL:
UNCHANGED

SCHEDULING:
UNCHANGED EXCEPT APPROVED ADVISORY WARNING

COMPLETED-ORDER LOCKING:
UNCHANGED

LIVE COUNTER RECALCULATION REQUIRED:
YES

PRODUCTION BACKFILL PERFORMED:
NO

KNOWN LIMITATIONS:
- FAIL avser vistelseräknarens nuvarande evidensmodell, bekräftad av aktiv funktionsdefinition och läsande konsekvensanalys; inget inloggat funktionstest kördes.
- NOT VERIFIED betyder att rättning eller föreskriven liveverifiering inte har utförts, inte att nuvarande implementation är säker.
- De 8 ej körda SQL/RLS-kontrollerna avser DB01–DB08 som sammanhängande verifieringssvit; kataloginspektionen ovan är separat.
- De 3 ej körda UI-kontrollerna avser montörens egen vy, HR-rapport och adminrapport/export; ytterligare scenarier kan behövas efter rättning.
- Oförändrade tid-, godkännande-, boknings- och låsningsflöden avser att inga sådana ändringar gjorts i denna granskning. Inga nya liveflödestester kördes.
- Inga nya rättningar har släppts; ingen releasenyhet skapades eller behövdes för denna läsande granskning.

BLOCKERS:
- Underlagets stoppvillkor: historiska vistelseräknare ändras materiellt. Systemägarens godkännande krävs innan rättningar fortsätter.

RELEASE STATUS:
NOT READY