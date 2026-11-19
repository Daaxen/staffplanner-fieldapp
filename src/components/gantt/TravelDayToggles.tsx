import { Car } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { travelDates } from '@/lib/travelDays';

const label = (iso?: string) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' }) : 'välj datum först';

type Props = { before: boolean; after: boolean; onBefore: (v: boolean) => void; onAfter: (v: boolean) => void; startDate?: string; endDate?: string };

const TravelDayToggles = ({ before, after, onBefore, onAfter, startDate, endDate }: Props) => {
  const t = travelDates({ startDate, endDate, travelBefore: true, travelAfter: true });
  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <p className="text-sm font-semibold flex items-center gap-1.5"><Car className="w-4 h-4" />Resdagar</p>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox checked={before} onCheckedChange={v => onBefore(v === true)} />
        Resdag dit <span className="text-xs text-muted-foreground">({label(t.before)}, dagen före start)</span>
      </label>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox checked={after} onCheckedChange={v => onAfter(v === true)} />
        Resdag hem <span className="text-xs text-muted-foreground">({label(t.after)}, dagen efter slut)</span>
      </label>
    </div>
  );
};

export default TravelDayToggles;
