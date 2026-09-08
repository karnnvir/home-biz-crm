/* eslint-disable no-undef */
// Firebase config here is the public, non-secret web config (same values as
// your .env). Service workers can't read bundler env vars, so this file is
// static and must be edited by hand if you fork this project.
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBzFedWRPBjb7MKJOOoZxd2d5ybHSmh9eM",
  authDomain: "homebakercrm.firebaseapp.com",
  projectId: "homebakercrm",
  storageBucket: "homebakercrm.firebasestorage.app",
  messagingSenderId: "519310995564",
  appId: "1:519310995564:web:227ebb791134aad3ab2849",
});

const messaging = firebase.messaging();

// Messages are sent as data-only (no "notification" field) so we always
// build the notification ourselves — this is what lets us attach a
// per-notification target url that notificationclick below can read back.
messaging.onBackgroundMessage((payload) => {
  const { title, body, url } = payload.data || {};
  self.registration.showNotification(title || "Home Biz CRM", {
    body: body || "",
    data: { url: url || "/orders" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/orders";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("navigate" in client && "focus" in client) {
          return client.navigate(url).then((c) => c && c.focus());
        }
      }
      return clients.openWindow(url);
    })
  );
});
