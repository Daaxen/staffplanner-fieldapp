# Utlandstraktamente: känn igen landet från ordern

## Vad som är fel
Ordern "637 Scandic Vaasa (FI) - Part 1" har landet **Sverige** sparat. Platsen är bara "Scandic Vaasa", utan adress eller land, så appen vet inte att jobbet är i Finland. Felix får därför inrikes traktamente. Appen läser aldrig landet ur platsen, bara ur fältet Land på ordern.

## Åtgärder
1. **Rätta Scandic Vaasa nu:** sätt Land = Finland på ordern. Felix får då utlandstraktamente för Finland direkt.
2. **Gissa landet automatiskt:** när en order sparas med Land = Sverige men platsen eller namnet tydligt pekar utomlands, föreslår appen rätt land:
   - landskod i namnet, t.ex. "(FI)", "(NO)", "(DK)"
   - landsnamn i platsen eller adressen (Finland, Norge, Suomi, Norway …)
   - adressen från kartsökningen när en sådan finns
   Förslaget visas vid fältet Land ("Ser ut som Finland – byt?") så att admin bekräftar. Inget ändras i tysthet.
3. **Hitta fler felaktiga ordrar:** en gång går appen igenom ordrar som har Sverige men "(XX)" i namnet och listar dem, så att de kan rättas (de rättas bara om du säger ja).
4. **Montörens vy:** montören kan redan byta land i traktamentet. Vi lägger till en tydlig rad "Ordern är i Sverige – fel land? Byt här", så att det syns direkt.

## Tekniskt
- Ny `guessCountry(name, location, street)` i src/lib/perDiem.ts: ISO-kod till svenskt landsnamn plus synonymer, matchat mot `per_diem_rates`-länderna. Tester för "(FI)", "Vaasa, Finland", "Oslo" utan land (ingen gissning) och svensk adress.
- Används i EditWorkOrderDialog vid fältet Land som förslagsknapp.
- Datafix för Scandic Vaasa görs via datafråga, inte migration.
