// Formatting helpers. All dates are shown in IST (Asia/Kolkata).
const TZ = 'Asia/Kolkata';

export const grams = (g: number | null | undefined, digits = 3) =>
  g == null ? '—' : `${Number(g).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })} g`;

export const gramsShort = (g: number | null | undefined) => {
  const v = Number(g || 0);
  if (v >= 1000) return `${(v / 1000).toLocaleString('en-IN', { maximumFractionDigits: 3 })} kg`;
  return `${v.toLocaleString('en-IN', { maximumFractionDigits: 3 })} g`;
};

export const int = (n: number | null | undefined) => Number(n || 0).toLocaleString('en-IN');

export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-IN', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

export const dateOnly = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/** YYYY-MM-DD of the IST calendar day for a timestamp. */
export const istDay = (iso: string | Date = new Date()) => {
  const d = new Date(new Date(iso).getTime() + 330 * 60_000);
  return d.toISOString().slice(0, 10);
};

/** UTC ISO instant for the start of an IST day (YYYY-MM-DD). */
export const istDayStart = (day: string) => new Date(`${day}T00:00:00+05:30`).toISOString();
export const istDayEnd = (day: string) => new Date(new Date(`${day}T00:00:00+05:30`).getTime() + 86400_000).toISOString();

/** Value for <input type="datetime-local"> in IST. */
export const toLocalInput = (iso: string | Date = new Date()) =>
  new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 16);
export const fromLocalInput = (v: string) => new Date(`${v}:00+05:30`).toISOString();

export const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' });
};
