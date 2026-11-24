# FETCH Foreign Work – final exit verification

Kontrolldatum: 24 november 2026, 21:59 UTC. Endast verifiering; ingen appkod, behörighet, policy, autentiseringsarkitektur eller historik ändrades.

## Slutrapport

| Kontroll | Resultat |
|---|---|
| FETCH FOREIGN WORK FINAL EXIT | **FAIL** — kontrollen stoppad; inte ett konstaterande att ordinarie regelredigering är trasig |
| VERIFIED COMMIT | `ed12b80` — den appversion som kontrollerades; denna rapport ändrar inte appen |
| TARGETED TESTS | 39 PASS / 0 FAIL / 0 NOT VERIFIED — befintlig riktad testsamling, inte samtliga acceptanskrav |
| FULL REGRESSION | 377 PASS / 0 FAIL — 54 testfiler, omkörda efter slutstädning |
| SQL/RLS | 108 PASS / 1 FAIL / 12 NOT VERIFIED — antal avgränsade kontroller enligt nedan |
| AUTHENTICATED UI | 1 PASS / 0 FAIL / 7 NOT VERIFIED |
| ANONYMOUS | BLOCKED |
| ROLELESS | BLOCKED |
| INSTALLER | NOT VERIFIED — egen åtkomst och spärrade administrativa vägar passerade; fylld dokument-/periodmatris återstår |
| HR | NOT VERIFIED — rapportdata och export tillåts, obehöriga skapanden/rättningar spärras; hela fyllda matrisen återstår |
| ADMIN | FAIL — utökad regeländringskontroll nekades; ordinarie redigeringsflöde inte slutverifierat |
| INTERNAL_NOTE PROTECTION | NOT VERIFIED — innehållskontroll av direkta anrop PASS; normal montörsvy återstår |
| TIME REPORTING REGRESSION | PASS — 1,25 h sparade i ordinarie orderlogg och återlästa efter omladdning/ny sidöppning; exakt en härledd norsk arbets-/vistelsedag |
| TIME APPROVAL | UNCHANGED — ingen godkännandefunktion eller godkänd tid ändrades; härledd dag görs inte till tidgodkännande |
| COMPLETED-ORDER LOCKING | NOT VERIFIED — kod och aktiva triggerdefinitioner oförändrade; live låsningskontroll avbröts före utförande |
| AUDIT COVERAGE | NOT VERIFIED — befintliga spärrar mot ändring passerade, hela korrigeringskedjan återstår |
| FORECAST/HISTORY SEPARATION | NOT VERIFIED — en framtida syntetisk order skapades utan ändring av verkliga dagfakta; hela bokningsflödet avbröts |
| DOCUMENT STATUS FLOW | NOT VERIFIED |
| REPORT | NOT VERIFIED — ingen ny slutlig UI-kontroll efter städning |
| EXPORT | NOT VERIFIED — exportbehörighet passerade, ny innehållsmatchning mot rapporten återstår |
| 91 DERIVED HISTORICAL DAYS | PRESERVED — samtliga verkliga dagfakta jämförda före/efter och identiska; 91 arbetsdagar och 91 härledda vistelsedagar |
| CONFIRMED PRESENCE | SEPARATE — ingen bekräftad period finns; härledd vistelse har inte blivit bekräftad vistelse |
| LIVE COUNTER RECALCULATION REQUIRED | NO — inget behov visades för den bevarade 91-dagarsuppdelningen |
| PRODUCTION BACKFILL | NO |
| TEMP TEST USERS REMOVED | YES — tidigare och aktuellt testkonto saknas i Auth; aktuella profil/roller också borttagna |
| SYNTHETIC MUTABLE DATA REMOVED | YES — kontrollerade noll kvarvarande montörer, tid, uppdrag, kund, order, regel, perioder och dokument för detta test |
| PROTECTED AUDIT RECORDS RETAINED | 21 från denna slutkontroll; äldre skyddad historik också orörd |
| REAL HISTORICAL TIME MODIFIED | NO — 358 verkliga tidsposter, identiskt fullständigt radfingeravtryck före/efter: `9aaac80ee5108362ea1ada2e041cb58a` |
| RELEASE ANNOUNCEMENT | NOT CREATED — samtliga releasekrav har inte passerat |
| ACKNOWLEDGEMENT TRACKING | NOT VERIFIED för denna release; testanvändaren kvitterade en befintlig nyhet, men komplett ny-release-kontroll gjordes inte |
| KNOWN LIMITATIONS | Se nedan |
| BLOCKERS | Nekad administratörskontroll och återstående acceptanskontroller; System Owner-beslut krävs för fortsatt kontroll |
| RELEASE STATUS | **NOT READY** |

## Exakt stopporsak

En autentiserad testadministratör försökte ändra den syntetiska regelns bevakningsgräns från 1 till 2 och samtidigt läsa tillbaka `id,watch_threshold,updated_at`.

Anropet nekades med HTTP 403, felkod `42501`: `permission denied for table foreign_work_rules`. Läsande databaskontroll bekräftade att `updated_at` inte är läsbart via direkt tabellfråga för rollen `authenticated`; tillåtna offentliga regelfält är läsbara. Regelns värde låg kvar på 1.

