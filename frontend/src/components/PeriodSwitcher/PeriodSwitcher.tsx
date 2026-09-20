import { PERIOD_OPTIONS, type Period } from "../../utils/period";
import styles from "./PeriodSwitcher.module.css";

interface PeriodSwitcherProps {
  period: Period;
  onChange: (period: Period) => void;
  size?: "block" | "inline";
}

export function PeriodSwitcher({ period, onChange, size = "block" }: PeriodSwitcherProps) {
  return (
    <div className={`${styles.group} ${size === "inline" ? styles.inline : ""}`} role="tablist">
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={period === option.value}
          className={`${styles.option} ${period === option.value ? styles.active : ""}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
