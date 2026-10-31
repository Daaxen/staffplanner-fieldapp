## Restid som rullhjul + tydligare anteckning

- **Restid:** fältet "Restid (timmar)" byts mot ett rullhjul med timmar (0–12) och minuter i kvartar (00, 15, 30, 45). Rubrik "Restid totalt (tur och retur)" och hjälptext "All restid för dagen, båda hållen". Gäller både "Lägg till tid" och "Ändra tid".
- **Annan färgton:** restidshjulet får en varm sand/bärnstensfärgad bakgrund och markering, medan Start/Slut behåller den blå tonen.
- **Anteckning:** rubriken blir "Anteckning (gäller dagens arbete och resa)" med exempeltext "T.ex. väntetid hos kund, omväg p.g.a. vägarbete".
- Restid sparas fortfarande som timmar (1 h 30 min = 1,5 h).

### Teknik
- Ny `DurationWheel` i `src/components/ui/time-wheel.tsx` (återanvänder hjulkolumnen), värde i decimaltimmar, prop `tone`.
- Ny semantisk färgtoken för restid i `index.css`/tailwind.
- `ProjectLogTab.tsx`: ersätt restidsfält i båda formulären, uppdatera anteckningsetikett.
- Uppdatera testet för halv/heldag (restid via hjulet) och lägg till test för omvandling h/min ↔ decimaltimmar.
