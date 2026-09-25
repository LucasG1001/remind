import { useEffect, useRef, useState } from "react";
import type { DayOfWeek, HabitFormData } from "../../types/habit";
import { DEFAULT_ICON_KEY, ICON_LIBRARY } from "../../utils/iconLibrary";
import { useDismiss } from "../../hooks/useDismiss";
import { DaySelector } from "../DaySelector/DaySelector";
import { ConfirmButton } from "../ConfirmButton/ConfirmButton";
import { CloseIcon, MinusIcon, PlusIcon, TrashIcon } from "../Icon/icons";
import styles from "./HabitForm.module.css";

interface HabitFormProps {
  mode: "create" | "edit";
  initialData?: HabitFormData;
  error?: string | null;
  onSave: (data: HabitFormData) => void;
  onClose: () => void;
  onDelete?: () => void;
}

const COLLAPSED_ICONS = 6;
const MIN_TARGET = 1;
const MAX_TARGET = 50;
const CLOSE_DRAG_PX = 90;
const DURATION_STEP = 5;
const MAX_DURATION = 600;

export function HabitForm({
  mode,
  initialData,
  error,
  onSave,
  onClose,
  onDelete,
}: HabitFormProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [icon, setIcon] = useState(initialData?.icon ?? DEFAULT_ICON_KEY);
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(initialData?.selectedDays ?? []);
  const [targetCount, setTargetCount] = useState(initialData?.targetCount ?? MIN_TARGET);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(
    initialData?.durationMinutes ?? null
  );
  const [daysError, setDaysError] = useState("");
  const [iconsExpanded, setIconsExpanded] = useState(
    () => ICON_LIBRARY.findIndex((entry) => entry.key === (initialData?.icon ?? "")) >= COLLAPSED_ICONS
  );
  const [dragY, setDragY] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragStartRef = useRef<number | null>(null);
  const dragYRef = useRef(0);

  useDismiss(onClose);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedDays.length === 0) {
      setDaysError("Selecione pelo menos um dia");
      return;
    }
    onSave({ name: name.trim(), icon, selectedDays, targetCount, durationMinutes });
  }

  // Descer do primeiro passo desliga o timer; subir do desligado liga no primeiro passo.
  function stepDuration(direction: 1 | -1) {
    setDurationMinutes((current) => {
      if (current === null) return direction > 0 ? DURATION_STEP : null;
      const next = direction > 0
        ? Math.floor(current / DURATION_STEP) * DURATION_STEP + DURATION_STEP
        : Math.ceil(current / DURATION_STEP) * DURATION_STEP - DURATION_STEP;
      return next <= 0 ? null : Math.min(MAX_DURATION, next);
    });
  }

  function handleDurationInput(raw: string) {
    const value = Number.parseInt(raw, 10);
    setDurationMinutes(Number.isNaN(value) || value <= 0 ? null : Math.min(MAX_DURATION, value));
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
  const isValid = name.trim().length > 0 && selectedDays.length > 0;
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

        <div className={styles.targetRow}>
          <span className={styles.targetText}>
            <span className={styles.targetLabel}>Duração</span>
            <span className={styles.targetHelp}>
              {durationMinutes === null
                ? "sem timer — só check"
                : "minutos; cada sessão cronometrada vale 1 check"}
            </span>
          </span>
          <span className={styles.stepper}>
            <button
              type="button"
              className={styles.stepperButton}
              onClick={() => stepDuration(-1)}
              disabled={durationMinutes === null}
              aria-label="Diminuir duração"
            >
              <MinusIcon className={styles.stepperIcon} />
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_DURATION}
              className={styles.durationInput}
              value={durationMinutes ?? ""}
              placeholder="—"
              onChange={(e) => handleDurationInput(e.target.value)}
              aria-label="Duração em minutos"
            />
            <button
              type="button"
              className={`${styles.stepperButton} ${styles.stepperPlus}`}
              onClick={() => stepDuration(1)}
              disabled={(durationMinutes ?? 0) >= MAX_DURATION}
              aria-label="Aumentar duração"
            >
              <PlusIcon className={styles.stepperIcon} />
            </button>
          </span>
        </div>

        {error && <p className={styles.formError}>{error}</p>}

        <button type="submit" className={styles.submit} disabled={!isValid}>
          {mode === "create" ? "Criar hábito" : "Salvar"}
        </button>
      </form>
    </div>
  );
}
