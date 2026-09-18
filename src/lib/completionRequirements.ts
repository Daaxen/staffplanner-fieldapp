// Rules that must be satisfied before an order can be marked Complete.

export const MIN_REQUIRED_PHOTOS = 2;

export const COMPLETION_CHECKLIST: { id: string; label: string }[] = [
  { id: 'installed', label: 'Installation finished as ordered' },
  { id: 'tested', label: 'Function tested and working' },
  { id: 'cleaned', label: 'Work area cleaned and waste removed' },
  { id: 'materials', label: 'Materials and tools accounted for' },
];

export interface CompletionState {
  photoCount: number;
  checkedItems: string[];
  signature: string | null;
  reportSubmitted: boolean;
}

export interface CompletionRequirement {
  id: 'photos' | 'checklist' | 'signature' | 'report';
  label: string;
  hint: string;
  tab: 'report' | 'summary';
  met: boolean;
}

export const completionRequirements = (s: CompletionState): CompletionRequirement[] => {
  const missingChecks = COMPLETION_CHECKLIST.filter(c => !s.checkedItems.includes(c.id));
  return [
    {
      id: 'photos',
      label: `Required photos uploaded (${s.photoCount}/${MIN_REQUIRED_PHOTOS})`,
      hint: `Add at least ${MIN_REQUIRED_PHOTOS} photos in the Report tab.`,
      tab: 'report',
      met: s.photoCount >= MIN_REQUIRED_PHOTOS,
    },
    {
      id: 'checklist',
      label: `Checklist completed (${COMPLETION_CHECKLIST.length - missingChecks.length}/${COMPLETION_CHECKLIST.length})`,
      hint: missingChecks.length
        ? `Still open: ${missingChecks.map(c => c.label).join(', ')}.`
        : 'All checklist items ticked.',
      tab: 'report',
      met: missingChecks.length === 0,
    },
    {
      id: 'signature',
      label: 'Customer signature collected',
      hint: 'Collect the customer signature in the Sign-off tab.',
      tab: 'summary',
      met: Boolean(s.signature && s.signature.trim().length > 1),
    },
    {
      id: 'report',
      label: 'Installation report submitted',
      hint: 'Write and submit the installation report in the Report tab.',
      tab: 'report',
      met: s.reportSubmitted,
    },
  ];
};

export const missingRequirements = (s: CompletionState) =>
  completionRequirements(s).filter(r => !r.met);

export const canComplete = (s: CompletionState) => missingRequirements(s).length === 0;
