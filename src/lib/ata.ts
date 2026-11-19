/** Builds the stored ÄTA text; empty optional fields are left out. */
export const ataDescription = (what: string, extra?: string, approvedBy?: string) =>
  [what.trim(), extra?.trim() && `Extra tid/material: ${extra.trim()}`, approvedBy?.trim() && `Godkänd av: ${approvedBy.trim()}`]
    .filter(Boolean).join('\n');
