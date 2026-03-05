import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DraggableBarProps {
  left: number;
  width: number;
  top: number;
  height: number;
  colWidth: number;
  projectStartDate: string;
  projectEndDate: string;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
  onClick?: () => void;
  onDragEnd: (newStartDate: string, newEndDate: string) => void;
}

const DraggableBar = ({
  left, width, top, height, colWidth,
  projectStartDate, projectEndDate,
  className, style, children, onClick, onDragEnd,
}: DraggableBarProps) => {
  const barRef = useRef<HTMLDivElement>(null);
  const dragInfo = useRef<{
    type: 'move' | 'left' | 'right';
    startX: number;
    origLeft: number;
    origWidth: number;
    moved: boolean;
  } | null>(null);

  const handleMouseDown = (e: React.MouseEvent, type: 'move' | 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    dragInfo.current = { type, startX: e.clientX, origLeft: left, origWidth: width, moved: false };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragInfo.current || !barRef.current) return;
      const dx = ev.clientX - dragInfo.current.startX;
      if (Math.abs(dx) > 3) dragInfo.current.moved = true;
      if (!dragInfo.current.moved) return;

      const { type: t, origLeft: ol, origWidth: ow } = dragInfo.current;
      if (t === 'move') {
        barRef.current.style.left = `${ol + dx}px`;
      } else if (t === 'left') {
        const nw = ow - dx;
        if (nw > 20) {
          barRef.current.style.left = `${ol + dx}px`;
          barRef.current.style.width = `${nw}px`;
        }
      } else {
        const nw = ow + dx;
        if (nw > 20) barRef.current.style.width = `${nw}px`;
      }
    };

    const onMouseUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (!dragInfo.current) return;

      const { type: t, startX, moved } = dragInfo.current;
      dragInfo.current = null;

      // Reset visual position
      if (barRef.current) {
        barRef.current.style.left = `${left}px`;
        barRef.current.style.width = `${width}px`;
      }

      if (!moved) {
        onClick?.();
        return;
      }

      const dx = ev.clientX - startX;
      const daysDelta = Math.round(dx / colWidth);

      const pStart = new Date(projectStartDate);
      const pEnd = new Date(projectEndDate);

      if (t === 'move') {
        if (daysDelta === 0) return;
        pStart.setDate(pStart.getDate() + daysDelta);
        pEnd.setDate(pEnd.getDate() + daysDelta);
      } else if (t === 'left') {
        pStart.setDate(pStart.getDate() + daysDelta);
        if (pStart >= pEnd) return;
      } else {
        pEnd.setDate(pEnd.getDate() + daysDelta);
        if (pEnd <= pStart) return;
      }

      onDragEnd(
        pStart.toISOString().split('T')[0],
        pEnd.toISOString().split('T')[0],
      );
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      ref={barRef}
      className={cn('absolute select-none', className)}
      style={{ left, width, top, height, ...style }}
      onMouseDown={(e) => handleMouseDown(e, 'move')}
    >
      {/* Left resize handle */}
      <div
        className="absolute left-0 top-0 w-2 h-full cursor-col-resize z-10 group"
        onMouseDown={(e) => handleMouseDown(e, 'left')}
      >
        <div className="w-0.5 h-3/5 my-auto mt-[20%] ml-0.5 rounded-full opacity-0 group-hover:opacity-100 bg-foreground/40 transition-opacity" />
      </div>
      {children}
      {/* Right resize handle */}
      <div
        className="absolute right-0 top-0 w-2 h-full cursor-col-resize z-10 group"
        onMouseDown={(e) => handleMouseDown(e, 'right')}
      >
        <div className="w-0.5 h-3/5 my-auto mt-[20%] mr-0.5 ml-auto rounded-full opacity-0 group-hover:opacity-100 bg-foreground/40 transition-opacity" />
      </div>
    </div>
  );
};

export default DraggableBar;
