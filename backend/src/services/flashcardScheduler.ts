import { spDateAtTime } from "../lib/dateUtils.js";

const DAY_START_HOUR = 4;

// Leitner sem teto: caixa 1 e o primeiro acerto valem 1 dia, e cada acerto
// seguinte dobra o intervalo — 1, 1, 2, 4, 8, 16, 32, …
// O limite existe só para a data continuar válida se a caixa vier corrompida do banco.
const MAX_INTERVAL_DAYS = 36500;

export interface ReviewOutcome {
  box: number;
  nextReviewAt: Date;
}

export function clampBox(box: number): number {
  if (!Number.isFinite(box) || box < 1) return 1;
  return Math.floor(box);
}

export function boxIntervalDays(box: number): number {
  return Math.min(2 ** Math.max(0, clampBox(box) - 2), MAX_INTERVAL_DAYS);
}

export function review(box: number, correct: boolean, now: Date): ReviewOutcome {
  const nextBox = correct ? clampBox(box) + 1 : 1;
  return {
    box: nextBox,
    nextReviewAt: spDateAtTime(now, boxIntervalDays(nextBox), DAY_START_HOUR, 0),
  };
}
