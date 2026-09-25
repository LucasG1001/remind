import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { useHabits } from "../../hooks/useHabits";
import { useIsMobile } from "../../hooks/useIsMobile";
import { usePeriodNav } from "../../hooks/usePeriodNav";
import { useHeaderSlot } from "../../context/useHeaderSlot";
import { HabitForm } from "../../components/HabitForm/HabitForm";
import { TodayColumn } from "../../components/TodayColumn/TodayColumn";
import { HistoryPanel } from "../../components/HistoryPanel/HistoryPanel";
import { getToday } from "../../utils/dateUtils";
import { alertApiError, apiErrorMessage } from "../../utils/apiError";
import type { Habit, HabitFormData } from "../../types/habit";
import styles from "./HabitsPage.module.css";

type Tab = "today" | "checkins";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function HabitsPage() {
  const {
    habits,
    loading,
    error,
    createHabit,
    updateHabit,
    deleteHabit,
    reorderHabits,
    setCompletion,
  } = useHabits();

  const isMobile = useIsMobile();
  const headerSlot = useHeaderSlot();
  const nav = usePeriodNav();

  const [tab, setTab] = useState<Tab>("today");
  // Guarda o id, não o objeto: adicionar um horário atualiza `habits`, e um
  // retrato congelado deixaria a lista do formulário para trás.
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId ? habits.find((h) => h.id === editingId) ?? null : null;
  const [formError, setFormError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const formMode: "create" | "edit" | null = editing
    ? "edit"
    : searchParams.get("novo") === "1"
      ? "create"
      : null;

  const openCreate = useCallback(() => {
    setEditingId(null);
    setFormError(null);
    setSearchParams({ novo: "1" });
  }, [setSearchParams]);

  const closeForm = useCallback(() => {
    setEditingId(null);
    setFormError(null);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const handleSave = useCallback(
    (data: HabitFormData) => {
      setFormError(null);
      const action =
        formMode === "edit" && editing ? updateHabit(editing.id, data) : createHabit(data);
      action
        .then(closeForm)
        .catch((err) => setFormError(apiErrorMessage(err, "Não foi possível salvar o hábito.")));
    },
    [formMode, editing, updateHabit, createHabit, closeForm]
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteHabit(id).catch((err) => alertApiError(err, "Não foi possível excluir o hábito."));
    },
    [deleteHabit]
  );

  const handleToggle = useCallback(
    (habitId: string, dateKey: string, nextCount: number) =>
      setCompletion(habitId, dateKey, nextCount).catch((err) =>
        alertApiError(err, "Não foi possível atualizar o hábito.")
      ),
    [setCompletion]
  );

  const handleEdit = useCallback((habit: Habit) => {
    setFormError(null);
    setEditingId(habit.id);
  }, []);

  const handleReorder = useCallback(
    (orderedVisibleIds: string[]) => {
      const visible = new Set(orderedVisibleIds);
      let vi = 0;
      const fullOrder = habits.map((h) => (visible.has(h.id) ? orderedVisibleIds[vi++]! : h.id));
      reorderHabits(fullOrder).catch(() => undefined);
    },
    [habits, reorderHabits]
  );

  const dateLabel = dateFormatter.format(getToday()).replace("-feira", "");

  const tabs = (
    <div className={styles.tabs} role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={tab === "today"}
        className={`${styles.tab} ${tab === "today" ? styles.tabActive : ""}`}
        onClick={() => setTab("today")}
      >
        Hoje
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === "checkins"}
        className={`${styles.tab} ${tab === "checkins" ? styles.tabActive : ""}`}
        onClick={() => setTab("checkins")}
      >
        Check-ins
      </button>
    </div>
  );

  const today = (
    <TodayColumn
      habits={habits}
      onToggle={handleToggle}
      onEdit={handleEdit}
      onReorder={handleReorder}
    />
  );

  return (
    <div className={styles.page}>
      {isMobile && headerSlot && habits.length > 0 && createPortal(tabs, headerSlot)}

      {loading && <p className={styles.muted}>Carregando…</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!loading &&
        !error &&
        habits.length > 0 &&
        (isMobile ? (
          tab === "today" ? (
            <div className={styles.today}>{today}</div>
          ) : (
            <div className={styles.history}>
              <HistoryPanel habits={habits} nav={nav} variant="mobile" dateLabel={dateLabel} />
            </div>
          )
        ) : (
          <>
            <div className={styles.today}>{today}</div>
            <div className={styles.history}>
              <HistoryPanel habits={habits} nav={nav} variant="desktop" dateLabel={dateLabel} />
            </div>
          </>
        ))}

      {!loading && !error && habits.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Nenhum hábito ainda</p>
          <p className={styles.muted}>Crie um hábito e acompanhe sua sequência por aqui.</p>
          <button className={styles.emptyButton} onClick={openCreate}>
            + Novo hábito
          </button>
        </div>
      )}

      {formMode && (
        <HabitForm
          mode={formMode}
          initialData={
            formMode === "edit" && editing
              ? {
                  name: editing.name,
                  icon: editing.icon,
                  selectedDays: editing.selectedDays,
                  targetCount: editing.targetCount,
                  durationMinutes: editing.durationMinutes,
                }
              : undefined
          }
          error={formError}
          onSave={handleSave}
          onClose={closeForm}
          onDelete={
            editing
              ? () => {
                  handleDelete(editing.id);
                  closeForm();
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
