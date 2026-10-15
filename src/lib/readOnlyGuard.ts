/**
 * While a superuser looks at the app as another installer, every write to the
 * backend is refused in the browser (reads still go through). One central
 * guard instead of a check in every save button.
 */
export function isBlockedWrite(url: string, method: string): boolean {
  const m = method.toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return false;
  if (!/\/(rest|storage)\/v1\//.test(url)) return false;
  // Read-only RPCs and signed download links are allowed.
  if (/\/rest\/v1\/rpc\/(log_view_as|current_installer_id|time_report_clients|assigned_clients|has_role)/.test(url)) return false;
  if (/\/storage\/v1\/object\/sign\//.test(url)) return false;
  return true;
}

let original: typeof fetch | null = null;

export function enableReadOnlyGuard(onBlocked: () => void) {
  if (original) return;
  original = window.fetch;
  const base = original;
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    if (isBlockedWrite(url, method)) {
      onBlocked();
      return Promise.reject(new Error('Endast läsläge – du tittar som en annan montör'));
    }
    return base(input, init);
  };
}

export function disableReadOnlyGuard() {
  if (original) { window.fetch = original; original = null; }
}
