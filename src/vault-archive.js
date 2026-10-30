/**
 * Vault desk-day archive. Renders only after the Vault gate opens the page.
 * Soft ↔ Crowded weeks come from the committed Desk series (and the Vault
 * pack index, for the weeks that have a pack). New Today desk days come from
 * the public new-today.json. Nothing here is a new data file; the archive is
 * an index over what is already committed, grouped by ISO week.
 */

import { isoWeek, isoWeekRange } from "./iso-week.js";
import { NT_SECTIONS, ctTime, deskDay } from "./new-today-window.js";
import { CANON, WEEKS, buildReading } from "./readings.js";

const BASE = import.meta.env?.BASE_URL ?? "/";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LEVELS = [
  ["extreme soft", "extreme soft"],
  ["soft", "soft"],
  ["mid", "mid"],
  ["crowded", "crowded"],
];
const PRESS = ["W", "SJ"].join("");

export function longDay(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return `${DAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]} ${MONTHS[month - 1]} ${day}, ${year}`;
}

function dateTokens(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  const week = isoWeek(iso);
  const weekday = DAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()].toLowerCase();
  return [iso, `${MONTHS[month - 1].toLowerCase()} ${day}`, `${MONTHS_LONG[month - 1]} ${day}`, `${month}/${day}`, `${month}/${day}/${year}`, weekday, week.toLowerCase(), week.slice(5).toLowerCase()].join(" ");
}

/** Public label for a New Today source. Press labels read as a press note. */
export function displaySource(label) {
  if (!label) return "Desk";
  return label === PRESS ? "Press note" : label;
}

/** Soft ↔ Crowded on the Desk for every committed Friday, newest first. */
export function deskWeekEntries(packIndex = null, house = "jpm") {
  const packs = new Map((packIndex?.weeks ?? []).map((row) => [row.week, row]));
  return WEEKS.map((week, at) => {
    const reading = buildReading(house, at, 4);
    const printed = CANON.map((ticker) => reading.sectors[ticker]).filter((sector) => sector.available);
    const counts = Object.fromEntries(LEVELS.map(([level]) => [level, printed.filter((sector) => sector.level === level).length]));
    const crowded = printed.filter((sector) => sector.level === "crowded").sort((a, b) => b.points - a.points);
    const softest = [...printed].sort((a, b) => a.points - b.points)[0];
    const pack = packs.get(week);
    const summary = [
      LEVELS.map(([level, label]) => `${counts[level]} ${label}`).join(" · "),
      crowded.length ? `crowded ${crowded.map((sector) => `${sector.ticker} ${sector.display}`).join(", ")}` : "nothing crowded",
      softest ? `softest ${softest.ticker} ${softest.display}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const iso = isoWeek(week);
    return {
      kind: "pack",
      date: week,
      isoWeek: iso,
      title: `${iso} Soft ↔ Crowded`,
      label: `${longDay(week)} · Desk Friday`,
      headline: pack?.headline ?? "",
      summary,
      hasPack: Boolean(pack),
      href: pack ? `../soft-crowded/?week=${iso}` : `../../positioning/desk/?source=${house}&week=${week}#sectors`,
      linkLabel: pack ? "Open the pack" : "Open this week on the Desk",
      text: [iso, pack?.headline ?? "", summary, ...printed.map((sector) => `${sector.ticker} ${sector.short} ${sector.level}`)].join(" ").toLowerCase(),
    };
  }).reverse();
}

/** New Today grouped into desk days, newest first. */
export function newTodayDays(items) {
  const byDay = new Map();
  for (const item of items ?? []) {
    const day = deskDay(item.publishedAt);
    if (!day) continue;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(item);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, list]) => {
      const sorted = [...list].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
      const sections = NT_SECTIONS.map((section) => [section.title, sorted.filter((item) => item.section === section.id).length]).filter(([, count]) => count);
      return {
        kind: "day",
        date: day,
        isoWeek: isoWeek(day),
        title: `New Today · ${longDay(day)}`,
        label: `Desk day ${longDay(day)} · 12:00 AM to 11:59 PM CT`,
        summary: `${sorted.length} ${sorted.length === 1 ? "item" : "items"} · ${sections.map(([title, count]) => `${count} ${title}`).join(" · ")}`,
        items: sorted.map((item) => ({
          id: item.id,
          time: ctTime(item.publishedAt),
          section: NT_SECTIONS.find((section) => section.id === item.section)?.title ?? item.section,
          source: displaySource(item.sourceLabel),
          title: item.title,
          summary: item.summary ?? "",
          href: item.href ?? "",
          text: `${item.title} ${item.summary ?? ""} ${displaySource(item.sourceLabel)} ${item.section}`.toLowerCase(),
        })),
        text: sorted.map((item) => `${item.title} ${item.summary ?? ""} ${displaySource(item.sourceLabel)}`).join(" ").toLowerCase(),
      };
    });
}

