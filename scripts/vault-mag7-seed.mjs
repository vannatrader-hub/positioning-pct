/**
 * Seeds public/data/vault/mag7/oscillator.json for the Vault MAG7 Oscillator.
 *
 *   node scripts/vault-mag7-seed.mjs                 # daily closes through the last session
 *   node scripts/vault-mag7-seed.mjs --at 12:30      # last bar = today's 5-minute close at 12:30 CT
 *
 * Closes are split-adjusted, not dividend-adjusted. The oscillator itself is
 * computed in the browser by src/mag7-osc.js; this file only stores inputs.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULTS, MAG7, buildOscillator, panelAt } from "../src/mag7-osc.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public/data/vault/mag7/oscillator.json");
const EW = "RSP";
const FROM = "2024-01-02";
const DEFAULT_FROM = "2025-01-13";

const args = process.argv.slice(2);
const atIndex = args.indexOf("--at");
const at = atIndex >= 0 ? args[atIndex + 1] : null;

const chartUrl = (ticker, range, interval) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=${interval}`;

async function chart(ticker, range, interval) {
  const res = await fetch(chartUrl(ticker, range, interval), { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`${ticker} ${range}/${interval} ${res.status}`);
  const result = (await res.json()).chart.result[0];
  const offset = result.meta.gmtoffset;
  const close = result.indicators.quote[0].close;
  return result.timestamp.map((ts, index) => ({ ts, local: new Date((ts + offset) * 1000).toISOString(), close: close[index] }));
}

const round = (value) => Math.round(value * 100) / 100;

function ctClock(ts) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(ts * 1000),
  );
}

const tickers = [...MAG7, EW];
const daily = {};
for (const ticker of tickers) {
  const rows = await chart(ticker, "5y", "1d");
  daily[ticker] = new Map(rows.filter((row) => row.close != null).map((row) => [row.local.slice(0, 10), round(row.close)]));
}
const dates = [...daily[MAG7[0]].keys()].filter((date) => date >= FROM && tickers.every((ticker) => daily[ticker].has(date))).sort();
const last = dates[dates.length - 1];

let asOf = `${last}T15:00:00-05:00`;
let lastBar = "close";
if (at) {
  for (const ticker of tickers) {
    const bars = (await chart(ticker, "1d", "5m")).filter((row) => row.close != null);
    const bar = bars.find((row) => ctClock(row.ts) === at);
    if (!bar || bar.local.slice(0, 10) !== last) throw new Error(`${ticker} has no 5-minute bar at ${at} CT on ${last}`);
    daily[ticker].set(last, round(bar.close));
  }
  const [hour, minute] = at.split(":").map(Number);
  const closeAt = hour * 60 + minute + 5;
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", timeZoneName: "longOffset" })
    .formatToParts(new Date(`${last}T12:00:00Z`))
    .find((part) => part.type === "timeZoneName")
    .value.replace("GMT", "");
  asOf = `${last}T${String(Math.floor(closeAt / 60)).padStart(2, "0")}:${String(closeAt % 60).padStart(2, "0")}:00${offset}`;
  lastBar = "intraday";
}

const doc = {
  sku: "mag7-oscillator",
  title: "MAG7 Oscillator",
  houseLabel: "Desk",
  names: MAG7,
  ew: { ticker: EW, label: "S&P 500 EW" },
  params: DEFAULTS,
  defaultFrom: DEFAULT_FROM,
  asOf,
  lastBar,
  basis: "Daily closes, split-adjusted. Equal weight across the seven names.",
  dates,
  closes: Object.fromEntries(tickers.map((ticker) => [ticker, dates.map((date) => daily[ticker].get(date))])),
};

const result = buildOscillator(doc);
const panel = panelAt(result, result.values.length - 1);
doc.snapshot = { value: panel.valueRounded, signal: panel.signal, breadth: panel.breadth, mode: panel.mode, type: panel.type };

mkdirSync(dirname(out), { recursive: true });
/* One array per line keeps the file diffable without a line per number. */
const text = JSON.stringify(doc, null, 2).replace(/\[\s+([^[\]{}]*?)\s+\]/g, (_, inner) => `[${inner.split(/,\s+/).join(", ")}]`);
writeFileSync(out, `${text}\n`);
console.log(`${out}: ${dates.length} sessions ${dates[0]} → ${last} (${lastBar}), value ${panel.valueText} ${panel.signal} breadth ${panel.breadth}%`);
