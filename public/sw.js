// こんだて帖のプッシュ通知を受け取る Service Worker。
// 送るのは Claude（scripts/db.mjs notify）と毎晩のリマインド（.github/workflows/notify.yml）。
// 中身は {"title","body","url","tag"} の JSON。url はアプリ内のパス（例 "shopping/"）。

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const scope = self.registration.scope;
  event.waitUntil(
    self.registration.showNotification(data.title || "こんだて帖", {
      body: data.body || "",
      tag: data.tag || undefined,
      icon: new URL("apple-touch-icon.png", scope).href,
      badge: new URL("apple-touch-icon.png", scope).href,
      data: { url: new URL(data.url || "", scope).href },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.registration.scope;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const win = wins.find((w) => w.url.startsWith(self.registration.scope));
      if (win) {
        await win.focus();
        if ("navigate" in win) await win.navigate(url).catch(() => {});
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
