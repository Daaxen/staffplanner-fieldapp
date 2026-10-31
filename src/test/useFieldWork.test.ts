import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFieldWork } from '@/hooks/useFieldWork';
import { emptyWork, hydrateWork, loadWork, saveWork, syncFieldWork } from '@/lib/offline/fieldWork';

vi.mock('@/hooks/useOffline', () => ({ useOnlineStatus: () => true }));
vi.mock('@/lib/offline/fieldWork', () => ({
  emptyWork: (projectRef: string) => ({
    projectRef, reportText: '', reportSubmitted: false, checkedItems: [], signature: '',
    signOffs: {}, photos: [], dirty: false, updatedAt: '2026-10-31T08:33:00Z',
  }),
  hydrateWork: vi.fn(), loadWork: vi.fn(), saveWork: vi.fn(), syncFieldWork: vi.fn(),
}));

describe('field report submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hydrateWork).mockResolvedValue(emptyWork('ORD-1'));
    vi.mocked(saveWork).mockImplementation(async work => ({ ...work, dirty: true }));
    vi.mocked(syncFieldWork).mockResolvedValue({ synced: 1, failed: 0 });
    vi.mocked(loadWork).mockResolvedValue({ ...emptyWork('ORD-1'), reportSubmitted: true });
  });

  it('submits the latest short report and confirms its saved result', async () => {
    const { result } = renderHook(() => useFieldWork('ORD-1'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => {
      // Same render: typing and submitting must not overwrite the latest text.
      const edit = result.current.update({ reportText: 'N/A' });
      expect(await result.current.submitReport()).toBe(true);
      await edit;
    });
    expect(saveWork).toHaveBeenLastCalledWith(expect.objectContaining({ reportText: 'N/A', reportSubmitted: true }));
  });

  it('rejects a blank report', async () => {
    const { result } = renderHook(() => useFieldWork('ORD-1'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await expect(result.current.submitReport()).rejects.toThrow('Skriv en installationsrapport först.');
    expect(saveWork).not.toHaveBeenCalled();
  });

  it('does not claim submission if saving fails', async () => {
    vi.mocked(hydrateWork).mockResolvedValue({ ...emptyWork('ORD-1'), reportText: 'Klart' });
    vi.mocked(saveWork).mockRejectedValue(new Error('Storage unavailable'));
    const { result } = renderHook(() => useFieldWork('ORD-1'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => {
      await expect(result.current.submitReport()).rejects.toThrow('Storage unavailable');
    });
  });

  it('reports a queued save rather than a submitted report if sync fails', async () => {
    vi.mocked(hydrateWork).mockResolvedValue({ ...emptyWork('ORD-1'), reportText: 'Klart' });
    vi.mocked(syncFieldWork).mockResolvedValue({ synced: 0, failed: 1 });
    vi.mocked(loadWork).mockResolvedValue({ ...emptyWork('ORD-1'), dirty: true });
    const { result } = renderHook(() => useFieldWork('ORD-1'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => { expect(await result.current.submitReport()).toBe(false); });
  });
});