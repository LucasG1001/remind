import type { Response } from "express";
import { z } from "zod";
import type { ZodError, ZodType } from "zod";
import { parseEventAt, spDateKey } from "./dateUtils.js";

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "YYYY-MM-DD" que existe de fato no calendário. A regex só valida o formato, e o
 * `Date.UTC` de `parseEventAt` normaliza overflow em silêncio: "2026-02-30" era
 * gravado como 02/03 e "0026-06-18" como 1926. O round-trip recusa esses casos.
 */
export const calendarDateSchema = z
  .string()
  .regex(DATE_RE, "Data inválida (use YYYY-MM-DD).")
  .refine((value) => spDateKey(parseEventAt(value, null)) === value, {
    message: "Data inexistente no calendário.",
  });

/** "HH:MM" em 24h. Fonte única — os schemas dos dois domínios importam daqui. */
export const timeSchema = z
  .string({ error: "Hora inválida (use HH:MM)." })
  .regex(TIME_RE, "Hora inválida (use HH:MM).");

export function requireUuid(res: Response, value: string, notFound: string): boolean {
  if (UUID_RE.test(value)) return true;
  res.status(404).json({ error: notFound });
  return false;
}

export function respondValidationError(
  res: Response,
  error: ZodError,
  fallback = "Dados inválidos."
): void {
  res.status(400).json({ error: error.issues[0]?.message ?? fallback });
}

export function parseBody<S extends ZodType>(
  res: Response,
  schema: S,
  body: unknown
): z.infer<S> | null {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    respondValidationError(res, parsed.error);
    return null;
  }
  return parsed.data;
}
