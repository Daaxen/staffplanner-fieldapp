import { describe, it, expect } from 'vitest';
import { isTestRow, type SandboxIds } from '@/lib/testData';
const s: SandboxIds = { installers: new Set(['ti']), projects: new Set(['tp']), clients: new Set(['tc']), clientRefs: new Set(), projectRefs: new Set(), include: false };
describe('isTestRow', () => {
  it('flags rows by test installer, order or client', () => {
    expect([isTestRow(s, { installer_id: 'ti' }), isTestRow(s, { project_id: 'tp' }), isTestRow(s, { client_id: 'tc' })]).toEqual([true, true, true]);
  });
  it('keeps real rows', () => expect(isTestRow(s, { installer_id: 'x', project_id: 'y', client_id: 'z' })).toBe(false));
});
