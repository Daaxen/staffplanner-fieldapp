import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProjectLogTab from '@/components/installer/reporting/ProjectLogTab';
import type { InstallerLogs } from '@/hooks/useInstallerLogs';

vi.mock('@/components/installer/reporting/TimeVarianceCard', () => ({ default: () => null }));
vi.mock('@/lib/receipts', () => ({
  missingReceiptMessage: () => '', receiptRequired: () => false, uploadReceipt: vi.fn(), RECEIPT_ACCEPT: 'image/*',
}));

afterEach(cleanup);

const makeLogs = () => ({
  loading: false, timeFor: () => [], expensesFor: () => [], categories: [], pendingMismatch: null,
  clearMismatch: vi.fn(), addTime: vi.fn().mockResolvedValue({ id: 'saved-entry' }),
}) as unknown as InstallerLogs;

describe('order work-day entry', () => {
  it.each([
    { label: 'Halvdag · 4 h', hours: 4, endTime: '13:30' },
    { label: 'Heldag · 8 h', hours: 8, endTime: '17:30' },
  ])('saves $hours work hours and keeps manually entered travel on the chosen day', async ({ label, hours, endTime }) => {
    const logs = makeLogs();
    render(<ProjectLogTab projectId="TEST-order" logs={logs} />);
    fireEvent.change(screen.getByLabelText('Datum'), { target: { value: '2026-10-30' } });
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '09:30' } });
    fireEvent.change(screen.getByLabelText('Restid (timmar)'), { target: { value: '1,5' } });
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(logs.addTime).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Spara tid för 2026-10-30' }));
    await waitFor(() => expect(logs.addTime).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'TEST-order', date: '2026-10-30', startTime: '09:30', endTime, hours, travelHours: 1.5,
    })));
  });
});