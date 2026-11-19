# Traktamente går inte att spara

## Orsak (bekräftad)
Tabellen där traktamenten sparas saknar behörighet för inloggade användare. Därför avvisar databasen varje försök att spara, och teknikern får bara "Traktamentet kunde inte sparas". Det förklarar varför inga traktamenten har sparats alls hittills. Det är alltså inte orderns status som stoppar det, och det handlar inte om fel land.

## Åtgärd
1. Ge inloggade användare rätt att läsa, spara, ändra och ta bort sina egna traktamenten. De nuvarande reglerna gör fortfarande att en tekniker bara ser sina egna rader och att admin ser alla.
2. Kontrollera samma sak för tabellen med Skatteverkets belopp, alltså läsbehörighet för inloggade användare.
3. Visa databasens riktiga felorsak i felmeddelandet, så att nästa fel går att felsöka direkt.
4. Verifiera genom att logga in som tekniker i förhandsvisningen, spara ett traktamente på en öppen order och se raden dyka upp. Ta sedan bort testraden.

## Tekniska detaljer
- Migration: `GRANT SELECT, INSERT, UPDATE, DELETE ON public.per_diem_entries TO authenticated;` och `GRANT SELECT ON public.per_diem_rates TO authenticated;` (plus `GRANT ALL ... TO service_role`). RLS-policyerna finns redan och lämnas orörda.
- `PerDiemSection.tsx`: lägg till `error.message` i fel-toasten när felet inte är TIME_LOCKED.
