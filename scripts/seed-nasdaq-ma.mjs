/**
 * Builds the Nasdaq % stocks-above-MA series from Yahoo daily closes of
 * Nasdaq-listed common stocks (Composite) and the Nasdaq-100 list (NDTW).
 *
 * This is a desk-computed participation series, not a vendor INDEX live feed.
 * `scripts/pull-breadth.mjs` replaces these files with $NCFD / $NDTW / $NCFI /
 * $NCTH when BREADTH_FEED is set.
 *
 *   node scripts/seed-nasdaq-ma.mjs
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public/data/vault/breadth");
const cacheDir = join("/tmp", "nasdaq-ma-cache");
mkdirSync(cacheDir, { recursive: true });

const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" };
const AS_OF_CAP = "2026-11-02";
const CONCURRENCY = 10;
const SERIES = [
  { id: "ncfd", symbol: "NCFD", window: 5, universe: "nasdaq-comp", defaultRangeMonths: 24, feed: "$NCFD", label: "Nasdaq 5-day", title: "Nasdaq Comp Stocks Above 5-Day Average" },
  { id: "ndtw", symbol: "NDTW", window: 20, universe: "nasdaq-100", defaultRangeMonths: 60, feed: "$NDTW", label: "Nasdaq-100 20-day", title: "Nasdaq 100 Stocks Above 20-Day Average" },
  { id: "ncfi", symbol: "NCFI", window: 50, universe: "nasdaq-comp", defaultRangeMonths: 24, feed: "$NCFI", label: "Nasdaq 50-day", title: "Nasdaq Comp Stocks Above 50-Day Average" },
  { id: "ncth", symbol: "NCTH", window: 200, universe: "nasdaq-comp", defaultRangeMonths: 60, feed: "$NCTH", label: "Nasdaq 200-day", title: "Nasdaq Comp Stocks Above 200-Day Average" },
];

function yahooSymbol(sym) {
  return encodeURIComponent(sym.replace(/\//g, "-"));
}

function cachePath(sym) {
  return join(cacheDir, `${sym.replace(/\//g, "-")}.json`);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, tries = 4) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url, { headers: UA });
      if (res.status === 429 || res.status >= 500) {
        last = new Error(`${url} ${res.status}`);
        await sleep(400 * 2 ** i);
        continue;
      }
      if (!res.ok) throw new Error(`${url} ${res.status}`);
      return res.json();
    } catch (error) {
      last = error;
      await sleep(250 * 2 ** i);
    }
  }
  throw last;
}

function parseListed(text) {
  const out = [];
  for (const line of text.split("\n").slice(1)) {
    if (!line || line.startsWith("File Creation")) continue;
    const [sym, name, , test, fin, , etf] = line.split("|");
    if (!sym || etf !== "N" || test !== "N" || fin !== "N") continue;
    if (/[+^=$]/.test(sym)) continue;
    const lower = (name || "").toLowerCase();
    if (/(warrant|right|unit|preferred|note|bond|debenture|etf|nextshares|acquisition corp)/.test(lower)) continue;
    if (!/(common stock|ordinary share|american depositary|ads)/.test(lower)) continue;
    out.push(sym);
  }
  return out;
}

async function loadCloses(sym) {
  const file = cachePath(sym);
  if (existsSync(file)) {
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch {
      /* refetch */
    }
  }
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol(sym)}?range=12y&interval=1d`;
  const json = await fetchJson(url);
  const result = json?.chart?.result?.[0];
  if (!result?.timestamp || !result.indicators?.quote?.[0]?.close) {
    writeFileSync(file, "[]");
    return [];
  }
  const offset = result.meta?.gmtoffset ?? 0;
  const close = result.indicators.quote[0].close;
  const rows = [];
  result.timestamp.forEach((ts, i) => {
    const value = close[i];
    if (value == null || !Number.isFinite(value)) return;
    const day = new Date((ts + offset) * 1000).toISOString().slice(0, 10);
    if (day > AS_OF_CAP) return;
    rows.push([day, value]);
  });
  writeFileSync(file, JSON.stringify(rows));
  return rows;
}

async function mapPool(items, limit, worker) {
  const ret = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next;
      next += 1;
      ret[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return ret;
}

function pctAbove(dates, book, period) {
  const bars = [];
  const ring = new Map();
  for (const day of dates) {
    let have = 0;
    let above = 0;
    for (const [sym, closes] of book) {
      const value = closes.get(day);
      if (value == null) continue;
      let hist = ring.get(sym);
      if (!hist) {
        hist = [];
        ring.set(sym, hist);
      }
      hist.push(value);
      if (hist.length > period) hist.shift();
      if (hist.length < period) continue;
      const avg = hist.reduce((sum, x) => sum + x, 0) / period;
      have += 1;
      if (value > avg) above += 1;
    }
    if (have < 30) continue;
    bars.push({ t: day, c: Math.round((above / have) * 10000) / 100 });
  }
  return bars;
}

function writeSeries(file, doc) {
  const { bars, ...head } = doc;
  const lines = bars.map((bar) => `    ${JSON.stringify(bar)}`).join(",\n");
  const top = JSON.stringify(head, null, 2).slice(0, -2);
  writeFileSync(join(outDir, file), `${top},\n  "bars": [\n${lines}\n  ]\n}\n`);
}

const listedText = await fetch("https://www.nasdaqtrader.com/dynamic/symdir/nasdaqlisted.txt", { headers: UA }).then((res) => {
  if (!res.ok) throw new Error(`nasdaqlisted ${res.status}`);
  return res.text();
});
const ndxJson = await fetchJson("https://api.nasdaq.com/api/quote/list-type/nasdaq100");
const ndx = ndxJson.data.data.rows.map((row) => row.symbol).filter(Boolean);
const composite = parseListed(listedText);
console.log(`universe: nasdaq-100 ${ndx.length} · nasdaq-comp ${composite.length}`);

const wanted = [...new Set([...ndx, ...composite])];
let ok = 0;
let fail = 0;
const closes = new Map();
await mapPool(wanted, CONCURRENCY, async (sym, i) => {
  try {
    const rows = await loadCloses(sym);
    if (rows.length >= 220) {
      closes.set(sym, new Map(rows));
      ok += 1;
    } else fail += 1;
  } catch {
    fail += 1;
  }
  if ((i + 1) % 100 === 0 || i + 1 === wanted.length) {
    console.log(`fetched ${i + 1}/${wanted.length} · kept ${ok} · skip ${fail}`);
  }
});

const ndxBook = new Map(ndx.filter((sym) => closes.has(sym)).map((sym) => [sym, closes.get(sym)]));
const compBook = new Map(composite.filter((sym) => closes.has(sym)).map((sym) => [sym, closes.get(sym)]));
const dateSet = new Set();
for (const map of compBook.values()) for (const day of map.keys()) dateSet.add(day);
const dates = [...dateSet].filter((day) => day <= AS_OF_CAP).sort();
if (dates.at(-1) !== AS_OF_CAP) console.warn(`last computed session ${dates.at(-1)}, cap ${AS_OF_CAP}`);

for (const spec of SERIES) {
  const book = spec.universe === "nasdaq-100" ? ndxBook : compBook;
  const bars = pctAbove(dates, book, spec.window);
  if (bars.length < 1500) throw new Error(`${spec.id} only ${bars.length} sessions`);
  const asOf = bars.at(-1).t;
  writeSeries(`${spec.id}.json`, {
    id: spec.id,
    symbol: spec.symbol,
    label: spec.label,
    title: spec.title,
    kind: "pct-above-ma",
    window: spec.window,
    universe: spec.universe,
    universeCount: book.size,
    asOf,
    period: "1D",
    defaultRangeMonths: spec.defaultRangeMonths,
    rails: [20, 40, 60, 80],
    softPctile: 20,
    crowdedPctile: 80,
    provenance: {
      kind: "desk-computed",
      source: spec.universe === "nasdaq-100" ? "Yahoo Finance daily closes of Nasdaq-100 names" : "Yahoo Finance daily closes of Nasdaq-listed common stocks",
      feedSymbol: spec.feed,
      note: `Share of names closing above their ${spec.window}-session average. Not a vendor INDEX live feed. Replace with ${spec.feed} when BREADTH_FEED is set.`,
    },
    bars,
  });
  console.log(`${spec.id} ${bars.length} sessions through ${asOf} last ${bars.at(-1).c}% · names ${book.size}`);
}
