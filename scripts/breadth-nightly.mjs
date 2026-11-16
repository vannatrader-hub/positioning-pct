/**
 * Weeknight breadth refresh: pull core (and any live participation) from
 * BREADTH_FEED, rebuild the desk-computed Nasdaq %‑above‑MA series from Yahoo,
 * then stamp index.json asOf / per-chart asOf from the written files.
 *
 * Fails non-zero (no further writes) when the feed asOf is stale vs the last
 * completed America/Chicago weekday session (1-session tolerance / holidays).
 *
 *   BREADTH_FEED="https://…" npm run breadth:nightly
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFeedFresh, writeBreadth } from "./pull-breadth.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public/data/vault/breadth");

function run(script) {
  const result = spawnSync(process.execPath, [join(root, "scripts", script)], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!process.env.BREADTH_FEED) {
  console.error("Set BREADTH_FEED to the desk's end-of-day text feed (see README, Vault breadth wall).");
  process.exit(1);
}

run("pull-breadth.mjs");

const nysi = JSON.parse(readFileSync(join(out, "nysi.json"), "utf8"));
try {
  assertFeedFresh(nysi.asOf);
} catch (error) {
  console.error(error.message ?? error);
  process.exit(1);
}

run("seed-nasdaq-ma.mjs");

const index = JSON.parse(readFileSync(join(out, "index.json"), "utf8"));
const asOf = nysi.asOf;
const ends = {};
for (const chart of index.charts) {
  const doc = JSON.parse(readFileSync(join(out, chart.file), "utf8"));
  let bars = doc.bars;
  if (chart.id.startsWith("nc") || chart.id === "ndtw") {
    const trimmed = bars.filter((bar) => bar.t <= asOf);
    if (trimmed.length !== bars.length || doc.asOf !== trimmed.at(-1)?.t) {
      bars = trimmed;
      writeBreadth(chart.file, { ...doc, asOf: bars.at(-1).t, bars }, { spaced: false });
    }
  }
  const last = bars.at(-1)?.t;
  if (!last) throw new Error(`${chart.id} has no bars`);
  const fileAsOf = chart.id.startsWith("nc") || chart.id === "ndtw" ? last : doc.asOf;
  if (fileAsOf !== last) throw new Error(`${chart.id} asOf ${fileAsOf} != last bar ${last}`);
  if (last > asOf) throw new Error(`${chart.id} last bar ${last} is after core asOf ${asOf}`);
  ends[chart.id] = last;
  if ("asOf" in chart) chart.asOf = last;
}
const overlay = JSON.parse(readFileSync(join(out, index.overlay.file), "utf8"));
const overlayLast = overlay.bars.at(-1)?.t;
if (!overlayLast || overlay.asOf !== overlayLast) {
  throw new Error(`SPX asOf ${overlay.asOf} != last bar ${overlayLast}`);
}
index.asOf = asOf;
writeFileSync(join(out, "index.json"), `${JSON.stringify(index, null, 2)}\n`);

const line = Object.entries(ends)
  .map(([id, day]) => `${id.toUpperCase()} ${day}`)
  .join(" · ");
console.log(`breadth nightly index.asOf ${index.asOf}: ${line} · SPX ${overlayLast}`);
