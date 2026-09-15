import { NavLink, useLocation, useNavigate } from "react-router-dom";
import styles from "./TopNav.module.css";
import { NAV_ITEMS, findNavItem, type NavItem } from "./navItems";
import { SectionSwitcher } from "./SectionSwitcher";
import { useCalendar } from "../../context/useCalendar";
import { useHeaderSlotTarget } from "../../context/useHeaderSlot";
import { CalendarIcon, LogoIcon, PlusIcon } from "../Icon/icons";

export function TopNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { open: openCalendar } = useCalendar();
  const setSlotElement = useHeaderSlotTarget();

  const section = findNavItem(pathname);
  const handleAdd = () => navigate(section.addTo);

  const mid = Math.floor(NAV_ITEMS.length / 2);

  const renderBarItem = (item: NavItem) => {
    const ItemIcon = item.icon;
    return (
      <NavLink
        key={item.path}
        to={item.path}
        title={item.label}
        className={({ isActive }) => `${styles.barItem} ${isActive ? styles.barItemActive : ""}`}
      >
        <ItemIcon className={styles.barIcon} />
        <span className={styles.barLabel}>{item.label}</span>
      </NavLink>
    );
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.inner}>
          <div className={styles.nav}>
            <span className={styles.brand}>
              <LogoIcon className={styles.brandMark} />
            </span>

            <SectionSwitcher />

            <span className={styles.divider} />

            <div className={styles.slot} ref={setSlotElement} />
          </div>

          <div className={styles.right}>
            <button
              type="button"
              className={styles.action}
              onClick={openCalendar}
              title="Calendário"
              aria-label="Abrir calendário"
            >
              <CalendarIcon className={styles.actionIcon} />
            </button>

            <button
              type="button"
              className={styles.add}
              onClick={handleAdd}
              title={section.addLabel}
              aria-label={section.addLabel}
            >
              <PlusIcon className={styles.actionIcon} />
            </button>
          </div>
        </div>
      </header>

      <nav className={styles.mobileNav} aria-label="Navegação principal">
        {NAV_ITEMS.slice(0, mid).map(renderBarItem)}
        <button type="button" className={styles.fab} onClick={handleAdd} aria-label={section.addLabel}>
          <PlusIcon className={styles.fabIcon} />
        </button>
        {NAV_ITEMS.slice(mid).map(renderBarItem)}
      </nav>
    </>
  );
}
