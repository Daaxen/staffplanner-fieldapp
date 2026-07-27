/* global importScripts, firebase */
// Background push handler for FCM. Values are injected at build time via
// a matching public/firebase-messaging-config.js if present; otherwise
// FCM initialization silently fails and the SW just idles.

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

try {
  // eslint-disable-next-line no-undef
  importScripts('/firebase-messaging-config.js');
  // firebase-messaging-config.js should define self.__FIREBASE_CONFIG__
  if (self.__FIREBASE_CONFIG__) {
    firebase.initializeApp(self.__FIREBASE_CONFIG__);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const title = payload.notification?.title ?? 'Reminder';
      const options = {
        body: payload.notification?.body ?? '',
        icon: '/placeholder.svg',
        data: payload.data ?? {},
      };
      self.registration.showNotification(title, options);
    });
  }
} catch (e) {
  console.warn('[fcm-sw] not configured', e);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/installer'));
});
