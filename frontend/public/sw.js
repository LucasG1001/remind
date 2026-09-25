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

/** A chave VAPID chega em base64url e o applicationServerKey só aceita bytes. */
function urlBase64ToBytes(base64) {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = self.atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * O navegador rotaciona/expira a subscription por conta própria. Sem reinscrever
 * aqui, os avisos param até alguém abrir o app — e o caso de uso deste app é
 * justamente não precisar abrir.
 */
async function resubscribe() {
  const response = await fetch("/api/push/public-key");
  if (!response.ok) return;
  const { publicKey } = await response.json();
  if (!publicKey) return;
  const subscription = await self.registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToBytes(publicKey),
  });
  await postJson("/api/push/subscribe", subscription.toJSON());
}

self.addEventListener("pushsubscriptionchange", (event) => {
  // Falha aqui é silenciosa de propósito: o app refaz o upsert no próximo open.
  event.waitUntil(resubscribe().catch(() => undefined));
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function readPayload(event) {
  try {
    return { ...FALLBACK, ...(event.data ? event.data.json() : {}) };
  } catch {
    return FALLBACK;
  }
}

function notify(title, body, tag, url) {
  return self.registration.showNotification(title, {
    body,
    icon: ICON,
    badge: BADGE,
    tag,
    data: { url: url ?? DEFAULT_URL },
  });
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

// O service worker mudou o estado no servidor; sem este aviso a página aberta
// continuaria mostrando a lista antiga até um reload manual.
async function notifyClients(message) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    client.postMessage(message);
  }
}

async function handleAction(action, data) {
  const { reminderId } = data;
  const url = data.url ?? DEFAULT_URL;
  const tag = reminderId ?? "remindme";

  // Payload sem o alvo da ação (push de teste, ou um aviso de hábito antigo ainda
  // na bandeja): nada a alterar no servidor.
  if (!reminderId) {
    await notify("✅ Botão funcionando", "Era um push de teste — nada foi alterado.", tag, url);
    return;
  }

  try {
    // switch explícito: um `else` catch-all faria qualquer ação desconhecida
    // concluir o lembrete.
    switch (action) {
      case "snooze-15":
        await postJson(`/api/reminders/${reminderId}/snooze`, { minutes: 15 });
        await notifyClients({ type: "reminder-updated", reminderId, action });
        await notify("😴 Soneca de 15 minutos", "Te aviso de novo em 15 min — o compromisso segue no mesmo horário.", tag, url);
        break;
      case "done":
        // `occurrenceAt` identifica a ocorrência: o push vai para todos os aparelhos
        // e, sem isto, dois cliques faziam um semanal saltar duas semanas.
        await postJson(`/api/reminders/${reminderId}/acknowledge`, {
          occurrenceAt: data.occurrenceAt ?? undefined,
        });
        await notifyClients({ type: "reminder-updated", reminderId, action });
        await notify("✅ Concluído", "Lembrete marcado como concluído.", tag, url);
        break;
      default:
        break;
    }
  } catch {
    await notify("⚠️ Não deu para salvar", "Sem conexão com o RemindMe. Abra o app para concluir ou adiar.", tag, url);
  }
}

// O Chrome exige uma notificação visível para todo push (userVisibleOnly): sem
// isso o Android mostra "site atualizado em segundo plano" e pode cassar a permissão.
self.addEventListener("push", (event) => {
  const payload = readPayload(event);
  // tag por lembrete: os avisos insistentes substituem o anterior em vez de empilhar.
  const tag = payload.reminderId ?? "remindme";
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.description,
      icon: ICON,
      badge: BADGE,
      tag,
      renotify: true,
      vibrate: [200, 100, 200],
      actions: ACTIONS,
      data: {
        reminderId: payload.reminderId ?? null,
        occurrenceAt: payload.occurrenceAt ?? null,
        url: payload.url ?? DEFAULT_URL,
      },
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
