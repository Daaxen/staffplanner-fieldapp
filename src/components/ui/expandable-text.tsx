import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** One-line clamp with a "Visa mer" toggle shown only when the text overflows. */
export function ExpandableText({ text, className }: { text?: string | null; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setOverflows(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
  }, [text, open]);
  if (!text) return null;
  return (
    <div className={className}>
      <div ref={ref} className={cn('break-words', open ? 'whitespace-pre-wrap' : 'truncate')}>{text}</div>
      {(overflows || open) && (
        <button type="button" onClick={e => { e.stopPropagation(); setOpen(o => !o); }} className="text-xs font-semibold text-primary hover:underline">
          {open ? 'Visa mindre' : 'Visa mer'}
        </button>
      )}
    </div>
  );
}
