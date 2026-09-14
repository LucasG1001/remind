import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useHabits } from "../../hooks/useHabits";
import { SidePanel } from "../../components/SidePanel/SidePanel";
import { HabitForm } from "../../components/HabitForm/HabitForm";
import { TodayHeader } from "../../components/TodayHeader/TodayHeader";
import { TodayHabitList } from "../../components/TodayHabitList/TodayHabitList";
import { alertApiError, apiErrorMessage } from "../../utils/apiError";
import type { Habit, HabitFormData } from "../../types/habit";
import styles from "./HabitsPage.module.css";

export function HabitsPage() {
  const { habits, loading, error, createHabit, updateHabit, deleteHabit, reorderHabits, setCompletion } =
    useHabits();

  const [selected, setSelected] = useState<Habit | null>(null);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const formMode: "create" | "edit" | null = editing
    ? "edit"
    : searchParams.get("novo") === "1"
      ? "create"
      : null;

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormError(null);
    setSearchParams({ novo: "1" });
  }, [setSearchParams]);

  const closeForm = useCallback(() => {
    setEditing(null);
    setFormError(null);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  // Mantém o painel sincronizado com o estado mais recente do hábito.
  const selectedHabit = selected ? habits.find((h) => h.id === selected.id) ?? null : null;

  const handleSave = useCallback(
    (data: HabitFormData) => {
      const action =
        formMode === "edit" && editing
          ? updateHabit(editing.id, data)
          : createHabit(data);
      setFormError(null);
      action
        .then(closeForm)
        .catch((err) => setFormError(apiErrorMessage(err, "Não foi possível salvar o hábito.")));
    },
    [formMode, editing, updateHabit, createHabit, closeForm]
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteHabit(id).catch((err) => alertApiError(err, "Não foi possível excluir o hábito."));
      setSelected(null);
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

  const handleReorder = useCallback(
    (orderedPendingIds: string[]) => {
      const pending = new Set(orderedPendingIds);
      let vi = 0;
      const fullOrder = habits.map((h) => (pending.has(h.id) ? orderedPendingIds[vi++]! : h.id));
      reorderHabits(fullOrder).catch(() => undefined);
    },
    [habits, reorderHabits]
  );

  return (
    <div className={styles.page}>
      {loading && <p className={styles.muted}>Carregando…</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!loading && !error && habits.length > 0 && (
        <>
          <TodayHeader habits={habits} />
          <div className={styles.actionsRow}>
            <button className={styles.newButton} aria-label="Novo hábito" onClick={openCreate}>
              <span className={styles.newPlus} aria-hidden="true">+</span>
              <span className={styles.newLabel}>Novo hábito</span>
            </button>
          </div>
          <TodayHabitList
            habits={habits}
            onToggle={handleToggle}
            onOpen={setSelected}
            onReorder={handleReorder}
          />
        </>
      )}

      {!loading && !error && habits.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Nenhum hábito ainda</p>
          <p className={styles.muted}>Crie um hábito e acompanhe sua sequência por aqui.</p>
          <button className={styles.emptyButton} onClick={openCreate}>
            + Novo hábito
          </button>
        </div>
      )}

      {selectedHabit && (
        <SidePanel
          habit={selectedHabit}
          onClose={() => setSelected(null)}
          onEdit={(habit) => {
            setSelected(null);
            setEditing(habit);
          }}
          onDelete={handleDelete}
          onSetCount={handleToggle}
        />
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
