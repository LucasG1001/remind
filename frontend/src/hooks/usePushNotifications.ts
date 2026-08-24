import { useCallback, useEffect, useState } from "react";
import { fetchVapidPublicKey, registerSubscription, removeSubscription } from "../services/pushService";
import { urlBase64ToArrayBuffer } from "../utils/push";

const SW_URL = "/sw.js";

function isSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function usePushNotifications() {
  const supported = isSupported();
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    supported ? Notification.permission : "denied"
  );
  const [subscribed, setSubscribed] = useState<boolean | null>(() => (supported ? null : false));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    let active = true;
    (async () => {
      try {
        // getRegistration (e não `ready`) para não pendurar a checagem para
        // sempre caso o registro do service worker tenha falhado.
        const registration = await navigator.serviceWorker.getRegistration();
        const existing = registration ? await registration.pushManager.getSubscription() : null;
        if (!active) return;
        setSubscribed(existing !== null);
        // Reenvia a subscription conhecida: o upsert atualiza o last_seen_at e
        // recupera o caso do banco ter sido recriado sem o aparelho saber.
        if (existing) await registerSubscription(existing.toJSON());
      } catch {
        if (active) setSubscribed(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [supported]);

  const enable = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    setError(null);
    try {
      const granted = await Notification.requestPermission();
      setPermission(granted);
      if (granted !== "granted") {
        setError("Permissão de notificações negada.");
        return;
      }
      const { publicKey } = await fetchVapidPublicKey();
      const registration = await navigator.serviceWorker.register(SW_URL);
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(publicKey),
        }));
      await registerSubscription(subscription.toJSON());
      setSubscribed(true);
    } catch {
      setError("Não foi possível ativar as notificações neste aparelho.");
    } finally {
      setBusy(false);
    }
  }, [supported]);

  const disable = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removeSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      setError("Não foi possível desativar as notificações.");
    } finally {
      setBusy(false);
    }
  }, [supported]);

  return { supported, permission, subscribed, busy, error, enable, disable };
}
