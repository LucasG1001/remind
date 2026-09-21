import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Project } from "../../types/project";
import { useDismiss } from "../../hooks/useDismiss";
import { CaretDownIcon } from "../Icon/icons";
import { ConfirmButton } from "../ConfirmButton/ConfirmButton";
import { InlineTextEdit } from "../InlineTextEdit/InlineTextEdit";
import styles from "./ProjectSwitcher.module.css";

const MENU_WIDTH = 248;

interface ProjectSwitcherProps {
  projects: Project[];
  current: Project | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function ProjectSwitcher({
  projects,
  current,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "rename" | null>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const close = () => {
    setOpen(false);
    setMode(null);
  };

  useDismiss(close, [triggerRef, menuRef], open);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCoords({
        top: rect.bottom + 8,
        left: Math.max(Math.min(rect.left, window.innerWidth - MENU_WIDTH - 12), 12),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  return (
    <div className={styles.switcher}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className={styles.name}>{current?.name ?? "Projetos"}</span>
        <CaretDownIcon className={`${styles.caret} ${open ? styles.caretOpen : ""}`} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className={styles.menu}
            style={{ top: coords.top, left: coords.left, width: MENU_WIDTH }}
            role="menu"
          >
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                role="menuitem"
                className={`${styles.item} ${project.id === current?.id ? styles.itemActive : ""}`}
                onClick={() => {
                  onSelect(project.id);
                  close();
                }}
              >
                {project.name}
              </button>
            ))}

            {projects.length > 0 && <div className={styles.divider} />}

            {mode === "create" ? (
              <InlineTextEdit
                initial=""
                placeholder="Nome do projeto"
                className={styles.menuInput}
                onCommit={(name) => {
                  onCreate(name);
                  close();
                }}
                onCancel={() => setMode(null)}
              />
            ) : (
              <button type="button" className={styles.item} onClick={() => setMode("create")}>
                + Novo projeto
              </button>
            )}

            {current &&
              (mode === "rename" ? (
                <InlineTextEdit
                  initial={current.name}
                  className={styles.menuInput}
                  onCommit={(name) => {
                    onRename(current.id, name);
                    close();
                  }}
                  onCancel={() => setMode(null)}
                />
              ) : (
                <button type="button" className={styles.item} onClick={() => setMode("rename")}>
                  Renomear projeto
                </button>
              ))}

            {current && (
              <ConfirmButton
                className={`${styles.item} ${styles.itemDanger}`}
                idleLabel="Excluir projeto"
                confirmLabel="Confirmar exclusão?"
                onConfirm={() => {
                  onDelete(current.id);
                  close();
                }}
              />
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
