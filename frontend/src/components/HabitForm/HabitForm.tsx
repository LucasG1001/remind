import { useCallback, useEffect, useRef, useState } from "react";
import type { DayOfWeek, HabitFormData } from "../../types/habit";
import { DEFAULT_ICON_KEY, ICON_LIBRARY } from "../../utils/iconLibrary";
import {
  MIN_HABIT_DURATION_MIN,
  TIME_WINDOW_MESSAGES,
  addMinutesToTime,
  checkTimeWindow,
  durationMinutes,
} from "../../utils/timeWindow";
import { useDismiss } from "../../hooks/useDismiss";
import { DaySelector } from "../DaySelector/DaySelector";
import { ConfirmButton } from "../ConfirmButton/ConfirmButton";
import { CloseIcon, MinusIcon, PlusIcon, TrashIcon } from "../Sidebar/Sidebar.icons";
import styles from "./HabitForm.module.css";

interface HabitFormProps {
  mode: "create" | "edit";
  initialData?: HabitFormData;
  defaultStartTime?: string | null;
  error?: string | null;
  onSave: (data: HabitFormData) => void | Promise<void>;
  onClose: () => void;
  onDelete?: () => void;
}

const COLLAPSED_ICONS = 6;
const MIN_TARGET = 1;
const MAX_TARGET = 50;
const CLOSE_DRAG_PX = 90;

const DURATION_PRESETS = [
  { minutes: 15, label: "15m" },
  { minutes: 30, label: "30m" },
  { minutes: 45, label: "45m" },
  { minutes: 60, label: "1h" },
  { minutes: 90, label: "1h30" },
  { minutes: 120, label: "2h" },
] as const;

const DEFAULT_DURATION_MIN = 30;

/** null = chip "outra" (duração livre via campo de fim). */
function initialDuration(data?: HabitFormData): number | null {
  if (!data?.startTime || !data.endTime) return DEFAULT_DURATION_MIN;
  const span = durationMinutes(data.startTime, data.endTime);
  if (span === null) return DEFAULT_DURATION_MIN;
  return DURATION_PRESETS.some((preset) => preset.minutes === span) ? span : null;
}

