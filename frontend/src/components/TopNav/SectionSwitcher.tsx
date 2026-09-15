import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./SectionSwitcher.module.css";
import { NAV_ITEMS, findNavItem } from "./navItems";
import { CaretDownIcon, CheckMarkIcon } from "../Icon/icons";

const MENU_WIDTH = 248;

export function SectionSwitcher() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const current = findNavItem(pathname);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
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

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const CurrentIcon = current.icon;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <CurrentIcon className={styles.triggerIcon} />
        <span className={styles.triggerLabel}>{current.label}</span>
        <CaretDownIcon className={styles.chevron} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className={styles.menu}
            style={{ top: coords.top, left: coords.left, width: MENU_WIDTH }}
            role="menu"
          >
            <span className={styles.menuTitle}>Seções</span>
            {NAV_ITEMS.map((item) => {
              const ItemIcon = item.icon;
              const active = item.path === current.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  role="menuitem"
                  className={`${styles.option} ${active ? styles.optionActive : ""}`}
                  onClick={() => {
                    setOpen(false);
                    if (!active) navigate(item.path);
                  }}
                >
                  <ItemIcon className={styles.optionIcon} />
                  <span className={styles.optionLabel}>{item.label}</span>
                  {active && <CheckMarkIcon className={styles.optionCheck} />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
