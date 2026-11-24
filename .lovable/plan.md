# Utlandsarbete – räknare och bevakning (FETCH)

## Konsekvensanalys (läsning, inget ändrat)
- **Destinationsland:** finns på varje order (`projects.country`), men som svenskt namn (Sverige, Norge, Finland, Danmark, Tyskland), inte ISO-kod. 47 utlandsordrar, 88 tidsposter på dem. Tillförlitligt sedan landsväljaren infördes; 32 äldre ordrar korrigerades i efterhand.
- **Hemland:** saknas helt. Ingen montör eller profil har land satt (0 av 13). Varken anställningsland, arbetsgivarland eller skattehemvist finns.
- **Godkänd tid:** FETCH har inget godkännandesteg för tid. Närmaste fakta är sparade tidsposter + låsning när ordern är Slutförd.
- **Vistelse/resor:** inga resposter finns, bara flaggorna `travelBefore`/`travelAfter` och restimmar. Räcker inte som bevis för vistelsedagar.
- **Arbetsgivare/organisation:** finns inte (montörtyp intern/UE finns).
- **Roller:** admin, installer, hr, superuser. Ingen separat planerar- eller compliance-roll; planerare går via admin.
- **Revision och dokument:** befintlig oföränderlig `audit_log` + `audit_row_change()` och dokumentlagringen kan återanvändas.

### Inga arkitekturkonflikter, men fyra luckor (påverkar status, inte genomförbarhet)
1. Inget hemland → alla räknare visas **EJ VERIFIERAD** tills admin satt hemland per montör. Sverige antas inte.
2. Inget tidsgodkännande → arbetsdagar från tidsposter märks **DERIVED**; tidsposter på Slutförda ordrar räknas som starkast.
3. Inga resposter → vistelsedagar kommer bara från admin-bekräftade vistelseperioder; annars **INSUFFICIENT_DATA**.
4. Ingen arbetsgivare → kolumnen visar intern/UE tills vidare.

## Vad som byggs
1. **Hemland per montör** (ISO-kod) på montörens adminkort, bara admin/HR kan sätta.
2. **Utlandsperioder**: härledda från tidsposter på utlandsordrar (arbetsdagar) + manuella vistelseperioder (vistelsedagar). Rättelse/makulering i stället för radering.
3. **Regler**: land/landgrupp, mätvärde (arbetsdagar, vistelsedagar, sammanhängande uppdrag), period (kalenderår, rullande 12 mån, fast intervall, sammanhängande), tre gränser, giltighetstid, på/av, förklaring. Inga regler förinlagda – inget hårdkodat 183.
4. **Status**: NORMAL / BEVAKA / KONTROLL KRÄVS / GRÄNSVÄRDE UPPNÅTT / EJ VERIFIERAD, med regel, period, räknare, gräns och vilka poster som gav siffran.
5. **Sektion UTLANDSARBETE** på montörens adminkort med historik.
6. **Admin → Compliance → Utlandsarbete**: rapport med filter, gruppering och XLSX-export (befintlig exportväg).
7. **Bokningsvarning** i tilldelningsdialogen: nuvarande + denna bokning = prognos. Rådgivande, blockerar aldrig.
8. **A1/dokumentmetadata** (typ, land, giltighet, status, referens) – länk endast till befintliga skyddade dokument.

## Behörighet
- Admin/superuser: allt. HR: läsa allt + dokumentmetadata.
- Montör: bara sin egen sammanfattning (förslag – se fråga). Rolllös/anonym: ingen åtkomst.
- Räkning och export sker i databasen, så rapport, kort och export ger samma siffror.

## Historik
Ingen bakåtfyllning körs. Jag tar fram antal kandidater, antaganden och oklara poster och stannar för godkännande.

## Tester
Beräknings-, regel-, rapport-, export-, bokning-, dokument-, säkerhets- och regressionstester enligt CALC/RULE/…/REG-listan, plus SQL-kontroller med tillfälliga syntetiska testkonton som tas bort efteråt.

## Tekniskt
- Nya tabeller: `foreign_work_periods` (källa, datum, land ISO, verifieringsstatus, voided_at), `foreign_work_rules`, `foreign_work_documents`; kolumn `installers.home_country` (nullable). Revision via befintlig `audit_row_change()`-trigger.
- Härledda arbetsdagar beräknas i en SECURITY DEFINER-funktion från `time_entries` × `projects.country` (namn→ISO-mappning), en dag räknas en gång per montör/land/datum oavsett antal poster eller bokning (ingen dubbelräkning). Inga tidsposter ändras.
- Status beräknas i en ren TS-modul med samma logik som DB-funktionen, testad mot fixturer.
- Befintliga RLS-regler, bokningskontroller, tidslåsning och dokumentbehörighet lämnas orörda.
