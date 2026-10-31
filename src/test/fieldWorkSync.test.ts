import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  records: new Map<string, unknown>(),
  upsert: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: () => ({ upsert: mocks.upsert }),
  },
}));
vi.mock('@/lib/installerIdentity', () => ({ getMyInstallerId: async () => 'installer-1' }));
vi.mock('@/lib/appData', () => ({ ensureProjectRowId: async () => 'project-1' }));
vi.mock('@/lib/offline/idb', () => ({
  idbGet: async (_store: string, key: string) => mocks.records.get(key),
  idbSet: async (_store: string, key: string, value: unknown) => { mocks.records.set(key, value); },
  idbAll: async () => [...mocks.records.values()],
  idbDel: vi.fn(),
}));

import { emptyWork, loadWork, saveWork, syncFieldWork } from '@/lib/offline/fieldWork';

describe('field report upload race', () => {
  beforeEach(() => {
    mocks.records.clear();
    mocks.upsert.mockReset();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('uploads a submitted report after an in-flight draft without overwriting it', async () => {
    let finishDraft: ((value: { error: null }) => void) | undefined;
    const draftUpload = new Promise<{ error: null }>(resolve => { finishDraft = resolve; });
    mocks.upsert.mockReturnValueOnce(draftUpload).mockResolvedValue({ error: null });
    const draft = await saveWork({ ...emptyWork('ORD-1'), reportText: 'N/A' });
    const draftSync = syncFieldWork();
    await vi.waitFor(() => expect(mocks.upsert).toHaveBeenCalledTimes(1));
    await saveWork({ ...draft, reportSubmitted: true });
    const submittedSync = syncFieldWork();
    if (!finishDraft) throw new Error('Draft upload was not started');
    finishDraft({ error: null });
    await Promise.all([draftSync, submittedSync]);
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.upsert.mock.calls[0][0].submitted_at).toBeNull();
    expect(mocks.upsert.mock.calls[1][0]).toEqual(expect.objectContaining({ report_text: 'N/A', submitted_at: expect.any(String) }));
    expect(await loadWork('ORD-1')).toEqual(expect.objectContaining({ reportText: 'N/A', reportSubmitted: true, dirty: false }));
  });
});