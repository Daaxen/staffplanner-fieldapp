import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

// Firebase config is provided as a JSON string via VITE_FIREBASE_CONFIG.
// When missing, push registration silently no-ops so the rest of the app
// keeps working — banners and the reminders inbox still function.

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

const rawConfig = import.meta.env.VITE_FIREBASE_CONFIG as string | undefined;
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

function init() {
  if (app || !rawConfig) return;
  try {
    const config = JSON.parse(rawConfig);
    app = getApps().length ? getApps()[0] : initializeApp(config);
    messaging = getMessaging(app);
  } catch (e) {
    console.warn('[firebase] invalid VITE_FIREBASE_CONFIG', e);
  }
}

export function isPushConfigured() {
  return Boolean(rawConfig && vapidKey);
}

export async function requestFcmToken(): Promise<string | null> {
  init();
  if (!messaging || !vapidKey) return null;
  if (typeof Notification === 'undefined') return null;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  return token ?? null;
}

export function onForegroundPush(cb: (payload: unknown) => void) {
  init();
  if (!messaging) return () => {};
  return onMessage(messaging, cb);
}