/** A query that names a date or an ISO week: "2026-10-28", "Oct 28", "10/28", "W44", "2026-W44". */
export function parseDateQuery(query, year = 2026) {
  const q = query.trim().toLowerCase().replace(/,/g, "").replace(/\s+/g, " ");
  if (!q) return null;
  let match = q.match(/^(\d{4})-w(\d{1,2})$/) ?? q.match(/^w(\d{1,2})$/);
  if (match) {
    const [y, w] = match.length === 3 ? [match[1], match[2]] : [String(year), match[1]];
    return { week: `${y}-W${String(Number(w)).padStart(2, "0")}` };
  }
  match = q.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return { day: q };
  match = q.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/);
  if (match) return { day: `${match[3] ?? year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}` };
  match = q.match(/^(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]* )?([a-z]+) (\d{1,2})(?: (\d{4}))?$/);
  if (match) {
    const month = MONTHS_LONG.findIndex((name) => name.startsWith(match[1]) && match[1].length >= 3);
    if (month >= 0) return { day: `${match[3] ?? year}-${String(month + 1).padStart(2, "0")}-${match[2].padStart(2, "0")}` };
  }
  return null;
}

/** Entries that match a query, with New Today items cut to the matching lines on a word search. */
export function filterEntries(entries, query, kind = "all") {
  const pool = entries.filter((entry) => kind === "all" || entry.kind === kind);
  const q = query.trim().toLowerCase();
  if (!q) return pool;
  const asDate = parseDateQuery(q);
  if (asDate?.week) return pool.filter((entry) => entry.isoWeek === asDate.week);
  if (asDate?.day) {
    return pool.filter((entry) => (entry.kind === "day" ? entry.date === asDate.day : entry.date === asDate.day || (entry.isoWeek === isoWeek(asDate.day) && entry.date >= asDate.day)));
  }
  const terms = q.split(/\s+/).filter(Boolean);
  const hit = (text) => terms.every((term) => text.includes(term));
  const out = [];
  for (const entry of pool) {
    const head = `${entry.title} ${entry.label} ${dateTokens(entry.date)}`.toLowerCase();
    if (entry.kind === "day") {
      if (hit(head)) {
        out.push(entry);
        continue;
      }
      const items = entry.items.filter((item) => hit(`${item.text} ${head}`));
      if (items.length) out.push({ ...entry, items, partial: true });
    } else if (hit(`${head} ${entry.text}`)) {
      out.push(entry);
    }
  }
  return out;
}

