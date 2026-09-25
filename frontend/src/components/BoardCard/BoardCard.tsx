import { useEffect, useRef, useState } from "react";
import type { Card, ProjectTag } from "../../types/project";
import { resolveTags, toggleTagId } from "../../utils/tagPalette";
import { useAutoGrow } from "../../hooks/useAutoGrow";
import { TagChip } from "../TagChip/TagChip";
import { TagQuickPicker } from "../TagQuickPicker/TagQuickPicker";
import styles from "./BoardCard.module.css";

interface BoardCardProps {
  card: Card;
  tags: ProjectTag[];
  dragging: boolean;
  dropTarget: boolean;
  editing: boolean;
  onPointerDown: (e: React.PointerEvent, card: Card) => void;
  onToggleDone: (card: Card) => void;
  onDelete: (card: Card) => void;
  onEditCommit: (card: Card, title: string, tagIds: string[]) => void;
  onEditCancel: () => void;
  onOpenMenu: (card: Card, x: number, y: number) => void;
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

interface CardEditorProps {
  card: Card;
  tags: ProjectTag[];
  onCommit: (title: string, tagIds: string[]) => void;
  onCancel: () => void;
}

function CardEditor({ card, tags, onCommit, onCancel }: CardEditorProps) {
  const [title, setTitle] = useState(card.title);
  const [tagIds, setTagIds] = useState(card.tagIds);
  const finishedRef = useRef(false);
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  useAutoGrow(fieldRef, title);

  const finish = (commit: boolean) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const value = title.trim();
    const changed = value !== card.title.trim() || !sameIds(tagIds, card.tagIds);
    if (commit && value && changed) onCommit(value, tagIds);
    else onCancel();
  };

  return (
    <div className={styles.editor} onPointerDown={(e) => e.stopPropagation()}>
      <textarea
        ref={fieldRef}
        rows={1}
        value={title}
        maxLength={500}
        className={styles.titleInput}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            finish(true);
          }
          if (e.key === "Escape") {
            e.preventDefault();
            finish(false);
          }
        }}
        onBlur={() => finish(true)}
      />
      <TagQuickPicker
        tags={tags}
        selected={tagIds}
        onToggle={(id) => setTagIds((prev) => toggleTagId(prev, id))}
      />
    </div>
  );
}

export function BoardCard({
  card,
  tags,
  dragging,
  dropTarget,
  editing,
  onPointerDown,
  onToggleDone,
  onDelete,
  onEditCommit,
  onEditCancel,
  onOpenMenu,
}: BoardCardProps) {
  const cardTags = resolveTags(tags, card.tagIds);
  const hasDescription = card.description.trim().length > 0;
  const checklistTotal = card.checklist.length;
  const checklistDone = card.checklist.filter((item) => item.done).length;
  const hasMeta = hasDescription || card.images.length > 0 || checklistTotal > 0;

  return (
    <div
      data-card-id={card.id}
      className={`${styles.card} ${card.done ? styles.done : ""} ${dragging ? styles.dragging : ""} ${
        dropTarget ? styles.dropTarget : ""
      } ${editing ? styles.editing : ""}`}
      onPointerDown={(e) => {
        if (!editing) onPointerDown(e, card);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!editing) onOpenMenu(card, e.clientX, e.clientY);
      }}
    >
      <button
        type="button"
        className={`${styles.check} ${card.done ? styles.checkDone : ""}`}
        aria-pressed={card.done}
        aria-label={card.done ? "Desmarcar como feito" : "Marcar como feito"}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onToggleDone(card)}
      >
        <svg viewBox="0 0 24 24" className={styles.checkIcon} aria-hidden="true">
          <path
            d="m5 12 5 5 9-10"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {editing ? (
        <CardEditor
          card={card}
          tags={tags}
          onCommit={(title, tagIds) => onEditCommit(card, title, tagIds)}
          onCancel={onEditCancel}
        />
      ) : (
        <div className={styles.content}>
          <span className={styles.title}>{card.title}</span>
          {cardTags.length > 0 && (
            <span className={styles.tags}>
              {cardTags.map((tag) => (
                <TagChip key={tag.id} tag={tag} />
              ))}
            </span>
          )}
          {hasMeta && (
            <span className={styles.meta}>
              {hasDescription && (
                <span className={styles.metaItem} aria-label="Tem descrição" title="Tem descrição">
                  📝
                </span>
              )}
              {card.images.length > 0 && (
                <span className={styles.metaItem} aria-label={`${card.images.length} imagem(ns)`}>
                  🖼 {card.images.length}
                </span>
              )}
              {checklistTotal > 0 && (
                <span className={styles.metaItem} aria-label="Checklist">
                  ☑ {checklistDone}/{checklistTotal}
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {!editing && (
        <>
          <button
            type="button"
            className={styles.delete}
            aria-label="Excluir cartão"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onDelete(card)}
          >
            ×
          </button>
          <button
            type="button"
            className={styles.more}
            aria-label="Opções do cartão"
            aria-haspopup="menu"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              onOpenMenu(card, rect.right, rect.bottom + 4);
            }}
          >
            ⋯
          </button>
        </>
      )}
    </div>
  );
}
