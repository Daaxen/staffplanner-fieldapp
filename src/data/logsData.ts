export type TimeEntry = {
  id: string;
  projectId: string;
  installerId: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string;
  hours: number;
  note?: string;
  source: 'timer' | 'manual';
  createdAt: string;
};

export type ExpenseCategory = 'materials' | 'travel' | 'parking' | 'meal' | 'mileage' | 'other';

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  materials: 'Materials',
  travel: 'Travel',
  parking: 'Parking',
  meal: 'Meal',
  mileage: 'Mileage',
  other: 'Other',
};

export const expenseCategoryIcons: Record<ExpenseCategory, string> = {
  materials: '🧰',
  travel: '🚆',
  parking: '🅿️',
  meal: '🍽️',
  mileage: '🚗',
  other: '💳',
};

export type ExpenseEntry = {
  id: string;
  projectId: string;
  installerId: string;
  date: string;
  category: ExpenseCategory;
  amount: number; // SEK
  km?: number;
  rate?: number;
  note?: string;
  receiptName?: string;
  createdAt: string;
};

export type ActiveTimer = {
  projectId: string;
  startedAt: string; // ISO
};

export type LogsStore = {
  time: TimeEntry[];
  expenses: ExpenseEntry[];
  activeTimer: ActiveTimer | null;
};

export const DEFAULT_MILEAGE_RATE = 25; // SEK/km
export const LOGS_STORAGE_KEY = 'installer-logs-v1';

const today = new Date();
const d = (offset: number) => {
  const date = new Date(today);
  date.setDate(date.getDate() + offset);
  return date.toISOString().split('T')[0];
};

export const initialLogsStore: LogsStore = {
  time: [
    { id: 't-seed-1', projectId: 'proj-1', installerId: 'inst-1', date: d(-1), startTime: '08:00', endTime: '12:00', hours: 4, note: 'Assembly of base units', source: 'manual', createdAt: new Date().toISOString() },
    { id: 't-seed-2', projectId: 'proj-1', installerId: 'inst-1', date: d(-1), startTime: '13:00', endTime: '16:30', hours: 3.5, note: 'Wall cabinets', source: 'manual', createdAt: new Date().toISOString() },
    { id: 't-seed-3', projectId: 'proj-7', installerId: 'inst-1', date: d(0), startTime: '09:00', endTime: '11:30', hours: 2.5, source: 'timer', createdAt: new Date().toISOString() },
  ],
  expenses: [
    { id: 'e-seed-1', projectId: 'proj-1', installerId: 'inst-1', date: d(-1), category: 'materials', amount: 480, note: 'Screws & brackets', createdAt: new Date().toISOString() },
    { id: 'e-seed-2', projectId: 'proj-1', installerId: 'inst-1', date: d(-1), category: 'mileage', amount: 32 * DEFAULT_MILEAGE_RATE, km: 32, rate: DEFAULT_MILEAGE_RATE, note: 'Site → warehouse → site', createdAt: new Date().toISOString() },
    { id: 'e-seed-3', projectId: 'proj-7', installerId: 'inst-1', date: d(0), category: 'parking', amount: 60, createdAt: new Date().toISOString() },
  ],
  activeTimer: null,
};

export const loadLogs = (): LogsStore => {
  if (typeof window === 'undefined') return initialLogsStore;
  try {
    const raw = window.localStorage.getItem(LOGS_STORAGE_KEY);
    if (!raw) return initialLogsStore;
    const parsed = JSON.parse(raw) as LogsStore;
    return {
      time: parsed.time ?? [],
      expenses: parsed.expenses ?? [],
      activeTimer: parsed.activeTimer ?? null,
    };
  } catch {
    return initialLogsStore;
  }
};

export const saveLogs = (store: LogsStore) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
};

export const computeHours = (startTime: string, endTime: string): number => {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  const diff = end - start;
  if (diff <= 0) return 0;
  return Math.round((diff / 60) * 100) / 100;
};