/** ISO-week groups, newest first. A week past the last Desk Friday says its print is not committed yet. */
export function archiveGroups(entries, lastDeskWeek = WEEKS[WEEKS.length - 1]) {
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.isoWeek)) groups.set(entry.isoWeek, []);
    groups.get(entry.isoWeek).push(entry);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([week, list]) => {
      const { start, end } = isoWeekRange(week);
      const friday = new Date(`${start}T12:00:00Z`);
      friday.setUTCDate(friday.getUTCDate() + 4);
      const fridayIso = friday.toISOString().slice(0, 10);
      const hasPack = list.some((entry) => entry.kind === "pack");
      return {
        week,
        start,
        end,
        entries: [...list].sort((a, b) => (a.kind === b.kind ? b.date.localeCompare(a.date) : a.kind === "pack" ? -1 : 1)),
        gap: !hasPack && fridayIso > lastDeskWeek ? `No Soft ↔ Crowded print is committed for ${longDay(fridayIso)} yet.` : "",
      };
    });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function shortDay(iso) {
  const [, month, day] = iso.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}`;
}

function packCard(entry) {
  const card = el("article", "archive-entry is-pack");
  card.dataset.date = entry.date;
  const head = el("div", "archive-entry-head");
  head.append(el("span", "badge is-journal", entry.hasPack ? "Pack" : "Desk week"), el("h3", "", entry.title));
  card.append(head, el("p", "archive-entry-label", entry.label));
  if (entry.headline) card.append(el("p", "archive-entry-line", entry.headline));
  card.append(el("p", "archive-entry-sub", entry.summary));
  const link = el("a", "section-link", `${entry.linkLabel} →`);
  link.href = entry.href;
  card.append(link);
  return card;
}

function dayCard(entry) {
  const card = el("article", "archive-entry is-day");
  card.dataset.date = entry.date;
  const head = el("div", "archive-entry-head");
  head.append(el("span", "badge is-live", "New Today"), el("h3", "", entry.title));
  card.append(head, el("p", "archive-entry-label", entry.label), el("p", "archive-entry-sub", entry.partial ? `${entry.items.length} matching · ${entry.summary}` : entry.summary));
  const list = el("ol", "archive-items");
  for (const item of entry.items) {
    const row = el("li");
    const meta = el("span", "archive-item-meta", `${item.time} · ${item.section} · ${item.source}`);
    const title = item.href ? el("a", "archive-item-title", item.title) : el("span", "archive-item-title", item.title);
    if (item.href) title.href = /^https?:\/\//.test(item.href) ? item.href : `${BASE}${item.href.replace(/^\/+/, "")}`;
    row.append(meta, title);
    if (item.summary) row.append(el("span", "archive-item-summary", item.summary));
    list.append(row);
  }
  card.append(list);
  return card;
}

function render(root, groups, count, query) {
  if (!groups.length) {
    const empty = el("div", "archive-empty");
    empty.append(
      el("p", "", query ? `Nothing in the archive matches “${query}”.` : "The archive is empty."),
      el("p", "hint", "Try a date such as 2026-10-28 or Oct 28, an ISO week such as W43, a ticker such as XLE, or a bank name."),
    );
    root.replaceChildren(empty);
    count.textContent = query ? "0 results" : "";
    return;
  }
  const nodes = groups.map((group) => {
    const section = el("section", "archive-week");
    section.dataset.week = group.week;
    const head = el("header", "archive-week-head");
    head.append(el("h2", "", group.week), el("span", "", `${shortDay(group.start)} – ${shortDay(group.end)}`));
    section.append(head);
    if (group.gap) section.append(el("p", "archive-gap", group.gap));
    const list = el("div", "archive-entries");
    for (const entry of group.entries) list.append(entry.kind === "pack" ? packCard(entry) : dayCard(entry));
    section.append(list);
    return section;
  });
  root.replaceChildren(...nodes);
  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);
  count.textContent = `${total} ${total === 1 ? "entry" : "entries"} across ${groups.length} ${groups.length === 1 ? "week" : "weeks"}${query ? ` for “${query}”` : ""}`;
}

async function load(root) {
  const [ntRes, packRes] = await Promise.all([fetch(`${BASE}data/new-today.json`), fetch(`${BASE}data/vault/soft-crowded/index.json`)]);
  if (!ntRes.ok) throw new Error(`new today ${ntRes.status}`);
  const nt = await ntRes.json();
  const packIndex = packRes.ok ? await packRes.json() : null;
  const entries = [...deskWeekEntries(packIndex), ...newTodayDays(nt.items)];

  const form = document.getElementById("archive-search");
  const input = document.getElementById("archive-q");
  const count = document.getElementById("archive-count");
  const buttons = [...form.querySelectorAll("[data-kind]")];
  const params = new URLSearchParams(window.location.search);
  const state = { q: params.get("q") ?? "", kind: ["pack", "day"].includes(params.get("kind")) ? params.get("kind") : "all" };
  input.value = state.q;

  const paint = () => {
    for (const button of buttons) {
      const on = button.dataset.kind === state.kind;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    }
    render(root, archiveGroups(filterEntries(entries, state.q, state.kind)), count, state.q.trim());
    const next = new URLSearchParams();
    if (state.q.trim()) next.set("q", state.q.trim());
    if (state.kind !== "all") next.set("kind", state.kind);
    const search = next.toString();
    window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
  };
  input.addEventListener("input", () => {
    state.q = input.value;
    paint();
  });
  form.addEventListener("submit", (event) => event.preventDefault());
  for (const button of buttons) {
    button.addEventListener("click", () => {
      state.kind = button.dataset.kind;
      paint();
    });
  }
  paint();
}

if (typeof document !== "undefined") {
  document.addEventListener("vault-open", () => {
    const root = document.getElementById("archive");
    if (!root || root.dataset.ready === "1") return;
    root.dataset.ready = "1";
    load(root).catch((error) => {
      console.error(error);
      root.replaceChildren(el("p", "hint", "The archive did not load. Refresh to try again."));
    });
  });
}
