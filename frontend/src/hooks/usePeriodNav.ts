import { useMemo, useState } from "react";
import { getToday } from "../utils/dateUtils";
import { periodLabel, periodRange, type Period, type PeriodRange } from "../utils/period";

export interface PeriodNav {
  period: Period;
  offset: number;
  range: PeriodRange;
  label: string;
  canGoNext: boolean;
  setPeriod: (period: Period) => void;
  goPrev: () => void;
  goNext: () => void;
}

export function usePeriodNav(): PeriodNav {
  const [period, setPeriodState] = useState<Period>("week");
  const [offset, setOffset] = useState(0);

  const range = useMemo(() => periodRange(period, offset, getToday()), [period, offset]);
  const label = useMemo(() => periodLabel(range, offset), [range, offset]);

  return {
    period,
    offset,
    range,
    label,
    canGoNext: offset < 0,
    setPeriod: (next) => {
      setPeriodState(next);
      setOffset(0);
    },
    goPrev: () => setOffset((prev) => prev - 1),
    goNext: () => setOffset((prev) => Math.min(0, prev + 1)),
  };
}
