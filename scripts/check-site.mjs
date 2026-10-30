import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HOUSES, INDICATORS, SECTIONS, readIndicator } from "../src/desk.js";
import { CANON, WEEKS, buildReading, ordinal } from "../src/readings.js";
import { STRUCTURES, creditSpreadMath, leapMath, price } from "../src/study.js";
import { breakeven, chartLevels, resolveExpiry } from "../src/flow-chart.js";
import { SIDES, alertLabel, sortPlays } from "../src/options-flow.js";
import { SECTION_ORDER, STATUS, allPlays, levelKind, outcomeLabel, sortCards, spotlightLevels, spotlightLines } from "../src/spotlights.js";
import { activeSpotlights, earningsBoxes, spotlightStar, tradeDates } from "../src/scorecard.js";
import { VAULT_ALLOWLIST, isAllowlisted } from "../src/vault-allowlist.js";
import { errorCopy, nextStep } from "../src/vault-signin.js";
import { NT_SECTIONS, SOURCE_LABELS, deskDay, deskDayStart, deskWindow, itemsForDay, windowLabel } from "../src/new-today-window.js";
import {
  CHARTS,
  CHART_IDS,
  CHART_SOURCES,
  SECTOR_BUCKETS,
  broadEquityChart,
  chartFacts,
  creditChart,
  fundManagerChart,
  riskChart,
  sectorChart,
  softVolChart,
} from "../src/pct-charts.js";

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
    assert(xlre.available && xlre.points !== 81, `${source} XLRE week ${week} should be a read, not 81`);
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
assert(cross.basis === "Ref chart 06-Oct-26 (JPM)", `cross-asset basis ${cross.basis}`);
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
assert(marks.asOfLabel === "Fri Oct 23, 2026 session close (CT)", `marks asOfLabel ${marks.asOfLabel}`);
const latestJpm = buildReading("jpm", WEEKS.length - 1, 4).sectors;
const printedJpm = CANON.filter((ticker) => latestJpm[ticker].available);
const softJpm = printedJpm.filter((ticker) => latestJpm[ticker].points < 25).sort();
const crowdedJpm = printedJpm.filter((ticker) => latestJpm[ticker].points >= 75).sort();
assert(
  JSON.stringify(softJpm) === JSON.stringify([...marks.softTickers].sort()),
  `soft JPM sectors ${softJpm} should match marks softTickers ${marks.softTickers}`,
);
assert(
  JSON.stringify(crowdedJpm) === JSON.stringify([...marks.crowdedTickers].sort()),
  `crowded JPM sectors ${crowdedJpm} should match marks crowdedTickers ${marks.crowdedTickers}`,
);

const sides = [
  ...marks.softTickers.map((ticker) => [ticker, "soft"]),
  ...marks.crowdedTickers.map((ticker) => [ticker, "crowded"]),
];
for (const [ticker, side] of sides) {
  const plan = STRUCTURES[side];
  const underlying = marks.underlyings[ticker];
  assert(underlying && typeof underlying.spot === "number", `${ticker} needs a spot price`);
  assert(underlying.spotBid <= underlying.spotAsk, `${ticker} spot bid/ask`);
  assert(Math.round(underlying.percentile * 100) === latestJpm[ticker].points, `${ticker} percentile matches the JPM card`);

  const chains = marks.chains[ticker];
  assert(chains, `${ticker} has no chains`);
  if (!chains) continue;
  const strip = chains[plan.strip];
  const leapRows = chains[plan.leapRows];
  const spread = chains.structures?.[plan.spread];
  const leap = chains.structures?.[plan.leap];
  assert(strip?.rows?.length >= 5, `${ticker} ${plan.strip}`);
  assert(leapRows?.rows?.length >= 1, `${ticker} ${plan.leapRows}`);
  assert(spread && leap, `${ticker} needs ${plan.spread} and ${plan.leap}`);
  if (!strip || !leapRows || !spread || !leap) continue;
  assert(strip.type === (side === "soft" ? "put" : "call"), `${ticker} strip type ${strip.type}`);
  assert(leapRows.type === (side === "soft" ? "call" : "put"), `${ticker} LEAP rows type ${leapRows.type}`);

  for (const chain of [strip, leapRows]) {
    const strikes = chain.rows.map((row) => row.strike);
    assert(strikes.every((value, index) => index === 0 || value > strikes[index - 1]), `${ticker} ${chain.type} strikes ascend`);
    for (const row of chain.rows) {
      const where = `${ticker} ${chain.type} ${row.strike}`;
      assert(row.bid <= row.mark && row.mark <= row.ask, `${where} mark inside bid/ask`);
      assert(Math.abs((row.bid + row.ask) / 2 - row.mark) < 0.0051, `${where} mark is mid`);
      for (const key of ["iv", "oi", "volume"]) assert(typeof row[key] === "number", `${where} ${key}`);
    }
  }

  assert(spread.expiration === strip.expiration, `${ticker} spread expiration matches the strip`);
  for (const leg of [spread.short, spread.long]) {
    assert(leg.type === strip.type, `${ticker} spread leg type`);
    const row = strip.rows.find((item) => item.strike === leg.strike);
    assert(row && row.mark === leg.mark && row.bid === leg.bid && row.ask === leg.ask, `${ticker} spread ${leg.strike} matches the chain`);
  }
  const math = creditSpreadMath(spread);
  assert(price(math.credit) === price(spread.creditMid), `${ticker} credit ${price(math.credit)} vs ${spread.creditMid}`);
  assert(math.width === spread.width, `${ticker} width ${math.width} vs ${spread.width}`);
  if (side === "soft") assert(spread.short.strike > spread.long.strike, `${ticker} bull put short strike above long`);
  else assert(spread.short.strike < spread.long.strike, `${ticker} bear call short strike below long`);

  assert(leap.expiration === leapRows.expiration && leap.long.type === leapRows.type, `${ticker} LEAP matches its rows`);
  const leapRow = leapRows.rows.find((item) => item.strike === leap.long.strike);
  assert(leapRow && leapRow.mark === leap.long.mark && leapRow.bid === leap.long.bid && leapRow.ask === leap.long.ask, `${ticker} LEAP leg matches the chain`);
}

const studyWant = {
  XLF: { credit: "0.37", maxLoss: "1.63", breakeven: "54.63", leap: "5.725", leapBreakeven: "61.725", spot: "55.90" },
  XLP: { credit: "0.60", maxLoss: "1.40", breakeven: "87.40", leap: "8.00", leapBreakeven: "96.00", spot: "88.26" },
  XLK: { credit: "2.125", maxLoss: "2.875", breakeven: "187.125", leap: "17.60", leapBreakeven: "162.40", spot: "183.26" },
};
for (const [ticker, want] of Object.entries(studyWant)) {
  const side = marks.crowdedTickers.includes(ticker) ? "crowded" : "soft";
  const structures = marks.chains[ticker].structures;
  const math = creditSpreadMath(structures[STRUCTURES[side].spread]);
  const leap = leapMath(structures[STRUCTURES[side].leap]);
  const got = {
    credit: price(math.credit),
    maxLoss: price(math.maxLoss),
    breakeven: price(math.breakeven),
    leap: price(leap.premium),
    leapBreakeven: price(leap.breakeven),
    spot: price(marks.underlyings[ticker].spot),
  };
  assert(JSON.stringify(got) === JSON.stringify(want), `${ticker} study math ${JSON.stringify(got)}`);
}

