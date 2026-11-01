#!/usr/bin/env node
/**
 * Idempotent New Today pack. Midnight, morning, and afternoon auto-ship each
 * run this same builder after their pulls and before `npm run check`:
 *
 *   npm run new-today:pack
 *   npm run new-today:pack -- --dry-run
 *
 * Cadence (America/Chicago), from the standing auto-ship:
 *   - Midnight: weekdays 12:00 AM CT (±15 min)
 *   - Morning:  weekdays 6:30 AM CT (±15 min)
 *   - Afternoon: weekdays once session artifacts have landed. Hook this to the
 *     vol close routine (about 3:30 PM CT) so a gauge close and any later
 *     flow or chart note still append on the same desk day.
 *   - Quiet Friday 3:00 PM CT through Sunday 5:00 PM CT: do not run.
 *   - Exit 0 and the word `unchanged` means nothing new: open no PR.
 *
 * Inputs (a missing path is a gap, never a fabricated row):
 *   - Last-ship stamp:
 *       NEW_TODAY_LAST_SHIP
 *       /home/box/agent-data/trading-desk/watchers/auto-ship/LAST_SHIP.json
 *   - Flow-post watcher (posts/, seen ids). Seen ids without a post body are
 *     counted and skipped:
 *       NEW_TODAY_FLOW_POSTS  NEW_TODAY_FLOW_SEEN
 *       /home/box/agent-data/trading-desk/watchers/hawk-master/posts
 *       /home/box/agent-data/trading-desk/watchers/hawk-master/seen_ids.json
 *   - Chart-note watcher. STATE.md plus captioned assets under any sibling
 *     directory whose name starts with the configured stem (default
 *     /workspace/darkroom, so /workspace/darkroom* matches):
 *       NEW_TODAY_CHART_STATE  NEW_TODAY_CHART_DIRS
 *       /home/box/agent-data/trading-desk/watchers/darkroom/STATE.md
 *   - Soft ↔ Crowded vault index (latest week only) and Vol Stress latest.json
 *     (plus series.json close-routine points in the retained week).
 *
 * Diffs those candidates against public/data/new-today.json. The last-ship
 * stamp is reported and does not hide a row that is still missing, so a note
 * that landed after the morning ship is not stuck behind that stamp. Appends
 * America/Chicago desk-day rows, dedupes by id, sorts newest first, and sets
 * updatedAt only when the item list changes. Public labels are Desk, a bank
 * or outlet from SOURCE_LABELS, or X. Copy is scrubbed before it is written.
 * Vault-owned ids (vol-stress-*, soft-crowded-*) are refreshed in place when
 * the artifact changes. Watcher rows are append-only.
 *
 * On 2026-11-01 the box watcher roots were not mounted, so no Oct 30–31
 * session wrap, flow ticket, or chart note was backfilled. The committed
 * Oct 30 vault files are the only rows this builder can prove.
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SOURCE_LABELS, deskDay, deskDayStart } from "../src/new-today-window.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DESK_TZ = "America/Chicago";
const KEEP_DAYS = 8;
const SECTIONS = new Set(["positioning", "options-flow", "spx", "research"]);
const OWNED_ID = /(?:^|-)(?:vol-stress|soft-crowded)(?:-|$)/;

/** Longest first so a brand inside a longer token is removed in one pass. */
const SCRUB_PHRASES = [
  "wallstjesus",
  "wall st jesus",
  "optionshawk",
  "sentimentrader",
  "sentiment ai",
  "copy-trading",
  "copy trading",
  "tradingview",
  "stockcharts",
  "darkroom",
  "volland",
  "hawkish",
  "edgetools",
  "robinhood",
  "jesus",
  "hawk",
];

const BANK_LABELS = [
  [/goldman/, "Goldman Sachs"],
  [/j\.?\s*p\.?\s*morgan|\bjpm\b/i, "JPM"],
  [/morgan stanley/i, "MS"],
  [/bank of america|\bbofa\b|\bboa\b/i, "BoA"],
  [/\bciti(?:group|bank)?\b/i, "Citi"],
  [/\bubs\b/i, "UBS"],
  [/barclays/i, "Barclays"],
  [/\bbnp\b/i, "BNP"],
  [/nomura/i, "Nomura"],
  [/citadel/i, "Citadel"],
  [/bloomberg/i, "Bloomberg"],
  [/wall street journal|\bwsj\b/i, "WSJ"],
  [/deutsche/i, "Bank note"],
];

