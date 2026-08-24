// Service worker exclusivo de push: sem handler de `fetch` e sem precache, para
// não arriscar servir o SPA de um cache velho.

const ICON = "/icon-192.png";
const BADGE = "/badge-96.png";
const DEFAULT_URL = "/lembretes";

// O Chrome no Android renderiza no máximo 2 botões (Notification.maxActions).
const ACTIONS = [
  { action: "snooze-15", title: "Soneca 15 min" },
  { action: "done", title: "Concluir" },
];

const FALLBACK = {
  title: "RemindMe",
  description: "Você tem um lembrete. Abra o app para ver.",
  url: DEFAULT_URL,
};

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function readPayload(event) {
  try {
    return { ...FALLBACK, ...(event.data ? event.data.json() : {}) };
  } catch {
    return FALLBACK;
  }
}

function notify(title, body, tag) {
  return self.registration.showNotification(title, { body, icon: ICON, badge: BADGE, tag });
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

async function openApp(url) {
  const target = new URL(url, self.location.origin);
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    if (!("focus" in client)) continue;
    if (client.url !== target.href && "navigate" in client) {
      await client.navigate(target.href).catch(() => undefined);
    }
    return client.focus();
  }
  return self.clients.openWindow(target.href);
}

async function handleAction(action, data) {
  const reminderId = data.reminderId;
  const tag = reminderId ?? "remindme";

  if (!reminderId) {
    await notify("✅ Botão funcionando", "Era um push de teste — nada foi alterado.", tag);
    return;
  }

  try {
    if (action === "snooze-15") {
      await postJson(`/api/reminders/${reminderId}/snooze`, { minutes: 15 });
      await notify("😴 Soneca de 15 minutos", "Te aviso de novo em 15 min — o compromisso segue no mesmo horário.", tag);
    } else {
      await postJson(`/api/reminders/${reminderId}/acknowledge`);
      await notify("✅ Concluído", "Lembrete marcado como concluído.", tag);
    }
  } catch {
    await notify("⚠️ Não deu para salvar", "Sem conexão com o RemindMe. Abra o app para concluir ou adiar.", tag);
  }
}

// O Chrome exige uma notificação visível para todo push (userVisibleOnly): sem
// isso o Android mostra "site atualizado em segundo plano" e pode cassar a permissão.
self.addEventListener("push", (event) => {
  const payload = readPayload(event);
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.description,
      icon: ICON,
      badge: BADGE,
      // tag = lembrete: os avisos insistentes substituem o anterior em vez de empilhar.
      tag: payload.reminderId ?? "remindme",
      renotify: true,
      vibrate: [200, 100, 200],
      actions: ACTIONS,
      data: { reminderId: payload.reminderId ?? null, url: payload.url ?? DEFAULT_URL },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data ?? {};
  event.notification.close();
  event.waitUntil(
    event.action ? handleAction(event.action, data) : openApp(data.url ?? DEFAULT_URL)
  );
});