const flow = JSON.parse(readFileSync(join(root, "public/data/flow/plays.json"), "utf8"));
const flowTickers = ["DAR", "JAZZ", "CASY", "JCI", "CRWD", "DDOG", "CORT", "QCOM", "MMM", "COIN", "ALAB", "CSCO"];
assert(
  JSON.stringify(sortPlays(flow.plays).map((play) => play.ticker)) === JSON.stringify(flowTickers),
  `Shopping List newest alert first: ${sortPlays(flow.plays).map((play) => play.ticker)}`,
);
assert(
  JSON.stringify(flow.plays.map((play) => play.ticker)) === JSON.stringify(flowTickers),
  "plays.json is stored newest alert first",
);
const windowStart = new Date(Date.parse(`${flow.asOf}T00:00:00Z`) - 21 * 86400000).toISOString().slice(0, 10);
for (const play of flow.plays) {
  const where = `flow ${play.ticker}`;
  assert(play.confidence === "$$$", `${where} confidence`);
  assert(play.industry?.broad && play.industry?.focus, `${where} industry broad / focus`);
  assert(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM) CT$/.test(play.alertedAtCt), `${where} alert stamp ${play.alertedAtCt}`);
  assert(play.alertedAtCt.startsWith(play.date), `${where} alert date matches date`);
  assert(play.date >= windowStart && play.date <= flow.asOf, `${where} outside the 3-week window`);
  assert(play.flow.length >= 1 && play.flow.length <= 3, `${where} keeps 1–3 flow paragraphs`);
  assert(typeof play.recommendation === "string" && play.recommendation.length > 20, `${where} recommendation`);
  assert(!("link" in play), `${where} carries a source link`);
  const recent = play.customerPurchased?.[0];
  assert((play.lead === null) === !recent, `${where} lead must exist exactly when Customer purchased has a row`);
  if (play.lead && recent) {
    assert(["call", "put"].includes(play.lead.type), `${where} lead type`);
    assert(["bought", "sold"].includes(play.lead.action), `${where} lead action`);
    assert(play.lead.strike > 0, `${where} lead strike`);
    assert(resolveExpiry(play.lead.expiry, play.date) > play.date, `${where} lead expiry ${play.lead.expiry}`);
    assert(recent.side === `${play.lead.type}s_${play.lead.action}`, `${where} lead ${play.lead.type} ${play.lead.action} vs ${recent.side}`);
    const strikes = typeof play.lead.shortStrike === "number" ? `$${play.lead.strike}/$${play.lead.shortStrike}` : `$${play.lead.strike} `;
    assert(`${recent.contract} `.includes(strikes), `${where} lead strikes ${strikes} not in "${recent.contract}"`);
  }

  const bars = JSON.parse(readFileSync(join(root, `public/data/flow/bars/${play.ticker}.json`), "utf8")).bars;
  assert(bars.length >= 250, `${where} needs at least a year of bars`);
  assert(bars.every((bar, index) => index === 0 || bar.t > bars[index - 1].t), `${where} bars ascend`);
  assert(bars.every((bar) => bar.l <= Math.min(bar.o, bar.c) && bar.h >= Math.max(bar.o, bar.c)), `${where} OHLC`);
  const last = bars[bars.length - 1];
  assert(play.quote.date === last.t && play.quote.last === last.c, `${where} quote matches the last bar`);
  assert(play.quote.prev === bars[bars.length - 2].c, `${where} prev close matches`);
  const levels = chartLevels(play, bars);
  assert(levels.window.length >= 110 && levels.window.length <= 135, `${where} six-month window ${levels.window.length}`);
}
const flowBy = Object.fromEntries(flow.plays.map((play) => [play.ticker, play]));
for (const play of flow.plays) {
  const rows = play.customerPurchased;
  assert(Array.isArray(rows), `${play.ticker} customerPurchased is a list`);
  for (const line of rows ?? []) {
    assert(line.contract && line.detail, `${play.ticker} customerPurchased row needs contract and detail`);
    assert(/\d{1,2}\/\d{1,2}$|last week$|more recently$/.test(line.detail), `${play.ticker} customerPurchased "${line.detail}" names when it traded`);
    const kind = /\bputs?\b/.test(line.contract) ? "puts" : "calls";
    const act = /\b(sold|short)\b/.test(line.detail) ? "sold" : "bought";
    assert(line.side === `${kind}_${act}`, `${play.ticker} ${line.contract} side ${line.side} should be ${kind}_${act}`);
    assert(line.side in SIDES, `${play.ticker} unknown side ${line.side}`);
  }
}
assert(
  JSON.stringify(flowBy.JCI.customerPurchased) ===
    JSON.stringify([{ contract: "Dec $160 calls", detail: "2,000 bought @ $3.54 · 10/26", side: "calls_bought" }]),
  "JCI customer purchased is the 10/26 Dec $160 call buy only",
);
const qcomRows = Object.fromEntries(flowBy.QCOM.customerPurchased.map((line) => [line.contract, line]));
assert(flowBy.QCOM.customerPurchased[0]?.contract === "Feb $200 calls", "QCOM most recent customer print is the Feb $200 call buy");
assert(/^1,200 bought · \$1\.3M/.test(qcomRows["Feb $200 calls"]?.detail) && qcomRows["Feb $200 calls"].side === "calls_bought", "QCOM Feb $200 calls: 1,200 bought for $1.3M");
assert(/^3,500 bought · \$4\.4M · 9\/25$/.test(qcomRows["Feb $250 calls"]?.detail) && qcomRows["Feb $250 calls"].side === "calls_bought", "QCOM Feb $250 calls: 3,500 bought for $4.4M on 9/25");
assert(
  JSON.stringify(flowBy.QCOM.lead) === JSON.stringify({ type: "call", action: "bought", qty: 1200, strike: 200, expiry: "February", price: null }),
  `QCOM lead is the Feb $200 call buy ${JSON.stringify(flowBy.QCOM.lead)}`,
);
const qcomBars = JSON.parse(readFileSync(join(root, "public/data/flow/bars/QCOM.json"), "utf8")).bars;
const qcomLevels = chartLevels(flowBy.QCOM, qcomBars);
assert(JSON.stringify(qcomLevels.lines.map((line) => line.value)) === "[200]", "QCOM chart draws the $200 strike");
assert(qcomLevels.expiry === "2027-02-19", `QCOM February expiry ${qcomLevels.expiry}`);
const cortBars = JSON.parse(readFileSync(join(root, "public/data/flow/bars/CORT.json"), "utf8")).bars;
assert(
  JSON.stringify(chartLevels(flowBy.CORT, cortBars).lines.map((line) => line.value)) === JSON.stringify([120, 160, 130.94]),
  "CORT chart draws the $120/$160 spread and its break-even",
);
for (const ticker of ["COIN", "ALAB"]) {
  assert(flowBy[ticker].customerPurchased.every((line) => line.detail.includes("sold")), `${ticker} short puts read as sold`);
}
const beWant = { CASY: 671.2, JCI: 163.54, MMM: 179.8, COIN: 123.5, ALAB: 183.8, CORT: 130.94, CRWD: null, DDOG: null, CSCO: null, QCOM: null };
for (const [ticker, want] of Object.entries(beWant)) {
  assert(breakeven(flowBy[ticker].lead) === want, `${ticker} break-even ${breakeven(flowBy[ticker].lead)} !== ${want}`);
}
assert(
  JSON.stringify(flowBy.CASY.lead) === JSON.stringify({ type: "put", action: "sold", qty: 275, strike: 890, expiry: "December 2027", price: 218.8 }),
  `CASY lead is the Dec 2027 $890 put sale ${JSON.stringify(flowBy.CASY.lead)}`,
);
assert(flowBy.CASY.customerPurchased[0]?.contract === "Dec 2027 $890 puts", "CASY Customer purchased is the Dec 2027 $890 puts");
const casyLevels = chartLevels(flowBy.CASY, JSON.parse(readFileSync(join(root, "public/data/flow/bars/CASY.json"), "utf8")).bars);
assert(JSON.stringify(casyLevels.lines.map((line) => line.value)) === "[890,671.2]", `CASY chart draws the $890 strike and break-even ${casyLevels.lines.map((line) => line.value)}`);
assert(casyLevels.expiry === "2027-12-17", `CASY December 2027 expiry ${casyLevels.expiry}`);
assert(!flowBy.UPS, "UPS is a $$ alert and stays off the $$$ watchlist");
assert(!flowBy.P && !flowBy.BX, "P and BX are $$ alerts and stay off the $$$ watchlist");
assert(
  JSON.stringify(flowBy.JAZZ.lead) === JSON.stringify({ type: "call", action: "bought", qty: 2700, strike: 240, expiry: "December 2026", price: null }),
  `JAZZ lead is the Dec 2026 $240 call buy ${JSON.stringify(flowBy.JAZZ.lead)}`,
);
assert(flowBy.JAZZ.customerPurchased[0]?.contract === "Dec 2026 $240 calls" && flowBy.JAZZ.customerPurchased[0]?.side === "calls_bought", "JAZZ Customer purchased is the Dec 2026 $240 call buy");
const jazzLevels = chartLevels(flowBy.JAZZ, JSON.parse(readFileSync(join(root, "public/data/flow/bars/JAZZ.json"), "utf8")).bars);
assert(JSON.stringify(jazzLevels.lines.map((line) => line.value)) === "[240]", `JAZZ chart draws only the $240 strike ${jazzLevels.lines.map((line) => line.value)}`);
assert(
  JSON.stringify(flowBy.DAR.lead) === JSON.stringify({ type: "call", action: "bought", qty: 10000, strike: 62.5, expiry: "April 2027", price: null }),
  `DAR lead is the Apr 2027 $62.5 call buy ${JSON.stringify(flowBy.DAR.lead)}`,
);
assert(flowBy.DAR.customerPurchased[0]?.contract === "Apr 2027 $62.5 calls" && flowBy.DAR.customerPurchased[0]?.side === "calls_bought", "DAR Customer purchased is the Apr 2027 $62.5 call buy");
const darLevels = chartLevels(flowBy.DAR, JSON.parse(readFileSync(join(root, "public/data/flow/bars/DAR.json"), "utf8")).bars);
assert(JSON.stringify(darLevels.lines.map((line) => line.value)) === "[62.5]", `DAR chart draws only the $62.5 strike ${darLevels.lines.map((line) => line.value)}`);
assert(resolveExpiry("December", "2026-10-27") === "2026-12-18", "December resolves to Dec 18, 2026");
assert(resolveExpiry("January", "2026-10-22") === "2027-01-15", "January resolves to Jan 15, 2027");
assert(resolveExpiry("January 2028", "2026-10-25") === "2028-01-21", "January 2028 resolves to Jan 21, 2028");
assert(resolveExpiry("", "2026-10-25") === null, "blank expiry resolves to null");
assert(alertLabel("2026-10-27 05:15 PM CT") === "Alerted Oct 27, 5:15 PM CT", "alert label");
const jciBars = JSON.parse(readFileSync(join(root, "public/data/flow/bars/JCI.json"), "utf8")).bars;
assert(chartLevels(flowBy.JCI, jciBars).expiryInView, "JCI Dec expiry is marked on the chart");
assert(!chartLevels(flowBy.CRWD, JSON.parse(readFileSync(join(root, "public/data/flow/bars/CRWD.json"), "utf8")).bars).expiryInView, "CRWD 2028 expiry stays off the axis");
for (const file of ["src/flow-chart.js", "src/spotlights.js"]) {
  const chartSource = readFileSync(join(root, file), "utf8").toLowerCase();
  for (const phrase of ["tradingview", "candlestick", "max gain", "dip buyer"]) {
    assert(!chartSource.includes(phrase), `${file} trade-levels chart should not include "${phrase}"`);
  }
}
assert(readFileSync(join(root, "src/spotlights.js"), "utf8").includes("drawLevelsChart"), "Spotlight cards share the $$$ line chart");

