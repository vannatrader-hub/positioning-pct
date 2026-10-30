/**
 * Vault breadth wall: the math behind the NY and Nasdaq Summation charts.
 * Pure so `npm run check` can import it without a page.
 */

export const DEFAULT_MONTHS = 12;
export const MAX_MONTHS = 120;
export const BUY_LINE = -1000;
export const MA_PERIOD = 8;

export const RANGES = [
  { months: 3, label: "3M" },
  { months: 6, label: "6M" },
  { months: 12, label: "1Y" },
  { months: 24, label: "2Y" },
  { months: 36, label: "3Y" },
  { months: 60, label: "5Y" },
  { months: 120, label: "10Y" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function utc(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Same calendar day `months` earlier, clamped to the month's last day. */
export function monthsBack(isoDate, months) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 - months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return target.toISOString().slice(0, 10);
}

export function clampMonths(months) {
  return Math.min(MAX_MONTHS, Math.max(1, Math.round(Number(months) || DEFAULT_MONTHS)));
}

/** Index of the first bar inside a window of `months` ending on the last bar. */
export function windowStart(bars, months) {
  const from = monthsBack(bars[bars.length - 1].t, clampMonths(months));
  const index = bars.findIndex((bar) => bar.t >= from);
  return index < 0 ? 0 : index;
}

export function rangeLabel(months) {
  const m = clampMonths(months);
  if (m < 12) return `${m}M`;
  const years = Math.floor(m / 12);
  const rest = m % 12;
  return rest ? `${years}Y ${rest}M` : `${years}Y`;
}

/** Simple moving average of closes, aligned to the bars; null until `period` closes exist. */
export function sma(bars, period = MA_PERIOD) {
  const out = new Array(bars.length).fill(null);
  let sum = 0;
  for (let i = 0; i < bars.length; i += 1) {
    sum += bars[i].c;
    if (i >= period) sum -= bars[i - period].c;
    if (i >= period - 1) out[i] = Math.round((sum / period) * 100) / 100;
  }
  return out;
}

/** Day change, with the percent taken against the size of the prior close so a rise from −732 reads positive. */
export function dayChange(bars, index) {
  if (index < 1) return { chg: 0, pct: 0 };
  const prev = bars[index - 1].c;
  const chg = Math.round((bars[index].c - prev) * 100) / 100;
  const pct = prev ? Math.round((chg / Math.abs(prev)) * 10000) / 100 : 0;
  return { chg, pct };
}

export function fixed(value, digits = 2) {
  return value.toFixed(digits);
}

export function signed(value, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

/** 29-Oct-2026 */
export function longDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${String(day).padStart(2, "0")}-${MONTHS[month - 1]}-${year}`;
}

/** 29 Oct */
export function legendDate(isoDate) {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

/** Oct 29, 2026 */
export function plainDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

export function niceStep(span, target) {
  const raw = (span || 1) / Math.max(1, target);
  const power = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * power).find((value) => value >= raw);
}

export function ticks(lo, hi, target) {
  const step = niceStep(hi - lo, target);
  const out = [];
  for (let value = Math.ceil(lo / step) * step; value <= hi + 1e-9; value += step) out.push(Math.round(value * 1e6) / 1e6);
  return out;
}

/** Value range for a pane: the visible closes and MA, always wide enough to hold the buy line. */
export function paneDomain(values, mark = null) {
  const list = values.filter((value) => typeof value === "number");
  if (mark !== null) list.push(mark);
  let lo = Math.min(...list);
  let hi = Math.max(...list);
  const pad = (hi - lo) * 0.04 || 1;
  lo -= pad;
  hi += pad;
  return { lo, hi };
}

/**
 * Month boundaries to label along the time axis. Steps up from every month to
 * quarters, halves, and years so labels keep `minGap` pixels apart; January
 * always carries the year.
 */
export function monthMarks(fromIso, toIso, pxPerDay, minGap = 34) {
  const from = utc(fromIso);
  const to = utc(toIso);
  const step = [1, 2, 3, 6, 12, 24].find((months) => months * 30.4 * pxPerDay >= minGap) ?? 24;
  const start = new Date(from);
  const marks = [];
  for (let date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)); date.getTime() <= to; date = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))) {
    const month = date.getUTCMonth();
    const year = date.getUTCFullYear();
    if (step >= 12 ? month !== 0 || year % (step / 12) : month % step) continue;
    marks.push({ t: date.toISOString().slice(0, 10), label: month === 0 ? String(year) : MONTHS[month], year: month === 0 });
  }
  return marks;
}

/** Card read: last close, MA, day change, and where the print sits against the buy line. */
export function breadthRead(doc) {
  const bars = doc.bars;
  const last = bars.length - 1;
  const ma = sma(bars, doc.ma ?? MA_PERIOD);
  const buy = doc.buyLine ?? BUY_LINE;
  const close = bars[last].c;
  const gap = Math.round((close - buy) * 100) / 100;
  const tenYear = bars.slice(windowStart(bars, MAX_MONTHS));
  const touches = tenYear.filter((bar, i) => bar.c <= buy && (i === 0 || tenYear[i - 1].c > buy));
  return {
    date: bars[last].t,
    close,
    ma: ma[last],
    ...dayChange(bars, last),
    buy,
    gap,
    atBuy: close <= buy,
    aboveMa: close >= ma[last],
    lastTouch: touches.length ? touches[touches.length - 1].t : null,
    touches: touches.length,
  };
}
