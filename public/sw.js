self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { body: event.data?.text() || "มีงานที่ต้องตรวจสอบ" };
  }
  event.waitUntil(self.registration.showNotification(payload.title || "งานบ้านของเรา", {
    body: payload.body || "มีงานที่ต้องตรวจสอบ",
    icon: payload.icon,
    data: { url: payload.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url || "/"));
});
