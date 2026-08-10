import type { ComponentType } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { useCalendar } from "../../context/useCalendar";
import { BellIcon, BoardIcon, CalendarIcon, CheckIcon, ChevronIcon, LayersIcon, LogoIcon, PlusIcon } from "./Sidebar.icons";

interface NavItem {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/lembretes", label: "Lembretes", icon: BellIcon },
  { path: "/habitos", label: "Hábitos", icon: CheckIcon },
  { path: "/projetos", label: "Projetos", icon: BoardIcon },
  { path: "/flashcards", label: "Flashcards", icon: LayersIcon },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { open: openCalendar } = useCalendar();

  const handleAdd = () => {
    if (location.pathname.startsWith("/habitos")) {
      navigate("/habitos?novo=1");
    } else if (location.pathname.startsWith("/projetos")) {
      navigate("/projetos?novo=1");
    } else if (location.pathname.startsWith("/flashcards")) {
      navigate("/flashcards?novo=1");
    } else {
      navigate("/lembretes/novo");
    }
  };

  const mid = Math.floor(NAV_ITEMS.length / 2);

  const renderBarItem = (item: NavItem) => {
    const ItemIcon = item.icon;
    return (
      <NavLink
        key={item.path}
        to={item.path}
        aria-label={item.label}
        title={item.label}
        className={({ isActive }) => `${styles.barItem} ${isActive ? styles.barItemActive : ""}`}
      >
        <ItemIcon className={styles.barIcon} />
      </NavLink>
    );
  };

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <LogoIcon className={styles.logoMark} />
        </div>
        <span className={styles.logoText}>RemindMe</span>
        <button
          type="button"
          className={styles.toggle}
          onClick={onToggle}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          <ChevronIcon className={styles.toggleIcon} />
        </button>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const ItemIcon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={item.label}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ""}`
              }
            >
              <ItemIcon className={styles.navIcon} />
              <span className={styles.navLabel}>{item.label}</span>
            </NavLink>
          );
        })}
        <button
          type="button"
          className={styles.navItem}
          onClick={openCalendar}
          title="Calendário"
        >
          <CalendarIcon className={styles.navIcon} />
          <span className={styles.navLabel}>Calendário</span>
        </button>
      </nav>

      <nav className={styles.mobileNav}>
        {NAV_ITEMS.slice(0, mid).map(renderBarItem)}
        <button type="button" className={styles.barAdd} onClick={handleAdd} aria-label="Adicionar">
          <PlusIcon className={styles.barAddIcon} />
        </button>
        {NAV_ITEMS.slice(mid).map(renderBarItem)}
      </nav>

      {!location.pathname.startsWith("/habitos") && (
        <button
          type="button"
          className={styles.mobileCalendarFab}
          onClick={openCalendar}
          aria-label="Calendário"
          title="Calendário"
        >
          <CalendarIcon className={styles.mobileCalendarIcon} />
        </button>
      )}
    </aside>
  );
}
