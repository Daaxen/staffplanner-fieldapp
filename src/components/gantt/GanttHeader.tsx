import { cn } from '@/lib/utils';

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
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 10 }, (_, i) => i + 7); // 07:00 - 16:00

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

  if (viewMode === 'day') {
    return (
      <div className="sticky top-0 z-10">
        {/* Day names row */}
        <div className="flex border-b border-border bg-gantt-header" style={{ height: 24 }}>
          {days.map((day, i) => {
            const isToday = day.toISOString().split('T')[0] === todayStr;
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center justify-center border-r border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider",
                  isToday && "bg-gantt-today/10"
                )}
                style={{ width: colWidth }}
              >
                {dayNames[day.getDay()]} {day.getDate()} {day.toLocaleDateString('en', { month: 'short' })}
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
    <div className="sticky top-0 z-10">
      {/* Week number row */}
      <div className="flex border-b border-border bg-gantt-header" style={{ height: 24 }}>
        {weekGroups.map((wg, i) => (
          <div
            key={`${wg.year}-w${wg.weekNum}-${i}`}
            className="flex items-center justify-center border-r border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider"
            style={{ width: wg.count * colWidth }}
          >
            W{wg.weekNum}
          </div>
        ))}
      </div>
      {/* Day headers */}
      <div className="flex border-b border-border bg-gantt-header" style={{ height: headerHeight - 24 }}>
        {days.map((day, i) => {
          const isToday = day.toISOString().split('T')[0] === todayStr;
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          return (
            <div
              key={i}
              className={cn(
                "flex flex-col items-center justify-center border-r border-border shrink-0",
                isToday && "bg-gantt-today/10",
                isWeekend && "bg-muted/50"
              )}
              style={{ width: colWidth }}
            >
              <span className="text-[10px] text-muted-foreground">{dayNames[day.getDay()]}</span>
              <span className={cn("text-sm font-semibold", isToday ? "text-gantt-today" : "text-foreground")}>{day.getDate()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GanttHeader;
