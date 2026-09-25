import type { ProjectTag } from "../../types/project";
import { TagChip } from "../TagChip/TagChip";
import styles from "./TagQuickPicker.module.css";

interface TagQuickPickerProps {
  tags: ProjectTag[];
  selected: string[];
  onToggle: (tagId: string) => void;
}

// Fica ao lado de um campo em edição que salva no blur: o preventDefault no pointerdown
// mantém o foco no campo, senão tocar numa tag fechava a edição antes da escolha.
const keepFocus = (e: React.SyntheticEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

export function TagQuickPicker({ tags, selected, onToggle }: TagQuickPickerProps) {
  return (
    <div className={styles.picker} data-tag-picker onPointerDown={keepFocus} onMouseDown={keepFocus}>
      {tags.length === 0 ? (
        <span className={styles.muted}>Nenhuma tag neste projeto.</span>
      ) : (
        tags.map((tag) => {
          const isSelected = selected.includes(tag.id);
          return (
            <TagChip
              key={tag.id}
              tag={tag}
              muted={!isSelected}
              active={isSelected}
              onClick={() => onToggle(tag.id)}
            />
          );
        })
      )}
    </div>
  );
}

