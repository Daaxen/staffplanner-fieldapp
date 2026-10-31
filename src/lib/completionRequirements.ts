// Rules that must be satisfied before an order can be marked Complete.
// Templates define checklists, suggested photos and available sign-offs.
// Photos and customer sign-offs never block completion; the written report,
// checklist and any installer sign-offs remain required.
import { getTemplate, type ProjectTemplate } from '@/lib/projectTemplates';

export const MIN_REQUIRED_PHOTOS = 2;

export const COMPLETION_CHECKLIST: { id: string; label: string }[] = [
  { id: 'installed', label: 'Installation finished as ordered' },
  { id: 'tested', label: 'Function tested and working' },
  { id: 'cleaned', label: 'Work area cleaned and waste removed' },
  { id: 'materials', label: 'Materials and tools accounted for' },
];

const DEFAULT_SIGNOFFS = [{ id: 'customer', label: 'Customer sign-off', by: 'customer' as const }];

/** A written report is required, but short reports must not be silently blocked. */
export const canSubmitReport = (text: string) => text.trim().length > 0;

export interface CompletionState {
  photoCount: number;
  checkedItems: string[];
  signature: string | null;
  reportSubmitted: boolean;
  /** Extra named sign-offs, keyed by sign-off id. 'customer' falls back to signature. */
  signOffs?: Record<string, string>;
}

export interface CompletionRequirement {
  id: string;
  label: string;
  hint: string;
  tab: 'report' | 'summary';
  met: boolean;
  /** Only required items block; recommended photos prompt an active skip choice. */
  severity: 'required' | 'recommended' | 'optional';
}

/** Key inside signOffs that records the installer actively skipped photos (ISO timestamp). */
export const PHOTOS_SKIPPED_KEY = '_photosSkipped';
export const photosSkippedAt = (s: { signOffs?: Record<string, string> }) =>
  s.signOffs?.[PHOTOS_SKIPPED_KEY] || null;

type TemplateInput = ProjectTemplate | string | null | undefined;

const resolve = (t: TemplateInput): ProjectTemplate | undefined =>
  typeof t === 'string' ? getTemplate(t) : t ?? undefined;

export const checklistFor = (t?: TemplateInput) => resolve(t)?.checklist ?? COMPLETION_CHECKLIST;
export const requiredPhotosFor = (t?: TemplateInput) => resolve(t)?.photos ?? [];
export const minPhotosFor = (t?: TemplateInput) => {
  const tpl = resolve(t);
  return tpl ? Math.max(tpl.photos.length, 1) : MIN_REQUIRED_PHOTOS;
};
export const signOffsFor = (t?: TemplateInput) => resolve(t)?.signOffs ?? DEFAULT_SIGNOFFS;

const signOffValue = (s: CompletionState, id: string) => {
  const explicit = s.signOffs?.[id];
  if (explicit && explicit.trim().length > 1) return explicit;
  if (id === 'customer' && s.signature && s.signature.trim().length > 1) return s.signature;
  return null;
};

export const completionRequirements = (
  s: CompletionState,
  template?: TemplateInput,
): CompletionRequirement[] => {
  const checklist = checklistFor(template);
  const minPhotos = minPhotosFor(template);
  const signOffs = signOffsFor(template);
  const missingChecks = checklist.filter(c => !s.checkedItems.includes(c.id));
  const skipped = !!photosSkippedAt(s);
  const enoughPhotos = s.photoCount >= minPhotos;

  return [
    {
      id: 'photos',
      label: enoughPhotos
        ? `Foton tillagda (${s.photoCount}/${minPhotos})`
        : skipped
          ? `Foton överhoppade (${s.photoCount}/${minPhotos})`
          : `Foton rekommenderas (${s.photoCount}/${minPhotos})`,
      hint: `Lägg gärna till minst ${minPhotos} foton – du kan välja att hoppa över.`,
      tab: 'report',
      met: enoughPhotos || skipped,
      severity: 'recommended',
    },
    {
      id: 'checklist',
      label: `Checklist completed (${checklist.length - missingChecks.length}/${checklist.length})`,
      hint: missingChecks.length
        ? `Still open: ${missingChecks.map(c => c.label).join(', ')}.`
        : 'All checklist items ticked.',
      tab: 'report',
      met: missingChecks.length === 0,
      severity: 'required',
    },
    ...signOffs.map(so => ({
      id: so.id === 'customer' ? 'signature' : `signoff:${so.id}`,
      label: so.by === 'customer' ? `${so.label} (optional)` : so.label,
      hint:
        so.by === 'customer'
          ? 'Customer signature is optional and does not prevent completion.'
          : 'Sign off the work yourself in the Sign-off tab.',
      tab: 'summary' as const,
      met: Boolean(signOffValue(s, so.id)),
      severity: so.by === 'customer' ? 'optional' as const : 'required' as const,
    })),
    {
      id: 'report',
      label: 'Installation report submitted',
      hint: 'Write and submit the installation report in the Report tab.',
      tab: 'report',
      met: s.reportSubmitted,
      severity: 'required',
    },
  ];
};

/** Only required items block completion. */
export const missingRequirements = (s: CompletionState, template?: TemplateInput) =>
  completionRequirements(s, template).filter(r => !r.met && r.severity === 'required');

/** Recommended items not done and not actively skipped. */
export const missingRecommendations = (s: CompletionState, template?: TemplateInput) =>
  completionRequirements(s, template).filter(r => !r.met && r.severity === 'recommended');

export const canComplete = (s: CompletionState, template?: TemplateInput) =>
  missingRequirements(s, template).length === 0;
