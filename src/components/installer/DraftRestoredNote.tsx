import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearDrafts, draftScope, hasDrafts } from '@/hooks/useDraftState';

/** Shows once when an order is opened with unsaved input restored from the phone. */
const DraftRestoredNote = ({ projectId }: { projectId: string }) => {
  const [show, setShow] = useState(() => hasDrafts(draftScope(projectId)));
  if (!show) return null;
  return (
    <div className="mx-3 mt-2 flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-xs">
      <RotateCcw className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">Osparat utkast återställt</span>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { clearDrafts(draftScope(projectId)); setShow(false); }}>Rensa</Button>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShow(false)}>OK</Button>
    </div>
  );
};
export default DraftRestoredNote;
