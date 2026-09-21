import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useReminders } from "../../hooks/useReminders";
import { ReminderActionsSheet } from "../../components/ReminderActionsSheet/ReminderActionsSheet";
import { PushBanner } from "../../components/PushBanner/PushBanner";
import { Timeline } from "../../components/Timeline/Timeline";
import { RemindersRail } from "../../components/RemindersRail/RemindersRail";
import { WeekStrip } from "../../components/WeekStrip/WeekStrip";
import {
  groupByMonth,
  splitReminders,
  todayLabel,
  type TimelineItem,
  type TimelineSection,
} from "../../utils/agenda";
import { dayRemainingLabel, recurrenceLabel, shortOverdueLabel } from "../../utils/format";
import { diffDaysFromToday } from "../../utils/dateUtils";
import { alertApiError } from "../../utils/apiError";
import { useHeaderSlot } from "../../context/useHeaderSlot";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useMinuteTick } from "../../hooks/useMinuteTick";
import type { Reminder } from "../../types/reminder";
import styles from "./RemindersPage.module.css";

function toTimelineItem(reminder: Reminder, now: number): TimelineItem {
  const when = Date.parse(reminder.eventAt);
  const diff = diffDaysFromToday(when, now);
  // Hoje fica sem contagem: o cabeçalho da seção já diz "Hoje" com a data.
  const countdown =
    diff < 0 ? shortOverdueLabel(when, now) : diff > 0 ? dayRemainingLabel(when, now).text : undefined;
  return {
    id: reminder.id,
    kind: "reminder",
    title: reminder.title,
    when,
    detail: recurrenceLabel(reminder) ?? "",
    hasTime: !reminder.isAllDay,
    subtitle: countdown,
    subtitleTone: diff < 0 ? "danger" : undefined,
    tone: diff < 0 ? "danger" : diff === 0 ? "today" : undefined,
  };
}

export function RemindersPage() {
  const navigate = useNavigate();
  const { reminders, loading, error, reload, acknowledge, reschedule, cancel } = useReminders();

  const [selected, setSelected] = useState<Reminder | null>(null);

  const byId = useMemo(() => new Map(reminders.map((r) => [r.id, r])), [reminders]);

  const selectedReminder = selected ? byId.get(selected.id) ?? selected : null;

  const now = useMinuteTick();
  const headerSlot = useHeaderSlot();
  const isMobile = useIsMobile();

  const { sections, overdueCount, todayCount } = useMemo(() => {
    const items = reminders.map((r) => toTimelineItem(r, now)).sort((a, b) => a.when - b.when);
    const { overdue, today, upcoming } = splitReminders(items, now);
    const list: TimelineSection[] = [
      {
        key: "overdue",
        label: "Atrasados",
        items: overdue,
        count: overdue.length,
        tone: "danger",
        actions: true,
      },
      { key: "today", label: "Hoje", items: today, caption: todayLabel(), actions: true },
      ...groupByMonth(upcoming, now),
    ];
    return { sections: list, overdueCount: overdue.length, todayCount: today.length };
  }, [reminders, now]);

  const openActions = (item: TimelineItem) => setSelected(byId.get(item.id) ?? null);

  const complete = (item: TimelineItem) =>
    acknowledge(item.id).catch((err) =>
      alertApiError(err, "Não foi possível concluir o lembrete.")
    );

  const summary = (overdueCount > 0 || todayCount > 0) && (
    <div className={styles.summary}>
      {overdueCount > 0 && (
        <span className={styles.overduePill}>
          {overdueCount} atrasado{overdueCount === 1 ? "" : "s"}
        </span>
      )}
      {todayCount > 0 && (
        <span className={styles.summaryText}>{todayCount} para hoje</span>
      )}
    </div>
  );

  return (
    <div className={styles.page}>
      {headerSlot && summary && createPortal(summary, headerSlot)}

      <div className={styles.list}>
        <PushBanner />

        {isMobile && !loading && !error && <WeekStrip reminders={reminders} />}

        {loading && <p className={styles.muted}>Carregando…</p>}
        {error && <p className={styles.error}>{error}</p>}

        {!loading && !error && reminders.length === 0 && (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Nada por aqui ainda</p>
            <p className={styles.muted}>Crie seu primeiro lembrete e eu te aviso na hora.</p>
            <Link to="/lembretes/novo" className={styles.emptyButton}>
              + Novo lembrete
            </Link>
          </div>
        )}

        {!loading && !error && reminders.length > 0 && (
          <Timeline
            sections={sections}
            onItemClick={openActions}
            onItemLongPress={(item) => navigate(`/lembretes/r/${item.id}`)}
            onSnooze={openActions}
            onComplete={complete}
            emptyMessage="Nenhum lembrete ativo agendado."
          />
        )}
      </div>

      <aside className={styles.rail}>
        <RemindersRail reminders={reminders} now={now} />
      </aside>

      {selectedReminder && (
        <ReminderActionsSheet
          reminder={selectedReminder}
          now={now}
          onClose={() => setSelected(null)}
          onCheck={(id) =>
            acknowledge(id).catch((err) =>
              alertApiError(err, "Não foi possível concluir o lembrete.")
            )
          }
          onReschedule={(id, input) =>
            reschedule(id, input).catch((err) => alertApiError(err, "Não foi possível remarcar."))
          }
          onCustom={(id) => navigate(`/lembretes/r/${id}?action=reschedule`)}
          onCancel={(id) =>
            cancel(id).catch((err) =>
              alertApiError(err, "Não foi possível cancelar o lembrete.")
            )
          }
        />
      )}

      <Outlet context={{ reload }} />
    </div>
  );
}
