import { CheckIcon, ClockIcon } from "../Icon/icons";
import { toFormParts } from "../../utils/format";
import { useDismiss } from "../../hooks/useDismiss";
import type { Reminder, RescheduleInput } from "../../types/reminder";
import styles from "./ReminderActionsSheet.module.css";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

interface Preset {
  label: string;
  deltaMs: number;
}

const TIMED_PRESETS: Preset[] = [
  { label: "+1 hora", deltaMs: HOUR },
  { label: "+3 horas", deltaMs: 3 * HOUR },
  { label: "+1 dia", deltaMs: DAY },
  { label: "+1 semana", deltaMs: 7 * DAY },
];

const ALL_DAY_PRESETS: Preset[] = [
  { label: "+1 dia", deltaMs: DAY },
  { label: "+1 semana", deltaMs: 7 * DAY },
];

interface ReminderActionsSheetProps {
  reminder: Reminder;
  now: number;
  onClose: () => void;
  onCheck: (id: string) => void;
  onReschedule: (id: string, input: RescheduleInput) => void;
  onCustom: (id: string) => void;
  onCancel: (id: string) => void;
}

export function ReminderActionsSheet({
  reminder,
  now,
  onClose,
  onCheck,
  onReschedule,
  onCustom,
  onCancel,
}: ReminderActionsSheetProps) {
  useDismiss(onClose);

  const presets = reminder.isAllDay ? ALL_DAY_PRESETS : TIMED_PRESETS;
  const base = Math.max(now, Date.parse(reminder.eventAt));
  const limit = reminder.nextOccurrenceAt ? Date.parse(reminder.nextOccurrenceAt) : null;

  const applyPreset = (deltaMs: number) => {
    const parts = toFormParts(new Date(base + deltaMs).toISOString());
    onClose();
    onReschedule(reminder.id, { date: parts.date, time: reminder.isAllDay ? null : parts.time });
  };

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleCancel = () => {
    if (window.confirm(`Cancelar "${reminder.title}"?`)) {
      onClose();
      onCancel(reminder.id);
    }
  };

  return (
    <div
      className={styles.backdrop}
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label={reminder.title}
    >
      <div className={styles.sheet}>
        <div className={styles.header}>
          <span className={styles.title}>{reminder.title}</span>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <button
          type="button"
          className={`${styles.action} ${styles.actionPrimary}`}
          onClick={() => {
            onClose();
            onCheck(reminder.id);
          }}
        >
          <CheckIcon className={styles.actionIcon} />
          Concluir
        </button>

        <div className={styles.sectionLabel}>
          <ClockIcon className={styles.sectionIcon} />
          Remarcar para
        </div>
        <div className={styles.presets}>
          {presets.map((preset) => {
            const disabled = limit != null && base + preset.deltaMs >= limit;
            return (
              <button
                key={preset.label}
                type="button"
                className={styles.preset}
                disabled={disabled}
                title={disabled ? "Passa do próximo agendamento" : undefined}
                onClick={() => applyPreset(preset.deltaMs)}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className={styles.action}
          onClick={() => {
            onClose();
            onCustom(reminder.id);
          }}
        >
          Personalizado…
        </button>

        <button type="button" className={`${styles.action} ${styles.actionDanger}`} onClick={handleCancel}>
          Cancelar lembrete
        </button>
      </div>
    </div>
  );
}
