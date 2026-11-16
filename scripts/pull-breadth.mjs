/**
 * Refreshes the Vault breadth series in public/data/vault/breadth/ from the
 * desk's end-of-day text feed. The feed address lives in BREADTH_FEED (env),
 * never in a committed file. Usage:
 *
 *   BREADTH_FEED="https://…" npm run pull:breadth
 *
 * The feed answers `?s=<symbol>&p=D&yr=<years>&…&img=text&inspector=yes` with a
 * <pricedata> block of "|"-separated bars: `n start end close vol` for the
 * breadth indexes and `n start end open high low close vol` for OHLC series.
 * Only completed sessions (stamped to 16:00) are kept.
 *
 * Core series are append-only: committed history is kept, new dates after the
 * last bar are added, and overlapping dates must match (within rounding) or
 * the write aborts. NYHL / NYAD daily values append onto the cumulative line
 * (and its embedded SPX context). Participation symbols are best-effort.
 *
 * All series are merged and validated in memory first; files are written only
 * when every validation passes (temp files, then rename). A failed pull leaves
 * the tree unchanged.
 */
import { randomBytes } from "node:crypto";
import { readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public/data/vault/breadth");
const feed = process.env.BREADTH_FEED;
const YEARS = 11;
const OVERLAP_EPS = 0.005;

/**
 * US cash-equity full-session closures the desk treats as non-sessions.
 * 2025–2028 follow published NYSE Group holiday calendars; 2029–2030 follow
 * the same observed-holiday rules (NYSE has not yet posted those years).
 * Includes 2025-01-09 (national day of mourning / Jimmy Carter).
 */
export const US_MARKET_HOLIDAYS = new Set([
  "2025-01-01", "2025-01-09", "2025-01-20", "2025-02-17", "2025-04-18", "2025-05-26", "2025-06-19", "2025-07-04", "2025-09-01", "2025-11-27", "2025-12-25",
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
  "2028-01-17", "2028-02-21", "2028-04-14", "2028-05-29", "2028-06-19", "2028-07-04", "2028-09-04", "2028-11-23", "2028-12-25",
  "2029-01-01", "2029-01-15", "2029-02-19", "2029-03-30", "2029-05-28", "2029-06-19", "2029-07-04", "2029-09-03", "2029-11-22", "2029-12-25",
  "2030-01-01", "2030-01-21", "2030-02-18", "2030-04-19", "2030-05-27", "2030-06-19", "2030-07-04", "2030-09-02", "2030-11-28", "2030-12-25",
]);

const CORE = [
  ["nysi", "$NYSI"],
  ["nasi", "$NASI"],
  ["spx", "$SPX"],
  ["nyhl", "$NYHL"],
  ["nyad", "$NYAD"],
];
const PCT_IDS = ["ncfd", "ndtw", "ncfi", "ncth"];
const PCT = PCT_IDS.map((id) => [id, `$${id.toUpperCase()}`]);
const CUMULATIVE = new Set(["nyhl", "nyad"]);
const SPACED = new Set(["nyhl", "nyad"]);

export function chicagoNowParts(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: parts.weekday,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function shiftIso(iso, days) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isWeekdayIso(iso) {
  const day = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6;
}

/** Most recent completed US cash session date in America/Chicago (weekdays only). */
export function lastCompletedWeekday(now = new Date()) {
  const parts = chicagoNowParts(now);
  let cursor = parts.date;
  // Regular session closes 15:00 CT (16:00 ET). Before that, today is not complete.
  const closedToday = parts.hour > 15 || (parts.hour === 15 && parts.minute >= 0);
  if (!closedToday || !isWeekdayIso(cursor) || US_MARKET_HOLIDAYS.has(cursor)) {
    cursor = shiftIso(cursor, -1);
  }
  while (!isWeekdayIso(cursor) || US_MARKET_HOLIDAYS.has(cursor)) {
    cursor = shiftIso(cursor, -1);
  }
  return cursor;
}

/**
 * Feed is stale when its asOf is older than the last completed weekday by more
 * than one session (1-session tolerance), ignoring known holidays.
 */
export function assertFeedFresh(asOf, now = new Date()) {
  const expected = lastCompletedWeekday(now);
  if (asOf >= expected) return { ok: true, expected, asOf };
  const prior = (() => {
    let cursor = shiftIso(expected, -1);
    while (!isWeekdayIso(cursor) || US_MARKET_HOLIDAYS.has(cursor)) cursor = shiftIso(cursor, -1);
    return cursor;
  })();
  if (asOf >= prior) return { ok: true, expected, asOf, tolerance: prior };
  const error = new Error(
    `breadth feed asOf ${asOf} is stale vs last completed Chicago session ${expected} (1-session tolerance to ${prior})`,
  );
  error.code = "BREADTH_FEED_STALE";
  throw error;
}

function closeEnough(a, b, eps = OVERLAP_EPS) {
  return Math.abs(Number(a) - Number(b)) <= eps;
}

export async function pull(symbol, feedBase = feed) {
  const url = `${feedBase}?s=${encodeURIComponent(symbol)}&p=D&yr=${YEARS}&mn=0&dy=0&i=t3757734781c&img=text&inspector=yes`;
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)" } });
  if (!res.ok) throw new Error(`${symbol} ${res.status}`);
  const text = await res.text();
  const block = text.split("<pricedata>")[1]?.split("</pricedata>")[0];
  if (!block) throw new Error(`${symbol} returned no price block`);
  const bars = [];
  for (const row of block.split("|")) {
    const cols = row.trim().split(/\s+/);
    if (cols.length < 5 || !cols[2].endsWith("1600")) continue;
    const close = Number(cols.length >= 8 ? cols[6] : cols[3]);
    if (!Number.isFinite(close)) continue;
    const day = cols[1];
    bars.push({ t: `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`, c: close });
  }
  if (bars.length < 200) throw new Error(`${symbol} returned only ${bars.length} sessions`);
  return bars;
}

function requireHistory(id, bars, min = 2500) {
  if (bars.length < min) throw new Error(`${id} returned only ${bars.length} sessions`);
  return bars;
}

function formatBar(bar, spaced) {
  if (!spaced) return `    ${JSON.stringify({ t: bar.t, c: bar.c })}`;
  const c = Number(bar.c);
  const cText = Number.isInteger(c) || Math.abs(c - Math.round(c)) < 1e-9 ? `${Math.round(c)}.0` : String(c);
  return `    {"t": "${bar.t}", "c": ${cText}}`;
}

export function formatBreadthBody(doc, { spaced = SPACED.has(doc.id) } = {}) {
  const { bars, spx, ...head } = doc;
  const top = JSON.stringify(head, null, 2).slice(0, -2);
  let body = `${top},\n  "bars": [\n${bars.map((bar) => formatBar(bar, spaced)).join(",\n")}\n  ]`;
  if (spx) body += `,\n  "spx": [\n${spx.map((bar) => formatBar(bar, spaced)).join(",\n")}\n  ]`;
  body += `\n}\n`;
  return body;
}

function tmpPath(dir, file) {
  return join(dir, `.${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`);
}

/** Write every body to a sibling temp file, then rename into place. Cleans temps on failure. */
export function commitBreadthWrites(dir, writes) {
  const temps = [];
  try {
    for (const { file, body } of writes) {
      const tmp = tmpPath(dir, file);
      writeFileSync(tmp, body);
      temps.push({ tmp, file });
    }
    for (const { tmp, file } of temps) {
      renameSync(tmp, join(dir, file));
    }
  } catch (error) {
    for (const { tmp } of temps) {
      try {
        unlinkSync(tmp);
      } catch {
        /* best-effort cleanup */
      }
    }
    throw error;
  }
}

export function writeBreadth(file, doc, { spaced = SPACED.has(doc.id) || SPACED.has(file.replace(/\.json$/, "")), dir = out } = {}) {
  commitBreadthWrites(dir, [{ file, body: formatBreadthBody(doc, { spaced }) }]);
}

/** Keep committed history; append only dates after the last bar; abort on overlap drift. */
export function appendLevel(doc, feedBars, asOf) {
  const kept = doc.bars.slice();
  const byT = new Map(kept.map((bar) => [bar.t, bar.c]));
  for (const bar of feedBars) {
    if (bar.t > asOf) continue;
    if (!byT.has(bar.t)) continue;
    if (!closeEnough(byT.get(bar.t), bar.c)) {
      throw new Error(`${doc.id} overlap ${bar.t}: committed ${byT.get(bar.t)} != feed ${bar.c}`);
    }
  }
  let last = kept.at(-1)?.t;
  for (const bar of feedBars) {
    if (bar.t <= last || bar.t > asOf) continue;
    kept.push({ t: bar.t, c: bar.c });
    last = bar.t;
  }
  if (kept.at(-1)?.t !== asOf) {
    throw new Error(`${doc.id} ends ${kept.at(-1)?.t}, expected ${asOf}`);
  }
  return { ...doc, asOf, bars: kept };
}

export function appendCumulative(doc, daily, spxBySession, sessions, asOf) {
  const bars = doc.bars.slice();
  const spx = (doc.spx ?? []).slice();
  const have = new Set(bars.map((bar) => bar.t));
  const byT = new Map(bars.map((bar) => [bar.t, bar.c]));
  for (let i = 1; i < bars.length; i += 1) {
    const day = bars[i].t;
    const feedBar = daily.find((bar) => bar.t === day);
    if (!feedBar) continue;
    const delta = bars[i].c - bars[i - 1].c;
    if (!closeEnough(delta, feedBar.c)) {
      throw new Error(`${doc.id} overlap Δ ${day}: committed ${delta} != feed ${feedBar.c}`);
    }
  }
  let cum = bars.at(-1).c;
  for (const bar of daily) {
    if (bar.t <= bars.at(-1)?.t) continue;
    if (bar.t > asOf || !sessions.has(bar.t)) continue;
    if (have.has(bar.t)) continue;
    const spxClose = spxBySession.get(bar.t);
    if (spxClose == null) throw new Error(`${doc.id} missing SPX on ${bar.t}`);
    cum += bar.c;
    bars.push({ t: bar.t, c: cum });
    spx.push({ t: bar.t, c: spxClose });
    have.add(bar.t);
    byT.set(bar.t, cum);
  }
  if (bars.at(-1).t !== asOf) {
    throw new Error(`${doc.id} cumulative ends ${bars.at(-1).t}, expected ${asOf}`);
  }
  if (spx.at(-1)?.t !== asOf) {
    throw new Error(`${doc.id} SPX context ends ${spx.at(-1)?.t}, expected ${asOf}`);
  }
  return { ...doc, asOf, bars, spx };
}

/**
 * Merge feed bars into committed docs in memory. Returns the file bodies to
 * write (including index.json). Throws before any filesystem mutation when a
 * series fails validation.
 */
export function prepareBreadthWrites(dir, core, pct = {}, { now = new Date() } = {}) {
  const index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
  const chartById = Object.fromEntries(index.charts.map((chart) => [chart.id, chart]));

  const asOf = core.nysi.at(-1).t;
  assertFeedFresh(asOf, now);
  for (const id of ["nasi", "spx", "nyhl", "nyad"]) {
    const end = core[id].at(-1).t;
    if (end < asOf) throw new Error(`NYSI ends ${asOf}, ${id} only reaches ${end}`);
  }

  const nysiDoc = JSON.parse(readFileSync(join(dir, chartById.nysi.file), "utf8"));
  const nasiDoc = JSON.parse(readFileSync(join(dir, chartById.nasi.file), "utf8"));
  const spxDoc = JSON.parse(readFileSync(join(dir, index.overlay.file), "utf8"));

  const nysiNext = appendLevel(nysiDoc, core.nysi, asOf);
  const nasiNext = appendLevel(nasiDoc, core.nasi, asOf);
  const sessions = new Set(nysiNext.bars.map((bar) => bar.t));
  const spxNext = appendLevel(
    spxDoc,
    core.spx.filter((bar) => bar.t <= asOf && (sessions.has(bar.t) || bar.t <= (spxDoc.bars.at(-1)?.t ?? ""))),
    asOf,
  );
  if (JSON.stringify(nysiNext.bars.map((bar) => bar.t)) !== JSON.stringify(nasiNext.bars.map((bar) => bar.t))) {
    throw new Error("NYSI and NASI sessions diverged after append");
  }
  if (JSON.stringify(nysiNext.bars.map((bar) => bar.t)) !== JSON.stringify(spxNext.bars.map((bar) => bar.t))) {
    throw new Error("NYSI and SPX sessions diverged after append");
  }
  const spxBySession = new Map(spxNext.bars.map((bar) => [bar.t, bar.c]));

  const writes = [
    { file: chartById.nysi.file, body: formatBreadthBody(nysiNext, { spaced: false }) },
    { file: chartById.nasi.file, body: formatBreadthBody(nasiNext, { spaced: false }) },
    { file: index.overlay.file, body: formatBreadthBody(spxNext, { spaced: false }) },
  ];

  for (const id of CUMULATIVE) {
    const chart = chartById[id];
    const doc = JSON.parse(readFileSync(join(dir, chart.file), "utf8"));
    const next = appendCumulative(doc, core[id], spxBySession, sessions, asOf);
    writes.push({ file: chart.file, body: formatBreadthBody(next, { spaced: true }) });
    if (chart.asOf) chart.asOf = asOf;
  }

  for (const id of PCT_IDS) {
    const bars = pct[id];
    if (!bars) continue;
    const chart = chartById[id];
    const doc = JSON.parse(readFileSync(join(dir, chart.file), "utf8"));
    const next = {
      ...doc,
      asOf,
      bars,
      provenance: {
        ...(doc.provenance ?? {}),
        kind: "feed",
        note: `End-of-day ${doc.provenance?.feedSymbol ?? chart.id} from the desk feed through ${asOf}.`,
      },
    };
    writes.push({ file: chart.file, body: formatBreadthBody(next, { spaced: false }) });
    if (chart.asOf) chart.asOf = asOf;
  }

  index.asOf = asOf;
  writes.push({ file: "index.json", body: `${JSON.stringify(index, null, 2)}\n` });

  return {
    asOf,
    writes,
    summary: {
      nysi: nysiNext.bars.at(-1).c,
      nasi: nasiNext.bars.at(-1).c,
      spx: spxNext.bars.at(-1).c,
      nyhl: core.nyhl.at(-1).c,
      nyad: core.nyad.at(-1).c,
    },
  };
}

async function main() {
  if (!feed) {
    console.error("Set BREADTH_FEED to the desk's end-of-day text feed (see README, Vault breadth wall).");
    process.exit(1);
  }

  const core = {};
  for (const [id, symbol] of CORE) {
    const bars = await pull(symbol);
    core[id] = id === "nyhl" || id === "nyad" ? bars : requireHistory(id, bars);
  }

  const asOf = core.nysi.at(-1).t;
  assertFeedFresh(asOf);
  for (const id of ["nasi", "spx", "nyhl", "nyad"]) {
    const end = core[id].at(-1).t;
    if (end < asOf) throw new Error(`NYSI ends ${asOf}, ${id} only reaches ${end}`);
  }

  const pct = {};
  const pctErrors = [];
  for (const [id, symbol] of PCT) {
    try {
      const bars = await pull(symbol);
      const end = bars.at(-1).t;
      if (end !== asOf) throw new Error(`NYSI ends ${asOf}, ${id} ends ${end}`);
      if (bars.length < 1500) throw new Error(`${symbol} returned only ${bars.length} sessions`);
      pct[id] = bars;
    } catch (error) {
      pctErrors.push(`${id}: ${error.message ?? error}`);
    }
  }

  const prepared = prepareBreadthWrites(out, core, pct);
  commitBreadthWrites(out, prepared.writes);

  const coreLine = `NYSI ${prepared.summary.nysi} · NASI ${prepared.summary.nasi} · NYHL Δ ${prepared.summary.nyhl} · NYAD Δ ${prepared.summary.nyad} · SPX ${prepared.summary.spx}`;
  if (pctErrors.length) {
    console.warn(`breadth core through ${prepared.asOf}: ${coreLine}`);
    console.warn(`participation skipped (${pctErrors.length}): ${pctErrors.join(" · ")}`);
  } else {
    const pctLine = PCT_IDS.map((id) => `${id.toUpperCase()} ${pct[id].at(-1).c}`).join(" · ");
    console.log(`breadth through ${prepared.asOf}: ${coreLine} · ${pctLine}`);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((error) => {
    console.error(error.message ?? error);
    process.exit(1);
  });
}
