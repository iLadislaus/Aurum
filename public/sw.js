// Нужен только для уведомлений: файлы приложения не перехватывает и не кэширует
self.addEventListener('push', (e) => {
  let m = {};
  try { m = e.data?.json() ?? {}; } catch { m = { body: e.data?.text() }; }
  // iPhone требует показывать уведомление на каждое пришедшее сообщение
  e.waitUntil(self.registration.showNotification(m.title || 'Aurum', { body: m.body || '', tag: m.tag, icon: 'icon-192.png', badge: 'icon-192.png' }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const app = open.find((c) => c.url.startsWith(self.registration.scope));
    return app ? app.focus() : self.clients.openWindow(self.registration.scope);
  })());
});