const hub = readFileSync(join(root, "options-flow/index.html"), "utf8");
const hubLinks = [...hub.matchAll(/<a class="tile hub-tile[^"]*" href="([^"]+)"/g)].map((match) => match[1]);
assert(JSON.stringify(hubLinks) === JSON.stringify(["dollar/", "spotlights/", "scorecard/"]), `hub calling cards ${hubLinks}`);
assert(!hub.includes('id="flow-list"'), "hub shows calling cards, not the $$$ table");
const dollarPage = readFileSync(join(root, "options-flow/dollar/index.html"), "utf8");
for (const id of ["flow-list", "calling-card", "cc-buy-block", "cc-oi-block", "cc-rec", "tl-tiles", "cc-chart"]) {
  assert(dollarPage.includes(`id="${id}"`), `$$$ watchlist page keeps #${id}`);
}
assert(dollarPage.includes('src="/src/options-flow.js"'), "$$$ watchlist page runs options-flow.js");
const viteConfig = readFileSync(join(root, "vite.config.js"), "utf8");
for (const page of ["options-flow/index.html", "options-flow/dollar/index.html", "options-flow/spotlights/index.html", "options-flow/scorecard/index.html"]) {
  assert(viteConfig.includes(`"${page}"`), `vite builds ${page}`);
  const html = readFileSync(join(root, page), "utf8");
  assert(/class="lockup" href="(\.\.\/)+"/.test(html), `${page} lockup links home`);
  if (page !== "options-flow/index.html") assert(html.includes('href="../"'), `${page} links back to the Options Flow hub`);
}

const posHub = readFileSync(join(root, "positioning/index.html"), "utf8");
const posLinks = [...posHub.matchAll(/<a class="tile hub-tile[^"]*" href="([^"]+)"/g)].map((match) => match[1]);
assert(
  JSON.stringify(posLinks) === JSON.stringify(["desk/#sectors", "desk/#credit", "desk/#vol", "desk/"]),
  `Positioning hub calling cards ${posLinks}`,
);
const posTitles = [...posHub.matchAll(/<h2>([^<]+)<\/h2>/g)].map((match) => match[1]);
assert(
  JSON.stringify(posTitles) === JSON.stringify(["Soft ↔ Crowded", "Credit", "Options &amp; Soft Vol", "Full desk"]),
  `Positioning hub card titles ${posTitles}`,
);
for (const link of posLinks) {
  const id = link.split("#")[1];
  if (id) assert(sectionIds.has(id), `Positioning hub card ${link} lands on a missing section id`);
}
const posFacts = posHub.split('href="desk/"')[1].split("</a>")[0].replace(/&amp;/g, "&");
for (const section of SECTIONS) assert(posFacts.includes(section.nav), `Full desk card lists ${section.nav}`);
assert(posHub.includes('src="/src/positioning-hub.js"') && !posHub.includes('id="desk"'), "Positioning hub shows calling cards, not the desk");
const deskPage = readFileSync(join(root, "positioning/desk/index.html"), "utf8");
for (const id of ["secnav-links", "chips", "week", "overview", "overview-grid", "desk", "study", "study-tabs", "study-body"]) {
  assert(deskPage.includes(`id="${id}"`), `Positioning desk keeps #${id}`);
}
assert(deskPage.includes('src="/src/positioning.js"'), "Positioning desk runs positioning.js");
assert(deskPage.includes('class="subnav-back" href="../"'), "Positioning desk links back to the hub");
assert(/class="lockup" href="\.\.\/\.\.\/"/.test(deskPage), "Positioning desk lockup links home");
assert(deskPage.includes('<a href="../charts/">Charts</a>'), "Positioning desk subnav links to the charts");
const deskScript = readFileSync(join(root, "src/positioning.js"), "utf8");
for (const id of ["soft-vol", "sectors"]) assert(deskScript.includes(`chartLink("${id}"`), `desk links its ${id} panel to the chart`);

/* Positioning % charts, batch 1 */
assert(
  JSON.stringify(CHART_IDS) === JSON.stringify(["soft-vol", "sectors", "broad-equity", "credit-stress", "fund-managers", "risk-appetite"]),
  `charts batch 1 is the six locked charts, got ${CHART_IDS}`,
);
for (const chart of CHARTS) {
  assert(houses.has(chart.house), `chart ${chart.id} house ${chart.house}`);
  assert(sectionIds.has(chart.deskSection), `chart ${chart.id} links to missing desk section ${chart.deskSection}`);
  for (const id of chart.reads ?? []) assert(INDICATORS.some((indicator) => indicator.id === id), `chart ${chart.id} reads unknown ${id}`);
}
const chartsPage = readFileSync(join(root, "positioning/charts/index.html"), "utf8");
assert(viteConfig.includes('"positioning/charts/index.html"'), "vite builds positioning/charts/index.html");
assert(chartsPage.includes('src="/src/charts.js"'), "charts page runs charts.js");
assert(chartsPage.includes('class="subnav-back" href="../"'), "charts page links back to the Positioning hub");
assert(chartsPage.includes('<a href="../desk/">Soft ↔ Crowded desk</a>'), "charts page links to the desk");
assert(/class="lockup" href="\.\.\/\.\.\/"/.test(chartsPage), "charts page lockup links home");
for (const id of ["chart-nav", "week", "history-date", "asof-line", "charts"]) assert(chartsPage.includes(`id="${id}"`), `charts page keeps #${id}`);
const chartCards = [...chartsPage.matchAll(/<article class="pchart[^"]*" id="([^"]+)" data-chart="([^"]+)"/g)];
assert(JSON.stringify(chartCards.map((match) => match[1])) === JSON.stringify(CHART_IDS), `charts page cards ${chartCards.map((match) => match[1])}`);
assert(chartCards.every((match) => match[1] === match[2]), "chart card ids match data-chart");
const chartNav = [...chartsPage.matchAll(/<a href="#([^"]+)" data-target="\1">/g)].map((match) => match[1]);
assert(JSON.stringify(chartNav) === JSON.stringify(CHART_IDS), `charts secnav ${chartNav}`);
for (const chart of CHARTS) {
  const card = chartsPage.split(`id="${chart.id}"`)[1]?.split("</article>")[0] ?? "";
  assert(card.includes(`>${chart.title.replace(/&/g, "&amp;")}</h2>`), `chart ${chart.id} title "${chart.title}"`);
  assert(card.includes(`class="house h-${chart.house}">${HOUSES[chart.house]}<`), `chart ${chart.id} shows its ${HOUSES[chart.house]} chip`);
  assert(card.includes('class="pchart-body"'), `chart ${chart.id} has a body to draw into`);
}
const hubCharts = [...posHub.matchAll(/<a class="tile chart-tile" href="charts\/#([^"]+)">/g)].map((match) => match[1]);
assert(JSON.stringify(hubCharts) === JSON.stringify(CHART_IDS), `hub chart cards ${hubCharts}`);
for (const id of CHART_IDS) {
  assert(posHub.includes(`data-preview="${id}"`) && posHub.includes(`data-hub="chart-${id}"`), `hub chart card ${id} has a preview and a fact`);
}
assert(posHub.includes('href="charts/"'), "hub links to all charts");
for (const file of ["positioning/charts/index.html", "positioning/index.html", "src/charts.js", "src/chart-svg.js", "src/pct-charts.js"]) {
  const text = readFileSync(join(root, file), "utf8");
  assert(!/<img\b|\.(png|jpe?g|webp|gif)\b|ref-pack|chart\d\.(png|jpe?g)/i.test(text), `${file} shows source images instead of a redraw`);
}

const vol = softVolChart("desk", 7);
assert(vol.display === "−1.2" && vol.name === "Soft Vol" && vol.tone === "soft", `Soft Vol chart desk ${vol.display} ${vol.name}`);
assert(softVolChart("jpm", 7).display === "−1.4", "Soft Vol chart JPM matches the desk's JPM gauge");
assert(Math.abs(vol.now * 10 - all.volTenths) < 1e-9, "Soft Vol chart Desk matches the desk gauge under All");
assert(vol.points.length === WEEKS.length && CHART_SOURCES.every((id) => vol.houses[id].length === WEEKS.length), "Soft Vol chart has every house for every week");
for (const source of CHART_SOURCES) {
  const chart = sectorChart(source, 7);
  const want = buildReading(source, 7, 4).sectors;
  assert(JSON.stringify(chart.bars.map((bar) => bar.ticker)) === JSON.stringify(CANON), `${source} sector chart runs XLF to XLC`);
  for (const bar of chart.bars) {
    if (!bar.available) {
      assert(want[bar.ticker].available === false, `${source} ${bar.ticker} hides a printed sector`);
      continue;
    }
    assert(bar.points === want[bar.ticker].points, `${source} ${bar.ticker} chart ${bar.points} vs desk ${want[bar.ticker].points}`);
    assert(SECTOR_BUCKETS.find((bucket) => bucket.level === bar.bucket)?.tone === bar.tone, `${source} ${bar.ticker} bucket tone`);
    assert(bar.bucket === want[bar.ticker].level, `${source} ${bar.ticker} bucket ${bar.bucket} matches the desk column ${want[bar.ticker].level}`);
  }
  const printed = chart.bars.filter((bar) => bar.available).length;
  assert(Object.values(chart.counts).reduce((sum, n) => sum + n, 0) === printed, `${source} bucket counts cover every printed sector`);
}
const softest = sectorChart("jpm", 7, "softest").bars.filter((bar) => bar.available);
assert(softest[0].ticker === "XLF" && softest.every((bar, index) => !index || bar.points >= softest[index - 1].points), "Softest first sorts by percentile");
assert(sectorChart("jpm", 7).bars.find((bar) => bar.ticker === "XLRE").available === false, "XLRE has no JPM column");
const broadChart = broadEquityChart(7);
assert(broadChart.read.value === "0.66" && broadChart.read.house === "jpm", `broad equity chart ${broadChart.read.value}`);
assert(JSON.stringify(broadChart.lines.find((line) => line.label === "Equities").path) === JSON.stringify(broadChart.read.pctPath), "broad equity chart is the monitor's Equities line");
const creditData = creditChart(7);
assert(creditData.cdx.value === "351" && creditData.bbb.value === "0.63", `credit chart CDX ${creditData.cdx.value} BBB−AAA ${creditData.bbb.value}`);
assert(creditData.pct === Math.round((creditData.cdx.pct + creditData.bbb.pct) / 2), "credit bar sits between its two panels");
const fmsData = fundManagerChart(7);
assert(fmsData.crowded.value === "53" && fmsData.cash.value === "3.9" && fmsData.trades[0].label === "Long global semis", "fund manager chart reads 53% semis and 3.9% cash");
const riskData = riskChart(7);
assert(
  JSON.stringify(riskData.reads.map((read) => `${read.houseLabel} ${read.value}`)) === '["GS +0.9","GS +1.6","GS 74","Desk 51.7"]',
  `risk appetite panel ${riskData.reads.map((read) => `${read.houseLabel} ${read.value}`)}`,
);
for (const read of riskData.reads) assert(read.basis === "Desk estimate" || read.basis.startsWith("Ref chart"), `${read.id} basis "${read.basis}"`);
const facts = chartFacts();
assert(JSON.stringify(Object.keys(facts)) === JSON.stringify(CHART_IDS), "hub has a live fact for every chart");
assert(Object.values(facts).every((text) => /^(JPM|MS|GS|BoA|Desk) · /.test(text)), "every hub chart fact leads with its house");
for (let week = 0; week < WEEKS.length; week += 1) {
  assert(softVolChart("desk", week).week === week && creditChart(week).cdx.path.length === WEEKS.length, `charts follow week ${week}`);
}

for (const page of ["positioning/index.html", "positioning/desk/index.html", "positioning/charts/index.html"]) {
  assert(viteConfig.includes(`"${page}"`), `vite builds ${page}`);
  const html = readFileSync(join(root, page), "utf8");
  assert(/<nav class="nav"[\s\S]*?class="is-current"[^>]*>Positioning</.test(html), `${page} marks Positioning current`);
}

const spot = JSON.parse(readFileSync(join(root, "public/data/flow/spotlights.json"), "utf8"));
assert(spot.live === true && !("sample" in spot), "Spotlight trades are live tickets");
assert(JSON.stringify(spot.sections.map((section) => section.id)) === JSON.stringify(SECTION_ORDER), "Spotlight rows are Active, Open, Closed");
assert(
  JSON.stringify(spot.sections.map((section) => Boolean(section.defaultOpen))) === "[true,false,false]",
  "only the Active row opens by default",
);
const spotRows = Object.fromEntries(spot.sections.map((section) => [section.id, section.plays.map((play) => play.ticker)]));
assert(JSON.stringify(spotRows) === JSON.stringify({ active: ["XYZ", "GLD", "FCX"], open: ["HOOD"], closed: ["V", "FSLY"] }), `Spotlight rows ${JSON.stringify(spotRows)}`);
const { start: activeStart, end: activeEnd } = spot.activeWindow;
assert(activeStart.startsWith("2026-10-") && activeEnd.startsWith("2026-10-") && activeEnd === spot.asOf, "Active window sits inside October 2026");
const barsLag = (Date.parse(`${spot.asOf}T00:00:00Z`) - Date.parse(`${spot.barsThrough}T00:00:00Z`)) / 86400000;
assert(barsLag >= 0 && barsLag <= 3, `Spotlight bars through ${spot.barsThrough} should be the last session on or before ${spot.asOf}`);
for (const section of spot.sections) {
  assert(JSON.stringify(sortCards(section.plays)) === JSON.stringify(section.plays), `${section.id} row is stored newest first`);
  for (const play of section.plays) {
    const where = `spotlight ${play.ticker}`;
    assert(play.status === section.id, `${where} status ${play.status} sits in the ${section.id} row`);
    assert(play.status in STATUS, `${where} status ${play.status}`);
    assert(play.title && play.structure && play.entry && play.recommendation && play.idea?.length, `${where} needs title, structure, entry, idea, recommendation`);
    assert(!("url" in play), `${where} carries a member source link`);
    if (play.status === "active") assert(play.published >= activeStart && play.published <= activeEnd, `${where} outside the Active window`);
    if (play.status === "open") assert(play.published < activeStart, `${where} belongs in Active`);
    if (play.status === "closed") {
      assert(play.closedAt > play.published && play.closeNote && play.result, `${where} needs a close date, note, and result`);
      assert(["banked", "expired"].includes(play.outcome), `${where} outcome ${play.outcome}`);
      if (play.outcome === "banked") assert(/^https:\/\/x\.com\//.test(play.closeEvidenceUrl), `${where} close evidence ${play.closeEvidenceUrl}`);
    }
    assert(play.levels.every((level) => levelKind(level.label)), `${where} has a level with an unknown label`);
    const by = Object.fromEntries(play.levels.map((level) => [levelKind(level.label), level.price]));
    assert(by.stop === play.stop && by.target === play.target && by.be === play.breakeven && by.spot === play.spotAtPost, `${where} levels match stop/target/B/E/spot`);
    assert(play.side === "puts" ? play.target < play.stop : play.target > play.stop, `${where} target sits past the stop`);

    const bars = JSON.parse(readFileSync(join(root, `public/data/flow/bars/${play.ticker}.json`), "utf8")).bars;
    assert(bars.length >= 250, `${where} needs at least a year of bars`);
    assert(bars.every((bar, index) => index === 0 || bar.t > bars[index - 1].t), `${where} bars ascend`);
    assert(bars.every((bar) => bar.l <= Math.min(bar.o, bar.c) && bar.h >= Math.max(bar.o, bar.c)), `${where} OHLC`);
    assert(bars[bars.length - 1].t === spot.barsThrough, `${where} bars run to ${spot.barsThrough}`);
    const chart = spotlightLevels(play, bars);
    assert(chart.window.length >= 110 && chart.window.length <= 135, `${where} six-month window ${chart.window.length}`);
    const kinds = Object.fromEntries(chart.lines.map((line) => [line.kind, line.value]));
    assert(kinds.stop === play.stop && kinds.target === play.target && kinds.breakeven === play.breakeven, `${where} chart draws stop/target/B/E`);
    assert(!chart.lines.some((line) => /^spot/i.test(line.label)), `${where} spot at post is a marker, not a level line`);
    assert(chart.expiryInView, `${where} expiry ${chart.expiry} is marked on the chart`);
    assert(chart.posted && Math.abs(chart.posted.c - play.spotAtPost) / play.spotAtPost < 0.01, `${where} close at post ${chart.posted?.c} vs ticket ${play.spotAtPost}`);
    if (play.closedAt) assert(chart.markers.some((marker) => marker.t === chart.closeBar.t), `${where} close is marked on the chart`);
  }
}
const spotBy = Object.fromEntries(allPlays(spot).map((play) => [play.ticker, play]));
const spotWant = {
  XYZ: { debit: 3.5, stop: 70, target: 90, breakeven: 78.5, spotAtPost: 75, published: "2026-10-27" },
  GLD: { debit: 8, stop: 367, target: 400, breakeven: 408, spotAtPost: 377.5, published: "2026-10-20" },
  FCX: { debit: 3.25, stop: 63, target: 80, breakeven: 78.25, spotAtPost: 69.2, published: "2026-10-14" },
  HOOD: { debit: 6, stop: 105, target: 140, breakeven: 131, spotAtPost: 114.1, published: "2026-10-05" },
  FSLY: { debit: 1.8, stop: 21.5, target: 30, breakeven: 26.8, spotAtPost: 23.8, published: "2026-09-20" },
  V: { debit: 7.5, stop: 349, target: 410, breakeven: 387.5, spotAtPost: 366.5, published: "2026-09-29" },
};
for (const [ticker, want] of Object.entries(spotWant)) {
  const got = Object.fromEntries(Object.keys(want).map((key) => [key, spotBy[ticker]?.[key]]));
  assert(JSON.stringify(got) === JSON.stringify(want), `spotlight ${ticker} ticket ${JSON.stringify(got)}`);
}
assert(spotBy.V.closedAt === "2026-10-12" && outcomeLabel(spotBy.V) === "Banked +107%", "V banked +107% on Oct 12");
const fsly = spotBy.FSLY;
const fslyChart = spotlightLevels(fsly, JSON.parse(readFileSync(join(root, "public/data/flow/bars/FSLY.json"), "utf8")).bars);
assert(fsly.outcome === "expired" && outcomeLabel(fsly) === "Expired worthless", "FSLY expired worthless");
assert(fslyChart.expiry === "2026-10-16" && fsly.closedAt === fslyChart.expiry, `FSLY closes at the ${fslyChart.expiry} October OpEx`);
assert(/OpEx expired/.test(fsly.closeNote) && /worthless/.test(fsly.closeNote), `FSLY close note ${fsly.closeNote}`);
assert(fslyChart.closeBar.c < 25, `FSLY closed ${fslyChart.closeBar.c} at expiry, under the $25 strike`);
assert(JSON.stringify(spotlightLines(spotBy.FCX).map((line) => line.value)) === "[80,78.25,75,63]", "FCX chart lines run target $80 down to stop $63");
assert(JSON.stringify(spotlightLines(spotBy.XYZ).map((line) => line.value)) === "[90,85,78.5,75,70]", "XYZ chart lines run target $90, short $85, B/E, long $75, stop $70");
assert(JSON.stringify(spotlightLines(spotBy.V).map((line) => line.kind)) === '["target","breakeven","strike","stop"]', "V draws short/target, B/E, long strike, stop");
const spotPage = readFileSync(join(root, "options-flow/spotlights/index.html"), "utf8");
for (const id of ["spot-rows", "spot-card", "sc-rec", "sc-close-note", "sl-tiles", "sl-chart", "sl-legend"]) {
  assert(spotPage.includes(`id="${id}"`), `Spotlight page keeps #${id}`);
}
assert(spotPage.includes("Recommendation") && spotPage.includes("Trade levels"), "Spotlight card labels");
assert(!/is-sample/.test(spotPage) && !/is-sample/.test(hub.split('href="spotlights/"')[1].split("</a>")[0]), "Spotlight page and hub card are not labeled Sample");

const board = JSON.parse(readFileSync(join(root, "public/data/flow/scorecard.json"), "utf8"));
assert(board.names.length >= 5, `scorecard ranks ${board.names.length} names`);
board.names.forEach((name, index) => {
  const where = `scorecard ${name.ticker}`;
  assert(name.rank === index + 1, `${where} rank ${name.rank}`);
  assert(Math.abs(name.composite - (0.65 * name.flow + 0.35 * name.tech)) <= 0.5 + 1e-9, `${where} composite ${name.composite} vs 0.65F/0.35T`);
  if (index) assert(name.composite <= board.names[index - 1].composite, `${where} ranked by composite`);
  assert(name.chart.length >= 100 && name.chart.every((bar, i) => i === 0 || bar.date > name.chart[i - 1].date), `${where} six-month chart`);
  assert(name.candles.length >= 10, `${where} spark candles`);
  assert(name.desk_analysis && name.lead?.contract && name.net_premium, `${where} trade card header`);
  assert(name.trades?.length && name.trades.every((trade) => /^\d{4}-\d{2}-\d{2}$/.test(trade.date) && trade.text), `${where} trades carry dates`);
  assert(JSON.stringify(tradeDates(name)) === JSON.stringify([...tradeDates(name)].sort().reverse()), `${where} trade dates newest first`);
  assert(name.technicals?.ema8 && name.technicals?.ema21 && name.technicals?.sma200, `${where} technical lines`);
  const boxes = earningsBoxes(name.earnings);
  assert(boxes.length === 4 && boxes.filter((box) => box.kind === "past").length === 3 && boxes[3].kind === "next", `${where} 3 past + 1 upcoming ER boxes`);
  for (const key of ["iv", "oi_levels", "fundamental"]) assert(key in name, `${where} carries ${key} (null when there is no live pull)`);
  for (const key of ["panels", "spotlight_watch", "top_prints", "technicals_note", "tech_why"]) assert(!(key in name), `${where} still carries ${key}`);
  assert(!/desk [ab]\b/i.test(JSON.stringify(name)), `${where} still names Desk A/B`);
});
assert(!("spotlight_watch" in board), "scorecard has no Spotlight watch list");
const activeSet = activeSpotlights(spot);
assert(JSON.stringify([...activeSet]) === '["XYZ","GLD","FCX"]', `Active Spotlights ${[...activeSet]}`);
assert(spotlightStar("XYZ", activeSet).includes("sb-star") && spotlightStar("AAPL", activeSet) === "", "star only marks Active Spotlights");
const boardPage = readFileSync(join(root, "options-flow/scorecard/index.html"), "utf8");
assert(boardPage.includes('href="/src/styles.css"') && boardPage.includes('class="topbar"') && boardPage.includes('class="site-footer"'), "scorecard sits in the Positioning % shell");
assert(boardPage.includes('class="subnav"') && boardPage.includes('class="is-current" href="./" aria-current="page">Weekly scorecard'), "scorecard is the current Options Flow subpage");
assert(!boardPage.includes('id="sb-watch"'), "Spotlight watch section is gone");
for (const id of ["sb-meta", "week-of", "blend-note", "lookback", "sb-list", "gaps", "board-card", "trade-card", "bc-ticker", "bc-contract", "bc-stamp", "bc-analysis", "bc-chart", "bc-tiles", "flow-intel"]) {
  assert(boardPage.includes(`id="${id}"`), `scorecard page keeps #${id}`);
}
const boardScript = readFileSync(join(root, "src/scorecard.js"), "utf8");
for (const piece of ["renderSpark", "renderChips", "renderFlowIntel", "renderOiHorizon", "renderTradeCard", "spotlightStar", "drawLevelsChart", "data_gaps", "flow_lookback"]) {
  assert(boardScript.includes(piece), `scorecard keeps ${piece}`);
}
for (const file of ["options-flow/index.html", "options-flow/scorecard/index.html", "src/scorecard.js", "src/options-flow-hub.js"]) {
  const text = readFileSync(join(root, file), "utf8");
  assert(!/netlify|desk-flow-board/i.test(text), `${file} points off-site`);
  assert(!/http-equiv="refresh"|location\.(href|assign)\s*=|location\.replace\((?!`dollar\/)/.test(text), `${file} redirects away`);
}

const banned = [
  "sentiment ai",
  "wallstjesus",
  "jesus",
  "optionshawk",
  "hawk",
  "volland",
  "darkroom",
  "sentimentrader",
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
for (const level of ["extreme soft", "soft", "mid", "crowded"]) assert(page.includes(`level: "${level}"`), `sector bucket column ${level}`);
for (const source of ["jpm", "ms", "gs", "boa", "desk"]) {
  const sectors = buildReading(source, 7, 4).sectors;
  for (const ticker of CANON) {
    const sector = sectors[ticker];
    if (sector.available) assert(["extreme soft", "soft", "mid", "crowded"].includes(sector.level), `${source} ${ticker} level ${sector.level} has a bucket`);
  }
}

/* New Today: desk day is midnight CT through 11:59:59 PM CT the same calendar date, DST-aware. */
const deskDayCases = {
  "2026-10-27T23:59:59-05:00": "2026-10-27",
  "2026-10-28T00:00:00-05:00": "2026-10-28",
  "2026-10-28T04:05:00-05:00": "2026-10-28",
  "2026-10-29T04:05:00-05:00": "2026-10-29",
  "2026-10-28T23:59:59-05:00": "2026-10-28",
  "2026-10-29T00:00:00-05:00": "2026-10-29",
  "2026-10-28T23:03:00Z": "2026-10-28",
  "2026-11-01T00:00:00-05:00": "2026-11-01",
  "2026-11-01T04:30:00-06:00": "2026-11-01",
  "2026-11-02T00:00:00-06:00": "2026-11-02",
  "2026-03-08T05:59:59Z": "2026-03-07",
  "2026-03-08T06:00:00Z": "2026-03-08",
  "2026-03-08T09:05:00Z": "2026-03-08",
};
for (const [stamp, want] of Object.entries(deskDayCases)) assert(deskDay(stamp) === want, `desk day of ${stamp} ${deskDay(stamp)} !== ${want}`);
assert(deskDayStart("2026-10-28") === "2026-10-28T00:00:00-05:00", `desk day start CDT ${deskDayStart("2026-10-28")}`);
assert(deskDayStart("2026-11-01") === "2026-11-01T00:00:00-05:00", `desk day start fall-back midnight ${deskDayStart("2026-11-01")}`);
assert(deskDayStart("2026-11-02") === "2026-11-02T00:00:00-06:00", `desk day start CST ${deskDayStart("2026-11-02")}`);
assert(deskDayStart("2026-03-08") === "2026-03-08T00:00:00-06:00", `desk day start spring-forward midnight ${deskDayStart("2026-03-08")}`);
assert(deskDayStart("2026-03-09") === "2026-03-09T00:00:00-05:00", `desk day start after spring-forward ${deskDayStart("2026-03-09")}`);
const fallBack = deskWindow("2026-11-01");
assert(fallBack.end - fallBack.start === 25 * 3600000, "the Nov 1 fall-back desk day runs 25 hours");
const springForward = deskWindow("2026-03-08");
assert(springForward.end - springForward.start === 23 * 3600000, "the Mar 8 spring-forward desk day runs 23 hours");
assert(deskWindow("2026-10-28").end - deskWindow("2026-10-28").start === 24 * 3600000, "a normal desk day runs 24 hours");
assert(
  windowLabel("2026-10-29") === "Thu, Oct 29 · 12:00 AM CT → Thu, Oct 29 · 11:59 PM CT",
  `window label ${windowLabel("2026-10-29")}`,
);

const ntPage = readFileSync(join(root, "new-today/index.html"), "utf8");
const homePage = readFileSync(join(root, "index.html"), "utf8");
assert(ntPage.includes("12:00 AM through 11:59 PM"), "New Today lede describes the calendar desk day");
for (const [file, text] of [
  ["new-today/index.html", ntPage],
  ["index.html", homePage],
  ["src/new-today-chip.js", readFileSync(join(root, "src/new-today-chip.js"), "utf8")],
  ["README.md", readFileSync(join(root, "README.md"), "utf8")],
]) {
  assert(!/5:00 AM|4:59 AM|(^|[^0-9:])5 AM CT/.test(text), `${file} still describes the overnight desk-day cut`);
}
assert(viteConfig.includes('"new-today/index.html"'), "vite builds new-today/index.html");
assert(ntPage.includes('src="/src/new-today.js"') && ntPage.includes('id="nt-body"'), "New Today page runs new-today.js");
for (const section of NT_SECTIONS) assert(ntPage.includes(`href="#nt-${section.id}"`), `New Today subnav jumps to ${section.title}`);
assert(
  JSON.stringify(NT_SECTIONS.map((section) => section.title)) === '["Positioning","Options Flow","SPX Levels","Research desk"]',
  "New Today sections run Positioning, Options Flow, SPX Levels, Research desk",
);
assert(/<section class="hero">[\s\S]*?<div class="hero-row">[\s\S]*?class="lockup"[\s\S]*?<a class="nt-chip" href="new-today\/" data-new-today/.test(homePage), "home hero carries the New Today chip beside the wordmark");
assert(homePage.includes('src="/src/new-today-chip.js"'), "home runs new-today-chip.js");
assert(homePage.includes("Since 12 AM CT"), "home chip counts from midnight CT");

const nt = JSON.parse(readFileSync(join(root, "public/data/new-today.json"), "utf8"));
assert(nt.timeZone === "America/Chicago" && nt.dayStartsAt === "00:00", "new-today.json documents the Chicago midnight desk day");
assert(nt.dayStart === deskDayStart(deskDay(nt.dayStart)), `new-today.json dayStart ${nt.dayStart} is a midnight CT open`);
assert(Array.isArray(nt.items), "new-today.json items is a list");
const ntIds = new Set();
const ntSectionIds = new Set(NT_SECTIONS.map((section) => section.id));
for (const item of nt.items ?? []) {
  const where = `new-today ${item.id}`;
  assert(item.id && !ntIds.has(item.id), `${where} needs a unique id`);
  ntIds.add(item.id);
  assert(ntSectionIds.has(item.section), `${where} section ${item.section}`);
  assert(item.title && item.summary, `${where} needs a title and a one-line summary`);
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/.test(item.publishedAt ?? ""), `${where} publishedAt ${item.publishedAt} needs an ISO stamp with offset`);
  assert(SOURCE_LABELS.includes(item.sourceLabel), `${where} sourceLabel ${item.sourceLabel} is not a public label`);
  if (item.section !== "research") {
    assert(item.href && !/^(https?:)?\/\//.test(item.href) && !item.href.startsWith("/"), `${where} deep links inside the site`);
    const page = item.href.split("#")[0];
    assert(statSync(join(root, page, "index.html"), { throwIfNoEntry: false })?.isFile(), `${where} href ${item.href} lands on a missing page`);
  } else {
    assert(item.href || item.thumb, `${where} research row needs a link or a chart thumb`);
  }
  if (item.href && /^https?:/.test(item.href)) assert(/^https:\/\//.test(item.href), `${where} external link uses https`);
}
const ntNewest = [...(nt.items ?? [])].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))[0];
if (ntNewest) assert(deskDay(ntNewest.publishedAt) === deskDay(nt.dayStart), "new-today.json dayStart is the desk day of the newest item");
assert(itemsForDay(nt.items ?? [], "2026-10-28").length === 8, "Oct 28 desk day lists eight items");
const earlyThursday = (nt.items ?? []).filter((item) => item.publishedAt === "2026-10-29T04:05:00-05:00");
assert(earlyThursday.length === 5 && earlyThursday.every((item) => deskDay(item.publishedAt) === "2026-10-29"), "4:05 AM CT Thursday belongs to the Thursday desk day");
assert(itemsForDay(nt.items ?? [], "2026-10-29").length === 20, "Oct 29 desk day lists the afternoon session, the evening additions, and the pre-open research notes");
assert(itemsForDay(nt.items ?? [], "2026-10-30").length === 1, "Oct 30 desk day lists the morning research note");

const nav = /<nav class="nav" aria-label="Pages">[\s\S]*?<\/nav>/;
const deskPages = ["index.html", "positioning/index.html", "positioning/desk/index.html", "positioning/charts/index.html", "spx-levels/index.html", "options-flow/index.html", "options-flow/dollar/index.html", "options-flow/spotlights/index.html", "options-flow/scorecard/index.html", "new-today/index.html"];
const vaultSurface = {
  "vault/index.html": { desk: "../", vault: "./" },
  "vault/soft-crowded/index.html": { desk: "../../", vault: "../" },
};
const publicPages = [...deskPages, ...Object.keys(vaultSurface)];
for (const file of publicPages) {
  const html = readFileSync(join(root, file), "utf8");
  const order = [...(html.match(nav)?.[0] ?? "").matchAll(/>(Positioning|Options Flow|SPX Levels)</g)].map((m) => m[1]);
  assert(JSON.stringify(order) === '["Positioning","Options Flow","SPX Levels"]', `${file} nav order ${order}`);
}

const surfaceNav = /<nav class="surface" aria-label="Surface">([\s\S]*?)<\/nav>/;
for (const file of publicPages) {
  const html = readFileSync(join(root, file), "utf8");
  const topbar = html.match(/<header class="topbar">[\s\S]*?<\/header>/)?.[0] ?? "";
  const links = [...(topbar.match(surfaceNav)?.[1] ?? "").matchAll(/<a([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attrs, inner]) => ({
    label: inner.replace(/<[^>]*>/g, "").trim(),
    href: attrs.match(/href="([^"]*)"/)?.[1],
    current: /class="is-current"/.test(attrs) && /aria-current="(page|true)"/.test(attrs),
  }));
  const where = `${file} surface switcher`;
  assert(JSON.stringify(links.map((link) => link.label)) === '["Desk","Vault"]', `${where} reads Desk | Vault, got ${links.map((link) => link.label)}`);
  if (links.length !== 2) continue;
  const [desk, vault] = links;
  const vaultLinks = vaultSurface[file];
  assert(desk.current === !vaultLinks && vault.current === Boolean(vaultLinks), `${where} marks ${vaultLinks ? "Vault" : "Desk"} as current`);
  if (vaultLinks) {
    assert(desk.href === vaultLinks.desk && vault.href === vaultLinks.vault, `${where} Desk ${desk.href} Vault ${vault.href}`);
  } else {
    assert(desk.href === "./" || /^(\.\.\/)+$/.test(desk.href), `${where} Desk links home, got ${desk.href}`);
    assert(vault.href === `${desk.href === "./" ? "" : desk.href}vault/`, `${where} Vault links to /vault/, got ${vault.href}`);
  }
}
const home = readFileSync(join(root, "index.html"), "utf8");
assert(!home.includes('class="phase"'), "home topbar swaps the phase badge for the surface switcher");
for (const file of deskPages) {
  const footer = readFileSync(join(root, file), "utf8").match(/<footer class="site-footer">[\s\S]*?<\/footer>/)?.[0] ?? "";
  assert(footer.includes('<p class="foot-note">Desk · public reading.</p>'), `${file} footer reads Desk · public reading.`);
}

const vaultPage = readFileSync(join(root, "vault/index.html"), "utf8");
assert(viteConfig.includes('"vault/index.html"'), "vite builds vault/index.html");
assert(vaultPage.includes('<body class="is-vault">'), "Vault page carries the Vault theme");
assert(css.includes(".is-vault {"), "stylesheet scopes Vault theme tokens under .is-vault");
assert(deskPages.every((file) => !readFileSync(join(root, file), "utf8").includes("is-vault")), "Desk pages stay on the light theme");
assert(/<h1>Vault/.test(vaultPage), "Vault hero");
assert((vaultPage.match(/class="tile vault-tile"/g) ?? []).length === 3, "Vault shows three preview tiles");
assert(!/<a\s[^>]*class="tile vault-tile/.test(vaultPage), "Vault preview tiles do not link anywhere");
assert(!/checkout/i.test(vaultPage), "Vault has no checkout");
const vaultTopbar = vaultPage.match(/<header class="topbar">[\s\S]*?<\/header>/)?.[0] ?? "";
assert(!/on the desk|nav-tag/i.test(vaultTopbar), "Vault topbar drops the On the Desk label");
const vaultFooter = vaultPage.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)?.[0] ?? "";
assert(vaultFooter.includes('<p class="foot-note">Vault · by invitation.</p>'), "Vault footer reads Vault · by invitation.");
assert(!/opening later/i.test(vaultTopbar + vaultFooter), "Vault chrome no longer says opening later");


const monetization = /\b(free|paid|premium|subscri\w*|paywall\w*|upgrad\w*|trials?|pric(e|es|ed|ing)|members?hips?|unlock\w*)\b/i;
const chromeCopy = [
  ...["index.html", "positioning/index.html", "positioning/charts/index.html", "options-flow/index.html", "spx-levels/index.html", "new-today/index.html", "vault/index.html", "vault/soft-crowded/index.html", "404.html"].map((file) => [
    file,
    readFileSync(join(root, file), "utf8"),
  ]),
  ...deskPages.flatMap((file) => {
    const html = readFileSync(join(root, file), "utf8");
    return [
      [`${file} topbar`, html.match(/<header class="topbar">[\s\S]*?<\/header>/)?.[0] ?? ""],
      [`${file} footer`, html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)?.[0] ?? ""],
    ];
  }),
];
for (const [where, text] of chromeCopy) {
  const hit = text.match(monetization);
  assert(!hit, `${where} chrome says "${hit?.[0]}"`);
  assert(!text.replaceAll("$$$", "").includes("$"), `${where} chrome shows a $ outside the $$$ flow mark`);
  assert(!/\bphase\s*\d/i.test(text), `${where} chrome names a phase`);
}
const hubScript = readFileSync(join(root, "src/options-flow-hub.js"), "utf8").match(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g) ?? [];
const hubHit = hubScript.find((text) => monetization.test(text));
assert(!hubHit, `src/options-flow-hub.js UI copy says ${hubHit}`);

/* Vault wall: signed-out visitors get a sign-in card; Vault content only renders from an inert template. */
const vaultMain = vaultPage.match(/<main id="content">([\s\S]*?)<\/main>/)?.[1] ?? "";
const vaultTemplate = vaultMain.match(/<template id="vault-content">([\s\S]*?)<\/template>/)?.[1] ?? "";
const vaultOutside = vaultMain.replace(/<template id="vault-content">[\s\S]*?<\/template>/, "");
assert(vaultPage.includes('src="/src/vault-gate.js"'), "Vault page runs vault-gate.js");
assert(/<section class="vault-wall" id="vault-wall" data-state="checking"/.test(vaultOutside), "Vault wall renders by default, before the gate decides");
assert(/<h1 id="vault-wall-title">Sign in to open Vault<\/h1>/.test(vaultOutside), "Vault wall reads Sign in to open Vault");
assert(/<input id="wall-email"[^>]*type="email"/.test(vaultOutside), "Vault wall asks for an email");
assert(/<input id="wall-password"[^>]*type="password"/.test(vaultOutside), "Vault wall asks for a password");
assert(/<input id="wall-code"[^>]*autocomplete="one-time-code"/.test(vaultOutside), "Vault wall has a code field for the email check");
assert(
  /<button class="wall-create-button" id="wall-create" type="button" disabled aria-disabled="true">Create account <span class="badge is-soon">Coming soon<\/span><\/button>/.test(vaultOutside),
  "Vault wall shows Create account disabled as Coming soon",
);
assert(!/magic link|sign-in link|email me a link/i.test(vaultOutside), "Vault wall no longer offers email links");
assert(/<h1>Vault/.test(vaultTemplate) && (vaultTemplate.match(/class="tile vault-tile"/g) ?? []).length === 3, "Vault hero and tiles live in the template");
assert(vaultTemplate.includes('class="tile vault-pack" href="soft-crowded/"'), "signed-in Vault links to the Soft ↔ Crowded pack");
assert(!vaultOutside.includes("soft-crowded"), "the pack link stays inside the signed-in template");
assert(!/vault-hero|vault-tile|vault-desk|vault-pack/.test(vaultOutside), "no Vault content renders outside the template");
const gateSource = readFileSync(join(root, "src/vault-gate.js"), "utf8");
assert(gateSource.includes("import.meta.env.VITE_CLERK_PUBLISHABLE_KEY"), "Vault gate reads VITE_CLERK_PUBLISHABLE_KEY");
assert(gateSource.includes('import("@clerk/clerk-js")'), "Vault gate loads Clerk only on demand");
assert(!/setActive\(\{[^}]*redirectUrl/.test(gateSource), "setActive stays on this page");
assert(gateSource.includes('strategy: "password"'), "Vault signs in with email and password");
assert(gateSource.includes("isAllowlisted(email)"), "Vault checks the allowlist before calling Clerk");

/* Allowlist sign-in only: the wall never opens a sign-up, an email link, a transfer, or the waitlist. */
const signInSource = readFileSync(join(root, "src/vault-signin.js"), "utf8");
for (const [file, text] of [["src/vault-gate.js", gateSource], ["src/vault-signin.js", signInSource]]) {
  assert(!/signUp|sign_up|createEmailLinkFlow|email_link|transfer|joinWaitlist|redirectUrl/.test(text), `${file} reaches for sign-up, email links, or redirects`);
}
assert(VAULT_ALLOWLIST.includes("vannatrader@gmail.com"), "allowlist carries the CEO login");
assert(VAULT_ALLOWLIST.every((email) => email === email.trim().toLowerCase()), "allowlist entries are lowercase");
assert(isAllowlisted(" VannaTrader@Gmail.com "), "allowlist ignores case and spaces");
assert(!isAllowlisted("someone@example.com") && !isAllowlisted(""), "allowlist rejects other emails");

const done = nextStep({ status: "complete", createdSessionId: "sess_1" });
assert(done.action === "activate" && done.sessionId === "sess_1", "a complete sign-in activates its session");
const trust = nextStep({ status: "needs_client_trust", supportedSecondFactors: [{ strategy: "email_code", emailAddressId: "idn_1" }] });
assert(trust.action === "code" && trust.strategy === "email_code" && trust.emailAddressId === "idn_1", "a new-device check asks for the email code");
assert(nextStep({ status: "needs_second_factor", supportedSecondFactors: [{ strategy: "totp" }] }).strategy === "totp", "an authenticator second factor asks for its code");
assert(nextStep({ status: "needs_second_factor", supportedSecondFactors: [{ strategy: "phone_code" }] }).code === "second_factor", "an unsupported second factor is reported");
assert(nextStep({ status: "needs_new_password" }).action === "new_password", "a verified reset code asks for the new password");
assert(nextStep({ status: "complete", createdSessionId: null }).code === "incomplete", "complete without a session does not pretend to finish");
assert(/password did not match/.test(errorCopy({ errors: [{ code: "form_password_incorrect" }] })), "a wrong password reads in Desk copy");
assert(/no password yet/.test(errorCopy({ errors: [{ code: "strategy_for_user_invalid" }] })), "an account without a password points at Set or reset password");
assert(/not switched on/.test(errorCopy({ errors: [{ code: "form_param_value_invalid", meta: { paramName: "strategy" } }] })), "a disabled strategy reads in Desk copy");

const gateHit = [gateSource, signInSource, readFileSync(join(root, "src/vault-allowlist.js"), "utf8")]
  .flatMap((text) => text.match(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g) ?? [])
  .find((text) => monetization.test(text));
assert(!gateHit, `Vault gate UI copy says ${gateHit}`);
const envExample = readFileSync(join(root, ".env.example"), "utf8");
assert(/^VITE_CLERK_PUBLISHABLE_KEY=$/m.test(envExample), ".env.example documents an empty VITE_CLERK_PUBLISHABLE_KEY");
const ignored = readFileSync(join(root, ".gitignore"), "utf8");
assert(/^\.env$/m.test(ignored) && /^\.env\.\*$/m.test(ignored), ".gitignore keeps local env files out of git");
for (const file of [".env.example", "README.md", "src/vault-gate.js", "vault/index.html", ".github/workflows/pages.yml"]) {
  assert(!/\b(pk|sk)_(test|live)_[A-Za-z0-9]{8,}/.test(readFileSync(join(root, file), "utf8")), `${file} carries a Clerk key`);
}

const scrubbed = /\bsample\b|\beducation\b|not advice|illustrative|textbook|curriculum|\blessons?\b|\bdesk [ab]\b|get_equity_|spotlight watch/i;
for (const file of [...publicPages, "README.md", "public/data/flow/scorecard.json", "public/data/flow/plays.json", "public/data/flow/spotlights.json"]) {
  const hit = readFileSync(join(root, file), "utf8").match(scrubbed);
  assert(!hit, `${file} still says "${hit?.[0]}"`);
}
for (const name of readdirSync(join(root, "src"))) {
  if (extname(name) !== ".js") continue;
  const strings = readFileSync(join(root, "src", name), "utf8").match(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g) ?? [];
  const hit = strings.find((text) => scrubbed.test(text));
  assert(!hit, `src/${name} UI copy still says ${hit}`);
}
assert(page.includes("Soft") && page.includes("Crowded"), "cards render Soft and Crowded labels");
assert(!page.includes("linear-gradient(90deg, #3"), "no blue-green card fill");

/* Vault SKU1 slice 1: Soft ↔ Crowded pack stays behind the wall and off the Desk. */
assert(viteConfig.includes('"vault/soft-crowded/index.html"'), "vite builds vault/soft-crowded/index.html");
const packPage = readFileSync(join(root, "vault/soft-crowded/index.html"), "utf8");
assert(packPage.includes('<body class="is-vault">'), "pack page carries the Vault theme");
assert(packPage.includes('src="/src/vault-gate.js"') && packPage.includes('src="/src/vault-pack.js"'), "pack page runs the gate and the pack");
assert(/class="lockup" href="\.\.\/\.\.\/"/.test(packPage), "pack lockup links home");
const packMain = packPage.match(/<main id="content">([\s\S]*?)<\/main>/)?.[1] ?? "";
const packTemplate = packMain.match(/<template id="vault-content">([\s\S]*?)<\/template>/)?.[1] ?? "";
const packOutside = packMain.replace(/<template id="vault-content">[\s\S]*?<\/template>/, "");
assert(/<section class="vault-wall" id="vault-wall" data-state="checking"/.test(packOutside), "pack wall renders before the gate opens");
assert(/<h1 id="vault-wall-title">Sign in to open Vault<\/h1>/.test(packOutside), "pack wall reads Sign in to open Vault");
assert(
  packOutside.match(/<section class="vault-wall"[\s\S]*?<\/section>/)?.[0].replaceAll('href="../../"', 'href="../"') ===
    vaultOutside.match(/<section class="vault-wall"[\s\S]*?<\/section>/)?.[0],
  "pack wall is the same sign-in card as the Vault wall",
);
assert(packTemplate.includes('id="pack"') && packTemplate.includes('href="#read"') && packTemplate.includes('href="#sectors"') && packTemplate.includes('href="#charts"'), "pack shell lives in the template");
assert(!/id="pack"|pack-sheet|bucket-grid/.test(packOutside), "pack content does not render outside the template");
assert(readFileSync(join(root, "src/vault-gate.js"), "utf8").includes('new CustomEvent("vault-open")'), "gate tells the pack when Vault opens");
for (const file of [...deskPages, "404.html", "index.html"]) {
  assert(!readFileSync(join(root, file), "utf8").includes("soft-crowded"), `${file} links into the Vault pack`);
}
for (const name of readdirSync(join(root, "src"))) {
  if (extname(name) !== ".js" || name === "vault-pack.js") continue;
  assert(!readFileSync(join(root, "src", name), "utf8").includes("soft-crowded"), `src/${name} links into the Vault pack`);
}

const packDir = join(root, "public/data/vault/soft-crowded");
const packSchema = JSON.parse(readFileSync(join(packDir, "schema.json"), "utf8"));
const packIndex = JSON.parse(readFileSync(join(packDir, "index.json"), "utf8"));
const packWeek = JSON.parse(readFileSync(join(packDir, `${packIndex.latest}.json`), "utf8"));
assert(packSchema.$schema === "https://json-schema.org/draft/2020-12/schema", "pack schema is draft 2020-12");
for (const key of ["read", "buckets", "charts"]) assert(packSchema.properties[key], `pack schema defines ${key}`);
assert(packSchema.$defs.read.description?.includes("One-page read"), "schema names the one-page read");
assert(packSchema.properties.buckets.description?.includes("Soft"), "schema names the Soft ↔ Crowded buckets");
assert(packSchema.$defs.chartBatch.description?.includes("Batch-1"), "schema names the batch-1 chart refs");

function derefSchema(root, node) {
  if (!node || typeof node !== "object" || !node.$ref) return node;
  assert(node.$ref.startsWith("#/"), `schema ref ${node.$ref}`);
  return node.$ref.slice(2).split("/").reduce((cur, key) => cur?.[key], root);
}

function bannedSource(text) {
  const lower = String(text).toLowerCase();
  return banned.find((phrase) => lower.includes(phrase)) ?? "";
}

function validatePack(rootSchema, schema, data, path) {
  const node = derefSchema(rootSchema, schema);
  if (!node) {
    assert(false, `${path} missing schema`);
    return;
  }
  if (Object.prototype.hasOwnProperty.call(node, "const")) {
    assert(data === node.const, `${path} ${JSON.stringify(data)} !== ${JSON.stringify(node.const)}`);
  }
  if (node.enum) assert(node.enum.includes(data), `${path} ${JSON.stringify(data)} is not in ${node.enum}`);
  if (node.type === "object") {
    assert(data && typeof data === "object" && !Array.isArray(data), `${path} should be an object`);
    if (!data || typeof data !== "object" || Array.isArray(data)) return;
    for (const key of node.required ?? []) assert(key in data, `${path} missing ${key}`);
    if (node.additionalProperties === false) {
      for (const key of Object.keys(data)) assert(key in (node.properties ?? {}), `${path} unexpected ${key}`);
    }
    for (const [key, prop] of Object.entries(node.properties ?? {})) {
      if (key in data) validatePack(rootSchema, prop, data[key], `${path}.${key}`);
    }
    return;
  }
  if (node.type === "array") {
    assert(Array.isArray(data), `${path} should be an array`);
    if (!Array.isArray(data)) return;
    if (typeof node.minItems === "number") assert(data.length >= node.minItems, `${path} has ${data.length} items`);
    if (typeof node.maxItems === "number") assert(data.length <= node.maxItems, `${path} has ${data.length} items`);
    if (node.items) data.forEach((item, index) => validatePack(rootSchema, node.items, item, `${path}[${index}]`));
    return;
  }
  if (node.type === "string") {
    assert(typeof data === "string", `${path} should be a string`);
    if (typeof data !== "string") return;
    if (typeof node.minLength === "number") assert(data.length >= node.minLength, `${path} is empty`);
    if (typeof node.maxLength === "number") assert(data.length <= node.maxLength, `${path} is longer than ${node.maxLength}`);
    if (node.pattern) assert(new RegExp(node.pattern).test(data), `${path} "${data}" misses ${node.pattern}`);
    if (typeof node.minWords === "number" || typeof node.maxWords === "number") {
      const count = data.trim().split(/\s+/).filter(Boolean).length;
      if (typeof node.minWords === "number") assert(count >= node.minWords, `${path} has ${count} words, minimum ${node.minWords}`);
      if (typeof node.maxWords === "number") assert(count <= node.maxWords, `${path} has ${count} words, maximum ${node.maxWords}`);
    }
    if (node["x-banned-sources"] === true) {
      const hit = bannedSource(data);
      assert(!hit, `${path} contains forbidden phrase "${hit}"`);
    }
    return;
  }
  if (node.type === "integer") {
    assert(Number.isInteger(data), `${path} ${data} should be an integer`);
    if (!Number.isInteger(data)) return;
    if (typeof node.minimum === "number") assert(data >= node.minimum, `${path} ${data} below ${node.minimum}`);
    if (typeof node.maximum === "number") assert(data <= node.maximum, `${path} ${data} above ${node.maximum}`);
  }
}

validatePack(packSchema, packSchema, packWeek, "week");
assert(bannedSource("a Hawk chart") === "hawk", "banned-source scan rejects Hawk");
assert(bannedSource("Volland levels") === "volland", "banned-source scan rejects Volland");
assert(bannedSource("Darkroom note") === "darkroom", "banned-source scan rejects Darkroom");
assert(bannedSource("OptionsHawk print") === "optionshawk", "banned-source scan rejects OptionsHawk");
assert(bannedSource("JPM BoA GS Desk") === "", "banned-source scan allows bank labels");
function expectPackReject(mutate, message) {
  const before = failed;
  const errors = [];
  const report = console.error;
  console.error = (...args) => errors.push(args.join(" "));
  try {
    const probe = structuredClone(packWeek);
    mutate(probe);
    validatePack(packSchema, packSchema, probe, "probe");
  } finally {
    console.error = report;
    failed = before;
  }
  assert(errors.length > 0, message);
}
expectPackReject((probe) => {
  probe.charts.refs[0].article.bodyMarkdown = `${probe.charts.refs[0].article.bodyMarkdown} Hawk`;
}, "schema validation rejects a banned source name in an article");
expectPackReject((probe) => {
  probe.charts.refs[0].article.headline = "one two three four five six seven eight nine ten eleven twelve thirteen";
}, "schema validation rejects a headline over 12 words");
assert(packIndex.sku === "soft-crowded" && packIndex.product === "SKU1" && packIndex.schema === "schema.json", "pack index names the schema");
assert(packIndex.title === "Soft ↔ Crowded", `pack index title ${packIndex.title}`);
assert(packIndex.latest === WEEKS[WEEKS.length - 1], `pack latest ${packIndex.latest} should be the Desk's current week`);
assert(packWeek.$schema === "./schema.json", "week document points at the schema");

const packAt = WEEKS.length - 1;
const packReading = buildReading("jpm", packAt, 4);
const packChart = sectorChart("jpm", packAt);
const packFacts = chartFacts(packAt);
assert(packWeek.week === packReading.weekIso && packWeek.weekLabel === packReading.weekLabel, "pack week label matches the Desk");
assert(packWeek.house === "jpm" && packWeek.houseLabel === "JPM" && packWeek.windowWeeks === 4, "pack is the JPM 4-week read");
assert(packWeek.basis === packChart.basis, `pack basis ${packWeek.basis}`);
assert(packWeek.sectorSource === packReading.sectorSource, `pack sector source ${packWeek.sectorSource}`);
assert(
  JSON.stringify(packWeek.buckets.map((bucket) => [bucket.level, bucket.title, bucket.range, bucket.tone])) ===
    JSON.stringify(SECTOR_BUCKETS.map((bucket) => [bucket.level, bucket.title, bucket.range, bucket.tone])),
  "pack buckets follow the Desk Soft ↔ Crowded columns",
);
const seenTickers = [];
for (const bucket of packWeek.buckets) {
  const want = CANON.filter((ticker) => packReading.sectors[ticker].available && packReading.sectors[ticker].level === bucket.level)
    .map((ticker) => packReading.sectors[ticker])
    .sort((a, b) => a.points - b.points || a.ticker.localeCompare(b.ticker));
  assert(bucket.sectors.length === want.length, `${bucket.level} has ${bucket.sectors.length} sectors, Desk has ${want.length}`);
  bucket.sectors.forEach((sector, index) => {
    const desk = want[index];
    seenTickers.push(sector.ticker);
    for (const key of ["ticker", "short", "name", "points", "display", "ile", "pill", "caption", "wowText", "regime", "level"]) {
      assert(sector[key] === desk[key], `${sector.ticker} ${key} ${sector[key]} !== ${desk[key]}`);
    }
  });
}
const missing = CANON.filter((ticker) => !packReading.sectors[ticker].available);
assert(
  JSON.stringify(packWeek.unprinted) ===
    JSON.stringify(missing.map((ticker) => {
      const sector = packReading.sectors[ticker];
      return { ticker, short: sector.short, name: sector.name, note: sector.unavailable };
    })),
  `pack unprinted ${JSON.stringify(packWeek.unprinted)}`,
);
assert(new Set(seenTickers).size === seenTickers.length, "a sector appears in two buckets");
assert(JSON.stringify([...seenTickers].sort()) === JSON.stringify(CANON.filter((ticker) => !missing.includes(ticker)).sort()), "pack covers every printed sector");
const prior = buildReading("jpm", packAt - 1, 4);
for (const ticker of CANON) {
  const now = packReading.sectors[ticker];
  const then = prior.sectors[ticker];
  if (!now.available || !then.available) continue;
  assert(now.level === then.level, `${ticker} changed columns since last week (${then.level} → ${now.level})`);
}
assert(/No sector changed columns versus last week/.test(packWeek.read.stance), "one-page read records that columns were unchanged");
for (const phrase of ["0.18", "0.75", "0.69", "0.66", "−1.2", "351", "3.9", "53%"]) {
  assert(JSON.stringify(packWeek.read).includes(phrase), `one-page read names ${phrase}`);
}
const articleSchema = packSchema.$defs.article;
assert(articleSchema?.description?.includes("week read stays the overview"), "per-chart articles leave the week read as the overview");
assert(articleSchema?.description?.includes("article"), "pack schema defines a per-chart article");
assert(
  JSON.stringify(articleSchema?.required) === JSON.stringify(["headline", "bodyMarkdown", "bias", "dumbMoney", "smartMoney", "invalidation"]),
  "article requires headline, body, bias, cohorts, and invalidation",
);
assert(
  JSON.stringify(articleSchema?.properties?.bias?.enum) === JSON.stringify(["long", "short", "neutral", "fade-long", "fade-short"]),
  "article bias enum",
);
assert(articleSchema?.properties?.headline?.maxWords === 12, "article headline is at most 12 words");
assert(articleSchema?.properties?.bodyMarkdown?.minWords === 120 && articleSchema?.properties?.bodyMarkdown?.maxWords === 220, "article body is 120 to 220 words");
for (const key of ["headline", "bodyMarkdown", "dumbMoney", "smartMoney", "invalidation"]) {
  assert(articleSchema?.properties?.[key]?.["x-banned-sources"] === true, `article ${key} rejects banned source names`);
}
assert(packSchema.$defs.chartRef.required.includes("article"), "each chart ref requires an article");
assert(packSchema.$defs.read.description?.includes("One-page read"), "one-page read stays the week overview");
assert(packWeek.charts.batch === 1, "chart refs are batch 1");
assert(
  JSON.stringify(packWeek.charts.refs.map((ref) => ref.id)) === JSON.stringify(CHART_IDS),
  `pack chart refs ${packWeek.charts.refs.map((ref) => ref.id)}`,
);
packWeek.charts.refs.forEach((ref, index) => {
  const chart = CHARTS[index];
  assert(ref.id === chart.id && ref.nav === chart.nav && ref.title === chart.title, `chart ref ${ref.id} drifted from batch 1`);
  assert(ref.house === chart.house && ref.houseLabel === HOUSES[chart.house] && ref.deskSection === chart.deskSection, `chart ref ${ref.id} house or section`);
  assert(ref.fact === packFacts[ref.id], `chart ref ${ref.id} fact ${ref.fact} !== ${packFacts[ref.id]}`);
  const article = ref.article;
  const body = article.bodyMarkdown;
  for (const [label, pattern] of [
    ["hedge funds", /hedge funds?/i],
    ["macro funds", /macro funds?/i],
    ["mutual funds", /mutual funds?/i],
    ["CTAs", /\bCTAs?\b/],
    ["dealers", /dealers?/i],
    ["sharpies", /sharpies?/i],
    ["commercials", /commercials?/i],
  ]) {
    assert(pattern.test(body), `${ref.id} article names ${label}`);
  }
  assert(/smart money is positioned against/i.test(body), `${ref.id} article sets smart money against the crowded book`);
  assert(
    /hedge funds?/i.test(article.dumbMoney) && /macro funds?/i.test(article.dumbMoney) && /mutual funds?/i.test(article.dumbMoney) && /\bCTAs?\b/.test(article.dumbMoney),
    `${ref.id} dumbMoney names the dumb-money cohort`,
  );
  assert(/(dealers?|sharpies?)/i.test(article.smartMoney) && /commercials?/i.test(article.smartMoney), `${ref.id} smartMoney names the smart-money cohort`);
  if (article.bias === "fade-long" || article.bias === "fade-short") {
    assert(/\b(fade|pullback|bounce|cover)\b/i.test(body), `${ref.id} fade bias is written into the article`);
  }
});
const packJs = readFileSync(join(root, "src/vault-pack.js"), "utf8");
assert(packJs.includes("data/vault/soft-crowded/"), "pack page loads the week document");
for (const piece of ["bodyMarkdown", "dumbMoney", "smartMoney", "invalidation", "article.headline", "fade-long", "pack-article"]) {
  assert(packJs.includes(piece), `pack page renders ${piece}`);
}
assert(css.includes("#pack .pack-article") && css.includes("@media print") && css.includes("break-inside: avoid"), "pack articles keep a print stylesheet");

if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log("site checks ok");
