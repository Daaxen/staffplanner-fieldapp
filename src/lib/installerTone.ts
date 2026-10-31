// Colour language for the installer app: green = done, yellow = in progress,
// blue = planned/to do, red = problem/missing, gray = cancelled/optional.
export type Tone = 'done' | 'progress' | 'planned' | 'problem' | 'neutral';

export const statusTone: Record<string, Tone> = {
  completed: 'done',
  'in-progress': 'progress',
  scheduled: 'planned',
  open: 'planned',
  'on-hold': 'problem',
  cancelled: 'neutral',
};

export const toneFor = (status: string): Tone => statusTone[status] ?? 'neutral';

export const toneClasses: Record<Tone, { border: string; badge: string; surface: string; icon: string; dot: string }> = {
  done: { border: 'border-status-completed', badge: 'bg-status-completed text-white', surface: 'bg-status-completed/10 border-status-completed/40', icon: 'text-status-completed', dot: 'bg-status-completed' },
  progress: { border: 'border-status-in-progress', badge: 'bg-status-in-progress text-foreground', surface: 'bg-status-in-progress/15 border-status-in-progress/50', icon: 'text-status-in-progress', dot: 'bg-status-in-progress' },
  planned: { border: 'border-status-scheduled', badge: 'bg-status-scheduled/15 text-status-scheduled border border-status-scheduled/40', surface: 'bg-status-scheduled/10 border-status-scheduled/40', icon: 'text-status-scheduled', dot: 'bg-status-scheduled' },
  problem: { border: 'border-destructive', badge: 'bg-destructive/15 text-destructive border border-destructive/40', surface: 'bg-destructive/10 border-destructive/40', icon: 'text-destructive', dot: 'bg-destructive' },
  neutral: { border: 'border-status-cancelled', badge: 'bg-muted text-muted-foreground border border-border', surface: 'bg-muted border-border', icon: 'text-muted-foreground', dot: 'bg-status-cancelled' },
};
