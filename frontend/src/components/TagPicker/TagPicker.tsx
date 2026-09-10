import type { ProjectTag } from "../../types/project";
import { TagChip } from "../TagChip/TagChip";
import styles from "./TagPicker.module.css";

interface TagPickerProps {
  tags: ProjectTag[];
  selected: string[];
  onToggle: (tagId: string) => void;
  onManage: () => void;
}

export function TagPicker({ tags, selected, onToggle, onManage }: TagPickerProps) {
  return (
    <div className={styles.picker}>
      <span className={styles.label}>Tags</span>
      <div className={styles.chips}>
        {tags.length === 0 && <span className={styles.muted}>Nenhuma tag neste projeto.</span>}
        {tags.map((tag) => {
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
        })}
        <button type="button" className={styles.manageButton} onClick={onManage}>
          ＋ Gerenciar
        </button>
      </div>
    </div>
  );
}
