// Rules that must be satisfied before an order can be marked Complete.
// Templates (src/lib/projectTemplates.ts) define the checklist, the required
// photos and the required sign-offs; these defaults are used when no template
// is attached to the order.
import { getTemplate, type ProjectTemplate } from '@/lib/projectTemplates';

export const MIN_REQUIRED_PHOTOS = 2;

export const COMPLETION_CHECKLIST: { id: string; label: string }[] = [
  { id: 'installed', label: 'Installation finished as ordered' },
  { id: 'tested', label: 'Function tested and working' },
  { id: 'cleaned', label: 'Work area cleaned and waste removed' },
  { id: 'materials', label: 'Materials and tools accounted for' },
];

const DEFAULT_SIGNOFFS = [{ id: 'customer', label: 'Customer sign-off', by: 'customer' as const }];

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
}

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

  return [
    {
      id: 'photos',
      label: `Required photos uploaded (${s.photoCount}/${minPhotos})`,
      hint: `Add at least ${minPhotos} photos in the Report tab.`,
      tab: 'report',
      met: s.photoCount >= minPhotos,
    },
    {
      id: 'checklist',
      label: `Checklist completed (${checklist.length - missingChecks.length}/${checklist.length})`,
      hint: missingChecks.length
        ? `Still open: ${missingChecks.map(c => c.label).join(', ')}.`
        : 'All checklist items ticked.',
      tab: 'report',
      met: missingChecks.length === 0,
    },
    ...signOffs.map(so => ({
      id: so.id === 'customer' ? 'signature' : `signoff:${so.id}`,
      label: so.label,
      hint:
        so.by === 'customer'
          ? 'Collect the customer signature in the Sign-off tab.'
          : 'Sign off the work yourself in the Sign-off tab.',
      tab: 'summary' as const,
      met: Boolean(signOffValue(s, so.id)),
    })),
    {
      id: 'report',
      label: 'Installation report submitted',
      hint: 'Write and submit the installation report in the Report tab.',
      tab: 'report',
      met: s.reportSubmitted,
    },
  ];
};

export const missingRequirements = (s: CompletionState, template?: TemplateInput) =>
  completionRequirements(s, template).filter(r => !r.met);

export const canComplete = (s: CompletionState, template?: TemplateInput) =>
  missingRequirements(s, template).length === 0;