**Viktig avgränsning:** den ordinarie regelredigeraren begär inte detta extra återlästa fält. Det misslyckade verifieringsanropet bevisar därför inte att ordinarie regelredigering är felaktig, och bevisar inte ett dataläckage. Direkt intern läsning ska vara spärrad. Kontrollen stoppades ändå enligt underlaget, utan att ändra behörigheter eller köra en alternativ rättning. Nästa steg behöver vara en godkänd kontroll av exakt ordinarie skrivväg och dess tillåtna återläsning — inte bredare läsbehörighet.

## Utförda livekontroller

Enbart syntetiska uppgifter användes. Ordinarie administratörssession användes för säker skapande/städning; endast testkontots roller växlades.

- Anonym: 20 kontroller PASS.
- Inloggad utan approll: 20 PASS.
- Montör: 20 PASS.
- HR: 20 PASS.
- Admin: 14 PASS.
- Superuser: 14 PASS.
- Totalt 108 passerade roll/API-kontroller. De omfattade dagfunktion, personlista, offentliga och interna regler, direkt intern kolumnåtkomst, tabelläsningar, dokumentmetadatafunktion, försök till åtkomst för annan montör, export, otillåtna skapanden, rättningsfunktioner, hem landsfunktion och ändring av auditlogg.
- Admin/superuser fick det exakta syntetiska `internal_note`-innehållet via auktoriserad intern regelfunktion. Montör och HR fick offentlig förklaring utan internanteckning; begäran om intern funktion nekades, liksom direkt intern kolumnåtkomst.
- Samtliga fyra skyddade utlandstabeller har aktivt RLS. Relevanta åtta administrativa/läsande funktioner är SECURITY DEFINER med explicit `search_path=public`; anonym saknar exekveringsrätt. Inga grants eller policies ändrades.
- Tomma period-, dokument- och landevidenstabeller bevisar inte fylld radisolering. Därför anges fullständig matris som NOT VERIFIED även när de utförda negativa anropen PASS.

## Inloggad tidregistrering

Montörens ordinarie **Tid → testorder → Logg** användes i den verkligt körande appen. Start 07:00, slut 08:15, arbete 1,25 h, resa 0. Spara lyckades; värdet visades som `1.25 h` på ordern. Omladdning och ny sidöppning återgav samma värde, och direkt återläsning bekräftade exakt en tidsrad med 1,25 h. Utlandsfunktionen gav exakt en norsk dag med `DERIVED`, `work_source=time_entry`, `presence_source=work_day`. Ingen dubbel dag och inget bekräftat vistelseunderlag skapades. Testtiden togs bort.

Inga produktionsfilter kring syntetiska kunder/order ändrades. Testet användes via orderloggen, inte via det tidigare filtrerade kundvalet i Min tid.

## Ej utförda kontroller

**12 SQL/RLS-acceptanskontroller NOT VERIFIED efter stoppet:**

1. Positiv autentiserad periodskapning.
2. Periodrättning med länkad evidens och historik.
3. Positiv dokumentmetadataskapning/redigering.
4. Fylld egen och annan montörs dokumentmetadata.
5. Fylld egen och annan montörs landevidens.
6. HR-mutation av befintlig dokumentmetadata.
7. Montörsmutation av befintlig dokumentmetadata.
8. HR-mutation av befintlig period.
9. Montörsmutation av befintlig period.
10. Full projektlandsrättning med aktör/tid/före/efter/audit.
11. Full hemlandsrättning med aktör/tid/före/efter/audit.
12. Regeltröskeländring och fullständigt auditinnehåll.

**7 inloggade UI-acceptanskontroller NOT VERIFIED:** fylld egen utlandsvy, HR-rapport/readonly-flöde, ordinarie adminregelredigering, live bokningsvarning, dokumentets skapa/redigera/statusflöde, slutlig rapportfiltrering/gruppering, slutlig XLSX-innehållsmatchning. Den passerade UI-kontrollen var tidens spara/återläsa-flöde.

Dokument och perioder har befintliga skydd mot hård radering. Inga sådana syntetiska evidensposter skapades i denna kontroll. En fortsatt kontroll måste kunna verifiera dem utan att kringgå dessa skydd eller lämna kontoberoende testposter; inga skydd försvagades.

## Slutstädning

- Båda testinloggningarna saknas vid ny direkt kontroll.
- Aktuellt testkontos profil och roller saknas; båda nya syntetiska montörer borttagna.
- Kund, två order, medlemskopplingar, tid och testregel borttagna. Inga kvarvarande syntetiska bokningar, perioder, dokument eller landevidens.
- Borttaget testkontos gamla session gav noll regelrader; ingen approll eller verksamhetskoppling återstår. Detta är inte ett påstående att redan utfärdad token omedelbart revokerats.
- Skyddade auditposter bevarade. Produktionsdagfakta identiska före/efter, verkliga tidsposters fullständiga radfingeravtryck identiskt.
- Full regression efter slutstädning: **377 PASS, 0 FAIL**. Appens senaste tillgängliga kontrollsignal: build OK. Ingen appkod, migration, policy, grant, tidslås eller historik ändrades. Inga andra säkerhetsfynd hanterades. Ingenting publicerades.

USER-VISIBLE CHANGE: YES för den tidigare, ännu opublicerade stabiliseringen.

RELEASE ANNOUNCEMENT REQUIRED: YES.

TARGET AUDIENCE: admin, HR och relevanta montörer.

ANNOUNCEMENT SEVERITY: IMPORTANT.

ANNOUNCEMENT CREATED: NO — hålls tills alla krav passerar.

ACKNOWLEDGEMENT TRACKING: NOT VERIFIED för denna release.