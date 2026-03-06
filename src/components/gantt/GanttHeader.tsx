import { cn } from '@/lib/utils';
import { isSwedishHoliday } from '@/utils/swedishHolidays';

interface GanttHeaderProps {
  days: Date[];
  colWidth: number;
  headerHeight: number;
  todayStr: string;
  viewMode?: 'day' | 'week' | 'month';
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const GanttHeader = ({ days, colWidth, headerHeight, todayStr, viewMode = 'week' }: GanttHeaderProps) => {
  const dayNames = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
  const hours = Array.from({ length: 7 }, (_, i) => 6 + i * 2);

  // Group days by week number
  const weekGroups: { weekNum: number; year: number; count: number }[] = [];
  days.forEach((day) => {
    const wn = getWeekNumber(day);
    const yr = day.getFullYear();
    const last = weekGroups[weekGroups.length - 1];
    if (last && last.weekNum === wn && last.year === yr) {
      last.count++;
    } else {
      weekGroups.push({ weekNum: wn, year: yr, count: 1 });
    }
  });

  const isMonday = (day: Date) => day.getDay() === 1;

  if (viewMode === 'day') {
    return (
      <div>
        {/* Day names row */}
        <div className="flex border-b border-border bg-gantt-header" style={{ height: 24 }}>
          {days.map((day, i) => {
            const dateStr = day.toISOString().split('T')[0];
            const isToday = dateStr === todayStr;
            const holiday = isSwedishHoliday(dateStr);
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center justify-center border-r border-border text-[10px] font-semibold uppercase tracking-wider",
                  isToday && "bg-gantt-today/10",
                  holiday ? "text-gantt-holiday" : "text-muted-foreground"
                )}
                style={{ width: colWidth }}
                title={holiday || undefined}
              >
                {dayNames[day.getDay()]} {day.getDate()} {day.toLocaleDateString('sv', { month: 'short' })}
                {holiday && ' 🔴'}
              </div>
            );
          })}
        </div>
        {/* Hour markers row */}
        <div className="flex border-b border-border bg-gantt-header" style={{ height: headerHeight - 24 }}>
          {days.map((day, dIdx) => {
            const hourWidth = colWidth / hours.length;
            return (
              <div key={dIdx} className="flex border-r border-border" style={{ width: colWidth }}>
                {hours.map((h) => (
                  <div
                    key={h}
                    className="flex items-center justify-center border-r border-border/50 text-[9px] text-muted-foreground"
                    style={{ width: hourWidth }}
                  >
                    {String(h).padStart(2, '0')}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Week number row */}
      <div className="flex border-b border-border bg-gantt-header" style={{ height: 24 }}>
        {weekGroups.map((wg, i) => (
          <div
            key={`${wg.year}-w${wg.weekNum}-${i}`}
            className="flex items-center justify-center border-r-2 border-gantt-week-border text-[10px] font-bold text-foreground uppercase tracking-wider bg-secondary/50"
            style={{ width: wg.count * colWidth }}
          >
            V{wg.weekNum}
          </div>
        ))}
      </div>
      {/* Day headers */}
      <div className="flex border-b border-border bg-gantt-header" style={{ height: headerHeight - 24 }}>
        {days.map((day, i) => {
          const dateStr = day.toISOString().split('T')[0];
          const isToday = dateStr === todayStr;
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const holiday = isSwedishHoliday(dateStr);
          const weekBorder = isMonday(day) && i > 0;
          return (
            <div
              key={i}
              className={cn(
                "flex flex-col items-center justify-center shrink-0",
                weekBorder ? "border-l-2 border-l-gantt-week-border border-r border-r-border" : "border-r border-border",
                isToday && "bg-gantt-today/10",
                isWeekend && !holiday && "bg-muted/50",
                holiday && "bg-gantt-holiday/8"
              )}
              style={{ width: colWidth }}
              title={holiday || undefined}
            >
              <span className={cn(
                "text-[10px]",
                holiday ? "text-gantt-holiday font-semibold" : "text-muted-foreground"
              )}>
                {dayNames[day.getDay()]}
              </span>
              <span className={cn(
                "text-sm font-semibold",
                holiday ? "text-gantt-holiday" : isToday ? "text-gantt-today" : "text-foreground"
              )}>
                {day.getDate()}
              </span>
              {holiday && (
                <span className="text-[7px] text-gantt-holiday font-medium leading-tight truncate max-w-full px-0.5">
                  {holiday}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GanttHeader;
