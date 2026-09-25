import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDismiss } from "../../hooks/useDismiss";
import styles from "./CardMenu.module.css";

const EDGE_GAP = 8;

interface CardMenuProps {
  x: number;
  y: number;
  onEdit: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export function CardMenu({ x, y, onEdit, onRemove, onClose }: CardMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: y, left: x });

  useDismiss(onClose, menuRef);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      top: Math.max(EDGE_GAP, Math.min(y, window.innerHeight - height - EDGE_GAP)),
      left: Math.max(EDGE_GAP, Math.min(x, window.innerWidth - width - EDGE_GAP)),
    });
  }, [x, y]);

  const pick = (action: () => void) => {
    onClose();
    action();
  };

  return createPortal(
    <div
      ref={menuRef}
      className={styles.menu}
      style={pos}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      <button type="button" role="menuitem" className={styles.option} onClick={() => pick(onEdit)}>
        Editar
      </button>
      <button
        type="button"
        role="menuitem"
        className={`${styles.option} ${styles.danger}`}
        onClick={() => pick(onRemove)}
      >
        Remover
      </button>
    </div>,
    document.body
  );
}
