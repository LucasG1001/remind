import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { useProjects } from "../../hooks/useProjects";
import { ProjectSwitcher } from "../../components/ProjectSwitcher/ProjectSwitcher";
import { BoardListColumn } from "../../components/BoardList/BoardList";
import { InlineTextEdit } from "../../components/InlineTextEdit/InlineTextEdit";
import { CardDetailPanel } from "../../components/CardDetailPanel/CardDetailPanel";
import { ProjectTagModal } from "../../components/ProjectTagModal/ProjectTagModal";
import { TagChip } from "../../components/TagChip/TagChip";
import { CardMenu } from "../../components/CardMenu/CardMenu";
import { moveCardInBoard, moveRelativeTo } from "../../utils/reorder";
import { LONG_PRESS_DRAG_MS, MOVE_THRESHOLD } from "../../hooks/useLongPress";
import { useHeaderSlot } from "../../context/useHeaderSlot";
import { alertApiError } from "../../utils/apiError";
import type { BoardList, Card, CardPatch } from "../../types/project";
import styles from "./ProjectsPage.module.css";

// classList não aceita string vazia; o fallback existe só para o tipo.
const GRABBING = styles.grabbing ?? "grabbing";

const EDGE_SCROLL_PX = 48;
const EDGE_SCROLL_STEP = 14;

type DragType = "card" | "list";

type Ghost = { type: DragType; width: number; title: string; done: boolean };

type DropTarget =
  | { kind: "card"; listId: string; index: number; overCardId: string | null }
  | { kind: "list"; overListId: string; order: string[] };

function sameDrop(a: DropTarget | null, b: DropTarget | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "card" && b.kind === "card")
    return a.listId === b.listId && a.index === b.index && a.overCardId === b.overCardId;
  if (a.kind === "list" && b.kind === "list") return a.overListId === b.overListId;
  return false;
}

function boardChanged(a: BoardList[], b: BoardList[]): boolean {
  return a.some((l, i) => {
    const o = b[i];
    if (!o || o.id !== l.id || o.cards.length !== l.cards.length) return true;
    return l.cards.some((c, j) => c.id !== o.cards[j]?.id);
  });
}

