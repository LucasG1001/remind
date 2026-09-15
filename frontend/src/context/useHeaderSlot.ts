import { createContext, useContext } from "react";

export interface HeaderSlotContextValue {
  element: HTMLElement | null;
  setElement: (element: HTMLElement | null) => void;
}

export const HeaderSlotContext = createContext<HeaderSlotContextValue | null>(null);

export function useHeaderSlot(): HTMLElement | null {
  const ctx = useContext(HeaderSlotContext);
  if (!ctx) throw new Error("useHeaderSlot precisa estar dentro de HeaderSlotProvider.");
  return ctx.element;
}

export function useHeaderSlotTarget(): (element: HTMLElement | null) => void {
  const ctx = useContext(HeaderSlotContext);
  if (!ctx) throw new Error("useHeaderSlotTarget precisa estar dentro de HeaderSlotProvider.");
  return ctx.setElement;
}
