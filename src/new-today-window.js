/** New Today: the desk day is the America/Chicago calendar date, 12:00:00 AM through 11:59:59 PM (half-open [midnight, next midnight)). */
export const DESK_TZ = "America/Chicago";
export const DAY_START_HOUR = 0;

export const NT_SECTIONS = [
  { id: "positioning", title: "Positioning", empty: "Nothing new in Positioning this desk day." },
  { id: "options-flow", title: "Options Flow", empty: "Nothing new in Options Flow this desk day." },
  { id: "spx", title: "SPX Levels", empty: "Nothing new in SPX Levels this desk day." },
  { id: "research", title: "Research desk", empty: "No research charts or bank notes this desk day." },
];

/**
 * Sections safe to list on the public Dashboard. Options Flow stays in the Vault.
 * A flow row is not turned into a public teaser here: the public page can list it
 * only when the row's own section is Positioning, SPX Levels, or Research.
 */
export const PUBLIC_NT_SECTIONS = NT_SECTIONS.filter((section) => section.id !== "options-flow");

export function publicDeskItems(items) {
  const allowed = new Set(PUBLIC_NT_SECTIONS.map((section) => section.id));
  return (items ?? []).filter((item) => allowed.has(item.section));
}

/** Public source labels. Research rows carry a bank label or one of the generic desk labels. */
export const SOURCE_LABELS = ["Desk", "X", "Bank note", "JPM", "MS", "GS", "BoA", "Citi", "UBS", "Barclays", "BNP", "Nomura", "Citadel", "WSJ", "Goldman Sachs", "Bloomberg"];

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

/**
 * UTC offset of Chicago at local midnight on a calendar day, as "-05:00" or "-06:00".
 * The clock change is at 2:00 AM, so midnight is never in the DST gap or the repeated hour.
 * The first guess is 18:00 UTC (early afternoon in Chicago, same calendar date); two passes
 * settle on the offset in force at DAY_START_HOUR:00.
 */
