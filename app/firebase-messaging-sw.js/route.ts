// Serves /firebase-messaging-sw.js with the Firebase config baked in from env vars.
// This worker is what shows notifications when the app is closed.
export const dynamic = "force-static";

export function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const js = `
importScripts('/fb/firebase-app-compat.js');
importScripts('/fb/firebase-messaging-compat.js');
firebase.initializeApp(${JSON.stringify(config)});
// Notifications sent with a "notification" payload are shown automatically when the app is in the background.
firebase.messaging();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('/');
  })());
});
`;
  return new Response(js, {
    headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
