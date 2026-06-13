/** Formats a Date as YYYY-MM-DD in UTC (the format GSC expects). */
export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Resolves a start/end date range. Explicit start/end win; otherwise derives
 * a range from `days` (default 28), ending `lagDays` ago because GSC data
 * lags ~2-3 days behind real time.
 */
export function resolveDateRange(opts: {
  startDate?: string;
  endDate?: string;
  days?: number;
  lagDays?: number;
}): { startDate: string; endDate: string } {
  const lag = opts.lagDays ?? 2;
  const now = new Date();

  const end = opts.endDate
    ? new Date(opts.endDate)
    : new Date(now.getTime() - lag * 86_400_000);

  if (opts.startDate) {
    return { startDate: opts.startDate, endDate: toISODate(end) };
  }

  const days = opts.days ?? 28;
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  return { startDate: toISODate(start), endDate: toISODate(end) };
}
