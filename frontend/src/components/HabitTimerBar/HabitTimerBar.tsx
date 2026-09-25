import { useLocation } from "react-router-dom";
import { useHabitTimer } from "../../context/useHabitTimer";
import { formatRemaining } from "../../utils/habitTimer";
import { CloseIcon, PauseIcon, PlayIcon } from "../Icon/icons";
import styles from "./HabitTimerBar.module.css";

/** Timer visível fora de Hábitos: é por aqui que se para o alarme estando em outra seção. */
export function HabitTimerBar() {
  const { timer, remaining, ringing, pause, resume, cancel, stopRinging } = useHabitTimer();
  const { pathname } = useLocation();

  if (pathname.startsWith("/habitos")) return null;

  if (ringing) {
    return (
      <div className={`${styles.bar} ${styles.ringing}`} role="alert">
        <span className={styles.text}>
          <span className={styles.name}>{ringing.habitName}</span>
          <span className={styles.meta}>Tempo esgotado · check registrado</span>
        </span>
        <button type="button" className={styles.stop} onClick={stopRinging}>
          Parar
        </button>
      </div>
    );
  }

  if (!timer) return null;
  const paused = timer.pausedAt !== null;

  return (
    <div className={styles.bar} role="status">
      <span className={styles.text}>
        <span className={styles.name}>{timer.habitName}</span>
        <span className={styles.meta}>
          <span className={styles.time}>{formatRemaining(remaining)}</span>
          {paused && " · pausado"}
        </span>
      </span>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={paused ? "Retomar timer" : "Pausar timer"}
        onClick={paused ? resume : pause}
      >
        {paused ? <PlayIcon className={styles.icon} /> : <PauseIcon className={styles.icon} />}
      </button>
      <button type="button" className={styles.iconButton} aria-label="Cancelar timer" onClick={cancel}>
        <CloseIcon className={styles.icon} />
      </button>
    </div>
  );
}
