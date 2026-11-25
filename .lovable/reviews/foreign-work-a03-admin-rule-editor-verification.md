# FETCH Foreign Work – A03 admin rule editor verification

Kontrolldatum: 25 november 2026, 08:07–08:12 UTC. Enbart godkänd A03-verifiering. Ingen appkod, RLS, grant, policy, SECURITY DEFINER-funktion, autentiseringsarkitektur eller regelarkitektur ändrades. Ingen publicering eller fortsatt A–M-acceptans kördes.

## Exakt slutrapport

```text
ADMIN RULE EDITOR: PASS
NORMAL CREATE/EDIT PATH: PASS
VALUE BEFORE: 10
VALUE AFTER: 20
VALUE AFTER RELOAD: 20
AUDIT EVENT: PASS
ADMIN ACCESS: PASS
HR MUTATION: BLOCKED
INSTALLER MUTATION: BLOCKED
ROLELESS MUTATION: BLOCKED
INTERNAL_NOTE PROTECTION: PASS
RLS CHANGED: NO
GRANTS CHANGED: NO
POLICIES CHANGED: NO
TEMP TEST USER REMOVED: YES
SYNTHETIC RULE REMOVED: YES
PROTECTED AUDIT RECORDS RETAINED: 6
```

## Syntetiska uppgifter

- Tillfällig användare: `9c32cf5e-f64e-47a1-8ae7-ff7f67c30eaa`.
- Testprofil: `TEST-FW-A03 Admin`, märkt som testdata.
- Automatisk montörspost: `8c202ec4-5e45-423f-9912-38daf461a666`, märkt som testdata och borttagen vid städning.
- Enda testregel: `TEST-FW-A03-20261125`, ID `e6e1ea00-ec9a-4142-a124-f9eb8bdcf80b`.
- Land `NO`, mått `PRESENCE_DAYS`, period `CALENDAR_YEAR`, giltig från `2026-11-25`.
- Ursprungliga nivåer: bevaka 10, kontroll 30, gränsvärde 40. Efter ändringen: 20, 30, 40.
- Syntetisk internanteckning användes som innehållsmarkör för negativa läsprov.

Inga verkliga regler fanns före kontrollen; efter städning finns åter noll regler. Endast testkontots egna roller växlades. Inga riktiga kontons roller eller verksamhetsuppgifter ändrades.

## Ordinarie skapa/redigera/återläsa-flöde

1. En riktig autentiserad testsession återställdes med plattformens testkontofunktion. FETCH öppnades som detta konto; dess identitet och administratörsroll kontrollerades i appen. Inloggningsformuläret i sig ingick inte i A03-kontrollen.
2. Den ordinarie sidan **Reports → Utlandsarbete → Regler** användes, på `/app/foreign-work`.
3. Testregeln skapades med **Lägg till regel**. Appens normala `POST foreign_work_rules` lyckades med HTTP 201.
4. **Redigera TEST-FW-A03-20261125** öppnades. Formuläret återgav 10/30/40.
5. Endast bevakningsgränsen ändrades till 20. **Spara regel** gav HTTP 204 via appens vanliga `PATCH foreign_work_rules?id=eq.<regel-id>`, utan bred direkt tabellåterläsning.
6. Regeldata lästes om genom appens befintliga `foreign_work_rule_data(_internal=true)`, HTTP 200. En ny sidöppning och återöppnad editor visade 20/30/40, med samma internanteckning.
7. Oberoende läsande databaskontroll bekräftade 20/30/40 samt exakt en avsedd ändringshändelse.

**Kontrollverktygets timing:** det första skriptet öppnade editorn igen innan den asynkrona omläsningen var färdig och såg den äldre formulärkopian 10. Skrivningen hade redan lyckats. Detta kontrollerades genom en ny sidöppning i ordinarie app, utan ytterligare skrivning: värdet var 20. Databasraden och auditens före/efter bekräftade samma sak. Ingen apprättning eller behörighetsändring gjordes.

Ingen obegränsad direkt tabellåtkomst användes för administratörens ordinarie flöde. Den tidigare verifieringens utökade `select` av `updated_at` upprepades inte och dess spärr ändrades inte.

## Audit