export function HabitForm({
  mode,
  initialData,
  defaultStartTime,
  error,
  onSave,
  onClose,
  onDelete,
}: HabitFormProps) {
  const seedStart = initialData?.startTime ?? defaultStartTime ?? "";
  const seedDuration = initialDuration(initialData);

  const [name, setName] = useState(initialData?.name ?? "");
  const [icon, setIcon] = useState(initialData?.icon ?? DEFAULT_ICON_KEY);
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(initialData?.selectedDays ?? []);
  const [targetCount, setTargetCount] = useState(initialData?.targetCount ?? MIN_TARGET);
  const [daysError, setDaysError] = useState("");
  const [iconsExpanded, setIconsExpanded] = useState(
    () => ICON_LIBRARY.findIndex((entry) => entry.key === (initialData?.icon ?? "")) >= COLLAPSED_ICONS
  );
  const [hasTime, setHasTime] = useState(Boolean(seedStart));
  const [startTime, setStartTime] = useState(seedStart);
  const [durationMin, setDurationMin] = useState<number | null>(seedDuration);
  const [customEnd, setCustomEnd] = useState(
    seedDuration === null ? (initialData?.endTime ?? "") : ""
  );
  const [saving, setSaving] = useState(false);
  const [dragY, setDragY] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const dragStartRef = useRef<number | null>(null);
  const dragYRef = useRef(0);

  // Escape com o seletor nativo de hora aberto deve fechar só o seletor.
  const handleDismiss = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && active.type === "time") return;
    onClose();
  }, [onClose]);

  useDismiss(handleDismiss);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const derivedEnd =
    !hasTime || !startTime
      ? null
      : durationMin === null
        ? customEnd || null
        : addMinutesToTime(startTime, durationMin);

  const windowIssue = hasTime ? checkTimeWindow(startTime || null, derivedEnd) : null;
  const timeValid = !hasTime || (Boolean(startTime) && windowIssue === null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedDays.length === 0) {
      setDaysError("Selecione pelo menos um dia");
      return;
    }
    setSaving(true);
    Promise.resolve(
      onSave({
        name: name.trim(),
        icon,
        selectedDays,
        targetCount,
        startTime: hasTime ? startTime : null,
        endTime: hasTime ? derivedEnd : null,
      })
    ).finally(() => setSaving(false));
  }

  /** Reencaixa a duração quando o novo início não comporta mais o preset atual. */
  function handleStartBlur() {
    if (!startTime || durationMin === null) return;
    if (addMinutesToTime(startTime, durationMin) !== null) return;
    const fits = DURATION_PRESETS.filter(
      (preset) => addMinutesToTime(startTime, preset.minutes) !== null
    );
    const largest = fits[fits.length - 1];
    if (largest) setDurationMin(largest.minutes);
    else {
      setDurationMin(null);
      setCustomEnd("");
    }
  }

  function handleCustomEndBlur() {
    if (!startTime || !customEnd) return;
    const issue = checkTimeWindow(startTime, customEnd);
    if (issue === "reversed" || issue === "tooShort") {
      setCustomEnd(addMinutesToTime(startTime, MIN_HABIT_DURATION_MIN) ?? customEnd);
    }
  }

  function handleDaysChange(days: DayOfWeek[]) {
    setSelectedDays(days);
    if (days.length > 0) setDaysError("");
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function setDrag(value: number) {
    dragYRef.current = value;
    setDragY(value);
  }

  const visibleIcons = iconsExpanded ? ICON_LIBRARY : ICON_LIBRARY.slice(0, COLLAPSED_ICONS);
  const hiddenIcons = ICON_LIBRARY.length - COLLAPSED_ICONS;
  const isValid = name.trim().length > 0 && selectedDays.length > 0 && timeValid;
  const title = mode === "create" ? "Novo hábito" : "Editar hábito";

  return (
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      role="dialog"
      aria-label={title}
      aria-modal="true"
    >
      <form
        className={styles.sheet}
        onSubmit={handleSubmit}
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <span
          className={styles.grabber}
          aria-hidden="true"
          onPointerDown={(e) => {
            dragStartRef.current = e.clientY;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (dragStartRef.current === null) return;
            setDrag(Math.max(0, e.clientY - dragStartRef.current));
          }}
          onPointerUp={() => {
            dragStartRef.current = null;
            if (dragYRef.current > CLOSE_DRAG_PX) onClose();
            else setDrag(0);
          }}
          onPointerCancel={() => {
            dragStartRef.current = null;
            setDrag(0);
          }}
        />

        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <div className={styles.headerActions}>
            {mode === "edit" && onDelete && (
              <ConfirmButton
                className={`${styles.headerButton} ${styles.deleteButton}`}
                confirmClassName={styles.deleteArmed}
                idleLabel={<TrashIcon className={styles.headerIcon} />}
                confirmLabel="Confirmar?"
                onConfirm={onDelete}
              />
            )}
            <button
              type="button"
              className={styles.headerButton}
              onClick={onClose}
              aria-label="Fechar"
            >
              <CloseIcon className={styles.headerIcon} />
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="habit-name">
            Nome
          </label>
          <input
            ref={inputRef}
            id="habit-name"
            type="text"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 60))}
            placeholder="Nome do hábito"
            maxLength={60}
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Ícone</span>
          <div className={styles.iconGrid}>
            {visibleIcons.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                className={`${styles.iconButton} ${icon === key ? styles.iconSelected : ""}`}
                onClick={() => setIcon(key)}
                aria-pressed={icon === key}
                aria-label={label}
                title={label}
              >
                <Icon className={styles.iconGlyph} />
              </button>
            ))}
            {!iconsExpanded && (
              <button
                type="button"
                className={styles.iconMore}
                onClick={() => setIconsExpanded(true)}
                aria-label={`Mostrar mais ${hiddenIcons} ícones`}
              >
                +{hiddenIcons}
              </button>
            )}
          </div>
        </div>

        <DaySelector selectedDays={selectedDays} onChange={handleDaysChange} error={daysError} />

        <div className={styles.field}>
          <span className={styles.label}>Horário</span>

          <div className={styles.chipRow}>
            <button
              type="button"
              className={`${styles.chip} ${hasTime ? styles.chipSelected : ""}`}
              aria-pressed={hasTime}
              onClick={() => setHasTime(true)}
            >
              Sim
            </button>
            <button
              type="button"
              className={`${styles.chip} ${!hasTime ? styles.chipSelected : ""}`}
              aria-pressed={!hasTime}
              onClick={() => setHasTime(false)}
            >
              A qualquer hora
            </button>
          </div>

          {hasTime && (
            <>
              <div className={styles.timeRow}>
                <input
                  type="time"
                  className={`${styles.input} ${styles.timeInput}`}
                  value={startTime}
                  step={900}
                  aria-label="Início"
                  onChange={(e) => setStartTime(e.target.value)}
                  onBlur={handleStartBlur}
                />
                {durationMin === null && (
                  <>
                    <span className={styles.timeArrow} aria-hidden="true">
                      →
                    </span>
                    <input
                      type="time"
                      className={`${styles.input} ${styles.timeInput}`}
                      value={customEnd}
                      aria-label="Fim"
                      onChange={(e) => setCustomEnd(e.target.value)}
                      onBlur={handleCustomEndBlur}
                    />
                  </>
                )}
              </div>

              <div className={styles.durationChips} role="group" aria-label="Duração">
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset.minutes}
                    type="button"
                    className={`${styles.chip} ${
                      durationMin === preset.minutes ? styles.chipSelected : ""
                    }`}
                    aria-pressed={durationMin === preset.minutes}
                    disabled={
                      Boolean(startTime) && addMinutesToTime(startTime, preset.minutes) === null
                    }
                    onClick={() => setDurationMin(preset.minutes)}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`${styles.chip} ${durationMin === null ? styles.chipSelected : ""}`}
                  aria-pressed={durationMin === null}
                  onClick={() => {
                    setDurationMin(null);
                    setCustomEnd(derivedEnd ?? "");
                  }}
                >
                  outra
                </button>
              </div>

              {windowIssue ? (
                <p className={styles.fieldError}>{TIME_WINDOW_MESSAGES[windowIssue]}</p>
              ) : (
                derivedEnd && (
                  <p className={styles.timeHint}>
                    termina às <strong className={styles.timeHintValue}>{derivedEnd}</strong>
                  </p>
                )
              )}
            </>
          )}
        </div>

        <div className={styles.targetRow}>
          <span className={styles.targetText}>
            <span className={styles.targetLabel}>Vezes por dia</span>
            <span className={styles.targetHelp}>quantas conclusões contam como feito</span>
          </span>
          <span className={styles.stepper}>
            <button
              type="button"
              className={styles.stepperButton}
              onClick={() => setTargetCount((n) => Math.max(MIN_TARGET, n - 1))}
              disabled={targetCount <= MIN_TARGET}
              aria-label="Diminuir vezes por dia"
            >
              <MinusIcon className={styles.stepperIcon} />
            </button>
            <span className={styles.stepperValue}>{targetCount}</span>
            <button
              type="button"
              className={`${styles.stepperButton} ${styles.stepperPlus}`}
              onClick={() => setTargetCount((n) => Math.min(MAX_TARGET, n + 1))}
              disabled={targetCount >= MAX_TARGET}
              aria-label="Aumentar vezes por dia"
            >
              <PlusIcon className={styles.stepperIcon} />
            </button>
          </span>
        </div>

        {error && <p className={styles.formError}>{error}</p>}

        <button type="submit" className={styles.submit} disabled={!isValid || saving}>
          {saving ? "Salvando…" : mode === "create" ? "Criar hábito" : "Salvar"}
        </button>
      </form>
    </div>
  );
}
