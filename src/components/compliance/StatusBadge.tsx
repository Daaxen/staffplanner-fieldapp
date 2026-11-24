import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STATUS_LABEL, type FlagStatus } from '@/lib/foreignWork';

const tone: Record<FlagStatus, string> = {
  NORMAL: 'bg-status-completed/15 text-status-completed border-status-completed/30',
  WATCH: 'bg-status-in-progress/15 text-status-in-progress border-status-in-progress/30',
  REVIEW: 'bg-status-on-hold/15 text-status-on-hold border-status-on-hold/30',
  REACHED: 'bg-destructive/15 text-destructive border-destructive/30',
  NOT_VERIFIED: 'bg-muted text-muted-foreground border-border',
};
export const ForeignStatusBadge = ({ status, className }: { status: FlagStatus; className?: string }) => (
  <Badge variant="outline" className={cn('font-semibold', tone[status], className)}>{STATUS_LABEL[status]}</Badge>
);
