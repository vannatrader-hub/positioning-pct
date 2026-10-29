/** New Today: the desk day runs 5:00 AM America/Chicago to 4:59:59 AM the next calendar day. */
export const DESK_TZ = "America/Chicago";
export const DAY_START_HOUR = 5;

export const NT_SECTIONS = [
  { id: "positioning", title: "Positioning", empty: "Nothing new in Positioning this desk day." },
  { id: "options-flow", title: "Options Flow", empty: "Nothing new in Options Flow this desk day." },
  { id: "spx", title: "SPX Levels", empty: "Nothing new in SPX Levels this desk day." },
  { id: "research", title: "Research desk", empty: "No research charts or bank notes this desk day." },
];

/** Public source labels. Research rows carry a bank label or one of the generic desk labels. */
export const SOURCE_LABELS = ["Desk", "X", "Bank note", "JPM", "MS", "GS", "BoA", "Citi", "UBS", "Barclays", "BNP", "Nomura", "WSJ"];

const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: DESK_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function wallClock(instant) {
  const out = {};
  for (const { type, value } of parts.formatToParts(instant)) out[type] = Number(value);
  return out;
}

function shiftDay(day, delta) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

function toInstant(value) {
  const instant = value instanceof Date ? value : new Date(value);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/** YYYY-MM-DD of the desk day an instant falls in, read on the Chicago wall clock so DST shifts are exact. */
export function deskDay(value = new Date()) {
  const instant = toInstant(value);
  if (!instant) return null;
  const ct = wallClock(instant);
  const day = `${ct.year}-${String(ct.month).padStart(2, "0")}-${String(ct.day).padStart(2, "0")}`;
  return ct.hour < DAY_START_HOUR ? shiftDay(day, -1) : day;
}

export function nextDeskDay(day) {
  return shiftDay(day, 1);
}

export function prevDeskDay(day) {
  return shiftDay(day, -1);
}

/** UTC offset of Chicago at 5:00 AM on a calendar day, as "-05:00" or "-06:00". 5 AM never sits in a DST gap. */
function startOffset(day) {
  const [y, m, d] = day.split("-").map(Number);
  let guess = Date.UTC(y, m - 1, d, DAY_START_HOUR + 6);
  for (let i = 0; i < 2; i += 1) {
    const ct = wallClock(new Date(guess));
    const asUtc = Date.UTC(ct.year, ct.month - 1, ct.day, ct.hour, ct.minute, ct.second);
    guess += Date.UTC(y, m - 1, d, DAY_START_HOUR) - asUtc;
  }
  const minutes = Math.round((Date.UTC(y, m - 1, d, DAY_START_HOUR) - guess) / 60000);
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** ISO stamp of a desk day's 5:00 AM CT open, with the Chicago offset in force that morning. */
export function deskDayStart(day) {
  return `${day}T0${DAY_START_HOUR}:00:00${startOffset(day)}`;
}

/** The half-open window [start, end) in epoch ms; end is the next desk day's open, so 4:59:59 AM is the last second in. */
export function deskWindow(day) {
  return { start: Date.parse(deskDayStart(day)), end: Date.parse(deskDayStart(nextDeskDay(day))) };
}

export function inDeskDay(item, day) {
  return deskDay(item.publishedAt) === day;
}

/** Items for one desk day, newest first. */
export function itemsForDay(items, day) {
  return items
    .filter((item) => inDeskDay(item, day))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: DESK_TZ, hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });

export function ctTime(value) {
  const instant = toInstant(value);
  return instant ? `${timeFmt.format(instant)} CT` : "";
}

export function dayLabel(day) {
  return dayFmt.format(new Date(`${day}T12:00:00Z`));
}

/** "Wed, Oct 28 · 5:00 AM CT → Thu, Oct 29 · 4:59 AM CT" */
export function windowLabel(day) {
  return `${dayLabel(day)} · 5:00 AM CT → ${dayLabel(nextDeskDay(day))} · 4:59 AM CT`;
}

/** Site-relative hrefs resolve against the Vite base; absolute http(s) links pass through. */
export function resolveHref(href, base) {
  if (!href) return "";
  if (/^https?:\/\//.test(href)) return href;
  return `${base}${href.replace(/^\/+/, "")}`;
}
