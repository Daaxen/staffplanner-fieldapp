# Sökbara fält för Kund, Projekt och Order i Min tid

## Vad som ändras
I dialogen "Ny tidsrad / Redigera tidsrad" under Tidsrapportering → Min tid (även More → Min tid i montörsappen) byts de tre rullgardinerna **Kund**, **Projekt** och **Order** mot fält där man börjar skriva och får förslag direkt.

- **Sök på nummer eller namn:** "10" hittar kundnummer 1001–1079 och "scan" hittar alla Scandic-kunder/ordrar. Gemener/versaler och å/ä/ö spelar ingen roll.
- **Förslagen följer kopplingen som idag:** Projekt visar bara projekt för vald kund, Order bara ordrar för vald kund (och valt projekt om ett är valt).
- **Byte av kund** rensar projekt och order, som nu.
- **Projekt och Order är fortfarande valfria:** ett val "Inget projekt" / "Ingen order" ligger kvar överst.
- "Ingen träff" visas när inget matchar. Fungerar på mobil (tangentbord öppnas, listan går att rulla).
- Kund 9999 och reglerna för den är oförändrade.

## Teknisk sektion
- Ny återanvändbar komponent `src/components/ui/search-select.tsx` byggd på befintliga `popover` + `command` (cmdk): props `options {value,label,keywords}`, `value`, `onChange`, `placeholder`, `emptyText`, `noneLabel?`, `disabled`.
- Filtrering normaliserar text (lowercase, tar bort diakritiska tecken) och matchar på nummer + namn.
- `MyTime.tsx`: ersätt de tre `Select` för kund/projekt/order med `SearchSelect`; Aktivitetstyp lämnas som rullgardin.
- Inga databas- eller regeländringar. Typkontroll + befintliga tester körs; flödet provas i förhandsvisningen (skriva, välja, spara rad, ta bort testraden).
