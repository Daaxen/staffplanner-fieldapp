# Tidsöversikt: visa tid och debiterbart direkt

## Svar på frågan
Nej. Tidsöversikten väntar inte på att ordern blir klar: en tidsrad syns så fort montören sparat den. Två saker kan ändå få det att se ut som om den väntar:
1. Listan uppdateras inte av sig själv. Den hämtar data bara när sidan öppnas eller när du byter period, så ny tid syns först när du laddar om.
2. Det finns ingen kolumn för debiterbart belopp, bara timmar.

## Ändringar
- **Live-uppdatering:** Tidsöversikten uppdateras automatiskt när en montör sparar, ändrar eller tar bort tid, utan att du behöver ladda om. Det gäller oavsett orderns status.
- **Debiterbart belopp:** ny kolumn "Debiterbart (kr)" per rad, plus en summa överst bredvid totala timmar.
  - Beloppet är arbetstid × timpris. Timpriset tas i första hand från tidsraden, annars från ordern och sist från kunden.
  - Restiden ingår inte i beloppet.
  - Saknas timpris visas "–" och raden markeras, så att du ser vad som behöver prissättas.
- **Status:** ny kolumn "Orderstatus" (t.ex. Pågår eller Klar), så att du direkt ser vad som redan är avslutat.
- **Excel-export:** de nya kolumnerna följer med i exporten.
- Endast administratörer ser beloppen. Montörens egen tidsvy ändras inte.

## Tekniskt
- `useTimeRows`: hämtar även `hourly_rate`. Ny prenumeration på `time_entries` som läser om listan vid ändring (kräver att tabellen läggs till i realtidspubliceringen via en migrering, där RLS fortsatt gäller).
- `useTimeRefs`: hämtar även `hourly_rate` för ordrar och kunder (kunder via admin-läsning).
- Ren funktion `billableRate(row, order, client)` med tester för prisordningen och för saknat pris.
