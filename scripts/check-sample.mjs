import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HOUSES, INDICATORS, SECTIONS, readIndicator } from "../src/desk.js";
import { CANON, WEEKS, buildReading, ordinal } from "../src/readings.js";
import { bullPutMath, leapMath, price } from "../src/study.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;

function assert(condition, message) {
  if (condition) return;
  failed += 1;
  console.error(`FAIL ${message}`);
}

const reading = buildReading("jpm", 7, 4);
const monitor = {
  XLE: "0.69",
  XLB: "0.46",
  XLI: "0.35",
  XLY: "0.48",
  XLP: "0.21",
  XLV: "0.34",
  XLF: "0.18",
  XLK: "0.75",
  XLC: "0.49",
  XLU: "0.33",
};

assert(Object.keys(reading.sectors).length === 11, "expected 11 sector funds");
for (const [ticker, display] of Object.entries(monitor)) {
  const got = reading.sectors[ticker];
  assert(got?.available, `${ticker} should have a JPM print`);
  assert(got?.display === display, `${ticker} JPM latest ${got?.display} !== ${display}`);
}
assert(reading.sectors.XLF.caption === "18th %ile · call skew soft", "XLF caption");
assert(reading.sectors.XLF.pill === "extreme soft → easing", "XLF pill");
assert(reading.sectors.XLRE.available === false, "XLRE has no JPM print");
assert(reading.sectors.XLRE.display === "—", "XLRE shows no number under JPM");
assert(reading.sectors.XLRE.unavailable === "Not in JPM monitor", "XLRE unavailable label");
for (let week = 0; week < WEEKS.length; week += 1) {
  for (const source of ["jpm", "all"]) {
    const sectors = buildReading(source, week, 4).sectors;
    assert(sectors.XLRE.points === null, `XLRE has a ${source} value on week ${week}`);
  }
  for (const source of ["ms", "gs", "boa", "desk"]) {
    const xlre = buildReading(source, week, 4).sectors.XLRE;
    assert(xlre.available && xlre.points !== 81, `${source} XLRE week ${week} should be a sample read, not 81`);
  }
}

assert(reading.volDisplay === "1.4", `soft vol display ${reading.volDisplay}`);
assert(reading.volName === "Soft Vol", `soft vol name ${reading.volName}`);
assert(reading.weekLabel === "Oct 23, 2026", `week label ${reading.weekLabel}`);
assert(ordinal(18) === "18th" && ordinal(22) === "22nd" && ordinal(21) === "21st", "ordinals");

const desk = buildReading("desk", 7, 4);
assert(desk.sectors.XLF.points !== reading.sectors.XLF.points, "desk composite should blend banks");
assert(desk.sectorSource === "Desk composite", "desk sector label");
const all = buildReading("all", 7, 4);
assert(all.sectors.XLF.points === 18 && all.sectors.XLF.display === "0.18", "All uses JPM for sectors, XLF 0.18");

const houses = new Set(Object.keys(HOUSES));
assert(
  JSON.stringify(Object.values(HOUSES)) === JSON.stringify(["JPM", "MS", "GS", "BoA", "Desk"]),
  "public house labels are JPM, MS, GS, BoA, Desk",
);
assert(SECTIONS.length === 10, `expected 10 desk sections, got ${SECTIONS.length}`);
const sectionIds = new Set(SECTIONS.map((section) => section.id));
const seen = new Set();
for (const indicator of INDICATORS) {
  assert(!seen.has(indicator.id), `${indicator.id} duplicated`);
  seen.add(indicator.id);
  assert(sectionIds.has(indicator.section), `${indicator.id} has unknown section`);
  assert(houses.has(indicator.house), `${indicator.id} has unknown house ${indicator.house}`);
  assert(indicator.values.length === WEEKS.length, `${indicator.id} needs ${WEEKS.length} values`);
  assert(indicator.pcts.length === WEEKS.length, `${indicator.id} needs ${WEEKS.length} pcts`);
  assert(indicator.pcts.every((pct) => pct >= 0 && pct <= 100), `${indicator.id} pct out of range`);
  if (indicator.ref) assert(Boolean(indicator.latest), `${indicator.id} references a chart but has no latest note`);
  for (let week = 0; week < WEEKS.length; week += 1) {
    const read = readIndicator(indicator, week);
    assert(typeof read.value === "string" && read.value.length > 0, `${indicator.id} week ${week} value`);
    assert(/→ (building|easing|steady)$/.test(read.pill), `${indicator.id} pill "${read.pill}"`);
  }
  const early = readIndicator(indicator, 0);
  assert(early.latestNote === "", `${indicator.id} shows its latest-print note on an earlier week`);
}
for (const section of SECTIONS) {
  if (section.id === "sectors") continue;
  const count = INDICATORS.filter((indicator) => indicator.section === section.id).length;
  assert(count >= 3, `${section.id} has only ${count} reads`);
}
for (const house of houses) {
  assert(INDICATORS.some((indicator) => indicator.house === house), `no reads from ${house}`);
}
const cross = readIndicator(INDICATORS.find((indicator) => indicator.id === "jpm-cross-asset"), 7);
const crossWant = {
  Equities: "0.66",
  "Govt Bonds": "0.60",
  Credit: "0.24",
  Dollar: "0.81",
  "Commodities ex Gold": "0.78",
  Gold: "0.38",
  Bitcoin: "0.87",
  "EM Equities": "0.84",
  "EM Bonds/FX": "0.15",
  "Japan Equities": "0.67",
  "Europe Equities": "0.26",
};
assert(cross.assets.length === 11, "cross-asset monitor has 11 lines");
for (const [label, display] of Object.entries(crossWant)) {
  const asset = cross.assets.find((item) => item.label === label);
  assert(asset?.display === display, `cross-asset ${label} ${asset?.display} !== ${display}`);
}
assert(cross.basis === "Sample · ref chart 06-Oct-26 (JPM)", `cross-asset basis ${cross.basis}`);
const broad = readIndicator(INDICATORS.find((indicator) => indicator.id === "jpm-broad"), 7);
assert(broad.value === "0.66" && broad.basis === cross.basis, `JPM broad equity ${broad.value} ${broad.basis}`);

