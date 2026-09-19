import { describe, expect, it } from 'vitest';
import { detectBrowser, detectDevice, feedbackStats, statusLabel, typeLabel, type FeedbackItem } from '@/lib/feedback';

const item = (over: Partial<FeedbackItem>): FeedbackItem => ({
  id: Math.random().toString(36).slice(2),
  title: 'T', type: 'bug', priority: 'medium', description: '', attachments: [],
  status: 'new', admin_note: null, resolved_at: null, created_by: null,
  reporter_name: null, reporter_role: null, page_path: null, order_number: null,
  project_number: null, device: null, browser: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  votes: 0, votedByMe: false, ...over,
});

describe('feedback labels', () => {
  it('uses Swedish labels', () => {
    expect(typeLabel('mobile')).toBe('Mobilproblem');
    expect(statusLabel('investigating')).toBe('Under utredning');
  });
});

describe('context detection', () => {
  it('detects browser and device', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 (KHTML) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1';
    expect(detectBrowser(ua)).toBe('Chrome 120');
    expect(detectDevice(ua, 390, 844)).toBe('Mobil · iOS · 390×844');
  });
});

describe('feedbackStats', () => {
  const items = [
    item({ type: 'bug', status: 'new' }),
    item({ type: 'mobile', status: 'investigating' }),
    item({ type: 'feature', status: 'planned', votes: 5, title: 'Top' }),
    item({ type: 'improvement', status: 'new', votes: 2 }),
    item({ type: 'other', status: 'resolved' }),
    item({ type: 'feature', status: 'rejected', votes: 99 }),
  ];
  const s = feedbackStats(items);

  it('counts open and resolved', () => {
    expect(s.open).toBe(4);
    expect(s.resolved).toBe(1);
    expect(s.total).toBe(6);
  });

  it('ranks requests by votes and skips rejected', () => {
    expect(s.topRequests.map(r => r.title)).toEqual(['Top', 'T']);
    expect(s.topRequests).toHaveLength(2);
  });

  it('lists bugs and mobile issues', () => {
    expect(s.topBugs).toHaveLength(2);
  });
});
