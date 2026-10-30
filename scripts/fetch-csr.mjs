/**
 * Refresh public/data/vault/credit-spread-regime/csr.json from FRED.
 *
 * ICE BofA OAS (HY BAMLH0A0HYM2, IG BAMLC0A0CM) and the Cboe VIX close are
 * carried forward onto S&P 500 sessions (FRED SP500), so the Z window counts
 * equity sessions. FRED serves the most recent three years of ICE BofA history.
 *
 *   node scripts/fetch-csr.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CSR_PARAMS, csrPanel, csrSeries } from "../src/csr.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public/data/vault/credit-spread-regime/csr.json");

const SERIES = {
  hy: { id: "BAMLH0A0HYM2", label: "ICE BofA US High Yield Index Option-Adjusted Spread", scale: 100 },
  ig: { id: "BAMLC0A0CM", label: "ICE BofA US Corporate Index Option-Adjusted Spread", scale: 100 },
  spx: { id: "SP500", label: "S&P 500 close", scale: 1 },
  vix: { id: "VIXCLS", label: "Cboe Volatility Index close", scale: 1 },
};

async function fred(id) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${id} ${res.status}`);
      const rows = (await res.text()).trim().split("\n").slice(1);
      return new Map(
        rows
          .map((line) => line.split(","))
          .filter(([, value]) => value && value !== ".")
          .map(([date, value]) => [date, Number(value)]),
      );
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((done) => setTimeout(done, 4000 * 2 ** attempt));
    }
  }
}

const data = Object.fromEntries(await Promise.all(Object.entries(SERIES).map(async ([key, spec]) => [key, await fred(spec.id)])));
const start = [...data.hy.keys()].sort()[0];
const sessions = [...data.spx.keys()].filter((date) => date >= start).sort();

const series = { t: [], hy: [], ig: [], spx: [], vix: [] };
const last = {};
for (const date of sessions) {
  for (const key of ["hy", "ig", "vix"]) if (data[key].has(date)) last[key] = data[key].get(date);
  if (last.hy === undefined || last.ig === undefined) continue;
  series.t.push(date);
  series.hy.push(Math.round(last.hy * SERIES.hy.scale));
  series.ig.push(Math.round(last.ig * SERIES.ig.scale));
  series.spx.push(Number(data.spx.get(date).toFixed(2)));
  series.vix.push(last.vix === undefined ? null : Number(last.vix.toFixed(2)));
}

const panel = csrPanel(csrSeries({ series }));
const doc = {
  id: "credit-spread-regime",
  title: "Credit Spread Regime",
  sourceLabel: "Desk",
  provider: "FRED",
  asOf: series.t[series.t.length - 1],
  updatedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
  calendar: "S&P 500 sessions; ICE BofA OAS and VIX carried forward on sessions without a print",
  units: { hy: "bps", ig: "bps", spx: "index", vix: "index" },
  sources: Object.entries(SERIES).map(([key, spec]) => ({ key, id: spec.id, label: spec.label })),
  params: { ...CSR_PARAMS },
};
doc.snapshot = {
  date: panel.date,
  hy: panel.hy,
  ig: panel.ig,
  excess: panel.excess,
  z: Number(panel.z.toFixed(2)),
  regime: panel.regime,
  percentile: Number(panel.percentile.toFixed(1)),
  momentum: Number(panel.momentum.toFixed(1)),
  vix: panel.vix,
  status: panel.status,
  cycle: panel.cycle,
  bias: panel.bias,
};

/* One line per column keeps the file diffable without a line per session. */
mkdirSync(dirname(out), { recursive: true });
const columns = Object.entries(series)
  .map(([key, values]) => `    ${JSON.stringify(key)}: ${JSON.stringify(values)}`)
  .join(",\n");
const head = JSON.stringify({ ...doc, series: "__SERIES__" }, null, 2);
writeFileSync(out, `${head.replace('"__SERIES__"', `{\n${columns}\n  }`)}\n`);
console.log(`csr.json · ${series.t.length} sessions ${series.t[0]} → ${doc.asOf} · Z ${doc.snapshot.z} ${doc.snapshot.regime} ${doc.snapshot.percentile}% ${doc.snapshot.bias}`);
