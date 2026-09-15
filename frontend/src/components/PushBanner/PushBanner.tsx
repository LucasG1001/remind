import { usePushNotifications } from "../../hooks/usePushNotifications";
import { BellIcon } from "../Icon/icons";
import styles from "./PushBanner.module.css";

export function PushBanner() {
  const { supported, permission, subscribed, busy, error, enable } = usePushNotifications();

  if (!supported || subscribed !== false) return null;

  const blocked = permission === "denied";

  return (
    <div className={styles.banner}>
      <BellIcon className={styles.icon} />
      <div className={styles.text}>
        <p className={styles.title}>
          {blocked ? "Notificações bloqueadas" : "Ativar notificações neste aparelho"}
        </p>
        <p className={styles.subtitle}>
          {blocked
            ? "Libere as notificações nas configurações do site e recarregue a página."
            : error ?? "Sem isso, os avisos dos seus lembretes não chegam aqui."}
        </p>
      </div>
      {!blocked && (
        <button type="button" className={styles.action} onClick={enable} disabled={busy}>
          {busy ? "Ativando…" : "Ativar"}
        </button>
      )}
    </div>
  );
}
