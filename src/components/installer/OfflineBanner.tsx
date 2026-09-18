import { CloudOff, RefreshCw, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineBannerProps {
  online: boolean;
  pending: number;
  syncing: boolean;
  onSync: () => void;
  className?: string;
}

const OfflineBanner = ({ online, pending, syncing, onSync, className }: OfflineBannerProps) => {
  if (online && pending === 0) return null;

  return (
    <div
      className={cn(
        'shrink-0 flex items-center gap-2 px-4 py-2 text-xs font-medium',
        online ? 'bg-status-in-progress/15 text-foreground' : 'bg-status-on-hold/20 text-foreground',
        className,
      )}
    >
      {online ? <UploadCloud className="w-4 h-4 text-status-in-progress" /> : <CloudOff className="w-4 h-4 text-status-on-hold" />}
      <span className="flex-1 min-w-0">
        {online
          ? `${pending} job${pending === 1 ? '' : 's'} waiting to upload`
          : pending > 0
            ? `Offline — ${pending} job${pending === 1 ? '' : 's'} saved on this phone`
            : 'Offline — your work is saved on this phone'}
      </span>
      {online && pending > 0 && (
        <button
          onClick={onSync}
          disabled={syncing}
          className="flex items-center gap-1 rounded-md bg-background/70 px-2 py-1 disabled:opacity-60"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
          {syncing ? 'Syncing' : 'Sync now'}
        </button>
      )}
    </div>
  );
};

export default OfflineBanner;
