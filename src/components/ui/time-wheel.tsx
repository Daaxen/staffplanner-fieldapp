import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const ITEM_H = 36;
const VISIBLE = 5;
const pad = (n: number) => n.toString().padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

/** Rounds "HH:MM" to the nearest quarter hour. Empty input falls back to the given default. */
export function roundToQuarter(value: string, fallback = '07:00'): { h: number; m: number } {
  const match = /^(\d{1,2}):(\d{2})/.exec(value || fallback) ?? /^(\d{1,2}):(\d{2})/.exec(fallback)!;
  let total = Number(match[1]) * 60 + Math.round(Number(match[2]) / 15) * 15;
  total = Math.min(total, 23 * 60 + 45);
  return { h: Math.floor(total / 60), m: total % 60 };
}

function WheelColumn({ items, value, onChange, label, format = pad, suffix }: {
  items: number[]; value: number; onChange: (v: number) => void; label: string;
  format?: (n: number) => string; suffix?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number>();
  const index = Math.max(0, items.indexOf(value));

  useEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ITEM_H) !== index) el.scrollTo?.({ top: index * ITEM_H });
  }, [index]);

  const onScroll = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
      if (items[i] !== value) onChange(items[i]);
    }, 100);
  };

  const step = (d: number) => {
    const i = Math.min(items.length - 1, Math.max(0, index + d));
    onChange(items[i]);
  };

  return (
    <div
      ref={ref}
      role="spinbutton"
      aria-label={label}
      aria-valuenow={value}
      aria-valuetext={suffix ? `${format(value)} ${suffix}` : format(value)}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={e => {
        if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
        if (e.key === 'ArrowDown') { e.preventDefault(); step(1); }
      }}
      className="relative flex-1 overflow-y-scroll snap-y snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
      style={{ height: ITEM_H * VISIBLE, paddingTop: ITEM_H * 2, paddingBottom: ITEM_H * 2 }}
    >
      {items.map((n, i) => {
        const dist = Math.abs(i - index);
        return (
          <button
            type="button"
            tabIndex={-1}
            key={n}
            onClick={() => onChange(n)}
            className={cn(
              'block w-full snap-center text-center tabular-nums transition-colors',
              dist === 0 ? 'text-lg font-semibold text-foreground' : dist === 1 ? 'text-base text-muted-foreground' : 'text-sm text-muted-foreground/50',
            )}
            style={{ height: ITEM_H, lineHeight: `${ITEM_H}px` }}
          >
            {format(n)}{suffix && dist === 0 ? <span className="ml-1 text-xs font-normal text-muted-foreground">{suffix}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

interface TimeWheelProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  fallback?: string;
}

/** Scroll-wheel time picker: hours 00–23 and minutes in quarter-hour steps. */
export function TimeWheel({ id, label, value, onChange, fallback }: TimeWheelProps) {
  const { h, m } = roundToQuarter(value, fallback);
  const emit = (nh: number, nm: number) => onChange(`${pad(nh)}:${pad(nm)}`);
  return (
    <div id={id} className="relative flex items-stretch rounded-lg border border-border bg-card px-1">
      <div aria-hidden className="pointer-events-none absolute inset-x-1 rounded-md bg-primary/10" style={{ top: ITEM_H * 2, height: ITEM_H }} />
      <WheelColumn label={`${label} timmar`} items={HOURS} value={h} onChange={nh => emit(nh, m)} />
      <span aria-hidden className="relative self-center px-0.5 text-lg font-semibold text-foreground">:</span>
      <WheelColumn label={`${label} minuter`} items={MINUTES} value={m} onChange={nm => emit(h, nm)} />
    </div>
  );
}

const DURATION_HOURS = Array.from({ length: 13 }, (_, i) => i);

/** Splits decimal hours into whole hours and quarter minutes (max 12 h). */
export function splitDuration(hours: number): { h: number; m: number } {
  const total = Math.min(12 * 60, Math.max(0, Math.round((hours * 60) / 15) * 15));
  return { h: Math.floor(total / 60), m: total % 60 };
}

export const joinDuration = (h: number, m: number) => Math.min(12, h + m / 60);

interface DurationWheelProps {
  id?: string;
  label: string;
  hint?: string;
  value: number;
  onChange: (hours: number) => void;
}

/** Scroll-wheel for a duration (travel time) in a warm tone to stand apart from clock wheels. */
export function DurationWheel({ id, label, hint, value, onChange }: DurationWheelProps) {
  const { h, m } = splitDuration(value);
  return (
    <div id={id} className="rounded-lg border border-travel/40 bg-travel-surface p-2">
      <p className="px-1 text-sm font-medium text-foreground">{label}</p>
      <div className="relative mx-auto flex max-w-[220px] items-stretch">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 rounded-md bg-travel/25" style={{ top: ITEM_H * 2, height: ITEM_H }} />
        <WheelColumn label={`${label} timmar`} items={DURATION_HOURS} value={h} onChange={nh => onChange(joinDuration(nh, nh === 12 ? 0 : m))} format={String} suffix="h" />
        <WheelColumn label={`${label} minuter`} items={MINUTES} value={m} onChange={nm => onChange(joinDuration(h, nm))} suffix="min" />
      </div>
      {hint && <p className="px-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