function startOffset(day) {
  const [y, m, d] = day.split("-").map(Number);
  let guess = Date.UTC(y, m - 1, d, 18);
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

/** ISO stamp of a desk day's midnight CT open, with the Chicago offset in force at that midnight. */
export function deskDayStart(day) {
  return `${day}T${String(DAY_START_HOUR).padStart(2, "0")}:00:00${startOffset(day)}`;
}

/** The half-open window [start, end) in epoch ms; end is the next midnight, so 11:59:59 PM is the last second in. */
export function deskWindow(day) {
  return { start: Date.parse(deskDayStart(day)), end: Date.parse(deskDayStart(nextDeskDay(day))) };
}

export function inDeskDay(item, day) {
  return deskDay(item.publishedAt) === day;
}

/** Items whose Chicago calendar date is in `days`, newest first. Stamps are not rewritten. */
export function itemsForDays(items, days) {
  const wanted = new Set((days ?? []).filter(Boolean));
  return (items ?? [])
    .filter((item) => wanted.has(deskDay(item?.publishedAt)))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

/** Items for one desk day, newest first. */
export function itemsForDay(items, day) {
  return itemsForDays(items, [day]);
}

/** Default New Today dates: the Chicago calendar day, then the previous one. */
export function catchUpDays(today) {
  return [today, prevDeskDay(today)];
}

/**
 * "today", "yesterday", or "earlier" for a Chicago calendar date.
 * A prior day stays yesterday; it is never reported as today.
 */
export function dayRelation(day, today) {
  if (day === today) return "today";
  if (day === prevDeskDay(today)) return "yesterday";
  return "earlier";
}

/** Visible date label. Today and Yesterday keep the original calendar date beside the word. */
export function rowDayLabel(publishedAt, today) {
  const day = deskDay(publishedAt);
  const relation = dayRelation(day, today);
  const date = day ? dayLabel(day) : "";
  const label = relation === "today" ? `Today · ${date}` : relation === "yesterday" ? `Yesterday · ${date}` : date;
  return { day, relation, label };
}

/**
 * Rows for one New Today view. Catch-up is today and yesterday. A day view is one
 * calendar date. Section and the public Options Flow cut both narrow that set.
 * publishedAt is left as stored.
 */
export function visibleDeskItems(items, { today, mode = "catchup", day, section, publicOnly = false } = {}) {
  const source = publicOnly ? publicDeskItems(items) : (items ?? []);
  const days = mode === "day" ? [day] : catchUpDays(today);
  const rows = itemsForDays(source, days);
  return section ? rows.filter((item) => item.section === section) : rows;
}

export function catchUpSummary(items, today) {
  const days = catchUpDays(today);
  const rows = itemsForDays(items, days);
  const todayCount = rows.filter((item) => deskDay(item.publishedAt) === days[0]).length;
  const yesterdayCount = rows.filter((item) => deskDay(item.publishedAt) === days[1]).length;
  return { days, rows, todayCount, yesterdayCount, total: todayCount + yesterdayCount };
}

/** Badge and section counts. Yesterday-only totals are not called new today. */
export function catchUpCountText(summary, { quiet = "Quiet" } = {}) {
  const { todayCount, yesterdayCount, total } = summary;
  if (!total) return quiet;
  if (todayCount && yesterdayCount) return `${todayCount} today · ${yesterdayCount} yesterday`;
  if (todayCount) return `${todayCount} today`;
  return `${yesterdayCount} from yesterday`;
}

export function catchUpChip(summary, updatedAt) {
  const stamp = updatedAt ? `Feed updated ${dayLabel(deskDay(updatedAt))} · ${ctTime(updatedAt)}` : "Feed time is not stamped";
  const { todayCount, yesterdayCount, total } = summary;
  let sub = "Quiet since yesterday";
  let detail = "nothing new on the Desk today or yesterday";
  if (todayCount && yesterdayCount) {
    sub = `${todayCount} today · ${yesterdayCount} yesterday`;
    detail = `${todayCount} today and ${yesterdayCount} yesterday`;
  } else if (todayCount) {
    sub = `${todayCount} today`;
    detail = `${todayCount} today, none yesterday`;
  } else if (yesterdayCount) {
    sub = `${yesterdayCount} from yesterday`;
    detail = `nothing new today. ${yesterdayCount} from yesterday`;
  }
  const aria = `New Today: ${detail}. ${stamp}.`;
  return { sub, aria, title: aria, lit: todayCount > 0, quiet: total === 0, stamp };
}

export function feedLine(updatedAt, { quiet, mode }) {
  if (!updatedAt) {
    if (!quiet) return "Feed time is not stamped.";
    return mode === "catchup" ? "Feed time is not stamped. Nothing new today or yesterday." : "Feed time is not stamped. Nothing new that desk day.";
  }
  const stamp = `Feed updated ${dayLabel(deskDay(updatedAt))} · ${ctTime(updatedAt)}`;
  if (!quiet) return stamp;
  return mode === "catchup" ? `${stamp} · nothing new today or yesterday` : `${stamp} · nothing new that desk day`;
}

export function emptyDeskMessage(mode) {
  return mode === "catchup" ? "Nothing new today or yesterday." : "Nothing new that desk day.";
}

export function emptyDayMessage(relation) {
  return relation === "today" ? "Nothing new today." : "Nothing new yesterday.";
}

export function sectionEmptyMessage(section, mode) {
  if (mode !== "catchup") return section.empty;
  if (section.id === "research") return "No research charts or bank notes today or yesterday.";
  return `Nothing new in ${section.title} today or yesterday.`;
}

export function yesterdayNote(today) {
  const prior = prevDeskDay(today);
  return `Nothing new today (${dayLabel(today)}). Rows below landed yesterday (${dayLabel(prior)}) and keep that date.`;
}

/** URL state. No day, or a day that is not strictly earlier, is the two-day catch-up. */
export function readDeskState(search, today) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const asked = params.get("day");
  const explicit = /^\d{4}-\d{2}-\d{2}$/.test(asked ?? "") && asked < today ? asked : null;
  return {
    today,
    mode: explicit ? "day" : "catchup",
    day: explicit ?? today,
    view: params.get("view") === "all" ? "all" : "sections",
  };
}

export function deskStateUrl(state) {
  const params = new URLSearchParams();
  if (state.mode === "day") params.set("day", state.day);
  if (state.view === "all") params.set("view", "all");
  const query = params.toString();
  return query ? `?${query}` : "./";
}

/** Earlier than the oldest day on screen. Catch-up already shows yesterday, so this opens the day before it. */
export function earlierState(state) {
  const anchor = state.mode === "catchup" ? prevDeskDay(state.today) : state.day;
  return { ...state, mode: "day", day: prevDeskDay(anchor) };
}

/** The next single desk day, or the two-day catch-up once the next day is today. */
export function laterState(state) {
  if (state.mode !== "day") return null;
  const next = nextDeskDay(state.day);
  if (next >= state.today) return { ...state, mode: "catchup", day: state.today };
  return { ...state, mode: "day", day: next };
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

/** "Thu, Oct 29 · 12:00 AM CT → Thu, Oct 29 · 11:59 PM CT" */
export function windowLabel(day) {
  return `${dayLabel(day)} · 12:00 AM CT → ${dayLabel(day)} · 11:59 PM CT`;
}

/** Today and yesterday as two calendar days, each midnight to 11:59 PM CT. */
export function catchUpWindowLabel(today) {
  const [current, prior] = catchUpDays(today);
  return `Today ${dayLabel(current)} · Yesterday ${dayLabel(prior)} · 12:00 AM CT through 11:59 PM CT`;
}

/** Site-relative hrefs resolve against the Vite base; absolute http(s) links pass through. */
export function resolveHref(href, base) {
  if (!href) return "";
  if (/^https?:\/\//.test(href)) return href;
  return `${base}${href.replace(/^\/+/, "")}`;
}