export function ProjectsPage() {
  const {
    projects,
    currentProjectId,
    board,
    tags,
    loading,
    boardLoading,
    error,
    selectProject,
    createProject,
    renameProject,
    deleteProject,
    createList,
    renameList,
    deleteList,
    reorderLists,
    createCard,
    updateCard,
    deleteCard,
    moveCard,
    createTag,
    updateTag,
    deleteTag,
  } = useProjects();
  const headerSlot = useHeaderSlot();

  const [searchParams, setSearchParams] = useSearchParams();

  const [detailCardId, setDetailCardId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardMenu, setCardMenu] = useState<{ card: Card; x: number; y: number } | null>(null);
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [composerListId, setComposerListId] = useState<string | null>(null);
  const [addingList, setAddingList] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [activeTagIds, setActiveTagIds] = useState<string[]>([]);

  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [dragListId, setDragListId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);

  const boardRef = useRef<BoardList[] | null>(null);
  const dragTypeRef = useRef<DragType | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const dropRef = useRef<DropTarget | null>(null);
  const ghostOffsetRef = useRef({ x: 0, y: 0 });
  const ghostElRef = useRef<HTMLDivElement | null>(null);
  const pressTimerRef = useRef<number | null>(null);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  // A página pode desmontar no meio de um arraste (gesto de voltar do navegador, toque
  // no bottom-nav): sem isto os listeners de window, o timer de toque longo e o rAF de
  // auto-scroll ficavam pendurados. Mesmo padrão do TodayColumn.
  useEffect(
    () => () => {
      if (pressTimerRef.current !== null) clearTimeout(pressTimerRef.current);
      dragCleanupRef.current?.();
    },
    []
  );

  // "?novo=1" (botão + do bottom-nav) abre o composer adequado; derivado como na HabitsPage.
  const wantsNew = searchParams.get("novo") === "1";
  const clearNovo = () => {
    if (wantsNew) setSearchParams({}, { replace: true });
  };

  const activeComposerListId =
    composerListId ?? (wantsNew && board && board.length > 0 ? board[0]!.id : null);
  const isAddingList =
    addingList || (wantsNew && Boolean(currentProjectId) && board !== null && board.length === 0);
  const isCreatingProject = creatingProject || (wantsNew && !loading && projects.length === 0);

  const autoScrollAtEdges = () => {
    const { x, y } = lastPointRef.current;
    const boardEl = boardScrollRef.current;
    if (boardEl) {
      const rect = boardEl.getBoundingClientRect();
      if (x < rect.left + EDGE_SCROLL_PX) boardEl.scrollLeft -= EDGE_SCROLL_STEP;
      else if (x > rect.right - EDGE_SCROLL_PX) boardEl.scrollLeft += EDGE_SCROLL_STEP;
    }
    if (dragTypeRef.current === "card") {
      const cardsEl = document
        .elementFromPoint(x, y)
        ?.closest("[data-list-id]")
        ?.querySelector("[data-cards]");
      if (cardsEl) {
        const rect = cardsEl.getBoundingClientRect();
        if (y < rect.top + EDGE_SCROLL_PX) cardsEl.scrollTop -= EDGE_SCROLL_STEP;
        else if (y > rect.bottom - EDGE_SCROLL_PX) cardsEl.scrollTop += EDGE_SCROLL_STEP;
      }
    }
  };

  const computeCardDrop = (x: number, y: number): DropTarget | null => {
    const dragId = dragIdRef.current;
    const current = boardRef.current;
    if (!dragId || !current) return null;
    const el = document.elementFromPoint(x, y);
    if (!el) return null;

    const cardEl = el.closest("[data-card-id]");
    if (cardEl) {
      const overId = cardEl.getAttribute("data-card-id")!;
      if (overId === dragId) return null;
      const list = current.find((l) => l.cards.some((c) => c.id === overId));
      if (!list) return null;
      const rect = cardEl.getBoundingClientRect();
      const after = y > rect.top + rect.height / 2;
      const ids = list.cards.filter((c) => c.id !== dragId).map((c) => c.id);
      const overIndex = ids.indexOf(overId);
      if (overIndex === -1) return null;
      return {
        kind: "card",
        listId: list.id,
        index: after ? overIndex + 1 : overIndex,
        overCardId: overId,
      };
    }

    const listEl = el.closest("[data-list-id]");
    if (listEl) {
      const listId = listEl.getAttribute("data-list-id")!;
      const list = current.find((l) => l.id === listId);
      if (!list) return null;
      const index = list.cards.filter((c) => c.id !== dragId).length;
      return { kind: "card", listId, index, overCardId: null };
    }
    return null;
  };

  const computeListDrop = (x: number, y: number): DropTarget | null => {
    const dragId = dragIdRef.current;
    const current = boardRef.current;
    if (!dragId || !current) return null;
    const listEl = document.elementFromPoint(x, y)?.closest("[data-list-id]");
    const overId = listEl?.getAttribute("data-list-id");
    if (!overId || overId === dragId) return null;
    const order = current.map((l) => l.id);
    const rect = listEl!.getBoundingClientRect();
    const after = x > rect.left + rect.width / 2;
    const nextOrder = moveRelativeTo(order, dragId, overId, after);
    if (nextOrder.every((id, i) => id === order[i])) return null;
    return { kind: "list", overListId: overId, order: nextOrder };
  };

  const applyMove = (x: number, y: number) => {
    lastPointRef.current = { x, y };
    const el = ghostElRef.current;
    if (el) {
      const off = ghostOffsetRef.current;
      el.style.transform = `translate(${x - off.x}px, ${y - off.y}px)`;
    }
    const next = dragTypeRef.current === "card" ? computeCardDrop(x, y) : computeListDrop(x, y);
    if (next && !sameDrop(next, dropRef.current)) {
      dropRef.current = next;
      setDrop(next);
    }
  };

  const commitDrop = (dragId: string, type: DragType) => {
    const target = dropRef.current;
    if (!target) return;
    if (type === "card" && target.kind === "card") {
      const current = boardRef.current;
      if (current && !boardChanged(current, moveCardInBoard(current, dragId, target.listId, target.index)))
        return;
      moveCard(dragId, target.listId, target.index).catch((err) =>
        alertApiError(err, "Não foi possível mover o cartão.")
      );
    } else if (type === "list" && target.kind === "list") {
      reorderLists(target.order).catch((err) =>
        alertApiError(err, "Não foi possível reordenar as listas.")
      );
    }
  };

  const startDrag = (id: string, type: DragType, isTouch: boolean) => {
    const current = boardRef.current;
    if (!current) return;
    if (type === "card" && !current.some((l) => l.cards.some((c) => c.id === id))) return;
    if (type === "list" && !current.some((l) => l.id === id)) return;
    const el = document.querySelector(
      type === "card" ? `[data-card-id="${id}"]` : `[data-list-id="${id}"]`
    ) as HTMLElement | null;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const { x: sx, y: sy } = lastPointRef.current;
    ghostOffsetRef.current = { x: sx - rect.left, y: sy - rect.top };

    let title: string;
    let done = false;
    if (type === "card") {
      const card = current.flatMap((l) => l.cards).find((c) => c.id === id);
      title = card?.title ?? "";
      done = card?.done ?? false;
    } else {
      title = current.find((l) => l.id === id)?.name ?? "";
    }

    dragTypeRef.current = type;
    dragIdRef.current = id;
    dropRef.current = null;
    setDrop(null);
    setGhost({ type, width: rect.width, title, done });
    if (type === "card") setDragCardId(id);
    else setDragListId(id);

    const onPointerMove = (ev: PointerEvent) => {
      ev.preventDefault();
      applyMove(ev.clientX, ev.clientY);
    };

    const onTouchMove = (ev: TouchEvent) => {
      ev.preventDefault();
      const t = ev.touches[0];
      if (t) applyMove(t.clientX, t.clientY);
    };

    const cleanup = () => {
      dragCleanupRef.current = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("touchcancel", onCancel);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    dragCleanupRef.current = cleanup;

    const resetDrag = () => {
      dragTypeRef.current = null;
      dragIdRef.current = null;
      dropRef.current = null;
      setDrop(null);
      setGhost(null);
      setDragCardId(null);
      setDragListId(null);
    };

    const onUp = () => {
      cleanup();
      commitDrop(id, type);
      resetDrag();
    };

    const onCancel = () => {
      cleanup();
      resetDrag();
    };

    if (isTouch) {
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", onUp);
      window.addEventListener("touchcancel", onCancel);
    } else {
      window.addEventListener("pointermove", onPointerMove, { passive: false });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    }

    const loop = () => {
      // Condição de parada (o TodayColumn já tinha a dele): sem ela o loop sobrevivia ao
      // fim do arraste e ao unmount, rolando para sempre o elemento sob o ponteiro.
      if (dragTypeRef.current !== type || dragIdRef.current !== id) {
        rafRef.current = null;
        return;
      }
      autoScrollAtEdges();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const beginPress = (e: React.PointerEvent, id: string, type: DragType, onTap: () => void) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (dragTypeRef.current) return;

    const start = { x: e.clientX, y: e.clientY };
    lastPointRef.current = start;
    let finished = false;

    if (e.pointerType === "touch") {
      const clearPress = () => {
        finished = true;
        if (pressTimerRef.current) {
          clearTimeout(pressTimerRef.current);
          pressTimerRef.current = null;
        }
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", onTouchEnd);
        window.removeEventListener("touchcancel", onTouchEnd);
      };

      const onTouchMove = (ev: TouchEvent) => {
        if (finished) return;
        const t = ev.touches[0];
        if (!t) return;
        const moved =
          Math.abs(t.clientX - start.x) > MOVE_THRESHOLD ||
          Math.abs(t.clientY - start.y) > MOVE_THRESHOLD;
        if (moved) clearPress();
      };

      const onTouchEnd = (ev: TouchEvent) => {
        if (finished) return;
        clearPress();
        if (ev.cancelable) ev.preventDefault();
        onTap();
      };

      pressTimerRef.current = window.setTimeout(() => {
        clearPress();
        startDrag(id, type, true);
      }, LONG_PRESS_DRAG_MS);

      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", onTouchEnd, { passive: false });
      window.addEventListener("touchcancel", onTouchEnd);
      return;
    }

    const clearPress = () => {
      finished = true;
      window.removeEventListener("pointermove", onPressMove);
      window.removeEventListener("pointerup", onPressUp);
      window.removeEventListener("pointercancel", onPressCancel);
    };

    const onPressMove = (ev: PointerEvent) => {
      if (finished) return;
      const moved =
        Math.abs(ev.clientX - start.x) > MOVE_THRESHOLD ||
        Math.abs(ev.clientY - start.y) > MOVE_THRESHOLD;
      if (!moved) return;
      clearPress();
      startDrag(id, type, false);
    };

    const onPressUp = () => {
      if (finished) return;
      clearPress();
      onTap();
    };

    const onPressCancel = () => {
      clearPress();
    };

    window.addEventListener("pointermove", onPressMove);
    window.addEventListener("pointerup", onPressUp);
    window.addEventListener("pointercancel", onPressCancel);
  };

  const handleBoardPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-card-id], header, button, input, textarea, [contenteditable="true"]'))
      return;
    const boardEl = boardScrollRef.current;
    if (!boardEl) return;
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = boardEl.scrollLeft;
    const cardsEl = target.closest("[data-cards]") as HTMLElement | null;
    const startTop = cardsEl?.scrollTop ?? 0;
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved) {
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        moved = true;
        boardEl.classList.add(GRABBING);
      }
      boardEl.scrollLeft = startLeft - dx;
      if (cardsEl) cardsEl.scrollTop = startTop - dy;
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      boardEl.classList.remove(GRABBING);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleCardPointerDown = (e: React.PointerEvent, card: Card) => {
    beginPress(e, card.id, "card", () => setEditingCardId(card.id));
  };

  const handleHeaderPointerDown = (e: React.PointerEvent, listId: string) => {
    beginPress(e, listId, "list", () => setRenamingListId(listId));
  };

  const handleSaveCardDetail = (card: Card, patch: CardPatch) => {
    updateCard(card.id, patch).catch((err) => alertApiError(err, "Não foi possível salvar o cartão."));
  };

  const handleEditCommit = (card: Card, title: string, tagIds: string[]) => {
    setEditingCardId(null);
    updateCard(card.id, { title, tagIds }).catch((err) =>
      alertApiError(err, "Não foi possível salvar o cartão.")
    );
  };

  const handleToggleDone = (card: Card) => {
    updateCard(card.id, { done: !card.done }).catch((err) =>
      alertApiError(err, "Não foi possível atualizar o cartão.")
    );
  };

  const handleDeleteCard = (card: Card) => {
    if (!card.done && !window.confirm(`Excluir "${card.title}"?`)) return;
    deleteCard(card.id).catch((err) => alertApiError(err, "Não foi possível excluir o cartão."));
  };

  const handleAddCard = (listId: string, title: string, tagIds: string[]) => {
    createCard(listId, title, tagIds).catch((err) => alertApiError(err, "Não foi possível criar o cartão."));
  };

  const handleRenameList = (listId: string, name: string) => {
    setRenamingListId(null);
    renameList(listId, name).catch((err) => alertApiError(err, "Não foi possível renomear a lista."));
  };

  const handleDeleteList = (list: BoardList) => {
    const confirmed =
      list.cards.length === 0 ||
      window.confirm(
        `Excluir a lista "${list.name}" e seu${list.cards.length === 1 ? "" : "s"} ${list.cards.length} cart${
          list.cards.length === 1 ? "ão" : "ões"
        }?`
      );
    if (!confirmed) return;
    deleteList(list.id).catch((err) => alertApiError(err, "Não foi possível excluir a lista."));
  };

  const handleCreateList = (name: string) => {
    setAddingList(false);
    clearNovo();
    createList(name).catch((err) => alertApiError(err, "Não foi possível criar a lista."));
  };

  // Tag excluída (ou troca de projeto) deixa de filtrar: o filtro é derivado das tags vivas.
  const activeTags = activeTagIds.filter((id) => tags.some((tag) => tag.id === id));

  const toggleTagFilter = (tagId: string) => {
    setActiveTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const list of board ?? []) {
      for (const card of list.cards) {
        for (const id of card.tagIds) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return counts;
  }, [board]);

  const visibleCardsOf = (list: BoardList) =>
    activeTags.length === 0
      ? list.cards
      : list.cards.filter((card) => card.tagIds.some((id) => activeTags.includes(id)));

  const currentProject = projects.find((p) => p.id === currentProjectId) ?? null;
  const lists = board;
  const dragging = Boolean(dragCardId || dragListId);
  const cardDrop = drop?.kind === "card" ? drop : null;
  const listDrop = drop?.kind === "list" ? drop : null;
  const detailCard = detailCardId
    ? board?.flatMap((l) => l.cards).find((c) => c.id === detailCardId) ?? null
    : null;

  return (
    <div className={styles.page}>
      {headerSlot &&
        createPortal(
          <ProjectSwitcher
            projects={projects}
            current={currentProject}
            onSelect={selectProject}
            onCreate={(name) =>
              createProject(name).catch((err) => alertApiError(err, "Não foi possível criar o projeto."))
            }
            onRename={(id, name) =>
              renameProject(id, name).catch((err) => alertApiError(err, "Não foi possível renomear o projeto."))
            }
            onDelete={(id) =>
              deleteProject(id).catch((err) => alertApiError(err, "Não foi possível excluir o projeto."))
            }
          />,
          headerSlot,
        )}

      <header className={styles.header}>
        {currentProject && (
          <div className={styles.tagBar}>
            {tags.map((tag) => (
              <TagChip
                key={tag.id}
                tag={tag}
                count={tagCounts.get(tag.id) ?? 0}
                muted={activeTags.length > 0 && !activeTags.includes(tag.id)}
                active={activeTags.includes(tag.id)}
                onClick={() => toggleTagFilter(tag.id)}
              />
            ))}
            <button
              type="button"
              className={styles.manageTags}
              onClick={() => setTagModalOpen(true)}
            >
              + Tags
            </button>
          </div>
        )}
      </header>

      {loading && <p className={styles.muted}>Carregando…</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!loading && !error && projects.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Nenhum projeto ainda</p>
          <p className={styles.muted}>Crie um projeto para organizar seus cartões.</p>
          {isCreatingProject ? (
            <InlineTextEdit
              initial=""
              placeholder="Nome do projeto"
              className={styles.emptyInput}
              onCommit={(name) => {
                setCreatingProject(false);
                clearNovo();
                createProject(name).catch((err) => alertApiError(err, "Não foi possível criar o projeto."));
              }}
              onCancel={() => {
                setCreatingProject(false);
                clearNovo();
              }}
            />
          ) : (
            <button type="button" className={styles.emptyButton} onClick={() => setCreatingProject(true)}>
              + Criar primeiro projeto
            </button>
          )}
        </div>
      )}

      {!loading && !error && currentProject && (
        <>
          {boardLoading && !lists && <p className={styles.muted}>Carregando…</p>}
          {lists && (
            <div
              ref={boardScrollRef}
              className={`${styles.board} ${dragging ? styles.boardDragging : ""}`}
              onPointerDown={handleBoardPointerDown}
            >
              {lists.map((list) => (
                <BoardListColumn
                  key={list.id}
                  list={list}
                  visibleCards={visibleCardsOf(list)}
                  tags={tags}
                  dragging={dragListId === list.id}
                  dragCardId={dragCardId}
                  dropCardId={cardDrop?.overCardId ?? null}
                  dropOnEmpty={Boolean(
                    cardDrop && cardDrop.overCardId === null && cardDrop.listId === list.id
                  )}
                  listDropTarget={listDrop?.overListId === list.id}
                  renaming={renamingListId === list.id}
                  composerOpen={activeComposerListId === list.id}
                  editingCardId={editingCardId}
                  onHeaderPointerDown={handleHeaderPointerDown}
                  onRenameCommit={handleRenameList}
                  onRenameCancel={() => setRenamingListId(null)}
                  onDeleteList={handleDeleteList}
                  onOpenComposer={setComposerListId}
                  onCloseComposer={() => {
                    setComposerListId(null);
                    clearNovo();
                  }}
                  onAddCard={handleAddCard}
                  onCardPointerDown={handleCardPointerDown}
                  onToggleDone={handleToggleDone}
                  onDeleteCard={handleDeleteCard}
                  onEditCommit={handleEditCommit}
                  onEditCancel={() => setEditingCardId(null)}
                  onOpenCardMenu={(card, x, y) => setCardMenu({ card, x, y })}
                />
              ))}

              <div className={styles.addListColumn}>
                {isAddingList ? (
                  <InlineTextEdit
                    initial=""
                    placeholder="Nome da lista"
                    className={styles.addListInput}
                    onCommit={handleCreateList}
                    onCancel={() => {
                      setAddingList(false);
                      clearNovo();
                    }}
                  />
                ) : (
                  <button type="button" className={styles.addListButton} onClick={() => setAddingList(true)}>
                    + Adicionar lista
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {ghost && (
        <div
          ref={(el) => {
            ghostElRef.current = el;
            if (el) {
              const { x, y } = lastPointRef.current;
              const off = ghostOffsetRef.current;
              el.style.transform = `translate(${x - off.x}px, ${y - off.y}px)`;
            }
          }}
          className={ghost.type === "card" ? styles.cardGhost : styles.listGhost}
          style={{ width: ghost.width }}
        >
          {ghost.title}
        </div>
      )}

      {cardMenu && (
        <CardMenu
          x={cardMenu.x}
          y={cardMenu.y}
          onEdit={() => setDetailCardId(cardMenu.card.id)}
          onRemove={() => handleDeleteCard(cardMenu.card)}
          onClose={() => setCardMenu(null)}
        />
      )}

      {detailCard && (
        <CardDetailPanel
          card={detailCard}
          tags={tags}
          onSave={(patch) => handleSaveCardDetail(detailCard, patch)}
          onDelete={(card) =>
            deleteCard(card.id).catch((err) => alertApiError(err, "Não foi possível excluir o cartão."))
          }
          onManageTags={() => setTagModalOpen(true)}
          onClose={() => setDetailCardId(null)}
        />
      )}

      {tagModalOpen && (
        <ProjectTagModal
          tags={tags}
          onCreate={createTag}
          onUpdate={updateTag}
          onDelete={deleteTag}
          onClose={() => setTagModalOpen(false)}
        />
      )}
    </div>
  );
}
