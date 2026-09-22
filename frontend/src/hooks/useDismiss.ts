import { useEffect, useRef, type RefObject } from "react";

type OutsideRef = RefObject<HTMLElement | null>;

export function useDismiss(
  onDismiss: () => void,
  outside?: OutsideRef | OutsideRef[],
  active = true
): void {
  const refs = outside ? (Array.isArray(outside) ? outside : [outside]) : [];
  const hasOutside = refs.length > 0;

  // Callback e refs entram por ref, e as deps do efeito passam a ter tamanho constante:
  // `[...refs]` mudava de tamanho entre renders (o React avisa e a reassinatura fica
  // imprevisível), e `onDismiss` é quase sempre arrow inline, o que removia e
  // readicionava o listener de teclado em **todo** render.
  const dismissRef = useRef(onDismiss);
  const refsRef = useRef(refs);
  useEffect(() => {
    dismissRef.current = onDismiss;
    refsRef.current = refs;
  });

  useEffect(() => {
    if (!active) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissRef.current();
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      const current = refsRef.current;
      const inside = current.some((ref) => ref.current?.contains(target));
      const mounted = current.some((ref) => ref.current);
      if (mounted && !inside) dismissRef.current();
    };

    document.addEventListener("keydown", onKey);
    if (hasOutside) document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (hasOutside) document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [active, hasOutside]);
}
