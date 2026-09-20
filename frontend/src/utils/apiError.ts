export function apiErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return message ?? fallback;
}

export function apiErrorStatus(err: unknown): number | null {
  return (err as { response?: { status?: number } })?.response?.status ?? null;
}

export function alertApiError(err: unknown, fallback: string): void {
  window.alert(apiErrorMessage(err, fallback));
}
