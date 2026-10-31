## Rullhjul för start- och sluttid

Start och Slut i montörens tidsredovisning (på ordern och i "Ändra tid") byts från vanliga tidsfält till två rullhjul var: timmar (00–23) och minuter (steg om 5 min).

- Valt värde markeras i ett ljust band i mitten; värden ovan/under tonas ut.
- Arbetstiden räknas direkt och visas under hjulen.
- Halvdag / Heldag flyttar hjulen till rätt tider.
- Restid (timmar) ligger kvar som vanligt fält.
- Fungerar med fingret (svep/snäpp) och med mus/tangentbord.

### Teknik
- Ny komponent `src/components/ui/time-wheel.tsx` med CSS scroll-snap, inga nya bibliotek; värde "HH:MM" in/ut.
- Ersätter de fyra `type="time"`-fälten i `ProjectLogTab.tsx`.
- Befintliga minutvärden som inte är jämna 5 avrundas till närmaste 5 vid visning.
- Uppdatera test för halv/heldag så hjulens värden kontrolleras.
