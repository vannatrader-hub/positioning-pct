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
 * Core symbols ($NYSI, $NASI, $SPX, $NYHL, $NYAD) must succeed and always ship.
 * NYHL / NYAD daily values are appended onto the committed cumulative series
 * (and their embedded SPX context). Participation symbols ($NCFD, $NDTW,
 * $NCFI, $NCTH) are best-effort: a miss is logged and the committed desk-
 * computed files are left alone so `npm run seed:nasdaq-ma` can refresh them.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public/data/vault/breadth");
const feed = process.env.BREADTH_FEED;
const YEARS = 11;

if (!feed) {
  console.error("Set BREADTH_FEED to the desk's end-of-day text feed (see README, Vault breadth wall).");
  process.exit(1);
}

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

async function pull(symbol) {
  const url = `${feed}?s=${encodeURIComponent(symbol)}&p=D&yr=${YEARS}&mn=0&dy=0&i=t3757734781c&img=text&inspector=yes`;
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

function write(file, doc) {
  const { bars, ...head } = doc;
  const lines = bars.map((bar) => `    ${JSON.stringify(bar)}`).join(",\n");
  const top = JSON.stringify(head, null, 2).slice(0, -2);
  writeFileSync(join(out, file), `${top},\n  "bars": [\n${lines}\n  ]\n}\n`);
}

function appendCumulative(doc, daily, spxBySession, sessions, asOf) {
  const bars = doc.bars.slice();
  const spx = (doc.spx ?? []).slice();
  const have = new Set(bars.map((bar) => bar.t));
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
  }
  if (bars.at(-1).t !== asOf) {
    throw new Error(`${doc.id} cumulative ends ${bars.at(-1).t}, expected ${asOf}`);
  }
  if (spx.at(-1)?.t !== asOf) {
    throw new Error(`${doc.id} SPX context ends ${spx.at(-1)?.t}, expected ${asOf}`);
  }
  return { ...doc, asOf, bars, spx };
}

const core = {};
for (const [id, symbol] of CORE) {
  const bars = await pull(symbol);
  core[id] = id === "nyhl" || id === "nyad" ? bars : requireHistory(id, bars);
}

const asOf = core.nysi.at(-1).t;
for (const id of ["nasi", "spx", "nyhl", "nyad"]) {
  const end = core[id].at(-1).t;
  if (end < asOf) throw new Error(`NYSI ends ${asOf}, ${id} only reaches ${end}`);
}
const sessions = new Set(core.nysi.map((bar) => bar.t));
const spx = core.spx.filter((bar) => bar.t <= asOf && sessions.has(bar.t));
if (spx.at(-1)?.t !== asOf) throw new Error(`SPX missing the NYSI as-of session ${asOf}`);
const spxBySession = new Map(spx.map((bar) => [bar.t, bar.c]));

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

const index = JSON.parse(readFileSync(join(out, "index.json"), "utf8"));
const chartById = Object.fromEntries(index.charts.map((chart) => [chart.id, chart]));

for (const id of ["nysi", "nasi"]) {
  const chart = chartById[id];
  const doc = JSON.parse(readFileSync(join(out, chart.file), "utf8"));
  const bars = core[id].filter((bar) => bar.t <= asOf);
  write(chart.file, { ...doc, asOf, bars });
}

write(index.overlay.file, {
  ...JSON.parse(readFileSync(join(out, index.overlay.file), "utf8")),
  asOf,
  bars: spx,
});

for (const id of CUMULATIVE) {
  const chart = chartById[id];
  const doc = JSON.parse(readFileSync(join(out, chart.file), "utf8"));
  const next = appendCumulative(doc, core[id], spxBySession, sessions, asOf);
  write(chart.file, next);
  if (chart.asOf) chart.asOf = asOf;
}

for (const id of PCT_IDS) {
  const bars = pct[id];
  if (!bars) continue;
  const chart = chartById[id];
  const doc = JSON.parse(readFileSync(join(out, chart.file), "utf8"));
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
  write(chart.file, next);
  if (chart.asOf) chart.asOf = asOf;
}

index.asOf = asOf;
writeFileSync(join(out, "index.json"), `${JSON.stringify(index, null, 2)}\n`);

const coreLine = `NYSI ${core.nysi.at(-1).c} · NASI ${core.nasi.at(-1).c} · NYHL Δ ${core.nyhl.at(-1).c} · NYAD Δ ${core.nyad.at(-1).c} · SPX ${spx.at(-1).c}`;
if (pctErrors.length) {
  console.warn(`breadth core through ${asOf}: ${coreLine}`);
  console.warn(`participation skipped (${pctErrors.length}): ${pctErrors.join(" · ")}`);
} else {
  const pctLine = PCT_IDS.map((id) => `${id.toUpperCase()} ${pct[id].at(-1).c}`).join(" · ");
  console.log(`breadth through ${asOf}: ${coreLine} · ${pctLine}`);
}
