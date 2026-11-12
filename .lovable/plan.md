# Traktamente & logi på work orders

## Vad montören gör (mobilappen + sub-vendor-länken)
Ny knapp **"Traktamente & logi"** i Rapportera-griden på ordern. Per dag väljer montören:
- **Övernattning:** Hotell (kvitto) / Privat logi (schablon nattraktamente) / Ingen
- **Avresa/hemkomst:** tider som avgör hel- eller halvdag (avresa före 12 = heldag, hemkomst efter 19 = heldag, annars halvdag)
- **Fria måltider:** kryss för frukost, lunch, middag (betald av kund/arbetsgivare) → automatisk reducering
- Hotellkostnad med kvittofoto (befintliga kvittoregler gäller)

Appen visar beloppet direkt, t.ex. "Heldag 300 kr − lunch 105 kr = 195 kr". Färgkod som övrigt: grön när dagen är ifylld.

## Regler (Skatteverket, inrikes)
- Schablon per år lagras i en tabell (heldag, halvdag, nattraktamente, måltidsavdrag per kombination). Admin kan uppdatera belopp när Skatteverket ändrar dem — inga kodändringar.
- 2026-beloppen hämtas och kontrolleras mot skatteverket.se vid bygget (sidan gick inte att läsa automatiskt just nu); jag visar dem för dig innan de låses.
- Krav: minst 50 km från bostad och vanlig arbetsplats + övernattning. Montören bekräftar detta med en kryssruta; avståndet kan inte verifieras automatiskt.
- Efter 3 månader på samma ort sänks schablonen (70 %) — markeras med varning, ingen automatik i första versionen.
- Låses när ordern är Completed, precis som tid/milersättning (admin kan ändra, får varning).

## Var det syns för admin
- **Field report** på ordern och **Work order reports**: ny rad "Traktamente" och "Logi" i billables, PDF och Excel. Klientversion kan exkludera traktamente.
- **Tidsöversikt / Export:** kolumner Traktamente (skattefritt) och Logi, för lönefil.
- Lönsamhet: räknas som kostnad på ordern.

## Tekniskt
- Ny tabell `per_diem_entries` (project_id, installer_id, datum, day_type, overnight_type, meals_provided, amount, rate_year) + `per_diem_rates` (år, belopp). Hotell sparas i befintliga `expense_entries` med ny kategori "Logi".
- Belopp räknas i databasen (trigger) från gällande års tabell så klienten inte kan sätta egna belopp. Låstrigger återanvänds.
- Sub-vendor: nya actions i `subvendor-access`, belopp visas men inga satser/kunddata.
- Tester: hel-/halvdag, måltidsavdrag, nattraktamente, låsning.

## Utlandstraktamente (tillägg)
- Ordern får ett fält **Land** (standard Sverige). Fylls i automatiskt från adressen/kartpositionen när den finns, kan ändras i "Edit work order".
- Är landet inte Sverige används Skatteverkets **normalbelopp per land** för aktuellt år (t.ex. Norge, Danmark, Finland, Tyskland). Hela landslistan läggs in i tabellen och admin kan uppdatera den varje år.
- Regler utland: heldag = normalbeloppet, halvdag (hemresedag efter kl 19 / avresa efter 12) = 50 %, nattraktamente = 50 % vid privat logi. Måltidsavdrag: frukost 15 %, lunch 35 %, middag 35 %. Efter 3 månader 70 %.
- Montören ser landets flagga och dagsbelopp överst ("Utlandstraktamente: Norge – X kr/dag, Skatteverket 2026"). Beloppen i bilden är exempel; riktiga 2026-belopp hämtas och visas för dig innan de används.
- Resdag in/ut ur Sverige: dagen räknas på det land där montören vistas längst tid (Skatteverkets regel) — montören kan byta land per dag vid behov.
- Rapporter och export visar land per rad.
