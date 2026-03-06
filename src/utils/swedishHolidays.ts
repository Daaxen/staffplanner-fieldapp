// Swedish public holidays (röda dagar) for 2024-2027
// Includes fixed + moveable holidays

function getEasterSunday(year: number): Date {
  // Anonymous Gregorian algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmt(d: Date): string {
  return d.toISOString().split('T')[0];
}

export interface SwedishHoliday {
  date: string;
  name: string;
}

export function getSwedishHolidays(year: number): SwedishHoliday[] {
  const easter = getEasterSunday(year);
  const holidays: SwedishHoliday[] = [
    { date: `${year}-01-01`, name: 'Nyårsdagen' },
    { date: `${year}-01-06`, name: 'Trettondedag jul' },
    { date: fmt(addDays(easter, -2)), name: 'Långfredagen' },
    { date: fmt(easter), name: 'Påskdagen' },
    { date: fmt(addDays(easter, 1)), name: 'Annandag påsk' },
    { date: `${year}-05-01`, name: 'Första maj' },
    { date: fmt(addDays(easter, 39)), name: 'Kristi himmelsfärdsdag' },
    { date: fmt(addDays(easter, 49)), name: 'Pingstdagen' },
    { date: `${year}-06-06`, name: 'Sveriges nationaldag' },
    // Midsommardagen: Saturday between June 20-26
    { date: fmt(getMidsommar(year)), name: 'Midsommardagen' },
    // Midsommarafton (eve, not official red day but commonly off)
    { date: fmt(addDays(getMidsommar(year), -1)), name: 'Midsommarafton' },
    // Alla helgons dag: Saturday between Oct 31 - Nov 6
    { date: fmt(getAllaSankt(year)), name: 'Alla helgons dag' },
    { date: `${year}-12-24`, name: 'Julafton' },
    { date: `${year}-12-25`, name: 'Juldagen' },
    { date: `${year}-12-26`, name: 'Annandag jul' },
    { date: `${year}-12-31`, name: 'Nyårsafton' },
  ];
  return holidays;
}

function getMidsommar(year: number): Date {
  // Saturday between June 20-26
  for (let d = 20; d <= 26; d++) {
    const date = new Date(year, 5, d);
    if (date.getDay() === 6) return date;
  }
  return new Date(year, 5, 20);
}

function getAllaSankt(year: number): Date {
  // Saturday between Oct 31 - Nov 6
  for (let d = 31; d <= 37; d++) {
    const date = new Date(year, 9, d); // Oct 31 = day 31 of month 9
    if (date.getDay() === 6) return date;
  }
  return new Date(year, 10, 1);
}

// Build a lookup map for quick access
let cachedYear: number | null = null;
let cachedMap: Map<string, string> = new Map();

export function getHolidayMap(year: number): Map<string, string> {
  if (cachedYear === year) return cachedMap;
  const map = new Map<string, string>();
  // Cover current year and neighbors for views spanning year boundaries
  [year - 1, year, year + 1].forEach(y => {
    getSwedishHolidays(y).forEach(h => map.set(h.date, h.name));
  });
  cachedYear = year;
  cachedMap = map;
  return map;
}

export function isSwedishHoliday(dateStr: string): string | undefined {
  const year = parseInt(dateStr.substring(0, 4));
  return getHolidayMap(year).get(dateStr);
}
