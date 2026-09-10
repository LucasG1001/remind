import { useState } from "react";
import type { ProjectTag, ProjectTagFormData } from "../../types/project";
import { useDismiss } from "../../hooks/useDismiss";
import { DEFAULT_ICON_KEY, ICON_LIBRARY } from "../../utils/iconLibrary";
import { TAG_COLORS } from "../../utils/tagPalette";
import { apiErrorMessage } from "../../utils/apiError";
import { ConfirmButton } from "../ConfirmButton/ConfirmButton";
import { TagChip } from "../TagChip/TagChip";
import styles from "./ProjectTagModal.module.css";

const COLLAPSED_ICONS = 7;

interface TagFieldsProps {
  data: ProjectTagFormData;
  onChange: (data: ProjectTagFormData) => void;
  autoFocus?: boolean;
}

function TagFields({ data, onChange, autoFocus }: TagFieldsProps) {
  const [iconsExpanded, setIconsExpanded] = useState(
    () => ICON_LIBRARY.findIndex((entry) => entry.key === data.icon) >= COLLAPSED_ICONS
  );

  const visibleIcons = iconsExpanded ? ICON_LIBRARY : ICON_LIBRARY.slice(0, COLLAPSED_ICONS);
  const hiddenIcons = ICON_LIBRARY.length - COLLAPSED_ICONS;

  return (
    <div className={styles.fields}>
      <input
        type="text"
        className={styles.input}
        value={data.name}
        onChange={(e) => onChange({ ...data, name: e.target.value.slice(0, 40) })}
        placeholder="Nome da tag"
        maxLength={40}
        autoFocus={autoFocus}
      />

      <div className={styles.swatches}>
        {TAG_COLORS.map((hex) => (
          <button
            key={hex}
            type="button"
            className={`${styles.swatch} ${data.color === hex ? styles.swatchActive : ""}`}
            style={{ background: hex }}
            onClick={() => onChange({ ...data, color: hex })}
            aria-label={`Cor ${hex}`}
            aria-pressed={data.color === hex}
          />
        ))}
      </div>

      <div className={styles.iconGrid}>
        {visibleIcons.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            className={`${styles.iconButton} ${data.icon === key ? styles.iconSelected : ""}`}
            onClick={() => onChange({ ...data, icon: key })}
            aria-pressed={data.icon === key}
            aria-label={label}
            title={label}
          >
            <Icon className={styles.iconGlyph} />
          </button>
        ))}
        {!iconsExpanded && (
          <button
            type="button"
            className={styles.iconMore}
            onClick={() => setIconsExpanded(true)}
            aria-label={`Mostrar mais ${hiddenIcons} ícones`}
          >
            +{hiddenIcons}
          </button>
        )}
      </div>
    </div>
  );
}

interface ProjectTagModalProps {
  tags: ProjectTag[];
  onCreate: (data: ProjectTagFormData) => Promise<unknown>;
  onUpdate: (id: string, data: ProjectTagFormData) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onClose: () => void;
}

const emptyDraft: ProjectTagFormData = {
  name: "",
  color: TAG_COLORS[0]!,
  icon: DEFAULT_ICON_KEY,
};

export function ProjectTagModal({
  tags,
  onCreate,
  onUpdate,
  onDelete,
  onClose,
}: ProjectTagModalProps) {
  const [draft, setDraft] = useState<ProjectTagFormData>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ProjectTagFormData>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useDismiss(onClose);

  function startEdit(tag: ProjectTag) {
    setError(null);
    setEditingId(tag.id);
    setEditDraft({ name: tag.name, color: tag.color, icon: tag.icon });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = draft.name.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate({ ...draft, name });
      setDraft(emptyDraft);
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível criar a tag."));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit() {
    const name = editDraft.name.trim();
    if (!editingId || !name || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onUpdate(editingId, { ...editDraft, name });
      setEditingId(null);
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível salvar a tag."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(tag: ProjectTag) {
    setError(null);
    try {
      await onDelete(tag.id);
      if (editingId === tag.id) setEditingId(null);
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível excluir a tag."));
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Tags do projeto</h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className={styles.list}>
          {tags.length === 0 ? (
            <p className={styles.muted}>Nenhuma tag ainda.</p>
          ) : (
            tags.map((tag) => (
              <div key={tag.id} className={styles.item}>
                <div className={styles.itemRow}>
                  <TagChip tag={tag} />
                  <span className={styles.spacer} />
                  <button
                    type="button"
                    className={styles.itemAction}
                    onClick={() => (editingId === tag.id ? setEditingId(null) : startEdit(tag))}
                  >
                    {editingId === tag.id ? "Fechar" : "Editar"}
                  </button>
                  <ConfirmButton
                    className={styles.itemDelete}
                    confirmClassName={styles.itemDeleteArmed}
                    idleLabel="Excluir"
                    confirmLabel="Confirmar?"
                    onConfirm={() => handleDelete(tag)}
                  />
                </div>

                {editingId === tag.id && (
                  <div className={styles.editor}>
                    <TagFields data={editDraft} onChange={setEditDraft} autoFocus />
                    <button
                      type="button"
                      className={styles.saveButton}
                      onClick={handleSaveEdit}
                      disabled={!editDraft.name.trim() || busy}
                    >
                      Salvar tag
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <form className={styles.form} onSubmit={handleCreate}>
          <span className={styles.label}>Nova tag</span>
          <TagFields data={draft} onChange={setDraft} />
          <button type="submit" className={styles.addButton} disabled={!draft.name.trim() || busy}>
            Adicionar tag
          </button>
        </form>
      </div>
    </div>
  );
}
