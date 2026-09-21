import { useEffect, type RefObject } from "react";

type OutsideRef = RefObject<HTMLElement | null>;

export function useDismiss(
  onDismiss: () => void,
  outside?: OutsideRef | OutsideRef[],
  active = true
): void {
  const refs = outside ? (Array.isArray(outside) ? outside : [outside]) : [];

  useEffect(() => {
    if (!active) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      const inside = refs.some((ref) => ref.current?.contains(target));
      const mounted = refs.some((ref) => ref.current);
      if (mounted && !inside) onDismiss();
    };

    document.addEventListener("keydown", onKey);
    if (refs.length) document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (refs.length) document.removeEventListener("pointerdown", onPointerDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDismiss, active, refs.length, ...refs]);
}
