import { describe, it, expect } from 'vitest';
import { toneFor } from '@/lib/installerTone';

describe('installer colour language', () => {
  it('completed is green (done)', () => expect(toneFor('completed')).toBe('done'));
  it('in progress is yellow', () => expect(toneFor('in-progress')).toBe('progress'));
  it('scheduled is blue (planned)', () => expect(toneFor('scheduled')).toBe('planned'));
  it('on hold is red (problem)', () => expect(toneFor('on-hold')).toBe('problem'));
  it('cancelled is gray', () => expect(toneFor('cancelled')).toBe('neutral'));
});
