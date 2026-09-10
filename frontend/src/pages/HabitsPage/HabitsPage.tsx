import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useHabits } from "../../hooks/useHabits";
import { useMinuteTick } from "../../hooks/useMinuteTick";
import { SidePanel } from "../../components/SidePanel/SidePanel";
import { HabitForm } from "../../components/HabitForm/HabitForm";
import { TodayHeader } from "../../components/TodayHeader/TodayHeader";
import { DayGrid } from "../../components/DayGrid/DayGrid";
import { AnytimeTray } from "../../components/AnytimeTray/AnytimeTray";
import { alertApiError, apiErrorMessage } from "../../utils/apiError";
import { getToday, getTodayKey, isScheduledDay, spMinutesOfDay } from "../../utils/dateUtils";
import { computeStartHour, layoutBlocks } from "../../utils/agendaGrid";
import type { HabitEntry } from "../../utils/agendaGrid";
import { floorToQuarter, isValidTime, parseTimeToMinutes } from "../../utils/timeWindow";
import type { Habit, HabitFormData } from "../../types/habit";
import styles from "./HabitsPage.module.css";

export function HabitsPage() {
  const { habits, loading, error, createHabit, updateHabit, deleteHabit, reorderHabits, setCompletion } =
    useHabits();

  const [selected, setSelected] = useState<Habit | null>(null);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const nowMinutes = spMinutesOfDay(useMinuteTick());
  const todayKey = getTodayKey();

  // Nada aqui pode depender de "agora": o tick de minuto recalcularia a grade
  // inteira. Pendente/atrasado é decidido no render do bloco, via habitState.
  const entries = useMemo<HabitEntry[]>(() => {
    const date = getToday();
    return habits
      .filter((habit) => isScheduledDay(date, habit.selectedDays))
      .map((habit) => {
        const completion = habit.completions.find((c) => c.date === todayKey);
        const target = Math.max(1, habit.targetCount);
        const count = Math.min(completion?.count ?? 0, target);
        const startMin = habit.startTime ? parseTimeToMinutes(habit.startTime) : null;
        const endMin = habit.endTime ? parseTimeToMinutes(habit.endTime) : null;
        return {
          habit,
          count,
          target,
          completed: count >= target,
          startMin,
          endMin: startMin === null ? null : (endMin ?? startMin),
        };
      });
  }, [habits, todayKey]);

  const timed = useMemo(() => entries.filter((e) => e.startMin !== null), [entries]);
  const untimed = useMemo(() => entries.filter((e) => e.startMin === null), [entries]);
  const startHour = useMemo(() => computeStartHour(timed), [timed]);
  const layout = useMemo(() => layoutBlocks(timed, startHour), [timed, startHour]);

  const formMode: "create" | "edit" | null = editing
    ? "edit"
    : searchParams.get("novo") === "1"
      ? "create"
      : null;

  const startParam = searchParams.get("inicio");
  const prefillStart = startParam && isValidTime(startParam) ? floorToQuarter(startParam) : null;

  const openCreate = useCallback(
    (startTime?: string) => {
      setEditing(null);
      setFormError(null);
      setSearchParams(startTime ? { novo: "1", inicio: startTime } : { novo: "1" });
    },
    [setSearchParams]
  );

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
      return action
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

  const toggleEntry = useCallback(
    (entry: HabitEntry) =>
      handleToggle(entry.habit.id, todayKey, entry.count >= entry.target ? 0 : entry.count + 1),
    [handleToggle, todayKey]
  );

  // Recebe um subconjunto ordenado (só os sem hora e pendentes) e o reinjeta
  // nos slots que esses ids já ocupam, preservando a posição de todo o resto.
  const handleReorder = useCallback(
    (orderedIds: string[]) => {
      if (orderedIds.length < 2) return;
      const subset = new Set(orderedIds);
      let vi = 0;
      const fullOrder = habits.map((h) => (subset.has(h.id) ? orderedIds[vi++]! : h.id));
      reorderHabits(fullOrder).catch(() => undefined);
    },
    [habits, reorderHabits]
  );

  const handleCreateAt = useCallback((startTime: string) => openCreate(startTime), [openCreate]);

  return (
    <div className={styles.page}>
      {loading && <p className={styles.muted}>Carregando…</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!loading && !error && habits.length > 0 && (
        <>
          <TodayHeader habits={habits} onCreate={openCreate} />
          <div className={styles.body}>
            <DayGrid
              layout={layout}
              nowMinutes={nowMinutes}
              onToggle={toggleEntry}
              onOpen={setSelected}
              onCreateAt={handleCreateAt}
            />
            <AnytimeTray
              entries={untimed}
              onToggle={toggleEntry}
              onOpen={setSelected}
              onReorder={handleReorder}
            />
          </div>
        </>
      )}

      {!loading && !error && habits.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Nenhum hábito ainda</p>
          <p className={styles.muted}>Crie um hábito e acompanhe sua sequência por aqui.</p>
          <button className={styles.emptyButton} onClick={() => openCreate()}>
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
                  startTime: editing.startTime,
                  endTime: editing.endTime,
                }
              : undefined
          }
          defaultStartTime={prefillStart}
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
