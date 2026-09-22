import type { ComponentType } from "react";
import { BellIcon, BoardIcon, CheckIcon, LayersIcon } from "../Icon/icons";

export interface NavItem {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  addTo: string;
  addLabel: string;
}

export const NAV_ITEMS: NavItem[] = [
  { path: "/lembretes", label: "Lembretes", icon: BellIcon, addTo: "/lembretes/novo", addLabel: "Novo lembrete" },
  { path: "/habitos", label: "Hábitos", icon: CheckIcon, addTo: "/habitos?novo=1", addLabel: "Novo hábito" },
  { path: "/projetos", label: "Projetos", icon: BoardIcon, addTo: "/projetos?novo=1", addLabel: "Nova lista" },
  { path: "/flashcards", label: "Flashcards", icon: LayersIcon, addTo: "/flashcards?novo=1", addLabel: "Novo card" },
];

export function findNavItem(pathname: string): NavItem {
  // NAV_ITEMS é uma lista literal e não-vazia.
  return NAV_ITEMS.find((item) => pathname.startsWith(item.path)) ?? NAV_ITEMS[0]!;
}
