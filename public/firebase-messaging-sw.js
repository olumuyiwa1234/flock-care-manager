/* Background push handler for Shepherd.
   A service worker cannot read build-time env vars, so the app passes the
   Firebase config in the query string when it registers this file. */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Rebuild the config object from the registration URL's query parameters.
firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));

// Initialising messaging is enough: Firebase then shows notification payloads
// automatically while the app is closed or in the background.
firebase.messaging();

// Tapping a notification opens (or focuses) the Celebrations page.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification?.data?.path || '/celebrations';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
