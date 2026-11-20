import { describe, it, expect, beforeEach } from 'vitest';
import { readDraft, writeDraft, setDraftUser, draftScope, hasDrafts, clearDrafts, DRAFT_MAX_AGE_MS } from '@/hooks/useDraftState';

describe('form drafts', () => {
  beforeEach(() => localStorage.clear());
  it('restores a written draft', () => {
    writeDraft('k', { note: 'hej' }, { note: '' });
    expect(readDraft('k')).toEqual({ note: 'hej' });
  });
  it('removes the draft when the form is reset after save', () => {
    writeDraft('k', 'text', '');
    writeDraft('k', '', '');
    expect(readDraft('k')).toBeUndefined();
  });
  it('ignores drafts older than 7 days', () => {
    writeDraft('k', 'text', '');
    expect(readDraft('k', Date.now() + DRAFT_MAX_AGE_MS + 1000)).toBeUndefined();
  });
  it('keeps drafts apart per user and order', () => {
    setDraftUser('stella'); writeDraft(draftScope('P1') + 'time', 'x', '');
    expect(hasDrafts(draftScope('P1'))).toBe(true);
    expect(hasDrafts(draftScope('P2'))).toBe(false);
    setDraftUser('felix');
    expect(hasDrafts(draftScope('P1'))).toBe(false);
    setDraftUser('stella'); clearDrafts(draftScope('P1'));
    expect(hasDrafts(draftScope('P1'))).toBe(false);
  });
});
