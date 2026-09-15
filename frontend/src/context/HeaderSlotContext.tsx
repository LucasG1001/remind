import { useMemo, useState, type ReactNode } from "react";
import { HeaderSlotContext } from "./useHeaderSlot";

export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ element, setElement }), [element]);

  return <HeaderSlotContext.Provider value={value}>{children}</HeaderSlotContext.Provider>;
}
