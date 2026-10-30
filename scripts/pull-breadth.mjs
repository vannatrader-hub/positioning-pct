/**
 * Refreshes the Vault breadth series in public/data/vault/breadth/ from the
 * desk's end-of-day text feed. The feed address lives in BREADTH_FEED (env),
 * never in a committed file. Usage:
 *
 *   BREADTH_FEED="https://…" npm run pull:breadth
 *
 * The feed answers `?s=<symbol>&p=D&yr=<years>&…&img=text` with a
 * <pricedata> block of "|"-separated bars: `n start end close vol` for the
 * breadth indexes and `n start end open high low close vol` for SPX.
 * Only completed sessions (stamped to 16:00) are kept.
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
  if (bars.length < 2500) throw new Error(`${symbol} returned only ${bars.length} sessions`);
  return bars;
}

function write(file, doc) {
  const { bars, ...head } = doc;
  const lines = bars.map((bar) => `    ${JSON.stringify(bar)}`).join(",\n");
  const top = JSON.stringify(head, null, 2).slice(0, -2);
  writeFileSync(join(out, file), `${top},\n  "bars": [\n${lines}\n  ]\n}\n`);
}

const [nysi, nasi, spxAll] = await Promise.all(["$NYSI", "$NASI", "$SPX"].map(pull));
const asOf = nysi[nysi.length - 1].t;
if (nasi[nasi.length - 1].t !== asOf) throw new Error(`NYSI ends ${asOf}, NASI ends ${nasi[nasi.length - 1].t}`);
const sessions = new Set(nysi.map((bar) => bar.t));
const spx = spxAll.filter((bar) => bar.t <= asOf && sessions.has(bar.t));

const index = JSON.parse(readFileSync(join(out, "index.json"), "utf8"));
for (const chart of index.charts) {
  const doc = JSON.parse(readFileSync(join(out, chart.file), "utf8"));
  write(chart.file, { ...doc, asOf, bars: chart.id === "nysi" ? nysi : nasi });
}
const overlay = JSON.parse(readFileSync(join(out, index.overlay.file), "utf8"));
write(index.overlay.file, { ...overlay, asOf, bars: spx });
index.asOf = asOf;
writeFileSync(join(out, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
console.log(`breadth through ${asOf}: NYSI ${nysi.at(-1).c} · NASI ${nasi.at(-1).c} · SPX ${spx.at(-1).c}`);