const HOUSE_LABELS = { jpm: "JPM", ms: "MS", gs: "GS", gsachs: "Goldman Sachs", boa: "BoA", desk: "Desk" };

const wallFmt = new Intl.DateTimeFormat("en-US", {
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
  for (const { type, value } of wallFmt.formatToParts(instant)) out[type] = Number(value);
  return out;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function shiftDay(day, delta) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/** Chicago offset at a wall-clock time, "-05:00" or "-06:00". */
function offsetForLocal(day, hour, minute, second) {
  const [y, m, d] = day.split("-").map(Number);
  let guess = Date.UTC(y, m - 1, d, hour + 6, minute, second);
  for (let i = 0; i < 3; i += 1) {
    const ct = wallClock(new Date(guess));
    const asUtc = Date.UTC(ct.year, ct.month - 1, ct.day, ct.hour, ct.minute, ct.second);
    guess += Date.UTC(y, m - 1, d, hour, minute, second) - asUtc;
  }
  const ct = wallClock(new Date(guess));
  if (ct.year !== y || ct.month !== m || ct.day !== d || ct.hour !== hour || ct.minute !== minute) return null;
  const minutes = Math.round((Date.UTC(y, m - 1, d, hour, minute, second) - guess) / 60000);
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function chicagoStamp(date = new Date()) {
  const ct = wallClock(date);
  const day = `${ct.year}-${pad(ct.month)}-${pad(ct.day)}`;
  const offset = offsetForLocal(day, ct.hour, ct.minute, ct.second) ?? "-06:00";
  return `${day}T${pad(ct.hour)}:${pad(ct.minute)}:${pad(ct.second)}${offset}`;
}

function localStamp(day, hour, minute, second = 0) {
  const offset = offsetForLocal(day, hour, minute, second);
  if (!offset) return null;
  return `${day}T${pad(hour)}:${pad(minute)}:${pad(second)}${offset}`;
}

const ISO_STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/;

export function scrubCopy(value) {
  let text = String(value ?? "");
  for (const phrase of SCRUB_PHRASES) {
    text = text.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  }
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/^[,.;:\s-]+/, "")
    .replace(/[\s-]+$/, "")
    .trim();
}

function banned(text) {
  const lower = String(text ?? "").toLowerCase();
  return SCRUB_PHRASES.find((phrase) => lower.includes(phrase)) ?? "";
}

export function publicSourceLabel(raw, { section, title } = {}) {
  const source = String(raw ?? "").trim();
  if (/^(x|twitter|tweet)$/i.test(source)) return "X";
  const head = String(title ?? "").split(/[:–—-]/)[0]?.trim() ?? "";
  const probe = head.length > 0 && head.length <= 40 ? `${source} ${head}` : source;
  for (const [re, label] of BANK_LABELS) {
    if (re.test(probe)) return label;
  }
  const canonical = SOURCE_LABELS.find((label) => label.toLowerCase() === source.toLowerCase());
  if (canonical && !banned(canonical)) return canonical;
  if (section === "research" && /\bbank\b/i.test(source)) return "Bank note";
  return "Desk";
}

function slug(value) {
  return scrubCopy(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function publicId(day, raw, title) {
  const cleaned = slug(raw || "");
  if (/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(cleaned) && cleaned.startsWith(day)) return cleaned.slice(0, 80);
  const stem = slug(raw || title) || "desk";
  const body = stem.startsWith(`${day}-`) ? stem.slice(day.length + 1) : stem;
  return `${day}-${body}`.replace(/--+/g, "-").slice(0, 80);
}

function parseStamp(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const instant = new Date(value);
    return Number.isNaN(instant.getTime()) ? null : chicagoStamp(instant);
  }
  const text = String(value).trim();
  if (ISO_STAMP.test(text)) return text;
  const ct = text.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:CT|America\/Chicago)?$/i);
  if (ct) return localStamp(ct[1], Number(ct[2]), Number(ct[3]), Number(ct[4] ?? 0));
  const dayOnly = text.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dayOnly) return localStamp(dayOnly[1], 0, 0, 0);
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return null;
  return chicagoStamp(new Date(parsed));
}

