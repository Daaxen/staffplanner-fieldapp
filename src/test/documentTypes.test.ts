import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { docScopeLabels, docScopeHints, type DocScope } from '@/data/documentsData';

const migrationsDir = join(process.cwd(), 'supabase/migrations');
const allMigrations = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .map(f => readFileSync(join(migrationsDir, f), 'utf8'))
  .join('\n');

const rlsTest = readFileSync(join(process.cwd(), 'supabase/tests/documents_types_rls_test.sql'), 'utf8');

const scopes: DocScope[] = ['global_internal', 'project', 'project_sensitive', 'client', 'hr', 'installer_private'];

describe('document types', () => {
  it('exposes a label and hint for every document type', () => {
    for (const s of scopes) {
      expect(docScopeLabels[s]).toBeTruthy();
      expect(docScopeHints[s]).toBeTruthy();
    }
  });

  it('registers the new purposes as approved reference values', () => {
    expect(allMigrations).toContain("'project_sensitive'");
    expect(allMigrations).toContain("ref_document_scope");
    expect(allMigrations).toMatch(/'hr',\s*'HR document'/);
  });

  it('requires an explicit grant for sensitive order documents', () => {
    expect(allMigrations).toContain('has_document_grant');
    expect(allMigrations).toMatch(/scope = 'project_sensitive'[\s\S]{0,200}has_document_grant/);
  });

  it('limits HR documents to HR access', () => {
    expect(allMigrations).toMatch(/scope = 'hr' AND public\.has_hr_access/);
  });

  it('keeps grants admin-managed and reasoned', () => {
    expect(allMigrations).toContain('document_access_reason_len');
    expect(allMigrations).toMatch(/document access admin manage[\s\S]{0,200}has_role\(auth\.uid\(\), 'admin'\)/);
  });

  it('audits every grant change', () => {
    expect(allMigrations).toMatch(/trg_audit_document_access[\s\S]{0,200}audit_row_change/);
  });

  it('covers every document type in the RLS test', () => {
    for (const s of scopes) expect(rlsTest).toContain(`'${s}'`);
    expect(rlsTest).toContain('sensitive order document visible without a grant');
    expect(rlsTest).toContain('installers cannot grant document access');
    expect(rlsTest).toContain('HR cannot read HR documents');
  });
});
