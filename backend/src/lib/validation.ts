import type { Response } from "express";
import type { ZodError, ZodType, z } from "zod";

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
