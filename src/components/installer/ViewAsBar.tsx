import { useEffect } from 'react';
import { Eye, LayoutDashboard } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useInstallersList } from '@/lib/appData';
import { setViewMode, stopViewingAs, useViewAs, viewAsInstaller } from '@/lib/viewAs';
import { disableReadOnlyGuard, enableReadOnlyGuard } from '@/lib/readOnlyGuard';

/** Superuser control in the installer app: switch views and pick whose app to look at. */
const ViewAsBar = () => {
  const { isSuperuser } = useAuth();
  const viewAs = useViewAs();
  const installers = useInstallersList();
  const readOnly = isSuperuser && !!viewAs.installerId;

  useEffect(() => {
    if (!readOnly) { disableReadOnlyGuard(); return; }
    enableReadOnlyGuard(() => toast.error('Endast läsläge – du tittar som en annan montör. Inget sparades.'));
    return () => disableReadOnlyGuard();
  }, [readOnly]);

  if (!isSuperuser) return null;

  return (
    <div className={readOnly ? 'shrink-0 bg-status-in-progress text-foreground px-3 py-2' : 'shrink-0 bg-secondary text-foreground px-3 py-2'}>
      <div className="flex items-center gap-2 text-xs">
        <Eye className="w-4 h-4 shrink-0" />
        <select
          aria-label="Visa som"
          className="flex-1 min-w-0 rounded-md border border-border bg-background px-2 py-1 text-xs"
          value={viewAs.installerId ?? ''}
          onChange={e => {
            const id = e.target.value || null;
            const name = installers.find(i => i.id === id)?.name ?? null;
            if (id) void viewAsInstaller(id, name); else stopViewingAs();
          }}
        >
          <option value="">Visa som: mig själv</option>
          {installers.map(i => <option key={i.id} value={i.id}>Visa som: {i.name}</option>)}
        </select>
        {readOnly && (
          <button onClick={stopViewingAs} className="rounded-md border border-border bg-background px-2 py-1 font-medium">Avsluta</button>
        )}
        <button
          onClick={() => { setViewMode('admin'); window.location.assign('/app'); }}
          className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 font-medium"
        >
          <LayoutDashboard className="w-3.5 h-3.5" /> Admin-vy
        </button>
      </div>
      {readOnly && (
        <p className="mt-1 text-xs font-semibold">Du tittar som {viewAs.installerName ?? 'en montör'} – endast läsläge</p>
      )}
    </div>
  );
};

export default ViewAsBar;
