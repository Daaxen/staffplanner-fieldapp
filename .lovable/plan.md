# Importera kundregistret från Fortnox

Fyll StaffPlanners kundregister med kunderna i Fortnox-filen, matchade på kundnummer.

## Vad som importeras

Filen innehåller 81 rader. Efter dina val blir det:

- **Matchning på kundnummer.** Finns kundnumret redan i StaffPlanner uppdateras den kunden, annars skapas en ny.
- **Dubbletter slås ihop.** Samma organisationsnummer på flera kundnummer behålls bara en gång, på det lägsta kundnumret: Enably Produktion (10, inte 11), Mari Helen Mat (25, inte 31), Byshoppen Livs (33, inte 10000), vroom Stockholm (54, inte 10001). Byshoppen och vroom får med sig den e-post som bara står på dubbletten.
- **Avklippta e-postadresser hoppas över.** Cirka 12 rader har en adress som är avhuggen i PDF:en (t.ex. "invoice@nordwestentreprenac"). De kunderna läggs in utan e-post, så du kan fylla i rätt adress efteråt.
- **Speeron AB (kundnr 4)** finns redan. Din kontaktperson och adress behålls; bara tomma fält fylls på (organisationsnummer, postnummer, ort, telefon, fakturamejl).
- **Dynamic Places AB (9999)** är ert eget bolag men ligger som kund i Fortnox — det läggs in som vanlig kund, säg till om du hellre vill utelämna det.
- Sista raden i filen har ett organisationsnummer där kundnumret ska stå (Carlssons i Sätila AB). Den läggs in med kundnummer 556796-4076 precis som i filen, så den går att känna igen och rätta.

Resultat: cirka 77 kunder i registret.

## Fält som fylls i

Namn, kundnummer, organisationsnummer, postnummer, ort (som region), telefon och fakturamejl. Filen innehåller ingen gatuadress, så det fältet lämnas tomt. Priser, moms och betalningsvillkor rörs inte.

## Tekniskt

- Engångsimport körs som SQL-migration mot `public.clients`.
- Upsert på `customer_number`: `INSERT ... ON CONFLICT` går inte utan unikt index, så importen körs som `INSERT ... WHERE NOT EXISTS` plus en `UPDATE`-sats för befintliga rader som bara sätter fält där nuvarande värde är `NULL` eller tomt (`COALESCE(NULLIF(col,''), ny)`).
- Mappning: KUNDNR → `customer_number`, NAMN → `name`, ORG-/PERSNR → `org_number`, POSTNR → `postal_code`, ORT → `region`, TELEFON → `contact_phone`, E-POST → `invoice_email` och `contact_email` (samma adress, det är den enda i filen).
- `sandbox` sätts till `false`, `vat_percent` lämnas till tabellens default.
- Ingen kodändring i appen; registret läser redan från `clients`.

## Verifiering

Räkna raderna efteråt, kontrollera att Speeron AB fortfarande har Karl Göransson och Röntgenvägen 3, och att inga dubbletter av organisationsnummer finns.
