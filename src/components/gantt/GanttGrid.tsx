import { cn } from '@/lib/utils';

interface GanttGridProps {
  days: Date[];
  colWidth: number;
  totalHeight: number;
  todayStr: string;
}

const GanttGrid = ({ days, colWidth, totalHeight, todayStr }: GanttGridProps) => {
  return (
    <>
      {days.map((day, i) => {
        const isToday = day.toISOString().split('T')[0] === todayStr;
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
        return (
          <div
            key={i}
            className={cn(
              "absolute top-0 border-r border-gantt-grid",
              isToday && "bg-gantt-today/5",
              isWeekend && "bg-muted/30"
            )}
            style={{ left: i * colWidth, width: colWidth, height: totalHeight }}
          />
        );
      })}
      {/* Today line */}
      {(() => {
        const todayIdx = days.findIndex(d => d.toISOString().split('T')[0] === todayStr);
        if (todayIdx < 0) return null;
        return (
          <div
            className="absolute top-0 w-0.5 bg-gantt-today z-20 pointer-events-none"
            style={{ left: todayIdx * colWidth + colWidth / 2, height: totalHeight }}
          />
        );
      })()}
    </>
  );
};

export default GanttGrid;
