import { useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import {
  fetchReminder,
  createReminder,
  updateReminder,
  rescheduleReminder,
  cancelReminder,
} from "../../services/reminderService";
import type { RecurMode, RecurUnit, ReminderInput } from "../../types/reminder";
import { toFormParts, spInstant } from "../../utils/format";
import { apiErrorMessage } from "../../utils/apiError";
import { WEEKDAYS_PT } from "../../utils/weekdays";
import { ChevronIcon } from "../Icon/icons";
import { Modal } from "../Modal/Modal";
import styles from "./ReminderForm.module.css";

interface RemindersOutletContext {
  reload: () => void;
}

const UNIT_OPTIONS: { value: RecurUnit; label: string }[] = [
  { value: "day", label: "dia(s)" },
  { value: "week", label: "semana(s)" },
  { value: "month", label: "mês(es)" },
  { value: "year", label: "ano(s)" },
];

export function ReminderForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { reload } = useOutletContext<RemindersOutletContext>();
  const isEdit = Boolean(id);
  const action = searchParams.get("action");

  const now = toFormParts(new Date().toISOString());

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(now.date);
  const [time, setTime] = useState(now.time);
  const [allDay, setAllDay] = useState(false);
  const [repeats, setRepeats] = useState(false);
  const [recurInterval, setRecurInterval] = useState(1);
  const [recurUnit, setRecurUnit] = useState<RecurUnit>("month");
  const [recurWeekday, setRecurWeekday] = useState<number | null>(null);
  const [recurMode, setRecurMode] = useState<RecurMode>("fixed");
  const [nextOccurrenceAt, setNextOccurrenceAt] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  /** Agendamento como veio do servidor, para saber se o usuário mexeu nele. */
  const loadedScheduleRef = useRef<{ date: string; time: string; allDay: boolean } | null>(null);

  const close = () => navigate("/lembretes");

  useEffect(() => {
    if (!isEdit) titleRef.current?.focus();
  }, [isEdit]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetchReminder(id)
      .then((r) => {
        if (!active) return;
        if (action === "cancel") {
          if (window.confirm(`Cancelar "${r.title}"?`)) {
            // `.finally` também roda na rejeição: fechava o modal como sucesso com o
            // lembrete intacto no servidor.
            cancelReminder(r.id)
              .then(() => {
                reload();
                navigate("/lembretes");
              })
              .catch((err) => {
                if (!active) return;
                setError(apiErrorMessage(err, "Não foi possível cancelar o lembrete."));
                setLoading(false);
              });
          } else {
            navigate("/lembretes");
          }
          return;
        }
        const parts = toFormParts(r.eventAt);
        setTitle(r.title);
        setNotes(r.notes ?? "");
        setDate(parts.date);
        setTime(r.isAllDay ? "" : parts.time);
        setAllDay(r.isAllDay);
        loadedScheduleRef.current = {
          date: parts.date,
          time: r.isAllDay ? "" : parts.time,
          allDay: r.isAllDay,
        };
        setRepeats(Boolean(r.recurInterval));
        setRecurInterval(r.recurInterval ?? 1);
        setRecurUnit(r.recurUnit ?? "month");
        setRecurWeekday(r.recurWeekday);
        setRecurMode(r.recurMode ?? "fixed");
        setNextOccurrenceAt(r.nextOccurrenceAt);
        const hasAdvanced = Boolean(r.notes) || Boolean(r.recurInterval);
        setExpanded(hasAdvanced);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError("Não foi possível carregar o lembrete.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id, action, navigate, reload]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Informe um título.");
      return;
    }
    if (!date) {
      setError("Escolha uma data.");
      return;
    }
    if (!allDay && !time) {
      setError("Escolha um horário ou marque como dia inteiro.");
      return;
    }

    // Só barra o passado quando o usuário mexeu no agendamento: senão era impossível
    // corrigir o título de um lembrete já atrasado sem também remarcar a data.
    const loaded = loadedScheduleRef.current;
    const scheduleChanged =
      !loaded || date !== loaded.date || allDay !== loaded.allDay || (!allDay && time !== loaded.time);
    if (scheduleChanged) {
      const todaySp = toFormParts(new Date().toISOString()).date;
      const isPast = allDay ? date < todaySp : spInstant(date, time) < Math.floor(Date.now() / 60000) * 60000;
      if (isPast) {
        setError("Não é possível agendar para uma data no passado.");
        return;
      }
    }

    // Remarcar de recorrente fixo: não pode passar do próximo agendamento.
    if (action === "reschedule" && nextOccurrenceAt) {
      const next = toFormParts(nextOccurrenceAt);
      const tooLate = allDay ? date >= next.date : spInstant(date, time) >= spInstant(next.date, next.time);
      if (tooLate) {
        setError(
          `Não é possível remarcar para depois do próximo agendamento (${next.date.split("-").reverse().join("/")}${
            allDay ? "" : ` ${next.time}`
          }).`
        );
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      if (id && action === "reschedule") {
        // Remarcar move só esta ocorrência: não toca na regra/série.
        await rescheduleReminder(id, { date, time: allDay ? null : time });
      } else {
        const payload: ReminderInput = {
          title: title.trim(),
          notes: notes.trim() || null,
          date,
          time: allDay ? null : time,
          recurInterval: repeats ? recurInterval : null,
          recurUnit: repeats ? recurUnit : null,
          recurWeekday: repeats ? recurWeekday : null,
          recurMode: repeats ? recurMode : undefined,
        };
        if (id) {
          await updateReminder(id, payload);
        } else {
          await createReminder(payload);
        }
      }
      reload();
      navigate("/lembretes");
    } catch {
      setError("Não foi possível salvar. Tente de novo.");
      setSaving(false);
    }
  };

  const title_ = isEdit ? "Editar lembrete" : "Novo lembrete";

  if (loading) {
    return (
      <Modal title={title_} onClose={close} onSubmit={close} submitLabel="Carregando…" submitDisabled>
        <p className={styles.muted}>Carregando…</p>
      </Modal>
    );
  }

  return (
    <Modal
      title={title_}
      onClose={close}
      onSubmit={handleSubmit}
      submitLabel={saving ? "Salvando…" : "Salvar"}
      submitDisabled={saving}
    >
      {action === "reschedule" && (
        <p className={styles.hint}>Ajuste a data/hora abaixo para remarcar este lembrete.</p>
      )}

      <label className={styles.field}>
        <span className={styles.label}>Título</span>
        <input
          ref={titleRef}
          className={styles.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Dentista"
          maxLength={200}
        />
      </label>

      <div className={styles.row}>
        <label className={`${styles.field} ${styles.grow}`}>
          <span className={styles.label}>Data</span>
          <input
            type="date"
            className={styles.input}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className={`${styles.field} ${styles.grow} ${allDay ? styles.disabled : ""}`}>
          <span className={styles.label}>Hora</span>
          <input
            type="time"
            className={styles.input}
            value={time}
            disabled={allDay}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
      </div>

      <label className={styles.checkbox}>
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
        <span>Dia inteiro (aviso às 08:00 do dia anterior e às 08:00 do dia do evento)</span>
      </label>

      {action !== "reschedule" && (
        <button
          type="button"
          className={styles.expander}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <ChevronIcon className={`${styles.expanderIcon} ${expanded ? styles.expanderOpen : ""}`} />
          {expanded ? "Menos opções" : "Mais opções"}
        </button>
      )}

      {action !== "reschedule" && expanded && (
        <div className={styles.advanced}>
          <label className={styles.field}>
            <span className={styles.label}>Notas (opcional)</span>
            <textarea
              className={styles.input}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={2000}
            />
          </label>

          <label className={styles.checkbox}>
            <input type="checkbox" checked={repeats} onChange={(e) => setRepeats(e.target.checked)} />
            <span>Repetir</span>
          </label>

          {repeats && (
            <div className={styles.recurBox}>
              <div className={styles.recurRow}>
                <span className={styles.label}>A cada</span>
                <input
                  type="number"
                  min={1}
                  className={`${styles.input} ${styles.intervalInput}`}
                  value={recurInterval}
                  onChange={(e) => setRecurInterval(Math.max(1, Number(e.target.value)))}
                />
                <select
                  className={styles.input}
                  value={recurUnit}
                  onChange={(e) => setRecurUnit(e.target.value as RecurUnit)}
                >
                  {UNIT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className={styles.field}>
                <span className={styles.label}>No dia da semana</span>
                <select
                  className={styles.input}
                  value={recurWeekday ?? ""}
                  onChange={(e) => setRecurWeekday(e.target.value === "" ? null : Number(e.target.value))}
                >
                  <option value="">Qualquer dia</option>
                  {WEEKDAYS_PT.map((w, i) => (
                    <option key={i} value={i}>
                      {w}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Quando recalcular</span>
                <select
                  className={styles.input}
                  value={recurMode}
                  onChange={(e) => setRecurMode(e.target.value as RecurMode)}
                >
                  <option value="fixed">Horário fixo (sempre na mesma grade)</option>
                  <option value="relative">A partir da conclusão</option>
                </select>
              </label>
            </div>
          )}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </Modal>
  );
}