function tickerOf(raw) {
  const value = raw?.ticker ?? raw?.symbol ?? (Array.isArray(raw?.tickers) ? raw.tickers[0] : "");
  const ticker = String(value ?? "").trim().toUpperCase();
  return /^[A-Z][A-Z0-9.]{0,5}$/.test(ticker) ? ticker : "";
}

function sectionOf(raw, fallback) {
  const blob = `${raw?.section ?? ""} ${raw?.kind ?? ""} ${raw?.type ?? ""} ${(raw?.tags ?? []).join(" ")}`.toLowerCase();
  if (SECTIONS.has(String(raw?.section ?? "").trim())) return raw.section.trim();
  if (/\bresearch\b|\bnote\b|\bbank\b|\bchart\b/.test(blob)) return "research";
  if (/\bspx\b|\blevels\b/.test(blob)) return "spx";
  if (/\bposition|\bcrowded\b|\bsector\b|\bsoft vol\b/.test(blob)) return "positioning";
  if (/\bblitz\b|\brecap\b|\bflow\b|\bspotlight\b|\bfeatured\b|\bdollar\b|\bshopping\b|\bticket\b|\bwrap\b/.test(blob)) return "options-flow";
  return fallback;
}

function hrefOf(raw, section, ticker) {
  const given = String(raw?.href ?? "").trim();
  if (given && !banned(given) && !given.startsWith("/") && (section === "research" || !/^(https?:)?\/\//.test(given))) return given;
  const url = String(raw?.url ?? raw?.link ?? "").trim();
  if (section === "research" && /^https:\/\//.test(url) && !banned(url)) return url;
  const kind = `${raw?.kind ?? ""} ${raw?.type ?? ""}`.toLowerCase();
  if (section === "options-flow" && ticker && /spotlight/.test(kind)) return `options-flow/spotlights/#${ticker}`;
  if (section === "options-flow" && ticker && /featured|dollar|shopping/.test(kind)) return `options-flow/dollar/#${ticker}`;
  if (section === "options-flow") return "options-flow/";
  if (section === "positioning") return "positioning/charts/";
  if (section === "spx") return "spx-levels/";
  return "new-today/#nt-research";
}

function thumbOf(raw) {
  const thumb = String(raw?.thumb ?? raw?.image ?? raw?.chart ?? "").trim();
  if (!thumb || banned(thumb)) return {};
  if (/^https:\/\//.test(thumb)) return { thumb };
  if (/^(https?:)?\/\//.test(thumb) || thumb.startsWith("/")) return {};
  const extra = {};
  extra.thumb = thumb.replace(/^public\//, "");
  const alt = scrubCopy(raw?.thumbAlt ?? raw?.imageAlt ?? "");
  if (alt) extra.thumbAlt = alt;
  return extra;
}

function asRecord(raw, fallbackSection) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const title = scrubCopy(raw.title ?? raw.headline ?? "");
  const summary = scrubCopy(raw.summary ?? raw.text ?? raw.body ?? raw.note ?? "");
  const publishedAt = parseStamp(raw.publishedAt ?? raw.published_at ?? raw.createdAt ?? raw.created_at ?? raw.at ?? raw.time ?? raw.ts ?? raw.timestamp);
  if (!title || !summary || !publishedAt || !deskDay(publishedAt)) return null;
  if (banned(title) || banned(summary) || banned(publishedAt)) return null;
  const section = sectionOf(raw, fallbackSection);
  if (!SECTIONS.has(section)) return null;
  const sourceLabel = publicSourceLabel(raw.sourceLabel ?? raw.source ?? raw.bank ?? raw.author, { section, title: raw.title ?? raw.headline });
  if (!SOURCE_LABELS.includes(sourceLabel)) return null;
  const day = deskDay(publishedAt);
  const id = publicId(day, raw.id ?? raw.slug, title);
  if (!id || banned(id)) return null;
  const ticker = tickerOf(raw);
  const item = {
    id,
    section,
    title,
    summary,
    href: hrefOf(raw, section, ticker),
    publishedAt,
    sourceLabel,
    ...thumbOf(raw),
  };
  if (banned(JSON.stringify(item))) return null;
  return item;
}

export function itemFromFlowPost(raw) {
  return asRecord(raw, "options-flow");
}

export function itemsFromChartState(markdown, fallbackSection = "research") {
  const text = String(markdown ?? "");
  const found = [];
  const front = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (front) {
    const fields = {};
    for (const line of front[1].split("\n")) {
      const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (match) fields[match[1]] = match[2].trim();
    }
    const summary = fields.summary || front[2].trim().split("\n").find((line) => line.trim()) || "";
    const row = asRecord({ ...fields, summary, section: fields.section || fallbackSection }, fallbackSection);
    if (row) found.push(row);
  }
  for (const block of text.matchAll(/```json\s*([\s\S]*?)```/gi)) found.push(...recordsFromJson(block[1], fallbackSection));
  for (const block of text.matchAll(/<!--\s*new-today\s*([\s\S]*?)-->/gi)) found.push(...recordsFromJson(block[1], fallbackSection));
  const sections = text.split(/\n(?=##\s)/);
  for (const section of sections) {
    const title = section.match(/^title:\s*(.+)$/im)?.[1];
    const summary = section.match(/^summary:\s*(.+)$/im)?.[1];
    const publishedAt = section.match(/^(?:publishedAt|at|time):\s*(.+)$/im)?.[1];
    if (!title || !summary || !publishedAt) continue;
    const source = section.match(/^(?:source|sourceLabel|bank):\s*(.+)$/im)?.[1];
    const image = section.match(/^(?:image|thumb|chart):\s*(.+)$/im)?.[1];
    const id = section.match(/^id:\s*(.+)$/im)?.[1];
    const row = asRecord({ id, title, summary, publishedAt, source, thumb: image, section: fallbackSection }, fallbackSection);
    if (row) found.push(row);
  }
  return dedupe(found);
}

function recordsFromJson(text, fallbackSection) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const list = Array.isArray(data) ? data : data?.posts ?? data?.items ?? [data];
  return list.map((row) => asRecord({ ...row, section: row?.section ?? fallbackSection }, fallbackSection)).filter(Boolean);
}

function shortDay(iso) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [, m, d] = iso.split("-").map(Number);
  return `${months[m - 1]} ${d}`;
}

export function itemFromSoftCrowded(index, weekDoc) {
  const week = index?.latest;
  const row = (index?.weeks ?? []).find((entry) => entry.week === week) ?? null;
  if (!row || !weekDoc || weekDoc.week !== week) return null;
  const publishedAt = parseStamp(weekDoc.asOf);
  if (!publishedAt) return null;
  const headline = scrubCopy(String(row.headline ?? weekDoc.read?.headline ?? "").replace(/\.$/, ""));
  const title = headline || `${row.isoWeek ?? week} Soft ↔ Crowded`;
  const carry = row.carryForward || weekDoc.carryForward?.from;
  const summary = carry
    ? `${row.isoWeek ?? "This"} pack is filed. Sector columns carry forward from the ${shortDay(carry)} Desk freeze.`
    : `${row.isoWeek ?? "This"} Soft ↔ Crowded pack is on the desk.`;
  const sourceLabel = carry ? "Desk" : HOUSE_LABELS[String(weekDoc.house ?? "").toLowerCase()] ?? "Desk";
  const item = asRecord(
    {
      id: `${week}-soft-crowded`,
      section: "positioning",
      title,
      summary,
      href: "positioning/ideas/",
      publishedAt,
      sourceLabel,
    },
    "positioning",
  );
  if (item) item.owned = true;
  return item;
}

function volMove(spxPct) {
  if (typeof spxPct !== "number" || !Number.isFinite(spxPct)) return "";
  const mag = String(Math.round(Math.abs(spxPct) * 100) / 100);
  if (spxPct < 0) return ` S&P 500 down ${mag}% at that print.`;
  if (spxPct > 0) return ` S&P 500 up ${mag}% at that print.`;
  return " S&P 500 flat at that print.";
}

export function itemFromVolStress(latest) {
  if (!latest || typeof latest.gauge !== "number" || !latest.asOf) return null;
  const publishedAt = parseStamp(latest.asOf);
  if (!publishedAt) return null;
  const time = publishedAt.slice(11, 16);
  const band = latest.gauge >= 2 ? " At or above 2 is the desk possible-bottom band." : "";
  const kind = latest.closed ? "Session close." : "Intraday gauge, not a session close.";
  const hhmm = time.replace(":", "");
  const item = asRecord(
    {
      id: `${deskDay(publishedAt)}-vol-stress-${hhmm}`,
      section: "positioning",
      title: `Vol Stress prints ${latest.gauge}`,
      summary: `Vol Stress printed ${latest.gauge} at ${time} CT.${volMove(latest.spxPct)} ${kind}${band}`,
      href: "vol/#spot-vol-beta",
      publishedAt,
      sourceLabel: "Desk",
    },
    "positioning",
  );
  if (item) item.owned = true;
  return item;
}

export function itemsFromVolCloses(series, anchorDay) {
  if (!series || !Array.isArray(series.points) || !anchorDay) return [];
  const start = shiftDay(anchorDay, -(KEEP_DAYS - 1));
  return series.points
    .filter((point) => point?.origin === "close-routine" && point.date >= start && point.recordedAt)
    .map((point) => {
      const item = asRecord(
        {
          id: `${point.date}-vol-stress-close`,
          section: "positioning",
          title: `Vol Stress close ${point.svb}`,
          summary: `Vol Stress closed at ${point.svb}${typeof point.spx === "number" ? ` with the S&P 500 at ${point.spx}` : ""}. Session close.`,
          href: "vol/#spot-vol-beta",
          publishedAt: point.recordedAt,
          sourceLabel: "Desk",
        },
        "positioning",
      );
      if (item) item.owned = true;
      return item;
    })
    .filter(Boolean);
}

function dedupe(items) {
  const byId = new Map();
  for (const item of items) if (item?.id && !byId.has(item.id)) byId.set(item.id, item);
  return [...byId.values()];
}

function publicView(item) {
  const view = {
    id: item.id,
    section: item.section,
    title: item.title,
    summary: item.summary,
    href: item.href,
    publishedAt: item.publishedAt,
    sourceLabel: item.sourceLabel,
  };
  if (item.thumb) view.thumb = item.thumb;
  if (item.thumbAlt) view.thumbAlt = item.thumbAlt;
  return view;
}

function readJson(path) {
  if (!path || !existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function walkFiles(dir, out, depth) {
  if (!dir || !existsSync(dir) || depth > 4) return;
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    let stat;
    try {
      stat = statSync(path);
    } catch {
      continue;
    }
    if (stat.isDirectory()) walkFiles(path, out, depth + 1);
    else out.push(path);
  }
}

function postsIn(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter((row) => row && typeof row === "object");
  if (Array.isArray(data.posts)) return data.posts;
  if (Array.isArray(data.items)) return data.items;
  if (data.title || data.headline) return [data];
  return Object.values(data).filter((row) => row && typeof row === "object" && (row.title || row.headline || row.summary));
}

function loadFlow(dir, seenPath) {
  const gaps = [];
  const posts = [];
  if (!dir || !existsSync(dir)) gaps.push("flow-post watcher is not mounted; no session rows were added from it");
  else {
    const files = [];
    walkFiles(dir, files, 0);
    for (const file of files) {
      if (file.endsWith(".json")) posts.push(...postsIn(readJson(file)).map((row) => itemFromFlowPost(row)));
      else if (file.endsWith(".jsonl")) {
        for (const line of readFileSync(file, "utf8").split("\n")) {
          if (!line.trim()) continue;
          try {
            posts.push(itemFromFlowPost(JSON.parse(line)));
          } catch {
            posts.push(null);
          }
        }
      } else if (file.endsWith(".md")) posts.push(...itemsFromChartState(readFileSync(file, "utf8"), "options-flow"));
    }
  }
  let seen = 0;
  const seenDoc = readJson(seenPath);
  if (!seenPath || !existsSync(seenPath)) gaps.push("flow-post seen-id file is not mounted");
  else if (Array.isArray(seenDoc)) seen = seenDoc.length;
  else if (seenDoc && typeof seenDoc === "object") {
    const embedded = postsIn(seenDoc).map((row) => itemFromFlowPost(row)).filter(Boolean);
    posts.push(...embedded);
    seen = Array.isArray(seenDoc.ids) ? seenDoc.ids.length : Object.keys(seenDoc).length;
  }
  const items = posts.filter(Boolean);
  if (seen && !items.length) gaps.push(`flow-post watcher has ${seen} seen ids and no post body; nothing was invented from the ids`);
  return { items, gaps };
}

function chartDirsFrom(configured) {
  const dirs = [];
  const stems = String(configured ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const stem of stems) {
    const parent = dirname(stem);
    const base = stem.split("/").filter(Boolean).at(-1) ?? "";
    if (parent && base && existsSync(parent)) {
      for (const name of readdirSync(parent)) {
        if (!name.startsWith(base)) continue;
        const full = join(parent, name);
        if (statSync(full).isDirectory()) dirs.push(full);
      }
    }
    if (existsSync(stem) && statSync(stem).isDirectory() && !dirs.includes(stem)) dirs.push(stem);
  }
  return dirs;
}

function loadCharts(statePath, configuredDirs) {
  const gaps = [];
  const items = [];
  if (!statePath || !existsSync(statePath)) gaps.push("chart-note watcher is not mounted; no session rows were added from it");
  else {
    const text = readFileSync(statePath, "utf8");
    items.push(...itemsFromChartState(text));
    if (!items.length && text.trim()) gaps.push("chart-note state has no titled, stamped note; nothing was invented from it");
  }
  const dirs = chartDirsFrom(configuredDirs);
  if (!dirs.length) gaps.push("chart-note asset directory is not mounted");
  for (const dir of dirs) {
    const files = [];
    walkFiles(dir, files, 0);
    for (const file of files) {
      if (file.endsWith("STATE.md")) continue;
      if (file.endsWith(".json") || file.endsWith(".md")) {
        const parsed = file.endsWith(".json") ? postsIn(readJson(file)).map((row) => asRecord(row, "research")) : itemsFromChartState(readFileSync(file, "utf8"));
        for (const item of parsed) if (item) items.push(item);
      }
    }
  }
  return { items, gaps };
}

function loadLastShip(path) {
  const doc = readJson(path);
  if (!doc) return { at: null, missing: true };
  const at = parseStamp(doc.shippedAt ?? doc.updatedAt ?? doc.at ?? doc.timestamp ?? doc.time);
  return { at, missing: false };
}

function emptyFeed() {
  return {
    timeZone: DESK_TZ,
    dayStartsAt: "00:00",
    dayStart: deskDayStart(deskDay(new Date())),
    updatedAt: chicagoStamp(new Date()),
    items: [],
  };
}

export function mergeFeed(feed, candidates, now = new Date()) {
  const prior = feed && Array.isArray(feed.items) ? feed : emptyFeed();
  const incoming = dedupe(candidates.filter(Boolean));
  const byId = new Map(prior.items.map((item) => [item.id, item]));
  const added = [];
  const updated = [];
  for (const candidate of incoming) {
    const next = publicView(candidate);
    const current = byId.get(candidate.id);
    if (!current) {
      byId.set(candidate.id, next);
      added.push(next);
      continue;
    }
    if (candidate.owned || OWNED_ID.test(candidate.id)) {
      if (JSON.stringify(publicView(current)) !== JSON.stringify(next)) {
        byId.set(candidate.id, next);
        updated.push(next);
      }
    }
  }
  let items = [...byId.values()].filter((item) => deskDay(item.publishedAt));
  const anchor = items.map((item) => deskDay(item.publishedAt)).sort().at(-1) ?? deskDay(now);
  const start = shiftDay(anchor, -(KEEP_DAYS - 1));
  const kept = [];
  const pruned = [];
  for (const item of items) {
    if (deskDay(item.publishedAt) < start) pruned.push(item);
    else kept.push(item);
  }
  kept.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.id.localeCompare(b.id));
  const dayStart = kept[0] ? deskDayStart(deskDay(kept[0].publishedAt)) : prior.dayStart;
  const changed = JSON.stringify(prior.items) !== JSON.stringify(kept) || prior.dayStart !== dayStart;
  const next = {
    timeZone: DESK_TZ,
    dayStartsAt: "00:00",
    dayStart,
    updatedAt: changed ? chicagoStamp(now) : prior.updatedAt,
    items: kept,
  };
  return { feed: next, added, updated, pruned, changed };
}

export function resolvePackPaths(options = {}) {
  const base = options.root ?? root;
  return {
    feed: options.feedPath ?? join(base, "public/data/new-today.json"),
    lastShip: options.lastShip ?? process.env.NEW_TODAY_LAST_SHIP ?? "/home/box/agent-data/trading-desk/watchers/auto-ship/LAST_SHIP.json",
    flowPosts: options.flowPosts ?? process.env.NEW_TODAY_FLOW_POSTS ?? "/home/box/agent-data/trading-desk/watchers/hawk-master/posts",
    flowSeen: options.flowSeen ?? process.env.NEW_TODAY_FLOW_SEEN ?? "/home/box/agent-data/trading-desk/watchers/hawk-master/seen_ids.json",
    chartState: options.chartState ?? process.env.NEW_TODAY_CHART_STATE ?? "/home/box/agent-data/trading-desk/watchers/darkroom/STATE.md",
    chartDirs: options.chartDirs ?? process.env.NEW_TODAY_CHART_DIRS ?? "/workspace/darkroom",
    packIndex: options.packIndex ?? join(base, "public/data/vault/soft-crowded/index.json"),
    volLatest: options.volLatest ?? join(base, "public/data/vault/spot-vol-beta/latest.json"),
  };
}

function within(item, start, now) {
  const day = deskDay(item?.publishedAt);
  if (!day || day < start) return false;
  const instant = Date.parse(item.publishedAt);
  return !Number.isNaN(instant) && instant <= now.getTime() + 36 * 60 * 60 * 1000;
}

export function planNewToday(options = {}) {
  const paths = resolvePackPaths(options);
  const now = options.now instanceof Date ? options.now : new Date();
  const feed = options.feed ?? readJson(paths.feed) ?? emptyFeed();
  const gaps = [];
  const lastShip = options.lastShipDoc ?? loadLastShip(paths.lastShip);
  if (lastShip.missing) gaps.push("last-ship stamp is not mounted; the diff is against the feed file");
  const flow = options.flow ?? loadFlow(paths.flowPosts, paths.flowSeen);
  const charts = options.charts ?? loadCharts(paths.chartState, paths.chartDirs);
  gaps.push(...flow.gaps, ...charts.gaps);

  const index = options.pack ?? readJson(paths.packIndex);
  const weekFile = index?.latest ? join(dirname(paths.packIndex), `${index.latest}.json`) : "";
  const weekDoc = options.weekDoc ?? (options.pack ? options.weekDoc ?? null : readJson(weekFile));
  const soft = itemFromSoftCrowded(index, weekDoc);
  if (!soft) gaps.push("Soft ↔ Crowded index has no stamped latest week");

  const latest = options.volLatestDoc ?? readJson(paths.volLatest);
  const vol = itemFromVolStress(latest);
  if (!vol) gaps.push("Vol Stress latest stamp is missing");
  const series = options.volSeries ?? readJson(join(dirname(paths.volLatest), "series.json"));
  const anchor = deskDay(latest?.asOf) ?? deskDay(now);
  const closes = itemsFromVolCloses(series, anchor);

  const freshDays = [deskDay(now), ...(feed.items ?? []).map((item) => deskDay(item.publishedAt)).filter(Boolean)];
  const start = shiftDay(freshDays.sort().at(-1), -(KEEP_DAYS - 1));
  let candidates = dedupe([...flow.items, ...charts.items, soft, vol, ...closes].filter((item) => within(item, start, now)));
  if (latest?.closed && candidates.some((item) => item.id === `${latest.session}-vol-stress-close`)) {
    candidates = candidates.filter((item) => item.id !== vol?.id);
  }
  const merged = mergeFeed(feed, candidates, now);
  return { ...merged, gaps, lastShip: lastShip.at, paths };
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--dry-run" || key === "--json" || key === "--self-test" || key === "--help") {
      args[key.slice(2)] = true;
      continue;
    }
    if (!key.startsWith("--")) {
      args._.push(key);
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${key} needs a value`);
    args[key.slice(2)] = value;
    i += 1;
  }
  return args;
}

function printHelp() {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?/, "").replace(/\n \*/g, "\n"));
}

export function runSelfTest() {
  const scrubbed = scrubCopy("OptionsHawk Darkroom Volland note stays hawkish");
  if (banned(scrubbed)) throw new Error(`scrub left a banned phrase in "${scrubbed}"`);
  const flow = itemFromFlowPost({
    id: "optionshawk-qqq",
    title: "OptionsHawk: QQQ size puts",
    summary: "Buyer of puts. Not a Darkroom note.",
    publishedAt: "2026-10-30T15:04:00-05:00",
    ticker: "QQQ",
    kind: "flow",
  });
  if (!flow || banned(JSON.stringify(flow)) || flow.sourceLabel !== "Desk" || flow.section !== "options-flow") throw new Error("flow post was not made public");
  if (flow.title.toLowerCase().includes("hawk")) throw new Error("flow title kept a banned name");
  const empty = itemsFromChartState("# STATE\n\nWatcher healthy at 2026-10-30T10:45:00-05:00. No new charts.\n");
  if (empty.length) throw new Error("a chart state without a note invented a row");
  const notes = itemsFromChartState("## Note\n\ntitle: Deutsche Bank: silicon dividend\nsummary: Bank note logged mid-morning.\npublishedAt: 2026-10-30T10:45:00-05:00\nsource: Deutsche Bank\n");
  if (notes.length !== 1 || notes[0].sourceLabel !== "Bank note" || notes[0].section !== "research") throw new Error("chart note did not keep the bank label");
  const seenOnly = loadFlow("/no/such/flow-posts", "/no/such/seen.json");
  if (seenOnly.items.length) throw new Error("a missing flow watcher invented rows");
  const scratch = mkdtempSync(join(tmpdir(), "nt-pack-"));
  try {
    writeFileSync(join(scratch, "seen.json"), JSON.stringify({ ids: ["ticket-1", "ticket-2"] }));
    const seenIds = loadFlow(join(scratch, "posts"), join(scratch, "seen.json"));
    if (seenIds.items.length) throw new Error("seen ids without a post body invented rows");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  const feed = { timeZone: DESK_TZ, dayStartsAt: "00:00", dayStart: "2026-10-30T00:00:00-05:00", updatedAt: "2026-10-30T06:30:00-05:00", items: [] };
  const once = mergeFeed(feed, [flow, flow], new Date("2026-11-01T18:00:00Z"));
  const twice = mergeFeed(once.feed, [flow], new Date("2026-11-01T19:00:00Z"));
  if (once.added.length !== 1 || twice.added.length || twice.changed) throw new Error("pack merge is not idempotent");
  if (once.feed.items[0].id !== twice.feed.items[0].id) throw new Error("dedupe dropped the row");
  return "new-today pack self-test ok";
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args["self-test"]) {
    console.log(runSelfTest());
    return;
  }
  const plan = planNewToday({
    root,
    now: args["updated-at"] ? new Date(args["updated-at"]) : new Date(),
    feedPath: args.feed,
    lastShip: args["last-ship"],
    flowPosts: args["flow-posts"],
    flowSeen: args["flow-seen"],
    chartState: args["chart-state"],
    chartDirs: args["chart-dirs"],
  });
  const report = {
    changed: plan.changed,
    added: plan.added.map((item) => item.id),
    updated: plan.updated.map((item) => item.id),
    pruned: plan.pruned.map((item) => item.id),
    updatedAt: plan.feed.updatedAt,
    lastShip: plan.lastShip,
    gaps: plan.gaps,
  };
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else if (!plan.changed) console.log("new-today: unchanged");
  else console.log(`new-today: added ${report.added.length}${report.added.length ? ` (${report.added.join(", ")})` : ""}`);
  if (!args.json) for (const gap of plan.gaps) console.log(`new-today gap: ${gap}`);
  if (args["dry-run"]) return;
  if (!plan.changed) return;
  writeFileSync(plan.paths.feed, `${JSON.stringify(plan.feed, null, 2)}\n`);
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}
