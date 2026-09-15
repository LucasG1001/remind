import { useMemo, useRef, useState } from "react";
import type { Flashcard } from "../../types/flashcard";
import type { FlashcardCategory } from "../../types/flashcardCategory";
import { categoryLabel, categoryTints, NEUTRAL_TINTS, tints } from "../../utils/flashcardPalette";
import { diffDaysFromToday, formatDateDisplay } from "../../utils/dateUtils";
import { dayRemainingLabel } from "../../utils/format";
import { useDismiss } from "../../hooks/useDismiss";
import { useMinuteTick } from "../../hooks/useMinuteTick";
import styles from "./FlashcardList.module.css";

interface FlashcardListProps {
  cards: Flashcard[];
  categories: FlashcardCategory[];
  onEdit: (card: Flashcard) => void;
  onDelete: (ids: string[]) => void;
  onMove: (ids: string[], categoryId: string | null) => void;
  onManageCategories: () => void;
}

type Filter = "all" | "none" | string;
type SortKey = "question" | "category" | "box" | "nextReviewAt" | "days" | "createdAt";
type SortDir = "asc" | "desc";
interface SortState {
  key: SortKey;
  dir: SortDir;
}

const DEFAULT_DIR: Record<SortKey, SortDir> = {
  question: "asc",
  days: "asc",
  category: "asc",
  box: "asc",
  nextReviewAt: "asc",
  createdAt: "desc",
};

const COLLATOR = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
const ts = (iso: string) => Date.parse(iso);

interface SortHeadProps {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  className?: string;
}

