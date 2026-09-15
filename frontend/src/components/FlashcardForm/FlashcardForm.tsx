import { useRef, useState } from "react";
import type { Flashcard, FlashcardFormData } from "../../types/flashcard";
import type { FlashcardCategory } from "../../types/flashcardCategory";
import { ConfirmButton } from "../ConfirmButton/ConfirmButton";
import { useDismiss } from "../../hooks/useDismiss";
import { useAutoGrow } from "../../hooks/useAutoGrow";
import { NEUTRAL_TINTS, tints } from "../../utils/flashcardPalette";
import styles from "./FlashcardForm.module.css";

interface FlashcardFormProps {
  initialData?: Flashcard;
  categories: FlashcardCategory[];
  error?: string | null;
  onSave: (data: FlashcardFormData) => void;
  onClose: () => void;
  onDelete?: () => void;
}

export function FlashcardForm({
  initialData,
  categories,
  error,
  onSave,
  onClose,
  onDelete,
}: FlashcardFormProps) {
  const [question, setQuestion] = useState(initialData?.question ?? "");
  const [answer, setAnswer] = useState(initialData?.answer ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(
    initialData?.categoryId ?? categories[0]?.id ?? null
  );

  const questionRef = useRef<HTMLTextAreaElement | null>(null);
  const answerRef = useRef<HTMLTextAreaElement | null>(null);

  useAutoGrow(questionRef, question);
  useAutoGrow(answerRef, answer);
  useDismiss(onClose);

  const isValid = question.trim().length > 0 && answer.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    onSave({
      question: question.trim(),
      answer: answer.trim(),
      categoryId,
    });
  }

  const catOptions: { id: string | null; label: string; color: string | null }[] = [
    ...categories.map((c) => ({ id: c.id as string | null, label: c.name, color: c.color })),
    { id: null, label: "Sem categoria", color: null },
  ];

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <form className={styles.drawer} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <h2 className={styles.title}>{initialData ? "Editar cartão" : "Novo cartão"}</h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label}>Categoria</label>
            <div className={styles.catPills}>
              {catOptions.map((opt) => {
                const active = opt.id === categoryId;
                const t = opt.color ? tints(opt.color) : NEUTRAL_TINTS;
                return (
                  <button
                    key={opt.id ?? "none"}
                    type="button"
                    className={`${styles.catPill} ${active ? styles.catPillActive : ""}`}
                    onClick={() => setCategoryId(opt.id)}
                    style={active ? { background: t.bg, color: t.fg, borderColor: t.border } : undefined}
                  >
                    {opt.color && <span className={styles.dot} style={{ background: t.dot }} />}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="flashcard-question">
              Frente (pergunta)
            </label>
            <textarea
              id="flashcard-question"
              ref={questionRef}
              className={styles.textarea}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={1}
              maxLength={10000}
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="flashcard-answer">
              Verso (resposta)
            </label>
            <textarea
              id="flashcard-answer"
              ref={answerRef}
              className={styles.textarea}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={1}
              maxLength={10000}
            />
          </div>

          {error && <p className={styles.formError}>{error}</p>}
        </div>

        <div className={styles.footer}>
          {initialData && onDelete ? (
            <ConfirmButton
              className={styles.deleteButton}
              confirmClassName={styles.deleteConfirm}
              idleLabel="Excluir"
              confirmLabel="Confirmar?"
              onConfirm={onDelete}
            />
          ) : (
            <span />
          )}
          <div className={styles.footerActions}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.saveButton} disabled={!isValid}>
              {initialData ? "Salvar alterações" : "Criar cartão"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
