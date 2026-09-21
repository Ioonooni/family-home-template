function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export async function initializePushNotifications({ button, vapidPublicKey, subscriptionRepository }) {
  if (!vapidPublicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    button.classList.add("hidden");
    return;
  }

  let registration;
  try {
    registration = await navigator.serviceWorker.register("/sw.js");
  } catch (error) {
    console.warn("Service worker registration failed", error);
    button.disabled = true;
    button.textContent = "🔕 แจ้งเตือนไม่พร้อม";
    return;
  }

  if (await registration.pushManager.getSubscription()) {
    button.textContent = "🔔 เปิดแจ้งเตือนแล้ว";
    button.disabled = true;
    return;
  }

  button.addEventListener("click", async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("ไม่ได้รับอนุญาตให้แจ้งเตือน");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      await subscriptionRepository.save(subscription);
      button.textContent = "🔔 เปิดแจ้งเตือนแล้ว";
      button.disabled = true;
    } catch (error) {
      alert(`เปิดการแจ้งเตือนไม่สำเร็จ: ${error.message}`);
    }
  });
}
