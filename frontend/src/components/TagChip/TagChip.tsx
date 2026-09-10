import { createElement } from "react";
import type { ProjectTag } from "../../types/project";
import { getIcon } from "../../utils/iconLibrary";
import { tints } from "../../utils/colorTints";
import styles from "./TagChip.module.css";

interface TagChipProps {
  tag: ProjectTag;
  compact?: boolean;
  muted?: boolean;
  active?: boolean;
  count?: number;
  onClick?: () => void;
}

export function TagChip({ tag, compact, muted, active, count, onClick }: TagChipProps) {
  const t = tints(tag.color);
  const style = muted
    ? undefined
    : { background: t.bg, color: t.fg, borderColor: active ? t.fg : t.border };
  const className = `${styles.chip} ${muted ? styles.muted : ""} ${active ? styles.active : ""} ${
    compact ? styles.compact : ""
  }`;

  const content = (
    <>
      {createElement(getIcon(tag.icon), { className: styles.glyph })}
      {!compact && <span className={styles.name}>{tag.name}</span>}
      {!compact && count !== undefined && <span className={styles.count}>{count}</span>}
    </>
  );

  if (!onClick) {
    return (
      <span className={className} style={style} title={tag.name}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      style={style}
      title={tag.name}
      aria-pressed={active}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
    >
      {content}
    </button>
  );
}
