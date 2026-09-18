export type PhotoCategory = 'before' | 'during' | 'completion' | 'issue' | 'other';

export interface PhotoCategoryDef {
  id: PhotoCategory;
  label: string;
  hint: string;
}

export const PHOTO_CATEGORIES: PhotoCategoryDef[] = [
  { id: 'before', label: 'Before', hint: 'Site and goods before work starts' },
  { id: 'during', label: 'During work', hint: 'Progress, mounting, cabling' },
  { id: 'completion', label: 'Completion', hint: 'Finished result, handover' },
  { id: 'issue', label: 'Issue', hint: 'Damage, missing goods, obstacles' },
  { id: 'other', label: 'Other', hint: 'Anything else worth documenting' },
];

export const DEFAULT_PHOTO_CATEGORY: PhotoCategory = 'before';

export const categoryLabel = (id?: string) =>
  PHOTO_CATEGORIES.find(c => c.id === id)?.label ?? 'Other';

export interface PhotoPosition {
  lat: number;
  lng: number;
  accuracy?: number;
}

/** Best-effort GPS fix. Never rejects — returns null when unavailable or denied. */
export function capturePosition(timeoutMs = 8000): Promise<PhotoPosition | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise(resolve => {
    let settled = false;
    const done = (value: PhotoPosition | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = setTimeout(() => done(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      pos => {
        clearTimeout(timer);
        done({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
        });
      },
      () => {
        clearTimeout(timer);
        done(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
    );
  });
}

export const formatCaptureTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const positionLink = (pos?: PhotoPosition | null) =>
  pos ? `https://www.google.com/maps/search/?api=1&query=${pos.lat},${pos.lng}` : null;

export const formatPosition = (pos?: PhotoPosition | null) =>
  pos ? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` : '';