- Skapande: `0370eed4-46db-4f9e-81b8-5ccc1a7eb011`, `2026-11-25T08:09:32.245061Z`.
- Ändring: `843808b1-049c-47dd-bf5c-32ee2dacef28`, `2026-11-25T08:09:32.893980Z`.
- Aktör för båda: det syntetiska administratörskontot; `actor_type=admin`, `source=app`.
- Ändringshändelsens `old_values={"watch_threshold":10}` och `new_values={"watch_threshold":20}`. Ingen annan regeluppgift ingår i ändringsdiffen.
- Borttagning vid städning: `ec5e6b4f-30c3-4d06-8539-41c44adbd4bf`, `2026-11-25T08:11:47.995510Z`, `actor_type=system`, `source=database`.
- Samtliga tre regelhändelser återlästes efter städning. Totalt **6 skyddade auditposter** för testkontot, dess montör och regel behölls. Inga auditposter ändrades eller raderades.

## HR, montör och inloggad utan roll

Varje prov kördes med en ny öppning av appen och kontroll av testkontots faktiska roller via dess autentiserade session. Anrop gjordes genom den vanliga appklienten, utan tjänstenyckel eller databasprivilegier.

| Prov | HR | Montör | Rollös |
|---|---|---|---|
| Offentlig regeldata | HTTP 200, internanteckning saknas | HTTP 200, internanteckning saknas | HTTP 403 |
| Intern regeldata, `_internal=true` | HTTP 403 | HTTP 403 | HTTP 403 |
| Direkt `select internal_note` | HTTP 403 | HTTP 403 | HTTP 403 |
| Ändra bevakning 20 → 21 på testregeln | 0 berörda rader | 0 berörda rader | 0 berörda rader |
| Skapa ny syntetisk regel | HTTP 403, RLS-nekat | HTTP 403, RLS-nekat | HTTP 403, RLS-nekat |
| Radera den befintliga testregeln | 0 berörda rader | 0 berörda rader | 0 berörda rader |

HR:s ordinarie regelvy visade testregeln utan redigeringsknapp, skapandeformulär eller internanteckning. Montören dirigerades till montörsappen och kunde inte öppna administratörens regelvy.

**Negativa mutationsprov bedömdes genom berörda rader och bestående data, inte bara svarskod.** En RLS-spärrad ändring/radering kan ge HTTP 200/204 utan att en enda rad ändras. HR:s första raderingsanrop gav HTTP 204; testregeln och audit förblev oförändrade. Prov med uttrycklig återläsning av berörda ID:n gav därefter `[]` för HR, montör och rollös. Ingen obehörig skapande-, ändrings- eller raderingshändelse tillkom.

## Oförändrad säkerhet

Fingeravtryck före och efter kontroll/städning var identiska för hela det offentliga appsschemat:

| Omfattning | Före = efter |
|---|---|
| Policies | `6e0eb324c5919a59b8bf8b1e1e1941a7` |
| Tabellers RLS-flaggor och grants | `3ef810fcf594b3a12455bdd089fb1541` |
| Kolumngrants | `f1505e4679a796d4d3e480866b496aa4` |
| Funktionsdefinitioner och funktionsgrants | `e360adf0cb41378f47799c53e06bac5f` |
| Regelrader efter städning | `d41d8cd98f00b204e9800998ecf8427e` |

Ingen migration, policy/grant-åtgärd, säkerhetsfyndhantering eller appkodsrättning utfördes. `git diff` för appkod, migrationsmappar, AGENTS.md och index.html var tom. Senaste tillgängliga appkontroll: **build OK**. Detta är inte en ny fullständig acceptanskontroll.

## Städning och stopp

- Testregeln, testkontots roller och den automatiska testmontören togs bort med exakt ID-avgränsade dataåtgärder.
- Kontoavslutning kördes genom appens befintliga administratörsfunktion, från systemägarens ordinarie administratörssession enbart för städning. Svar: `{"ok":true}`.
- Slutlig oberoende databaskontroll bekräftade **0** kvarvarande testkonton i Auth, profiler, roller, montörer, testregler och nyhetskvitteringar för detta test.
- **6** skyddade auditposter finns kvar, inklusive skapande, ändring och städning av testregeln.

**A03 PASS. STOP.** Återstående acceptansmatris väntar på System Owner-godkännande. Inget publicerades.

USER-VISIBLE CHANGE: NO för denna verifiering. RELEASE ANNOUNCEMENT REQUIRED: NO. Den tidigare stabiliseringens releasebeslut är fortfarande separat och inte godkänt av denna A03-kontroll.