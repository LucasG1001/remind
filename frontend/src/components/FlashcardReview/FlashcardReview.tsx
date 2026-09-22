import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Flashcard } from "../../types/flashcard";
import type { FlashcardCategory } from "../../types/flashcardCategory";
import { fetchDueFlashcards } from "../../services/flashcardService";
import { apiErrorMessage } from "../../utils/apiError";
import { categoryLabel, categoryTints } from "../../utils/flashcardPalette";
import styles from "./FlashcardReview.module.css";

interface FlashcardReviewProps {
  categories: FlashcardCategory[];
  onReview: (id: string, correct: boolean) => Promise<Flashcard>;
}

const ALL = "all";

function shuffle<T>(input: T[]): T[] {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function FlashcardReview({ categories, onReview }: FlashcardReviewProps) {
  const [due, setDue] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<string>(ALL);
  const [queue, setQueue] = useState<string[]>([]);
  /**
   * Tamanho da sessão, fixado no início. A `queue` cresce a cada erro (o card volta
   * para o fim), então usá-la como total fazia "Card 3 / 7" virar "3 / 8" e a barra
   * de progresso andar para trás.
   */
  const [sessionSize, setSessionSize] = useState(0);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const gradedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetchDueFlashcards()
      .then((cards) => {
        setDue(cards);
        setQueue(shuffle(cards.map((c) => c.id)));
        setSessionSize(cards.length);
      })
      .catch(() => setError("Não foi possível carregar a sessão de estudo."))
      .finally(() => setLoading(false));
  }, []);

  const byId = useMemo(() => new Map(due.map((c) => [c.id, c])), [due]);

  const build = useCallback(
    (cat: string) => {
      const ids = due.filter((c) => cat === ALL || c.categoryId === cat).map((c) => c.id);
      gradedRef.current = new Set();
      setCategory(cat);
      setQueue(shuffle(ids));
      setSessionSize(ids.length);
      setError(null);
      setPos(0);
      setFlipped(false);
      setCorrect(0);
      setWrong(0);
    },
    [due]
  );

  const currentId = pos < queue.length ? queue[pos] : undefined;
  const card = currentId ? byId.get(currentId) : undefined;
  const finished = queue.length > 0 && pos >= queue.length;

  const flip = useCallback(() => setFlipped((f) => !f), []);

  const mark = useCallback(
    (ok: boolean) => {
      if (!currentId) return;
      if (!gradedRef.current.has(currentId)) {
        gradedRef.current.add(currentId);
        onReview(currentId, ok)
          // Limpa no sucesso: uma falha de gravação deixava a linha vermelha na tela
          // pelo resto da sessão.
          .then(() => setError(null))
          .catch((err) =>
            setError(apiErrorMessage(err, "Não foi possível registrar a resposta."))
          );
      }
      if (ok) {
        setCorrect((c) => c + 1);
      } else {
        setWrong((w) => w + 1);
        setQueue((q) => [...q, currentId]);
      }
      setPos((p) => p + 1);
      setFlipped(false);
    },
    [currentId, onReview]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && /INPUT|TEXTAREA/.test(target.tagName)) return;
      // O listener é global, mas os modais (form de card, categorias, calendário) vivem
      // em outro ramo da árvore: sem esta guarda, Space virava o card atrás do modal e
      // Enter submetia o formulário **e** virava o card.
      if (document.querySelector('[aria-modal="true"]')) return;
      if (!currentId) return;
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        flip();
        return;
      }
      if (!flipped) return;
      if (e.key === "2" || e.key === "ArrowRight") {
        e.preventDefault();
        mark(true);
      } else if (e.key === "1" || e.key === "ArrowLeft") {
        e.preventDefault();
        mark(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentId, flipped, flip, mark]);

  const catTints = (id: string | null) => categoryTints(categories, id);
  const catLabel = (id: string | null) => categoryLabel(categories, id);

  if (loading) return <p className={styles.muted}>Carregando…</p>;
  if (error && due.length === 0) return <p className={styles.error}>{error}</p>;

  const tabs = [
    { id: ALL, label: "Todos", count: due.length },
    ...categories.map((c) => ({
      id: c.id,
      label: c.name,
      count: due.filter((d) => d.categoryId === c.id).length,
    })),
  ];

  const total = sessionSize;
  const answered = correct + wrong;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  // `pos` passa de `total` quando um card errado volta para a fila: clampa em 100%.
  const progress = total ? Math.round((Math.min(pos, total) / total) * 100) : 0;

  return (
    <div className={styles.session}>
      <div className={styles.tabs} role="tablist">
        {tabs.map((t) => {
          const active = t.id === category;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`${styles.tab} ${active ? styles.tabActive : ""}`}
              onClick={() => build(t.id)}
            >
              {t.label}
              <span className={styles.tabCount}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {due.length === 0 ? (
        <div className={styles.finished}>
          <p className={styles.finishedTitle}>Nada para revisar agora</p>
          <p className={styles.muted}>Volte mais tarde ou crie novos cartões.</p>
        </div>
      ) : finished ? (
        <div className={styles.finished}>
          <p className={styles.finishedTitle}>Sessão concluída</p>
          <p className={styles.muted}>
            Você revisou os cards de <strong>{tabs.find((t) => t.id === category)?.label}</strong>.
          </p>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={`${styles.statValue} ${styles.statCorrect}`}>{correct}</span>
              <span className={styles.statLabel}>acertos</span>
            </div>
            <div className={styles.stat}>
              <span className={`${styles.statValue} ${styles.statWrong}`}>{wrong}</span>
              <span className={styles.statLabel}>erros</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{accuracy}%</span>
              <span className={styles.statLabel}>precisão</span>
            </div>
          </div>
          <button type="button" className={styles.restart} onClick={() => build(category)}>
            Estudar novamente
          </button>
        </div>
      ) : queue.length === 0 ? (
        <div className={styles.finished}>
          <p className={styles.finishedTitle}>Nenhum card nesta categoria</p>
          <p className={styles.muted}>Escolha outra categoria acima.</p>
        </div>
      ) : (
        card && (
          <>
            <div className={styles.progressRow}>
              <span>
                Card <strong>{Math.min(pos + 1, total)} / {total}</strong>
              </span>
              <span className={styles.score}>
                <span className={styles.scoreCorrect}>✓ {correct}</span>
                <span className={styles.scoreWrong}>✕ {wrong}</span>
              </span>
            </div>
            <div className={styles.progressTrack}>
              <div className={styles.progressBar} style={{ width: `${progress}%` }} />
            </div>

            <div className={styles.cardOuter} onClick={flip} key={currentId}>
              <div className={`${styles.cardInner} ${flipped ? styles.flipped : ""}`}>
                <div className={`${styles.face} ${styles.front}`}>
                  <div className={styles.faceHeader}>
                    <span
                      className={styles.tag}
                      style={{
                        background: catTints(card.categoryId).bg,
                        color: catTints(card.categoryId).fg,
                        borderColor: catTints(card.categoryId).border,
                      }}
                    >
                      {catLabel(card.categoryId)}
                    </span>
                    <span className={styles.faceKind}>PERGUNTA</span>
                  </div>
                  <div className={styles.faceBody}>
                    <p className={styles.question}>{card.question}</p>
                  </div>
                  <div className={styles.hint}>clique ou espaço para virar</div>
                </div>

                <div className={`${styles.face} ${styles.back}`}>
                  <div className={styles.faceHeader}>
                    <span
                      className={styles.tag}
                      style={{
                        background: catTints(card.categoryId).bg,
                        color: catTints(card.categoryId).fg,
                        borderColor: catTints(card.categoryId).border,
                      }}
                    >
                      {catLabel(card.categoryId)}
                    </span>
                    <span className={styles.faceKindBack}>RESPOSTA</span>
                  </div>
                  <div className={styles.faceBody}>
                    <p className={styles.answer}>{card.answer}</p>
                  </div>
                  <div className={styles.hint}>como você foi?</div>
                </div>
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.controls}>
              <button
                type="button"
                className={`${styles.control} ${styles.controlWrong}`}
                onClick={() => mark(false)}
              >
                Errei <span className={styles.controlKey}>1 / ←</span>
              </button>
              <button
                type="button"
                className={`${styles.control} ${styles.controlCorrect}`}
                onClick={() => mark(true)}
              >
                Acertei <span className={styles.controlKey}>2 / →</span>
              </button>
            </div>
            <p className={styles.footnote}>Errados voltam ao fim da fila até você acertar</p>
          </>
        )
      )}
    </div>
  );
}
