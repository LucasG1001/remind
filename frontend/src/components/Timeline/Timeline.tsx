import { memo } from "react";
import type { TimelineItem, TimelineSection } from "../../utils/agenda";
import { dayCellLabel, itemTime } from "../../utils/agenda";
import { CheckIcon, ClockIcon } from "../Icon/icons";
import { useLongPress } from "../../hooks/useLongPress";
import styles from "./Timeline.module.css";

interface TimelineProps {
  sections: TimelineSection[];
  onItemClick?: (item: TimelineItem) => void;
  onItemLongPress?: (item: TimelineItem) => void;
  onSnooze?: (item: TimelineItem) => void;
  onComplete?: (item: TimelineItem) => void;
  emptyMessage?: string;
}

function metaText(item: TimelineItem): string {
  return [item.subtitle, item.detail].filter(Boolean).join(" · ");
}

export const Timeline = memo(function Timeline({
  sections,
  onItemClick,
  onItemLongPress,
  onSnooze,
  onComplete,
  emptyMessage = "Nada agendado nos próximos dias.",
}: TimelineProps) {
  const bindPress = useLongPress<TimelineItem>({
    onTap: (item) => onItemClick?.(item),
    onLongPress: (item) => onItemLongPress?.(item),
  });

  const visible = sections.filter((section) => section.items.length > 0);
  if (visible.length === 0) {
    return <div className={styles.empty}>{emptyMessage}</div>;
  }

  return (
    <div className={styles.timeline}>
      {visible.map((section) => (
        <section key={section.key} className={styles.section}>
          <div className={styles.sectionHeader}>
            {section.tone === "danger" && <span className={styles.sectionDot} />}
            <span
              className={`${styles.sectionLabel} ${
                section.tone === "danger" ? styles.sectionLabelDanger : ""
              }`}
            >
              {section.label}
            </span>
            {section.count !== undefined && (
              <span className={styles.sectionCount}>{section.count}</span>
            )}
            {section.caption && <span className={styles.sectionCaption}>{section.caption}</span>}
          </div>

          <div className={styles.items}>
            {section.items.map((item) => {
              const pressProps = onItemLongPress
                ? bindPress(item)
                : { onClick: () => onItemClick?.(item) };
              const meta = metaText(item);
              const time = item.hasTime ? itemTime(item, false) : "dia todo";
              return (
                <div
                  key={item.id}
                  className={`${styles.item} ${item.tone ? styles[item.tone]! : ""}`}
                  role="button"
                  tabIndex={0}
                  {...pressProps}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onItemClick?.(item);
                    }
                  }}
                >
                  <span className={styles.when}>
                    <span className={styles.whenDate}>{dayCellLabel(item.when)}</span>
                    <span className={styles.whenTime}>{time}</span>
                  </span>

                  <span className={styles.body}>
                    <span
                      className={`${styles.title} ${item.done ? styles.titleDone : ""}`}
                    >
                      {item.title}
                    </span>
                    {meta && (
                      <span
                        className={`${styles.meta} ${
                          item.subtitleTone === "danger" ? styles.metaDanger : ""
                        }`}
                      >
                        {meta}
                      </span>
                    )}
                  </span>

                  {section.actions && (
                    <span className={styles.actions}>
                      {onSnooze && (
                        <button
                          type="button"
                          className={styles.snooze}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSnooze(item);
                          }}
                        >
                          <ClockIcon className={styles.actionIcon} />
                          Adiar
                        </button>
                      )}
                      {onComplete && (
                        <button
                          type="button"
                          className={styles.complete}
                          aria-label={`Concluir ${item.title}`}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            onComplete(item);
                          }}
                        >
                          <CheckIcon className={styles.actionIcon} />
                          <span className={styles.completeLabel}>Concluir</span>
                        </button>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
});
