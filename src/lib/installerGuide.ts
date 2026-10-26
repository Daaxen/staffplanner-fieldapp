import home from '@/assets/guide/01_home.jpg';
import jobs from '@/assets/guide/02_jobs.jpg';
import orderInfo from '@/assets/guide/03_order_info.jpg';
import day from '@/assets/guide/04_day.jpg';
import manual from '@/assets/guide/05_manual.jpg';
import mileage from '@/assets/guide/06_mileage.jpg';
import expense from '@/assets/guide/07_expense.jpg';
import more from '@/assets/guide/08_more.jpg';

export type GuideTarget = { tab: string; moreView?: string };

export interface GuideStep {
  title: string;
  image: string;
  /** Numbered markings in the image, in the same order as the red badges. */
  callouts: { n: number; text: string }[];
}

export interface GuideChapter {
  id: string;
  title: string;
  intro: string;
  steps: GuideStep[];
  tip: string;
  mistakes: string[];
  goTo?: GuideTarget;
}

export const installerGuide: GuideChapter[] = [
  {
    id: 'start',
    title: '1. Kom igång',
    intro: 'Appen har fem flikar längst ner. Du behöver oftast bara två av dem.',
    steps: [
      {
        title: 'Hitta rätt i appen',
        image: home,
        callouts: [
          { n: 1, text: 'Active jobs – dina ordrar. Här börjar du varje dag.' },
          { n: 2, text: 'Reporting – redovisa tid och utlägg på en order.' },
          { n: 3, text: 'More – Min tid, schema, lediga jobb, dokument och profil.' },
          { n: 4, text: 'Field mode – förenklad vy med stora knappar, bra ute på plats.' },
        ],
      },
    ],
    tip: 'Lägg appen på hemskärmen: i webbläsaren väljer du "Lägg till på hemskärmen".',
    mistakes: ['Logga inte ut varje dag – du är inloggad tills du trycker på Sign out.'],
    goTo: { tab: 'schedule' },
  },
  {
    id: 'orders',
    title: '2. Se dina ordrar',
    intro: 'Allt du behöver veta om jobbet finns på ordern.',
    steps: [
      {
        title: 'Öppna en order',
        image: jobs,
        callouts: [{ n: 1, text: 'Tryck på ordern för att öppna den. Du ser datum, tider, kund och adress direkt på kortet.' }],
      },
      {
        title: 'Läs på om jobbet',
        image: orderInfo,
        callouts: [
          { n: 1, text: 'Info – tider, arbetsbeskrivning, kund, kontakt och adress.' },
          { n: 2, text: 'Docs & Pics – ritningar och filer som kontoret lagt på ordern.' },
          { n: 3, text: 'Log – här redovisar du tid, körning och utlägg.' },
        ],
      },
      {
        title: 'Schema och lediga jobb',
        image: more,
        callouts: [
          { n: 1, text: 'Min tid – all din tid per dag eller vecka.' },
          { n: 2, text: 'Full schedule – alla dina kommande dagar.' },
          { n: 3, text: 'Available jobs – lediga ordrar du kan ta (Pick Up).' },
        ],
      },
    ],
    tip: 'Tryck på adressen för att öppna vägbeskrivning i kartan.',
    mistakes: ['Ser du inte en order? Den kanske ligger på andra dagar – kolla Full schedule.'],
    goTo: { tab: 'schedule' },
  },
  {
    id: 'time',
    title: '3. Redovisa tid',
    intro: 'Öppna ordern, gå till fliken Log och välj dag.',
    steps: [
      {
        title: 'Välj dag och starta klockan',
        image: day,
        callouts: [
          { n: 1, text: 'Välj vilken dag du redovisar. Idag är förvalt. "Annan dag" ger ett eget datum.' },
          { n: 2, text: 'Start / stopp idag – tryck Start när du börjar och Stopp när du slutar.' },
        ],
      },
      {
        title: 'Eller fyll i tiden själv',
        image: manual,
        callouts: [
          { n: 1, text: 'Restid anges i timmar. Använd snabbknapparna 0,5 – 1 – 1,5 – 2 h.' },
          { n: 2, text: 'Tryck "Spara tid" – datumet på knappen visar vilken dag det sparas på.' },
        ],
      },
    ],
    tip: 'Intern tid utan kund? Gå till More → Min tid och välj "Intern eller osäker kund" (kund 9999) och skriv vad du gjorde.',
    mistakes: [
      'Glömd klocka stoppas automatiskt vid midnatt – kontrollera sluttiden dagen efter.',
      'Max 24 timmar per dag. Fel dag? Ta bort raden och lägg in den igen.',
    ],
    goTo: { tab: 'reporting' },
  },
  {
    id: 'costs',
    title: '4. Redovisa utlägg och körning',
    intro: 'Längre ner på fliken Log finns körning och kostnader.',
    steps: [
      {
        title: 'Körning (kilometer)',
        image: mileage,
        callouts: [
          { n: 1, text: 'Skriv antal km och gärna sträckan.' },
          { n: 2, text: 'Tryck "Save mileage".' },
        ],
      },
      {
        title: 'Utlägg med kvitto',
        image: expense,
        callouts: [
          { n: 1, text: 'Välj kategori, t.ex. material, och skriv belopp och vad du köpte.' },
          { n: 2, text: 'Fota kvittot direkt eller bifoga en fil.' },
          { n: 3, text: 'Tryck "Save cost". Utlägget syns under Reported entries.' },
        ],
      },
    ],
    tip: 'Fota kvittot direkt i butiken – då försvinner det inte.',
    mistakes: ['Större utlägg kräver kvitto. Utan kvitto går det inte att spara.'],
    goTo: { tab: 'reporting' },
  },
];

export const GUIDE_DISMISSED_KEY = 'installerGuideDismissed';
