import { useState } from 'react';
import { ChevronLeft, ChevronRight, Lightbulb, TriangleAlert, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { installerGuide, type GuideTarget } from '@/lib/installerGuide';
import { cn } from '@/lib/utils';

interface Props { onGoTo: (target: GuideTarget) => void }

const InstallerGuide = ({ onGoTo }: Props) => {
  const [chapterIdx, setChapterIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [zoom, setZoom] = useState<string | null>(null);
  const chapter = installerGuide[chapterIdx];
  const step = chapter.steps[stepIdx];
  const isLastStep = stepIdx === chapter.steps.length - 1;

  const pickChapter = (i: number) => { setChapterIdx(i); setStepIdx(0); };
  const next = () => {
    if (!isLastStep) setStepIdx(stepIdx + 1);
    else if (chapterIdx < installerGuide.length - 1) pickChapter(chapterIdx + 1);
  };
  const prev = () => {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
    else if (chapterIdx > 0) { const c = chapterIdx - 1; setChapterIdx(c); setStepIdx(installerGuide[c].steps.length - 1); }
  };

  return (
    <div className="p-4 pb-24 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">Guide för montörer</h2>
        <p className="text-sm text-muted-foreground">Steg för steg. Följ de röda siffrorna i bilderna.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {installerGuide.map((c, i) => (
          <button key={c.id} onClick={() => pickChapter(i)}
            className={cn('rounded-md border px-3 py-2 text-left text-sm font-semibold',
              i === chapterIdx ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground')}>
            {c.title}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <p className="text-sm text-muted-foreground">{chapter.intro}</p>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">{step.title}</h3>
          <span className="text-xs text-muted-foreground">Steg {stepIdx + 1} av {chapter.steps.length}</span>
        </div>
        <button onClick={() => setZoom(step.image)} className="block w-full overflow-hidden rounded-md border border-border">
          <img src={step.image} alt={step.title} className="w-full h-auto" loading="lazy" />
        </button>
        <p className="text-[11px] text-muted-foreground text-center">Tryck på bilden för att förstora</p>
        <ol className="space-y-2">
          {step.callouts.map(c => (
            <li key={c.n} className="flex gap-3 text-sm text-foreground">
              <span className="shrink-0 w-6 h-6 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">{c.n}</span>
              <span>{c.text}</span>
            </li>
          ))}
        </ol>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={prev} disabled={chapterIdx === 0 && stepIdx === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" />Föregående
          </Button>
          <Button className="flex-1" onClick={next} disabled={isLastStep && chapterIdx === installerGuide.length - 1}>
            Nästa<ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-secondary p-3 flex gap-2 text-sm text-foreground">
        <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-primary" /><span><b>Tips:</b> {chapter.tip}</span>
      </div>
      <div className="rounded-lg border border-border bg-card p-3 text-sm text-foreground space-y-1">
        <p className="font-semibold flex items-center gap-2"><TriangleAlert className="w-4 h-4 text-destructive" />Vanliga misstag</p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">{chapter.mistakes.map(m => <li key={m}>{m}</li>)}</ul>
      </div>
      {chapter.goTo && (
        <Button variant="outline" className="w-full h-12" onClick={() => onGoTo(chapter.goTo!)}>
          Ta mig dit<ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      )}

      <Dialog open={!!zoom} onOpenChange={o => !o && setZoom(null)}>
        <DialogContent className="max-w-md p-2">
          <DialogTitle className="sr-only">Förstorad bild</DialogTitle>
          {zoom && <img src={zoom} alt="Förstorad skärmbild" className="w-full rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstallerGuide;
