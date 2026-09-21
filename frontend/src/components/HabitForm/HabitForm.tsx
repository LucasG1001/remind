import { useEffect, useRef, useState } from "react";
import type { DayOfWeek, HabitFormData, HabitReminder } from "../../types/habit";
import { DEFAULT_ICON_KEY, ICON_LIBRARY } from "../../utils/iconLibrary";
import { useDismiss } from "../../hooks/useDismiss";
import { DaySelector } from "../DaySelector/DaySelector";
import { ConfirmButton } from "../ConfirmButton/ConfirmButton";
import { CloseIcon, MinusIcon, PlusIcon, TrashIcon } from "../Icon/icons";
import styles from "./HabitForm.module.css";

interface HabitFormProps {
  /** Horários já salvos (modo edição). No modo criação ficam locais até salvar. */
  reminders?: HabitReminder[];
  habitId?: string | null;
  onAddReminder?: (habitId: string, time: string) => void;
  onRemoveReminder?: (reminderId: string) => void;
  mode: "create" | "edit";
  initialData?: HabitFormData;
  error?: string | null;
  onSave: (data: HabitFormData, pendingTimes: string[]) => void;
  onClose: () => void;
  onDelete?: () => void;
}

const COLLAPSED_ICONS = 6;
const MIN_TARGET = 1;
const MAX_TARGET = 50;
const CLOSE_DRAG_PX = 90;

export function HabitForm({
  mode,
  initialData,
  reminders = [],
  habitId = null,
  onAddReminder,
  onRemoveReminder,
  error,
  onSave,
  onClose,
  onDelete,
}: HabitFormProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [icon, setIcon] = useState(initialData?.icon ?? DEFAULT_ICON_KEY);
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(initialData?.selectedDays ?? []);
  const [targetCount, setTargetCount] = useState(initialData?.targetCount ?? MIN_TARGET);
  const [daysError, setDaysError] = useState("");
  const [iconsExpanded, setIconsExpanded] = useState(
    () => ICON_LIBRARY.findIndex((entry) => entry.key === (initialData?.icon ?? "")) >= COLLAPSED_ICONS
  );
  const [dragY, setDragY] = useState(0);
  // Modo criação: os horários ficam aqui até o hábito existir.
  const [pendingTimes, setPendingTimes] = useState<string[]>([]);
  const [newTime, setNewTime] = useState("");

  const savedTimes = reminders.map((r) => r.time);
  const times = habitId ? savedTimes : pendingTimes;
  const atLimit = times.length >= targetCount;

  function addTime() {
    if (!newTime || atLimit || times.includes(newTime)) return;
    if (habitId) onAddReminder?.(habitId, newTime);
    else setPendingTimes((prev) => [...prev, newTime].sort());
    setNewTime("");
  }

  function removeTime(time: string) {
    const saved = reminders.find((r) => r.time === time);
    if (saved) onRemoveReminder?.(saved.id);
    else setPendingTimes((prev) => prev.filter((t) => t !== time));
  }

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
    onSave({ name: name.trim(), icon, selectedDays, targetCount }, pendingTimes);
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

        <div className={styles.field}>
          <span className={styles.label}>Horários de aviso</span>
          {times.length > 0 && (
            <ul className={styles.timeList}>
              {times.map((time, index) => (
                <li
                  key={time}
                  className={`${styles.timeChip} ${index >= targetCount ? styles.timeChipOff : ""}`}
                >
                  <span className={styles.timeValue}>{time}</span>
                  {index >= targetCount && <span className={styles.timeOffTag}>não notifica</span>}
                  <button
                    type="button"
                    className={styles.timeRemove}
                    aria-label={`Remover horário ${time}`}
                    onClick={() => removeTime(time)}
                  >
                    <MinusIcon className={styles.timeRemoveIcon} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.timeAdd}>
            <input
              type="time"
              className={styles.timeInput}
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              disabled={atLimit}
            />
            <button
              type="button"
              className={styles.timeAddButton}
              onClick={addTime}
              disabled={!newTime || atLimit}
            >
              <PlusIcon className={styles.timeRemoveIcon} />
              Adicionar
            </button>
          </div>
          <span className={styles.timeHelp}>
            {atLimit
              ? `A meta de ${targetCount} permite ${targetCount} horário${targetCount === 1 ? "" : "s"}.`
              : "O aviso insiste a cada 5 min por 25 min, ou até você dar o check."}
          </span>
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

        <button type="submit" className={styles.submit} disabled={!isValid}>
          {mode === "create" ? "Criar hábito" : "Salvar"}
        </button>
      </form>
    </div>
  );
}
