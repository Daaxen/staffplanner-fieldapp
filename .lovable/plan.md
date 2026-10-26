# Montörsguide "For dummies" i montörsappen

## Vad som byggs
En enkel steg-för-steg-guide på svenska, inne i montörsappen under **More → Guide**. Stora rubriker, korta steg, en bild per steg (skärmdump av riktiga appen) och en tips-ruta per avsnitt.

## Innehåll (4 kapitel)
1. **Kom igång** – logga in, appens fem flikar längst ner (Active jobs, Reporting, Deviations, Sign-off, More), vad Field mode är.
2. **Se dina ordrar** – Active jobs-listan, öppna en order, läs arbetsbeskrivning, tider, adress/karta, filer under Docs & Pics, hela schemat under More → Full schedule, ta en ledig order under Available jobs.
3. **Redovisa tid** – välj dag på ordern, Start/stopp idag, manuell inmatning (start, slut, restid i timmar med snabbknappar), Min tid för dag/vecka och kund 9999 för intern tid.
4. **Redovisa utlägg** – lägg till utlägg och kilometer på ordern, fota kvittot, vad som händer sen.

Varje kapitel: 3–6 numrerade steg, "Tips"-ruta och "Vanliga misstag" (t.ex. glömd klocka stoppas vid midnatt).

## Upplägg
- Kapitelväljare överst, steg som kort man bläddrar med "Nästa"/"Föregående", knapp "Ta mig dit" som öppnar rätt flik.
- En första gång-banner i appen: "Ny här? Läs guiden" som kan stängas.

## Tekniska detaljer
- Ny komponent `src/components/installer/guide/InstallerGuide.tsx` med innehåll i `src/lib/installerGuide.ts` (data, lätt att redigera).
- Ny post `guide` i More-menyn i `InstallerApp.tsx`; "Ta mig dit" använder befintliga `setTab`/`setMoreView`.
- Skärmdumpar tas med Playwright i mobilvy (390×844) och sparas i `src/assets/guide/`.
- Banner döljs via localStorage-flagga.
- Inga databasändringar.
