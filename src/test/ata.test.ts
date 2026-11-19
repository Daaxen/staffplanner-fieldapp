import { describe, it, expect } from 'vitest';
import { ataDescription } from '@/lib/ata';
describe('ataDescription', () => {
  it('includes extra and approver', () => {
    expect(ataDescription('Extra hylla', '2 h', 'Anna')).toBe('Extra hylla\nExtra tid/material: 2 h\nGodkänd av: Anna');
  });
  it('omits empty optional fields', () => {
    expect(ataDescription(' Extra hylla ', '', '')).toBe('Extra hylla');
  });
});