function SortHead({ label, sortKey, sort, onSort, className }: SortHeadProps) {
  const active = sort.key === sortKey;
  return (
    <span
      role="columnheader"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={className}
    >
      <button
        type="button"
        className={`${styles.colHead} ${active ? styles.colHeadActive : ""}`}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <span aria-hidden="true" className={styles.caret}>
          {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </span>
  );
}

export function FlashcardList({
  cards,
  categories,
  onEdit,
  onDelete,
  onMove,
  onManageCategories,
}: FlashcardListProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortState>({ key: "nextReviewAt", dir: "asc" });
  const [filterOpen, setFilterOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  const filterRef = useRef<HTMLDivElement | null>(null);
  const moveRef = useRef<HTMLDivElement | null>(null);

  useDismiss(() => setFilterOpen(false), filterRef, filterOpen);
  useDismiss(() => setMoveOpen(false), moveRef, moveOpen);

  const now = useMinuteTick();

  const counts = useMemo(() => {
    const map = new Map<Filter, number>();
    map.set("all", cards.length);
    map.set("none", cards.filter((c) => !c.categoryId).length);
    for (const cat of categories) {
      map.set(cat.id, cards.filter((c) => c.categoryId === cat.id).length);
    }
    return map;
  }, [cards, categories]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((c) => {
      if (filter === "none" && c.categoryId) return false;
      if (filter !== "all" && filter !== "none" && c.categoryId !== filter) return false;
      if (q && !`${c.question} ${c.answer}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cards, filter, search]);

  const catTints = (id: string | null) => categoryTints(categories, id);
  const catLabel = (id: string | null) => categoryLabel(categories, id);

  const comparators = useMemo((): Record<SortKey, (a: Flashcard, b: Flashcard) => number> => {
    const label = (id: string | null) => categoryLabel(categories, id);
    return {
      question: (a, b) => COLLATOR.compare(a.question, b.question),
      days: (a, b) => ts(a.nextReviewAt) - ts(b.nextReviewAt),
      category: (a, b) =>
        !a.categoryId !== !b.categoryId
          ? a.categoryId
            ? -1
            : 1
          : COLLATOR.compare(label(a.categoryId), label(b.categoryId)),
      box: (a, b) => a.box - b.box,
      nextReviewAt: (a, b) => ts(a.nextReviewAt) - ts(b.nextReviewAt),
      createdAt: (a, b) => ts(a.createdAt) - ts(b.createdAt),
    };
  }, [categories]);

  const rows = useMemo(() => {
    const cmp = comparators[sort.key];
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...visible].sort((a, b) => {
      const primary = cmp(a, b);
      if (primary !== 0) return sign * primary;
      const byNext = ts(a.nextReviewAt) - ts(b.nextReviewAt);
      return byNext !== 0 ? byNext : a.id.localeCompare(b.id);
    });
  }, [visible, sort, comparators]);

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: DEFAULT_DIR[key] }
    );
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visibleIds = rows.map((c) => c.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = visibleIds.some((id) => selected.has(id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(visibleIds));
  }

  function clearSelection() {
    setSelected(new Set());
    setMoveOpen(false);
  }

  const selectedIds = [...selected];

  function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Excluir ${selectedIds.length} cartão(ões)?`)) return;
    onDelete(selectedIds);
    clearSelection();
  }

  function handleMove(categoryId: string | null) {
    onMove(selectedIds, categoryId);
    clearSelection();
  }

  function handleRowDelete(id: string) {
    if (!window.confirm("Excluir este cartão?")) return;
    onDelete([id]);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  const filterOptions: { id: Filter; label: string }[] = [
    { id: "all", label: "Todas as categorias" },
    { id: "none", label: "Sem categoria" },
    ...categories.map((c) => ({ id: c.id as Filter, label: c.name })),
  ];
  const current = filterOptions.find((o) => o.id === filter) ?? filterOptions[0]!;
  const currentTints = filter === "all" || filter === "none" ? NEUTRAL_TINTS : catTints(filter);

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <span className={styles.kicker}>Cartões</span>

        <div className={styles.menuWrapper} ref={filterRef}>
          <button
            type="button"
            className={styles.filterTrigger}
            aria-haspopup="menu"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((o) => !o)}
          >
            {filter !== "all" && (
              <span className={styles.dot} style={{ background: currentTints.dot }} />
            )}
            {current.label}
            <span className={styles.chipCount}>{counts.get(filter) ?? 0}</span>
            <span aria-hidden="true" className={styles.caret}>
              ▾
            </span>
          </button>
          {filterOpen && (
            <div className={styles.menu} role="menu">
              {filterOptions.map((opt) => {
                const t = opt.id === "all" || opt.id === "none" ? NEUTRAL_TINTS : catTints(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="menuitem"
                    className={`${styles.menuItem} ${opt.id === filter ? styles.menuItemActive : ""}`}
                    onClick={() => {
                      setFilter(opt.id);
                      setFilterOpen(false);
                    }}
                  >
                    {opt.id !== "all" && (
                      <span className={styles.dot} style={{ background: t.dot }} />
                    )}
                    {opt.label}
                    <span className={styles.chipCount}>{counts.get(opt.id) ?? 0}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button type="button" className={styles.manageButton} onClick={onManageCategories}>
          + Categorias
        </button>

        <span className={styles.spacer} />

        <input
          type="search"
          className={styles.search}
          placeholder="Buscar cartões…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {selectedIds.length > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selectedIds.length} selecionado(s)</span>
          <div className={styles.menuWrapper} ref={moveRef}>
            <button
              type="button"
              className={styles.bulkButton}
              aria-haspopup="menu"
              aria-expanded={moveOpen}
              onClick={() => setMoveOpen((o) => !o)}
            >
              Mover para ▾
            </button>
            {moveOpen && (
              <div className={styles.menu} role="menu">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="menuitem"
                    className={styles.menuItem}
                    onClick={() => handleMove(c.id)}
                  >
                    <span className={styles.dot} style={{ background: tints(c.color).dot }} />
                    {c.name}
                  </button>
                ))}
                <button
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={() => handleMove(null)}
                >
                  <span className={styles.dot} style={{ background: NEUTRAL_TINTS.dot }} />
                  Sem categoria
                </button>
              </div>
            )}
          </div>
          <span className={styles.spacer} />
          <button
            type="button"
            className={`${styles.bulkButton} ${styles.bulkDelete}`}
            onClick={handleBulkDelete}
          >
            Excluir
          </button>
          <button type="button" className={styles.bulkButton} onClick={clearSelection}>
            Limpar
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyEmoji}>🗂️</div>
          <p className={styles.emptyTitle}>Nenhum cartão encontrado</p>
          <p className={styles.muted}>Ajuste a busca/filtro ou crie um novo cartão.</p>
        </div>
      ) : (
        <div className={styles.table} role="table">
          <div className={`${styles.row} ${styles.head}`} role="row">
            <span role="columnheader" className={styles.checkCell}>
              <button
                type="button"
                className={`${styles.check} ${allSelected ? styles.checkOn : ""}`}
                onClick={toggleAll}
                aria-label="Selecionar todos"
              >
                {allSelected ? "✓" : someSelected ? "–" : ""}
              </button>
            </span>
            <SortHead label="Frente" sortKey="question" sort={sort} onSort={toggleSort} />
            <SortHead
              label="Categoria"
              sortKey="category"
              sort={sort}
              onSort={toggleSort}
              className={styles.catHead}
            />
            <SortHead
              label="Caixa"
              sortKey="box"
              sort={sort}
              onSort={toggleSort}
              className={styles.boxHead}
            />
            <SortHead
              label="Próxima revisão"
              sortKey="nextReviewAt"
              sort={sort}
              onSort={toggleSort}
              className={styles.nextHead}
            />
            <SortHead label="Dias" sortKey="days" sort={sort} onSort={toggleSort} />
            <SortHead
              label="Criado em"
              sortKey="createdAt"
              sort={sort}
              onSort={toggleSort}
              className={styles.createdHead}
            />
            <span role="columnheader" />
          </div>

          {rows.map((c) => {
            const t = catTints(c.categoryId);
            const sel = selected.has(c.id);
            const due = dayRemainingLabel(ts(c.nextReviewAt), now);
            const overdue = ts(c.nextReviewAt) <= now;
            const days = diffDaysFromToday(ts(c.nextReviewAt), now);
            return (
              <div
                key={c.id}
                role="row"
                className={`${styles.row} ${sel ? styles.rowSelected : ""}`}
                style={{ boxShadow: `inset 3px 0 0 ${t.dot}` }}
              >
                <span role="cell" className={styles.checkCell}>
                  <button
                    type="button"
                    className={`${styles.check} ${sel ? styles.checkOn : ""}`}
                    onClick={() => toggle(c.id)}
                    aria-label="Selecionar cartão"
                  >
                    {sel ? "✓" : ""}
                  </button>
                </span>
                <span role="cell" className={styles.front}>
                  <span className={styles.clamp}>{c.question}</span>
                </span>
                <span role="cell" className={styles.catCell}>
                  <span
                    className={styles.tag}
                    style={{ background: t.bg, color: t.fg, borderColor: t.border }}
                    title={catLabel(c.categoryId)}
                  >
                    <span className={styles.dot} style={{ background: t.dot }} />
                    <span className={styles.tagLabel}>{catLabel(c.categoryId)}</span>
                  </span>
                </span>
                <span role="cell" className={styles.boxCell}>
                  <span className={styles.boxPill}>{c.box}</span>
                </span>
                <span
                  role="cell"
                  className={`${styles.dateCell} ${styles.nextCell} ${overdue ? styles.dateOverdue : ""}`}
                  title={due.text}
                >
                  {formatDateDisplay(c.nextReviewAt)}
                </span>
                <span
                  role="cell"
                  className={`${styles.daysCell} ${overdue ? styles.dateOverdue : ""}`}
                  title={due.text}
                >
                  {days === 0 ? "hoje" : days}
                </span>
                <span role="cell" className={`${styles.dateCell} ${styles.createdCell}`}>
                  {formatDateDisplay(c.createdAt)}
                </span>
                <span role="cell" className={styles.actions}>
                  <button
                    type="button"
                    className={styles.action}
                    onClick={() => onEdit(c)}
                    aria-label="Editar"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className={`${styles.action} ${styles.actionDanger}`}
                    onClick={() => handleRowDelete(c.id)}
                    aria-label="Excluir"
                  >
                    🗑
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
