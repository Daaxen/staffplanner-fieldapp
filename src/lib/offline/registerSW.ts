/** Registers the offline app shell — production builds only, never in the Lovable preview. */
export function registerOfflineSW() {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;
  const host = window.location.hostname;
  if (host === 'localhost' || host.endsWith('.lovableproject.com') || host.includes('id-preview')) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
