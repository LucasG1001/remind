export const WEEKDAYS_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export const WEEKDAY_ABBR_PT = WEEKDAYS_PT.map((w) => w.slice(0, 3));

export const WEEKDAY_LETTERS = WEEKDAYS_PT.map((w) => w[0]!);

const WEEKDAYS_ALL = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS_BUSINESS = [1, 2, 3, 4, 5];
const WEEKDAYS_WEEKEND = [0, 6];

function sameSet(days: number[], other: number[]): boolean {
  return days.length === other.length && other.every((d) => days.includes(d));
}

export function formatSelectedDays(days: number[]): string {
  if (days.length === 0) return "Nenhum dia";
  if (sameSet(days, WEEKDAYS_ALL)) return "Todos os dias";
  if (sameSet(days, WEEKDAYS_BUSINESS)) return "Seg a Sex";
  if (sameSet(days, WEEKDAYS_WEEKEND)) return "Fins de semana";
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_ABBR_PT[d])
    .join(", ");
}
