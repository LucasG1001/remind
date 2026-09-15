import { useRef, useState } from "react";
import type { Project } from "../../types/project";
import { useDismiss } from "../../hooks/useDismiss";
import { CaretDownIcon } from "../Icon/icons";
import { ConfirmButton } from "../ConfirmButton/ConfirmButton";
import { InlineTextEdit } from "../InlineTextEdit/InlineTextEdit";
import styles from "./ProjectSwitcher.module.css";

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
  const rootRef = useRef<HTMLDivElement | null>(null);

  const close = () => {
    setOpen(false);
    setMode(null);
  };

  useDismiss(close, rootRef, open);

  return (
    <div className={styles.switcher} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className={styles.name}>{current?.name ?? "Projetos"}</span>
        <CaretDownIcon className={`${styles.caret} ${open ? styles.caretOpen : ""}`} />
      </button>

      {open && (
        <div className={styles.menu} role="menu">
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
        </div>
      )}
    </div>
  );
}