const fms = readIndicator(INDICATORS.find((indicator) => indicator.id === "boa-fms-crowded"), 7);
assert(fms.value === "53" && fms.unit === "%", "FMS crowded trade reads 53%");
const ndx = readIndicator(INDICATORS.find((indicator) => indicator.id === "desk-cftc-ndx"), 7);
assert(ndx.value === "−11.8k", `NDX hedgers ${ndx.value}`);
const cor = readIndicator(INDICATORS.find((indicator) => indicator.id === "desk-cor1m"), 7);
assert(cor.value === "7.41" && cor.tone === "crowded", `COR1M ${cor.value} ${cor.tone}`);

const eight = buildReading("jpm", 7, 8);
assert(eight.sectors.XLF.pill === "extreme soft → easing", "8-week XLF still easing");
assert(eight.sectors.XLU.pill === "soft → catching up", `8-week XLU ${eight.sectors.XLU.pill}`);

const marks = JSON.parse(readFileSync(join(root, "public/data/study-marks.json"), "utf8"));
assert(typeof marks.asOfLabel === "string" && marks.asOfLabel.length > 0, "marks need an asOfLabel");
const latestJpm = buildReading("jpm", WEEKS.length - 1, 4).sectors;
const softJpm = CANON.filter((ticker) => latestJpm[ticker].available && latestJpm[ticker].points < 25).sort();
assert(
  JSON.stringify(softJpm) === JSON.stringify([...marks.softTickers].sort()),
  `soft JPM sectors ${softJpm} should match marks softTickers ${marks.softTickers}`,
);
for (const ticker of marks.softTickers) {
  const underlying = marks.underlyings[ticker];
  assert(underlying && typeof underlying.spot === "number", `${ticker} needs a spot price`);
  assert(Math.round(underlying.percentile * 100) === latestJpm[ticker].points, `${ticker} percentile matches the JPM card`);
}
const xlf = marks.chains.XLF;
assert(xlf?.putStrip?.rows?.length >= 5, "XLF put strip");
assert(xlf?.leapCalls?.rows?.length >= 1, "XLF LEAP calls");
for (const chain of [xlf.putStrip, xlf.leapCalls]) {
  for (const row of chain.rows) {
    assert(row.bid <= row.mark && row.mark <= row.ask, `${chain.type} ${row.strike} mark inside bid/ask`);
    assert(Math.abs((row.bid + row.ask) / 2 - row.mark) < 0.0051, `${chain.type} ${row.strike} mark is mid`);
    for (const key of ["iv", "oi", "volume"]) assert(typeof row[key] === "number", `${chain.type} ${row.strike} ${key}`);
  }
}
const spread = xlf.structures.bullPut;
for (const leg of [spread.short, spread.long]) {
  const row = xlf.putStrip.rows.find((item) => item.strike === leg.strike);
  assert(row && row.mark === leg.mark && row.bid === leg.bid && row.ask === leg.ask, `bull put ${leg.strike} matches the chain`);
}
assert(spread.expiration === xlf.putStrip.expiration, "bull put expiration matches the strip");
const bp = bullPutMath(spread);
assert(price(bp.credit) === "0.37" && price(bp.credit) === price(spread.creditMid), `bull put credit ${price(bp.credit)}`);
assert(price(bp.maxLoss) === "1.63" && price(bp.breakeven) === "54.63", `bull put math ${price(bp.maxLoss)} ${price(bp.breakeven)}`);
const leap = xlf.structures.callLeap;
const leapRow = xlf.leapCalls.rows.find((item) => item.strike === leap.long.strike);
assert(leapRow && leapRow.mark === leap.long.mark, "LEAP leg matches the chain");
assert(price(leapMath(leap).premium) === "5.725", `LEAP mark ${price(leapMath(leap).premium)}`);
assert(price(marks.underlyings.XLF.spot) === "55.90", "XLF spot 55.90");

const banned = [
  "sentiment ai",
  "wallstjesus",
  "jesus",
  "optionshawk",
  "hawk",
  "volland",
  "darkroom",
  "sentimentrader",
  "deutsche",
  "copy-trading",
  "copy trading",
  "robinhood",
];
const scanExt = new Set([".html", ".js", ".css", ".md", ".yml", ".svg", ".json"]);

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", "dist", ".git", "fonts", "package-lock.json"].includes(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
      continue;
    }
    if (!scanExt.has(extname(name))) continue;
    const text = readFileSync(path, "utf8").toLowerCase();
    for (const phrase of banned) {
      assert(!text.includes(phrase), `${path} contains forbidden phrase "${phrase}"`);
    }
  }
}

walk(root);

const css = readFileSync(join(root, "src/styles.css"), "utf8");
assert(!css.includes("sparkline"), "stylesheet should not define a sparkline treatment");
const page = readFileSync(join(root, "src/positioning.js"), "utf8");
assert(page.includes("Soft") && page.includes("Crowded"), "cards render Soft and Crowded labels");
assert(!page.includes("linear-gradient(90deg, #3"), "no blue-green card fill");

if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log("sample readings ok");
