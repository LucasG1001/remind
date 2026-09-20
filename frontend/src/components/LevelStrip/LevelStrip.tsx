import { LEVEL_STEP } from "../../utils/levelUtils";
import styles from "./LevelStrip.module.css";

interface LevelStripProps {
  level: number;
  progress: number;
}

export function LevelStrip({ level, progress }: LevelStripProps) {
  return (
    <div className={styles.wrapper}>
      <div
        className={styles.strip}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={LEVEL_STEP}
        aria-valuenow={progress}
        aria-label={`Progresso para o nível ${level + 1}`}
      >
        {Array.from({ length: LEVEL_STEP }, (_, i) => (
          <span
            key={i}
            className={`${styles.cell} ${
              i < progress ? styles.filled : i === progress ? styles.next : ""
            }`}
          />
        ))}
      </div>
      <div className={styles.caption}>
        <span>para o nível {level + 1}</span>
        <span>
          {progress}/{LEVEL_STEP}
        </span>
      </div>
    </div>
  );
}
