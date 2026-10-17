// Shop books its day on Pakistan local time — this must match SHOP_TIMEZONE in
// the backend's networkController, otherwise the two disagree about "today"
// for the hours around midnight.
const SHOP_TIMEZONE = 'Asia/Karachi';

/** Today as 'YYYY-MM-DD' in the shop's timezone. */
export function shopToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SHOP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** 'YYYY-MM-DD' → '17 Aug 2026' */
export function formatDayLabel(date: string): string {
  if (!date) return '';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Time-of-day label for a load entry timestamp. */
export function formatTime(iso: string): string {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: SHOP_TIMEZONE,
  });
}

/** ₨ 56,150 — no decimals, easyload amounts are always whole rupees. */
export function formatPkr(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `₨ ${Math.round(value).toLocaleString('en-PK')}`;
}

/** Shift a 'YYYY-MM-DD' string by whole days without tripping over timezones. */
export function shiftDay(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
