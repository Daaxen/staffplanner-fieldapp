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

export const initialLogsStore: LogsStore = {
  time: [],
  expenses: [],
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
