import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HOUSES, INDICATORS, SECTIONS, readIndicator } from "../src/desk.js";
import { CANON, JPM_MONITOR_REF, WEEKS, buildReading, formatWeek, ordinal } from "../src/readings.js";
import { STRUCTURES, creditSpreadMath, leapMath, price } from "../src/study.js";
import { breakeven, chartLevels, resolveExpiry } from "../src/flow-chart.js";
import { SIDES, alertLabel, sortPlays } from "../src/options-flow.js";
import { SECTION_ORDER, STATUS, allPlays, levelKind, outcomeLabel, sortCards, spotlightLevels, spotlightLines } from "../src/spotlights.js";
import { activeSpotlights, earningsBoxes, spotlightStar, tradeDates } from "../src/scorecard.js";
import { VAULT_ALLOWLIST, isAllowlisted } from "../src/vault-allowlist.js";
import { FAMILY_ALLOWLIST, FAMILY_ENTRY } from "../src/family-allowlist.js";
import { PRODUCT_FEEDS } from "../src/product-feeds.js";
import { errorCopy, nextStep } from "../src/vault-signin.js";
import { NT_SECTIONS, PUBLIC_NT_SECTIONS, SOURCE_LABELS, deskDay, deskDayStart, deskWindow, itemsForDay, publicDeskItems, windowLabel } from "../src/new-today-window.js";
import { BUY_LINE, DEFAULT_MONTHS, MAX_MONTHS, RANGES, averageCrosses, averageOf, breadthRead, dayChange, monthsBack, sma as breadthSma, windowStart as breadthWindowStart } from "../src/breadth.js";
import { CSR_PARAMS, biasOf, csrPanel, csrSeries, cycleOf, panelText, regimeOf as csrRegimeOf, zColor } from "../src/csr.js";
import { DEFAULTS as MAG7_DEFAULTS, MAG7, TYPES as MAG7_TYPES, buildOscillator, fmtPct, momentum, panelAt, rangeStart, regimeOf, sma } from "../src/mag7-osc.js";
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
  shortWeek,
  softVolChart,
} from "../src/pct-charts.js";
import { columnMoves, isoWeek, isoWeekRange, packFrame } from "../src/vault-pack-frame.js";
import { FORMULA, axisTicks, buildClose, closeEvent, closeRows, closeSpxPct, deskEstimate, formatSvb, gaugeFraction, readout, spotVolTip } from "../src/vault-svb.js";
import { archiveGroups, deskWeekEntries, displaySource, filterEntries, longDay, newTodayDays, parseDateQuery } from "../src/vault-archive.js";
import { bookSide, closedPnl, deskCopy, equityPath, formatBook, formatPx, formatUsd, isOpen, isPending, markOf, resultLabel, stopOf, targetOf, weekStrip } from "../src/vault-portfolio.js";

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
const hubMain = hub.match(/<main id="content">([\s\S]*?)<\/main>/)?.[1] ?? "";
const hubTemplate = hubMain.match(/<template id="vault-content">([\s\S]*?)<\/template>/)?.[1] ?? "";
const hubOutside = hubMain.replace(/<template id="vault-content">[\s\S]*?<\/template>/, "");
const hubLinks = [...hubTemplate.matchAll(/<a class="tile hub-tile[^"]*" href="([^"]+)"/g)].map((match) => match[1]);
assert(JSON.stringify(hubLinks) === JSON.stringify(["dollar/", "spotlights/", "scorecard/"]), `Vault Options Flow hub links ${hubLinks}`);
assert(!hubTemplate.includes('<article class="tile hub-tile">'), "Shopping List and Spotlights are real links, not dead articles");
assert(hub.includes('src="/src/vault-gate.js"') && hub.includes('<body class="is-vault">'), "Options Flow hub is behind the Vault gate");
assert(!hubOutside.includes('href="dollar/"') && !hubOutside.includes('href="spotlights/"'), "Options Flow cards stay inside the Vault template");
assert(!hub.includes('id="flow-list"'), "hub shows calling cards, not the $$$ table");
const dollarPage = readFileSync(join(root, "options-flow/dollar/index.html"), "utf8");
const dollarTemplate = dollarPage.match(/<template id="vault-content">([\s\S]*?)<\/template>/)?.[1] ?? "";
const dollarOutside = dollarPage.replace(/<template id="vault-content">[\s\S]*?<\/template>/, "");
assert(dollarPage.includes('src="/src/vault-gate.js"') && dollarPage.includes('src="/src/options-flow.js"'), "$$$ Shopping List page runs the Vault gate and options-flow.js");
assert(dollarPage.includes('addEventListener("vault-open"') || readFileSync(join(root, "src/options-flow.js"), "utf8").includes('addEventListener("vault-open"'), "Shopping List boots after the Vault opens");
assert(/<section class="vault-wall" id="vault-wall" data-state="checking"/.test(dollarOutside), "$$$ Shopping List shows the Vault sign-in wall by default");
assert(!dollarOutside.includes("Sign in for Insight") && !dollarPage.includes("family-content"), "$$$ Shopping List is no longer a family Coming soon wall");
for (const id of ["flow-list", "calling-card", "cc-buy-block", "cc-oi-block", "cc-rec", "tl-tiles", "cc-chart"]) {
  assert(dollarTemplate.includes(`id="${id}"`), `$$$ Shopping List template keeps #${id}`);
}
assert(!dollarOutside.includes('id="flow-list"'), "$$$ Shopping List content stays inside the Vault template");
const viteConfig = readFileSync(join(root, "vite.config.js"), "utf8");
const viteInputs = [...viteConfig.matchAll(/resolve\(root, "([^"]+)"\)/g)].map((match) => match[1]);
assert(viteInputs.length > 0, "vite config lists HTML inputs");
for (const page of viteInputs) {
  const path = join(root, page);
  assert(page.endsWith(".html"), `vite input ${page} is an HTML file path`);
  assert(statSync(path).isFile(), `vite input ${page} is a file, not a directory`);
  assert(!/<link\b[^>]*href="(?:\.\.\/)+"/i.test(readFileSync(path, "utf8")), `${page} does not point a link tag at a directory`);
}
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
const spotTemplate = spotPage.match(/<template id="vault-content">([\s\S]*?)<\/template>/)?.[1] ?? "";
const spotOutside = spotPage.replace(/<template id="vault-content">[\s\S]*?<\/template>/, "");
assert(spotPage.includes('src="/src/vault-gate.js"') && spotPage.includes('src="/src/spotlights.js"'), "Spotlight page runs the Vault gate and spotlights.js");
assert(/<section class="vault-wall" id="vault-wall" data-state="checking"/.test(spotOutside), "Spotlight page shows the Vault sign-in wall by default");
assert(!spotOutside.includes("Sign in for Insight") && !spotPage.includes("family-content"), "Spotlight page is no longer a family Coming soon wall");
for (const id of ["spot-rows", "spot-card", "sc-rec", "sc-close-note", "sl-tiles", "sl-chart", "sl-legend"]) {
  assert(spotTemplate.includes(`id="${id}"`), `Spotlight template keeps #${id}`);
}
assert(spotTemplate.includes("Recommendation") && spotTemplate.includes("Trade levels"), "Spotlight card labels");
assert(!/is-sample/.test(spotPage), "Spotlight page is not labeled Sample");
assert(!spotOutside.includes('id="spot-rows"'), "Spotlight content stays inside the family template");

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
  "edgetools",
  "tradingview",
  "stockcharts",
];
const scanExt = new Set([".html", ".js", ".css", ".md", ".yml", ".svg", ".json"]);
/* The mock book is scrubbed. Nothing in the repo is exempt from the source-name scan. */
const bannedAllow = new Set();

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
    if (bannedAllow.has(path)) continue;
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
  ["README.md", readFileSync(join(root, "README.md"), "utf8")],
]) {
  assert(!/5:00 AM|4:59 AM|(^|[^0-9:])5 AM CT/.test(text), `${file} still describes the overnight desk-day cut`);
}
assert(viteConfig.includes('"new-today/index.html"'), "vite builds new-today/index.html");
assert(ntPage.includes('src="/src/new-today.js"') && ntPage.includes('id="nt-body"'), "New Today page runs new-today.js");
for (const section of PUBLIC_NT_SECTIONS) assert(ntPage.includes(`href="#nt-${section.id}"`), `New Today subnav jumps to ${section.title}`);
assert(!ntPage.includes('href="#nt-options-flow"'), "public New Today does not jump into Options Flow");
assert(ntPage.includes('data-surface="public"') && ntPage.includes('id="nt-fresh"'), "New Today stamps the feed and stays on the public surface");
assert(readFileSync(join(root, "src/new-today.js"), "utf8").includes("Feed updated"), "New Today copy names when the feed was updated");
assert(
  JSON.stringify(NT_SECTIONS.map((section) => section.title)) === '["Positioning","Options Flow","SPX Levels","Research desk"]',
  "New Today sections run Positioning, Options Flow, SPX Levels, Research desk",
);
assert(JSON.stringify(PUBLIC_NT_SECTIONS.map((section) => section.id)) === '["positioning","spx","research"]', "public New Today drops Options Flow");
assert(publicDeskItems([{ section: "options-flow" }, { section: "positioning" }]).length === 1, "public desk items keep Positioning and drop Options Flow");
assert(homePage.includes('class="nt-chip"') && homePage.includes('data-public="1"'), "Dashboard home shows the public New Today chip");
for (const id of ["spot-vol-beta", "credit-spread-regime", "mag7", "nysi", "nasi"]) {
  assert(homePage.includes(`id="${id}"`), `Dashboard shows the ${id} wall widget`);
}
assert(homePage.includes('src="/src/vault-wall.js"') && homePage.includes('src="/src/vault-breadth.js"'), "Dashboard runs the wall widgets");
for (const banned of ["options-flow/", "portfolio/", "spx-levels/", "insight/", "vol-credit-momentum"]) {
  assert(!homePage.includes(banned), `Dashboard home does not link ${banned}`);
}

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
const dashboardPages = ["index.html", "positioning/index.html", "positioning/desk/index.html", "positioning/charts/index.html", "positioning/ideas/index.html", "vol/index.html", "spx-levels/index.html", "new-today/index.html"];
const vaultSurface = {
  "vault/index.html": { dashboard: "../", vault: "./" },
  "vault/soft-crowded/index.html": { dashboard: "../../", vault: "../" },
  "vault/vol-credit-momentum/index.html": { dashboard: "../../", vault: "../" },
  "vault/portfolio/index.html": { dashboard: "../../", vault: "../" },
  "vault/archive/index.html": { dashboard: "../../", vault: "../" },
};
const flowSurface = {
  "options-flow/index.html": { dashboard: "../", vault: "../vault/" },
  "options-flow/dollar/index.html": { dashboard: "../../", vault: "../../vault/" },
  "options-flow/spotlights/index.html": { dashboard: "../../", vault: "../../vault/" },
  "options-flow/scorecard/index.html": { dashboard: "../../", vault: "../../vault/" },
};
const publicPages = [...dashboardPages, ...Object.keys(vaultSurface), ...Object.keys(flowSurface), "coming-soon/index.html"];
for (const file of publicPages) {
  const html = readFileSync(join(root, file), "utf8");
  const order = [...(html.match(nav)?.[0] ?? "").matchAll(/>(Positioning|Options Flow|Desk wall|New Today|Portfolio)</g)].map((m) => m[1]);
  const expectedPublic = '["Positioning","Desk wall","New Today"]';
  const expectedVault = '["Positioning","Options Flow","Portfolio","Desk wall"]';
  const expected = file.startsWith("vault/") || file.startsWith("options-flow/") || file.startsWith("coming-soon/") ? expectedVault : expectedPublic;
  assert(JSON.stringify(order) === expected, `${file} nav order ${order}, expected ${expected}`);
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
  assert(JSON.stringify(links.map((link) => link.label)) === '["Dashboard","Vault"]', `${where} reads Dashboard | Vault, got ${links.map((link) => link.label)}`);
  assert(!/insight/i.test(links.map((link) => link.label).join(" ")), `${where} does not name Insight`);
  if (links.length !== 2) continue;
  const [dashboard, vault] = links;
  const vaultLinks = vaultSurface[file] || flowSurface[file];
  const isVault = Boolean(vaultLinks) || file.startsWith("coming-soon/");
  assert(dashboard.current === !isVault && vault.current === isVault, `${where} marks ${isVault ? "Vault" : "Dashboard"} as current`);
  if (vaultSurface[file] || flowSurface[file]) {
    assert(dashboard.href === vaultLinks.dashboard && vault.href === vaultLinks.vault, `${where} Dashboard ${dashboard.href} Vault ${vault.href}`);
  } else {
    assert(dashboard.href === "./" || /^(\.\.\/)+$/.test(dashboard.href), `${where} Dashboard links home, got ${dashboard.href}`);
    assert(vault.href === `${dashboard.href === "./" ? "" : dashboard.href}vault/`, `${where} Vault links to /vault/, got ${vault.href}`);
  }
}
const home = readFileSync(join(root, "index.html"), "utf8");
assert(!home.includes('class="phase"'), "home topbar swaps the phase badge for the surface switcher");
for (const file of dashboardPages) {
  const footer = readFileSync(join(root, file), "utf8").match(/<footer class="site-footer">[\s\S]*?<\/footer>/)?.[0] ?? "";
  assert(footer.includes('<p class="foot-note">Dashboard · public reading.</p>'), `${file} footer reads Dashboard · public reading.`);
}

const vaultPage = readFileSync(join(root, "vault/index.html"), "utf8");
assert(viteConfig.includes('"vault/index.html"'), "vite builds vault/index.html");
assert(vaultPage.includes('<body class="is-vault">'), "Vault page carries the Vault theme");
assert(css.includes(".is-vault {"), "stylesheet scopes Vault theme tokens under .is-vault");
assert(dashboardPages.every((file) => !readFileSync(join(root, file), "utf8").includes("is-vault")), "Dashboard pages stay on the light theme");
assert(/<h1>Vault/.test(vaultPage), "Vault hero");
assert((vaultPage.match(/class="tile vault-tile"/g) ?? []).length === 3, "Vault shows three preview tiles");
for (const href of ["../coming-soon/#live-pulls", "../coming-soon/#alerts", "../coming-soon/#sizing"]) {
  assert(vaultPage.includes(`class="tile vault-tile" href="${href}"`), `Vault preview tile links to ${href}`);
}
assert(viteConfig.includes('"coming-soon/index.html"'), "vite builds the coming-soon notes");
assert(!/checkout/i.test(vaultPage), "Vault has no checkout");
const vaultTopbar = vaultPage.match(/<header class="topbar">[\s\S]*?<\/header>/)?.[0] ?? "";
assert(!/on the desk|nav-tag/i.test(vaultTopbar), "Vault topbar drops the On the Desk label");
const vaultFooter = vaultPage.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)?.[0] ?? "";
assert(vaultFooter.includes('<p class="foot-note">Vault · by invitation.</p>'), "Vault footer reads Vault · by invitation.");
assert(!/opening later/i.test(vaultTopbar + vaultFooter), "Vault chrome no longer says opening later");


const monetization = /\b(free|paid|premium|subscri\w*|paywall\w*|upgrad\w*|trials?|pric(e|es|ed|ing)|members?hips?|unlock\w*)\b/i;
const chromeCopy = [
  ...["index.html", "positioning/index.html", "positioning/charts/index.html", "options-flow/index.html", "spx-levels/index.html", "new-today/index.html", "vault/index.html", "vault/soft-crowded/index.html", "vault/vol-credit-momentum/index.html", "vault/portfolio/index.html", "vault/archive/index.html", "insight/index.html", "404.html", `${FAMILY_ENTRY}/index.html`, `${FAMILY_ENTRY}/options-flow/index.html`, `${FAMILY_ENTRY}/new-today/index.html`].map((file) => [
    file,
    readFileSync(join(root, file), "utf8"),
  ]),
  ...dashboardPages.flatMap((file) => {
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
assert(vaultTemplate.includes('href="../options-flow/"') && vaultTemplate.includes(">Portfolio</h2>"), "signed-in Vault links Options Flow and Portfolio");
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
assert(VAULT_ALLOWLIST.includes("vannatrader@gmail.com"), "vault allowlist carries the CEO login");
assert(FAMILY_ALLOWLIST.includes("vannatrader@gmail.com"), "family allowlist carries the CEO login so the Hub can be opened");
assert(FAMILY_ALLOWLIST.every((email) => email === email.trim().toLowerCase()), "family allowlist entries are lowercase");
assert(isAllowlisted(" VannaTrader@Gmail.com ", FAMILY_ALLOWLIST), "family allowlist ignores case and spaces");
assert(VAULT_ALLOWLIST.every((email) => email === email.trim().toLowerCase()), "vault allowlist entries are lowercase");
assert(isAllowlisted(" VannaTrader@Gmail.com "), "vault allowlist ignores case and spaces");
assert(!isAllowlisted("someone@example.com") && !isAllowlisted(""), "vault allowlist rejects other emails");
assert(existsSync(join(root, "src/family-allowlist.js")) && existsSync(join(root, "src/hub-gate.js")), "Hub keeps its own allowlist and gate");

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

/* Insight is not a tab. The old URL returns to the public Dashboard and does not name the private entry. */
const insightPage = readFileSync(join(root, "insight/index.html"), "utf8");
assert(viteConfig.includes('"insight/index.html"'), "vite builds insight/index.html");
assert(insightPage.includes('http-equiv="refresh"') && insightPage.includes("url=%BASE_URL%"), "Insight refreshes to the Dashboard");
assert(insightPage.includes('location.replace("%BASE_URL%")') && insightPage.includes('href="%BASE_URL%"'), "Insight link returns to the Dashboard");
assert(!/<link[^>]+href="\.\.\/"/.test(insightPage), "Insight canonical link is not a directory path");
assert(!insightPage.includes(FAMILY_ENTRY) && !insightPage.includes("hub/"), "Insight does not reveal the private entry");
assert(!insightPage.includes('aria-label="Surface"'), "Insight redirect does not carry the Positioning % switcher");
assert(!existsSync(join(root, "src/insight-gate.js")) && !existsSync(join(root, "src/family-content-gate.js")), "the old Insight gate is gone");
assert(!/href="(?:\.\.\/)*insight\//.test([...publicPages, "insight/index.html"].map((file) => readFileSync(join(root, file), "utf8")).join("\n")), "no page links back to Insight");
assert(!readFileSync(join(root, "README.md"), "utf8").includes(FAMILY_ENTRY), "the public README does not name the private entry");
for (const file of publicPages) {
  const html = readFileSync(join(root, file), "utf8");
  assert(!html.includes(`${FAMILY_ENTRY}/`) && !html.includes("hub/"), `${file} does not link the private entry`);
}

const privatePages = [
  `${FAMILY_ENTRY}/index.html`,
  `${FAMILY_ENTRY}/options-flow/index.html`,
  `${FAMILY_ENTRY}/options-flow/dollar/index.html`,
  `${FAMILY_ENTRY}/options-flow/spotlights/index.html`,
  `${FAMILY_ENTRY}/options-flow/scorecard/index.html`,
  `${FAMILY_ENTRY}/new-today/index.html`,
];
for (const file of privatePages) {
  assert(viteConfig.includes(`"${file}"`), `vite builds ${file}`);
  const html = readFileSync(join(root, file), "utf8");
  const outside = html.replace(/<template id="vault-content">[\s\S]*<\/template>/, "");
  assert(html.includes('name="robots" content="noindex, nofollow"'), `${file} asks crawlers not to index`);
  assert(outside.includes(">Coming soon</h1>") && outside.includes("Nothing on this page yet."), `${file} signed-out wall is generic`);
  assert(!/family|the Hub|>Hub</i.test(outside), `${file} signed-out wall does not market a private desk`);
  assert(!outside.includes("<header") && !outside.includes('aria-label="Surface"'), `${file} keeps product chrome behind the wall`);
  assert(!html.includes("portfolio/"), `${file} does not open the book`);
  const order = [...(html.match(/<nav class="nav" aria-label="Departments">[\s\S]*?<\/nav>/)?.[0] ?? "").matchAll(/>(Desk|Options Flow|New Today)</g)].map((match) => match[1]);
  assert(JSON.stringify(order) === '["Desk","Options Flow","New Today"]', `${file} department nav ${order}`);
}
const privateHome = readFileSync(join(root, `${FAMILY_ENTRY}/index.html`), "utf8");
const privateFlow = readFileSync(join(root, `${FAMILY_ENTRY}/options-flow/index.html`), "utf8");
assert(privateHome.includes('src="/src/hub-gate.js"') && privateFlow.includes('src="/src/hub-gate.js"'), "private pages run the allowlist gate");
assert(privateHome.includes('href="options-flow/"') && privateHome.includes('href="../positioning/"') && privateHome.includes('href="new-today/"'), "private desk links its three departments");
const privateFlowTemplate = privateFlow.match(/<template id="vault-content">([\s\S]*?)<\/template>/)?.[1] ?? "";
assert(JSON.stringify([...privateFlowTemplate.matchAll(/<a class="tile hub-tile[^"]*" href="([^"]+)"/g)].map((match) => match[1])) === '["dollar/","spotlights/","scorecard/"]', "private Options Flow links the three pages");
assert(readFileSync(join(root, `${FAMILY_ENTRY}/options-flow/dollar/index.html`), "utf8").includes('src="/src/options-flow.js"'), "private Shopping List uses the shared flow module");
assert(readFileSync(join(root, `${FAMILY_ENTRY}/options-flow/spotlights/index.html`), "utf8").includes('src="/src/spotlights.js"'), "private Spotlights use the shared module");
assert(readFileSync(join(root, `${FAMILY_ENTRY}/options-flow/scorecard/index.html`), "utf8").includes('src="/src/scorecard.js"'), "private scorecard uses the shared module");
assert(readFileSync(join(root, `${FAMILY_ENTRY}/new-today/index.html`), "utf8").includes(`data-flow-base="${FAMILY_ENTRY}/options-flow/"`), "private New Today rewrites flow rows into the private entry");
assert(readFileSync(join(root, "src/new-today.js"), "utf8").includes("dataset.flowBase"), "New Today can retarget flow links");
const privateGate = readFileSync(join(root, "src/hub-gate.js"), "utf8");
assert(privateGate.includes("FAMILY_ALLOWLIST") && privateGate.includes("FAMILY_ENTRY") && privateGate.includes('new CustomEvent("vault-open")'), "private gate uses the allowlist and the shared mount event");
for (const feed of PRODUCT_FEEDS) {
  assert(existsSync(join(root, feed.file)), `shared feed ${feed.id} is missing at ${feed.file}`);
  assert(feed.surfaces.length > 0, `${feed.id} names a product`);
}
assert(PRODUCT_FEEDS.find((feed) => feed.id === "portfolio").surfaces.join() === "vault", "the book feed is Vault-only");
const sharedFlow = PRODUCT_FEEDS.filter((feed) => feed.surfaces.includes("vault") && feed.surfaces.includes("private") && feed.id !== "portfolio");
assert(sharedFlow.length >= 3, "Options Flow data is listed for Vault and the private entry");

const envExample = readFileSync(join(root, ".env.example"), "utf8");
assert(/^VITE_CLERK_PUBLISHABLE_KEY=$/m.test(envExample), ".env.example documents an empty VITE_CLERK_PUBLISHABLE_KEY");
const ignored = readFileSync(join(root, ".gitignore"), "utf8");
assert(/^\.env$/m.test(ignored) && /^\.env\.\*$/m.test(ignored), ".gitignore keeps local env files out of git");
for (const file of [".env.example", "README.md", "src/vault-gate.js", "vault/index.html", ".github/workflows/pages.yml"]) {
  assert(!/\b(pk|sk)_(test|live)_[A-Za-z0-9]{8,}/.test(readFileSync(join(root, file), "utf8")), `${file} carries a Clerk key`);
}

const scrubbed = /\bsample\b|\beducation\b|not advice|illustrative|textbook|curriculum|\blessons?\b|\bdesk [ab]\b|get_equity_|spotlight watch/i;
for (const file of [...publicPages, ...privatePages, "README.md", "public/data/flow/scorecard.json", "public/data/flow/plays.json", "public/data/flow/spotlights.json"]) {
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
for (const file of [...dashboardPages, "404.html", "index.html"]) {
  assert(!readFileSync(join(root, file), "utf8").includes("soft-crowded"), `${file} links into the Vault pack`);
}
for (const name of readdirSync(join(root, "src"))) {
  if (extname(name) !== ".js" || name.startsWith("vault-")) continue;
  assert(!readFileSync(join(root, "src", name), "utf8").includes("soft-crowded"), `src/${name} links into the Vault pack`);
}

const packDir = join(root, "public/data/vault/soft-crowded");
const packSchema = JSON.parse(readFileSync(join(packDir, "schema.json"), "utf8"));
const packIndex = JSON.parse(readFileSync(join(packDir, "index.json"), "utf8"));
const packWeeks = (packIndex.weeks ?? []).map((row) => ({ row, doc: JSON.parse(readFileSync(join(packDir, row.file), "utf8")) }));
const packWeek = packWeeks.find(({ row }) => row.week === packIndex.latest)?.doc ?? JSON.parse(readFileSync(join(packDir, `${packIndex.latest}.json`), "utf8"));
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
  if (Array.isArray(node.type)) {
    if (data === null && node.type.includes("null")) return;
    const types = node.type.filter((type) => type !== "null");
    assert(types.length === 1, `${path} schema type ${node.type}`);
    validatePack(rootSchema, { ...node, type: types[0] }, data, path);
    return;
  }
  if (node.type === "null") {
    assert(data === null, `${path} should be null`);
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
    return;
  }
  if (node.type === "number") {
    assert(typeof data === "number" && Number.isFinite(data), `${path} ${data} should be a number`);
    if (typeof data !== "number" || !Number.isFinite(data)) return;
    if (typeof node.minimum === "number") assert(data >= node.minimum, `${path} ${data} below ${node.minimum}`);
    if (typeof node.maximum === "number") assert(data <= node.maximum, `${path} ${data} above ${node.maximum}`);
    return;
  }
  if (node.type === "boolean") assert(typeof data === "boolean", `${path} should be a boolean`);
}

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
function nextFriday(iso) {
  const day = new Date(`${iso}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 7);
  return day.toISOString().slice(0, 10);
}
const packByWeek = new Map(packWeeks.map(({ row, doc }) => [row.week, doc]));
const lastDeskWeek = WEEKS[WEEKS.length - 1];
assert(
  packIndex.latest === lastDeskWeek || (packWeek.carryForward?.from === lastDeskWeek && packIndex.latest === nextFriday(lastDeskWeek)),
  `pack latest ${packIndex.latest} should be the Desk's current week, or a disclosed carry-forward of it on the next Friday`,
);assert(packWeek.$schema === "./schema.json", "week document points at the schema");

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
assert(packSchema.$defs.chartRef.required.includes("article") && packSchema.$defs.chartRef.required.includes("snapshot"), "each chart ref requires an article and a frozen snapshot");
assert(packSchema.$defs.read.description?.includes("One-page read"), "one-page read stays the week overview");
for (const key of ["isoWeek", "title", "asOf", "asOfLabel"]) assert(packSchema.required.includes(key), `pack schema requires ${key}`);
for (const key of ["softened", "crowded", "backdrop", "nextWeek"]) assert(packSchema.$defs.read.required.includes(key), `one-page read requires ${key}`);

assert(isoWeek("2026-10-23") === "2026-W43" && isoWeek("2026-10-30") === "2026-W44" && isoWeek("2027-01-01") === "2026-W53", "ISO week labels");
assert(JSON.stringify(isoWeekRange("2026-W44")) === '{"start":"2026-10-26","end":"2026-11-01"}', "ISO week range");

function wordCount(value) {
  if (typeof value === "string") return value.trim().split(/\s+/).filter(Boolean).length;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + wordCount(item), 0);
  if (value && typeof value === "object") return Object.values(value).reduce((sum, item) => sum + wordCount(item), 0);
  return 0;
}

function stripWritten(doc) {
  const { $schema, read, charts, ...rest } = doc;
  return { ...rest, charts: { ...charts, refs: charts.refs.map(({ article, ...ref }) => ref) } };
}

function checkPackWeek(row, doc) {
  const where = `pack ${row.week}`;
  validatePack(packSchema, packSchema, doc, where);
  assert(doc.$schema === "./schema.json", `${where} points at the schema`);
  assert(row.file === `${row.week}.json` && doc.week === row.week, `${where} index row names its file`);
  assert(row.isoWeek === doc.isoWeek && row.title === doc.title && row.weekLabel === doc.weekLabel && row.headline === doc.read.headline, `${where} index row matches the week`);
  assert(
    JSON.stringify(row.counts) === JSON.stringify(Object.fromEntries(doc.buckets.map((bucket) => [bucket.level, bucket.sectors.length]))),
    `${where} index counts ${JSON.stringify(row.counts)}`,
  );
  assert(doc.isoWeek === isoWeek(doc.week) && doc.title === `${doc.isoWeek} Soft ↔ Crowded`, `${where} title ${doc.title}`);
  assert(new Date(`${doc.week}T12:00:00Z`).getUTCDay() === 5, `${where} is a Friday desk day`);
  assert(/T05:00:00-0[56]:00$/.test(doc.asOf) && doc.asOf.startsWith(doc.week), `${where} as-of is the 5:00 AM CT open, got ${doc.asOf}`);
  assert(doc.asOfLabel.includes("5:00 AM CT open"), `${where} as-of label ${doc.asOfLabel}`);
  const words = wordCount(doc.read);
  assert(words >= 400 && words <= 600, `${where} one-page read is ${words} words, want 400 to 600`);

  const carried = doc.carryForward?.from ?? null;
  assert((row.carryForward ?? null) === carried, `${where} index row names its carry-forward week`);
  if (carried) {
    const source = packByWeek.get(carried);
    assert(WEEKS.includes(carried) && !WEEKS.includes(doc.week), `${where} carries a Desk week forward and is not a Desk week itself`);
    assert(nextFriday(carried) === doc.week, `${where} carries forward the Friday before, got ${carried}`);
    assert(Boolean(source) && !source?.carryForward, `${where} carries forward a filed Desk pack`);
    if (source) {
      for (const key of ["house", "houseLabel", "windowWeeks", "buckets", "unprinted"]) {
        assert(JSON.stringify(doc[key]) === JSON.stringify(source[key]), `${where} ${key} is the ${carried} freeze verbatim`);
      }
      assert(JSON.stringify(stripWritten(doc).charts) === JSON.stringify(stripWritten(source).charts), `${where} chart snapshots are the ${carried} freeze verbatim`);
    }
    assert(doc.weekLabel === formatWeek(doc.week), `${where} week label ${doc.weekLabel}`);
    assert(
      doc.basis.startsWith("Carry-forward") && doc.basis.includes(JPM_MONITOR_REF) && doc.basis.includes(`last Desk freeze ${shortWeek(carried)}`),
      `${where} basis discloses the carry-forward, got ${doc.basis}`,
    );
    assert(doc.sectorSource.includes(JPM_MONITOR_REF) && doc.sectorSource.includes("carried forward"), `${where} sector source discloses the carry-forward`);
    assert(/carried forward/i.test(`${doc.read.lede} ${doc.read.stance}`), `${where} read says the columns are carried forward`);
    assert(!/No sector changed columns/.test(doc.read.stance), `${where} read does not claim a column check it has no print for`);
  }

  const deskWeek = carried ?? doc.week;
  const at = WEEKS.indexOf(deskWeek);
  assert(at >= 0 || doc.week !== packIndex.latest, `${where} latest pack must be a Desk week or a disclosed carry-forward of one`);
  if (at < 0) return;
  const frame = packFrame(deskWeek);
  if (carried) {
    assert(JSON.stringify(doc.buckets) === JSON.stringify(frame.buckets), `${where} carried buckets drifted from the Desk`);
  } else if (doc.week === WEEKS[WEEKS.length - 1]) {
    assert(JSON.stringify(stripWritten(doc)) === JSON.stringify(frame), `${where} drifted from the Desk series; rerun npm run pack:build -- ${doc.week}`);
  } else {
    assert(JSON.stringify(doc.buckets) === JSON.stringify(frame.buckets), `${where} buckets drifted from the Desk`);
  }

  const reading = buildReading("jpm", at, 4);
  const facts = chartFacts(at);
  assert(doc.house === "jpm" && doc.houseLabel === "JPM" && doc.windowWeeks === 4, `${where} is the JPM 4-week read`);
  if (!carried) {
    assert(doc.weekLabel === reading.weekLabel, `${where} week label matches the Desk`);
    assert(doc.basis === sectorChart("jpm", at).basis, `${where} basis ${doc.basis}`);
    assert(doc.sectorSource === reading.sectorSource, `${where} sector source ${doc.sectorSource}`);
  }
  assert(
    JSON.stringify(doc.buckets.map((bucket) => [bucket.level, bucket.title, bucket.range, bucket.tone])) ===
      JSON.stringify(SECTOR_BUCKETS.map((bucket) => [bucket.level, bucket.title, bucket.range, bucket.tone])),
    `${where} buckets follow the Desk Soft ↔ Crowded columns`,
  );
  const seen = [];
  for (const bucket of doc.buckets) {
    const want = CANON.filter((ticker) => reading.sectors[ticker].available && reading.sectors[ticker].level === bucket.level)
      .map((ticker) => reading.sectors[ticker])
      .sort((a, b) => a.points - b.points || a.ticker.localeCompare(b.ticker));
    assert(bucket.sectors.length === want.length, `${where} ${bucket.level} has ${bucket.sectors.length} sectors, Desk has ${want.length}`);
    bucket.sectors.forEach((sector, index) => {
      const desk = want[index];
      seen.push(sector.ticker);
      for (const key of ["ticker", "short", "name", "points", "display", "ile", "pill", "caption", "wowText", "regime", "level"]) {
        assert(sector[key] === desk?.[key], `${where} ${sector.ticker} ${key} ${sector[key]} !== ${desk?.[key]}`);
      }
    });
  }
  const missing = CANON.filter((ticker) => !reading.sectors[ticker].available);
  assert(new Set(seen).size === seen.length, `${where} a sector appears in two buckets`);
  assert(JSON.stringify([...seen].sort()) === JSON.stringify(CANON.filter((ticker) => !missing.includes(ticker)).sort()), `${where} covers every printed sector`);

  const moves = carried ? null : columnMoves(at);
  if (moves?.length === 0) {
    assert(/No sector changed columns versus last week/.test(doc.read.stance), `${where} read records that columns were unchanged`);
  } else if (moves) {
    const told = `${doc.read.stance} ${doc.read.moved.join(" ")}`;
    for (const move of moves) {
      const named = told.includes(move.ticker) || told.includes(reading.sectors[move.ticker].short);
      assert(named && told.includes(move.to), `${where} read names ${move.ticker} moving ${move.from} → ${move.to}`);
    }
  }

  assert(doc.charts.batch === 1, `${where} chart refs are batch 1`);
  assert(JSON.stringify(doc.charts.refs.map((ref) => ref.id)) === JSON.stringify(CHART_IDS), `${where} chart refs ${doc.charts.refs.map((ref) => ref.id)}`);
  doc.charts.refs.forEach((ref, index) => {
    const chart = CHARTS[index];
    assert(ref.id === chart.id && ref.nav === chart.nav && ref.title === chart.title, `${where} chart ref ${ref.id} drifted from batch 1`);
    assert(ref.house === chart.house && ref.houseLabel === HOUSES[chart.house] && ref.deskSection === chart.deskSection, `${where} chart ref ${ref.id} house or section`);
    assert(ref.fact === facts[ref.id], `${where} chart ref ${ref.id} fact ${ref.fact} !== ${facts[ref.id]}`);
    const snap = ref.snapshot;
    assert(snap.weeks.at(-1) === deskWeek, `${where} ${ref.id} snapshot stops at the pack week, or the freeze it carries`);
    const lengths = [snap.values?.length, ...(snap.panels ?? []).flatMap((panel) => panel.series.map((series) => series.values.length))].filter((n) => n !== undefined);
    assert(lengths.every((n) => n === snap.weeks.length), `${where} ${ref.id} snapshot series run ${lengths} points over ${snap.weeks.length} weeks`);
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
      assert(pattern.test(body), `${where} ${ref.id} article names ${label}`);
    }
    assert(/smart money is positioned against/i.test(body), `${where} ${ref.id} article sets smart money against the crowded book`);
    assert(
      /hedge funds?/i.test(article.dumbMoney) && /macro funds?/i.test(article.dumbMoney) && /mutual funds?/i.test(article.dumbMoney) && /\bCTAs?\b/.test(article.dumbMoney),
      `${where} ${ref.id} dumbMoney names the dumb-money cohort`,
    );
    assert(/(dealers?|sharpies?)/i.test(article.smartMoney) && /commercials?/i.test(article.smartMoney), `${where} ${ref.id} smartMoney names the smart-money cohort`);
    if (article.bias === "fade-long" || article.bias === "fade-short") {
      assert(/\b(fade|pullback|bounce|cover)\b/i.test(body), `${where} ${ref.id} fade bias is written into the article`);
    }
  });
}

assert(packWeeks.length >= 2, "pack index lists the latest week and at least one archived week");
assert(
  JSON.stringify(packWeeks.map(({ row }) => row.week)) === JSON.stringify(packWeeks.map(({ row }) => row.week).sort().reverse()),
  "pack index lists weeks newest first",
);
assert(packWeeks[0]?.row.week === packIndex.latest, "pack index latest is the first row");
assert(new Set(packWeeks.map(({ row }) => row.isoWeek)).size === packWeeks.length, "one pack per ISO week");
for (const { row, doc } of packWeeks) checkPackWeek(row, doc);

const packW43 = packByWeek.get("2026-10-23");
if (packW43) {
  for (const phrase of ["0.18", "0.75", "0.69", "0.66", "−1.2", "351", "3.9", "53%"]) {
    assert(JSON.stringify(packW43.read).includes(phrase), `W43 one-page read names ${phrase}`);
  }
}
const packW44 = packByWeek.get("2026-10-30");
if (packW44) {
  assert(packW44.carryForward?.from === "2026-10-23", "W44 carries the Oct 23 Desk freeze forward");
  for (const phrase of ["−4.58", "2.98", "22.5%", "$165M", "06-Oct-26", "0.75", "0.18"]) {
    assert(JSON.stringify(packW44.read).includes(phrase), `W44 one-page read names ${phrase}`);
  }
  assert(JSON.stringify(packW44.read).includes("Vol Stress"), "W44 read names the overlay as Vol Stress");
}
const latestPackCopy = JSON.stringify([packWeek.read, packWeek.charts.refs.map((ref) => ref.article)]);
assert(!/Spot Vol Beta|UV_|desk estimate|svb-dial|gauge/i.test(latestPackCopy), "the latest pack renders on public Trade ideas, so its copy uses Vol Stress and hides the gauge");
const packW42 = packWeeks.find(({ row }) => row.week === "2026-10-16")?.doc;
if (packW42) {
  assert(JSON.stringify(columnMoves(WEEKS.indexOf("2026-10-16"))) === '[{"ticker":"XLF","from":"soft","to":"extreme soft"},{"ticker":"XLE","from":"mid","to":"crowded"}]', "W42 column moves");
}
const packJs = readFileSync(join(root, "src/vault-pack.js"), "utf8");
assert(packJs.includes("data/vault/soft-crowded/"), "pack page loads the week document");
for (const piece of ["bodyMarkdown", "dumbMoney", "smartMoney", "invalidation", "article.headline", "fade-long", "pack-article"]) {
  assert(packJs.includes(piece), `pack page renders ${piece}`);
}
assert(css.includes("#pack .pack-article") && css.includes("@media print") && css.includes("break-inside: avoid"), "pack articles keep a print stylesheet");

/* Vault wall: Vol · Credit · Momentum, with the MAG7 Oscillator beside Spot Vol Beta and Credit Spread Regime. */
const wallFile = "vault/vol-credit-momentum/index.html";
assert(viteConfig.includes(`"${wallFile}"`), `vite builds ${wallFile}`);
const wallPage = readFileSync(join(root, wallFile), "utf8");
assert(wallPage.includes('<body class="is-vault">'), "wall page carries the Vault theme");
assert(wallPage.includes('src="/src/vault-gate.js"') && wallPage.includes('src="/src/vault-wall.js"'), "wall page runs the gate and the wall");
assert(/class="lockup" href="\.\.\/\.\.\/"/.test(wallPage), "wall lockup links home");
const wallMain = wallPage.match(/<main id="content">([\s\S]*?)<\/main>/)?.[1] ?? "";
const wallTemplate = wallMain.match(/<template id="vault-content">([\s\S]*?)<\/template>/)?.[1] ?? "";
const wallOutside = wallMain.replace(/<template id="vault-content">[\s\S]*?<\/template>/, "");
assert(/<section class="vault-wall" id="vault-wall" data-state="checking"/.test(wallOutside), "wall page sign-in card renders before the gate opens");
assert(/<h1 id="vault-wall-title">Sign in to open Vault<\/h1>/.test(wallOutside), "wall page reads Sign in to open Vault");
assert(
  wallOutside.match(/<section class="vault-wall"[\s\S]*?<\/section>/)?.[0].replaceAll('href="../../"', 'href="../"') ===
    vaultOutside.match(/<section class="vault-wall"[\s\S]*?<\/section>/)?.[0],
  "wall page sign-in card is the same allowlist sign-in card as the Vault",
);
assert(!/id="mag7"|mo-pane|wall-grid|wall-slot/.test(wallOutside), "wall content does not render outside the template");
const wallOrder = [...wallTemplate.matchAll(/<article class="[^"]*" id="([^"]+)"/g)].map((match) => match[1]);
assert(JSON.stringify(wallOrder) === '["spot-vol-beta","credit-spread-regime","mag7","nysi","nasi","nyhl","nyad"]', `wall order ${wallOrder}`);
for (const id of ["mo-controls", "mo-pane", "mo-plot", "mo-legend", "mo-table", "mo-now", "mo-basis"]) assert(wallTemplate.includes(`id="${id}"`), `MAG7 card keeps #${id}`);
assert(wallTemplate.includes("Caution +9") && wallTemplate.includes("Stretched −5"), "MAG7 key names the caution and stretched lines");
assert(wallTemplate.includes("Bullish above +2") && wallTemplate.includes("Bearish below −2"), "MAG7 key names the ±2 signal thresholds");
assert(vaultTemplate.includes('class="tile vault-pack" href="vol-credit-momentum/"'), "signed-in Vault links to the wall");
assert(!vaultOutside.includes("vol-credit-momentum"), "the wall link stays inside the signed-in template");
for (const file of [...dashboardPages, "404.html"]) {
  assert(!readFileSync(join(root, file), "utf8").includes("vol-credit-momentum"), `${file} links into the Vault wall`);
}

const wallSources = [wallFile, "src/vault-wall.js", "src/mag7-chart.js", "src/mag7-osc.js", "scripts/vault-mag7-seed.mjs", "public/data/vault/mag7/oscillator.json"];
for (const file of wallSources) {
  const text = readFileSync(join(root, file), "utf8");
  assert(!/tradingview|\btdv\b|\bpine\b|pinescript|<iframe|©/i.test(text), `${file} carries third-party chart branding, script source, or an embed`);
}
function noPineFiles(dir) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", "dist", ".git"].includes(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) noPineFiles(path);
    else assert(extname(name) !== ".pine", `${path} ships indicator script source`);
  }
}
noPineFiles(root);

assert(JSON.stringify(momentum([100, 110, 121, 99], 2).map((value) => Math.round(value * 1e6) / 1e6)) === "[0,0,21,-10]", "momentum is % change over the lookback, 0 during warmup");
assert(JSON.stringify(sma([1, 2, 3, null, 5], 2)) === "[null,1.5,2.5,null,null]", "smoothing skips windows with a missing bar");
assert(regimeOf(2, 2, -2) === "neutral" && regimeOf(2.01, 2, -2) === "bull" && regimeOf(-2.01, 2, -2) === "bear", "signal fires strictly beyond ±2");
assert(fmtPct(-4.578) === "−4.58" && fmtPct(2, 1) === "2" && fmtPct(-4.5) === "−4.5", "table numbers keep up to two decimals");

const oscDoc = JSON.parse(readFileSync(join(root, "public/data/vault/mag7/oscillator.json"), "utf8"));
assert(oscDoc.sku === "mag7-oscillator" && oscDoc.houseLabel === "Desk", "oscillator document is the Desk MAG7 read");
assert(JSON.stringify(oscDoc.names) === JSON.stringify(MAG7) && JSON.stringify(MAG7) === '["AAPL","MSFT","GOOGL","AMZN","NVDA","TSLA","META"]', "oscillator runs the seven names");
assert(JSON.stringify(oscDoc.params) === JSON.stringify(MAG7_DEFAULTS), "oscillator document carries the desk parameters");
assert(
  MAG7_DEFAULTS.momentumLength === 14 && MAG7_DEFAULTS.smoothingLength === 5 && MAG7_DEFAULTS.bullishThreshold === 2 && MAG7_DEFAULTS.bearishThreshold === -2,
  "MAG7 is 14-day momentum, 5-session smoothing, ±2 thresholds",
);
assert(MAG7_DEFAULTS.stretched === -5 && MAG7_DEFAULTS.caution === 9, "MAG7 stretched line at −5 and caution line at +9");
assert(oscDoc.dates.every((date, index) => !index || date > oscDoc.dates[index - 1]), "oscillator sessions ascend");
for (const ticker of [...MAG7, oscDoc.ew.ticker]) {
  const closes = oscDoc.closes[ticker];
  assert(closes?.length === oscDoc.dates.length && closes.every((close) => typeof close === "number" && close > 0), `${ticker} closes cover every session`);
}
assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(oscDoc.asOf) && oscDoc.asOf.startsWith(oscDoc.dates[oscDoc.dates.length - 1]), `oscillator asOf ${oscDoc.asOf} is the last session`);
assert(["close", "intraday"].includes(oscDoc.lastBar), `oscillator lastBar ${oscDoc.lastBar}`);

const osc = buildOscillator(oscDoc);
const oscLast = osc.values.length - 1;
const oscPanel = panelAt(osc, oscLast);
assert(oscPanel.valueText === "−4.58%" && oscPanel.signal === "BEARISH" && oscPanel.breadth === 29, `MAG7 panel ${oscPanel.valueText} ${oscPanel.signal} ${oscPanel.breadth}% should read −4.58% BEARISH 29%`);
assert(oscPanel.mode === "MAG7" && oscPanel.type === "Momentum" && oscPanel.threshold === "±2%" && oscPanel.breadthUp === 2, "MAG7 panel mode, type, threshold, 2 of 7 up");
assert(
  JSON.stringify(oscDoc.snapshot) === JSON.stringify({ value: oscPanel.valueRounded, signal: oscPanel.signal, breadth: oscPanel.breadth, mode: oscPanel.mode, type: oscPanel.type }),
  "oscillator snapshot matches the computed last bar",
);
assert(osc.pivots?.caution === 9 && osc.pivots?.stretched === -5, "default MAG7 view draws the caution and stretched lines");
assert(osc.dates[rangeStart(osc, "desk", oscDoc.defaultFrom)] === oscDoc.defaultFrom, `default window opens on ${oscDoc.defaultFrom}`);
const oscFrom = rangeStart(osc, "desk", oscDoc.defaultFrom);
const oscWindow = osc.values.slice(oscFrom);
assert(oscWindow.every((value) => typeof value === "number"), "default window has a value on every bar");
assert(Math.min(...oscWindow) < -12 && Math.max(...oscWindow) > 14, "default window spans the deep low and the high spike");
const oscRegimes = new Set(osc.regime.slice(oscFrom));
assert(oscRegimes.has("bull") && oscRegimes.has("bear") && oscRegimes.has("neutral"), "default window shows all three regime bands");
const rel = buildOscillator(oscDoc, { mode: "relative" });
const relPanel = panelAt(rel, oscLast);
assert(rel.thresholds.upper === 1 && relPanel.threshold === "±1%" && relPanel.legs.length === 2 && !rel.pivots, "Relative mode reads ±1% with MAG7 and S&P EW legs");
assert(["OUTPERFORM", "UNDERPERFORM", "NEUTRAL"].includes(relPanel.signal), `Relative signal ${relPanel.signal}`);
for (const type of MAG7_TYPES) {
  for (const mode of ["mag7", "ew", "relative"]) {
    const built = buildOscillator(oscDoc, { mode, type });
    assert(built.values.slice(rangeStart(built, "max")).every((value) => typeof value === "number"), `${mode} ${type} has a value on every plotted bar`);
  }
}
const wallJs = readFileSync(join(root, "src/vault-wall.js"), "utf8");
for (const label of ['"Value"', '"Mode"', '"Signal"', '"Type"', '"Breadth"', '"Threshold"', '"MAG7 Oscillator", "Values"']) {
  assert(wallJs.includes(label), `MAG7 stats panel keeps ${label}`);
}
assert(wallJs.includes("data/vault/mag7/oscillator.json"), "wall loads the oscillator document");
const chartJs = readFileSync(join(root, "src/mag7-chart.js"), "utf8");
for (const piece of ["PANE.band", "mo-pivot", '"caution"', '"stretched"', "thresholds", "mo-line"]) assert(chartJs.includes(piece), `MAG7 pane draws ${piece}`);

for (const stray of ["vault/vol-credit", "vault/vol", "public/data/vault/vol-credit", "public/data/vault/vol"]) {
  assert(!existsSync(join(root, stray)), `${stray} is gone; the wall lives at /vault/vol-credit-momentum/`);
  assert(!viteConfig.includes(`"${stray}/index.html"`), `vite no longer builds ${stray}/index.html`);
}

/* Credit Spread Regime, card 02 on the wall. */
assert(!/csr-|id="csr-title"/.test(wallOutside), "Credit Spread Regime does not render outside the template");
const csrCard = wallTemplate.match(/<article class="[^"]*\bcsr-card\b[^"]*" id="credit-spread-regime"[\s\S]*?<\/article>/)?.[0] ?? "";
assert(csrCard && !/wall-slot|is-soon|Not open yet/.test(csrCard), "Credit Spread Regime is a live card, not a Soon slot");
for (const id of ["csr-frame", "csr-panel", "csr-legend", "csr-spx", "csr-asof"]) assert(csrCard.includes(`id="${id}"`), `Credit Spread Regime card keeps #${id}`);
assert(csrCard.includes(">SPX overlay<"), "Credit Spread Regime card offers the SPX overlay");
for (const zone of [">Low<", ">Normal<", ">Elevated<", ">Stress<"]) assert(csrCard.includes(zone), `Credit Spread Regime key names ${zone}`);
assert(csrCard.includes("Source: Desk · Positioning %"), "Credit Spread Regime credits the desk");
for (const file of ["src/csr.js", "src/csr-chart.js", "src/vault-csr.js", "scripts/fetch-csr.mjs", "public/data/vault/credit-spread-regime/csr.json"]) {
  const text = readFileSync(join(root, file), "utf8");
  assert(!/edge\s*tools|tradingview|\btdv\b|\bpine\b|pinescript|tv\.js|<iframe|©/i.test(text), `${file} carries third-party chart branding, script source, or an embed`);
  assert(!/indicator\(|request\.security|\/\/@version/.test(text), `${file} ships indicator script source`);
}

const csrDoc = JSON.parse(readFileSync(join(root, "public/data/vault/credit-spread-regime/csr.json"), "utf8"));
const csrCols = csrDoc.series;
assert(csrDoc.sourceLabel === "Desk" && csrDoc.provider === "FRED", "csr.json is a Desk read of FRED series");
assert(
  JSON.stringify(csrDoc.sources.map((source) => source.id)) === '["BAMLH0A0HYM2","BAMLC0A0CM","SP500","VIXCLS"]',
  `csr.json sources ${csrDoc.sources.map((source) => source.id)}`,
);
assert(JSON.stringify(csrDoc.params) === JSON.stringify(CSR_PARAMS), "csr.json params match the card (EMA 5, 252-session Z, 2 / 1 / −1)");
assert(CSR_PARAMS.smoothing === 5 && CSR_PARAMS.lookback === 252 && CSR_PARAMS.stress === 2 && CSR_PARAMS.elevated === 1 && CSR_PARAMS.low === -1, "Credit Spread Regime runs EMA 5, 252-session Z, Stress 2, Elevated 1, Low −1");
for (const key of ["hy", "ig", "spx", "vix"]) assert(csrCols[key]?.length === csrCols.t.length, `csr.json ${key} has a value for every session`);
assert(csrCols.t.every((day, index) => /^\d{4}-\d{2}-\d{2}$/.test(day) && (index === 0 || day > csrCols.t[index - 1])), "csr.json sessions ascend");
assert(csrCols.hy.every((v, i) => Number.isInteger(v) && Number.isInteger(csrCols.ig[i]) && v > csrCols.ig[i] && csrCols.ig[i] > 0), "csr.json HY and IG are whole bps with HY over IG");
assert(csrCols.spx.every((v) => v > 0), "csr.json SPX closes are positive");
assert(csrDoc.asOf === csrCols.t[csrCols.t.length - 1], "csr.json asOf is the last session");
assert(csrCols.t.length - CSR_PARAMS.lookback >= 252, "csr.json carries at least a year of Z after the 252-session window");
const csrRead = csrSeries(csrDoc);
const csrLast = csrPanel(csrRead);
const csrSnap = csrDoc.snapshot;
assert(
  csrSnap.date === csrLast.date && csrSnap.hy === csrLast.hy && csrSnap.ig === csrLast.ig && csrSnap.excess === csrLast.excess &&
    csrSnap.z === Number(csrLast.z.toFixed(2)) && csrSnap.regime === csrLast.regime && csrSnap.percentile === Number(csrLast.percentile.toFixed(1)) &&
    csrSnap.momentum === Number(csrLast.momentum.toFixed(1)) && csrSnap.bias === csrLast.bias && csrSnap.cycle === csrLast.cycle,
  `csr.json snapshot ${JSON.stringify(csrSnap)} matches the computed last session`,
);
const lockAt = csrCols.t.indexOf("2026-10-29");
if (lockAt >= 0) {
  const lockDoc = { series: Object.fromEntries(Object.entries(csrCols).map(([key, values]) => [key, values.slice(0, lockAt + 1)])) };
  const lockText = panelText(csrPanel(csrSeries(lockDoc)));
  const want = { hy: "326 bps", ig: "89 bps", excess: "237 bps", z: "1.85", regime: "ELEVATED", percentile: "95.2%", momentum: "−8.4 bps", status: "NORMAL", cycle: "RECOVERING", bias: "RISK-OFF" };
  const got = Object.fromEntries(Object.keys(want).map((key) => [key, lockText[key]]));
  assert(JSON.stringify(got) === JSON.stringify(want), `Oct 29, 2026 panel ${JSON.stringify(got)} matches the desk lock`);
}
const peak = csrRead.z.reduce((best, z, i) => (z !== null && z > (csrRead.z[best] ?? -Infinity) ? i : best), csrRead.first);
assert(csrRead.t[peak] >= "2025-04-01" && csrRead.t[peak] <= "2025-04-30" && csrRead.z[peak] > 4, `April 2025 is the Z peak (${csrRead.t[peak]} ${csrRead.z[peak]?.toFixed(2)})`);
const octDots = csrRead.t.filter((day, i) => csrRead.sell[i] && day >= "2026-10-01");
assert(JSON.stringify(octDots) === '["2026-10-21","2026-10-26","2026-10-27"]', `October 2026 stress roll-over dots ${octDots}`);
assert(csrRegimeOf(2) === "STRESS" && csrRegimeOf(1.99) === "ELEVATED" && csrRegimeOf(1) === "ELEVATED" && csrRegimeOf(-1) === "NORMAL" && csrRegimeOf(-1.01) === "LOW", "regime thresholds");
assert(JSON.stringify(zColor(2.5)) === "[239,68,68]" && JSON.stringify(zColor(-1.5)) === "[34,197,94]" && JSON.stringify(zColor(1)) === "[115,115,115]", "Z line runs green, grey, red");
assert(cycleOf(1.5, -1) === "RECOVERING" && cycleOf(1.5, 1) === "DETERIORATING" && cycleOf(-1.5, -1) === "TIGHTENING" && cycleOf(0, 1) === "STABLE", "credit cycle phases");
assert(biasOf(1) === "RISK-OFF" && biasOf(-1.01) === "RISK-ON" && biasOf(0) === "NEUTRAL", "bias");
const csrJs = readFileSync(join(root, "src/vault-csr.js"), "utf8");
const csrChartJs = readFileSync(join(root, "src/csr-chart.js"), "utf8");
assert(wallJs.includes('import "./vault-csr.js"'), "the wall mounts Credit Spread Regime");
assert(csrJs.includes("data/vault/credit-spread-regime/") && csrJs.includes("onDeskReady") && csrJs.includes('getElementById("credit-spread-regime")'), "Credit Spread Regime loads csr.json once the desk is ready");
for (const piece of ["drawSpx", "drawZones", "drawBackground", "drawMarkers", "drawLevels", "drawCrosshair"]) assert(csrChartJs.includes(`function ${piece}(`), `Credit Spread Regime chart keeps ${piece}`);
assert(!/shadowBlur|backdrop-filter|feGaussian|filter:\s*blur|globalAlpha|drawImage\(/.test(csrChartJs), "Credit Spread Regime chart draws a sharp line with no glow or blur");
const csrCss = css.slice(css.indexOf("/* Credit Spread Regime"), css.indexOf("/* Wall breadth"));
assert(csrCss.includes(".csr-panel") && !/backdrop-filter|filter:\s*blur|-webkit-mask|mask-image/.test(csrCss), "Credit Spread Regime styles have no frost, blur, or soft mask");
assert(csrCss.includes("background: #171717") && csrCss.includes("background: #262626") && !/rgba\(23,\s*23,\s*23,/.test(csrCss), "Credit Spread Regime stats panel is opaque");

/* Spot Vol Beta, card 01 on the wall: the gauge first, the desk estimate second, then the daily close line. */
assert(!/svb-|id="svb-title"/.test(wallOutside), "Spot Vol Beta does not render outside the template");
const svbCard = wallTemplate.match(/<article class="[^"]*\bsvb-card\b[^"]*" id="spot-vol-beta"[\s\S]*?<\/article>/)?.[0] ?? "";
assert(svbCard && !/wall-slot|is-soon|Not open yet/.test(svbCard), "Spot Vol Beta is a live card, not a Soon slot");
for (const id of ["svb-title", "svb-asof", "svb-body", "svb-status"]) assert(svbCard.includes(`id="${id}"`), `Spot Vol Beta card keeps #${id}`);
assert(readFileSync(join(root, "src/vault-gate.js"), "utf8").includes('new CustomEvent("vault-open")'), "gate still tells Vault pages when the wall opens");
const svbJs = readFileSync(join(root, "src/vault-svb.js"), "utf8");
assert(wallJs.includes('import "./vault-svb.js"'), "the wall mounts Spot Vol Beta");
assert(svbJs.includes("data/vault/spot-vol-beta/") && svbJs.includes("drawDualLine") && svbJs.includes('new CustomEvent("vault-open")') === false, "Spot Vol Beta loads its series and does not mint a second gate event");
assert(svbJs.includes("onDeskReady") && svbJs.includes("FORMULA") && svbJs.includes("publicBody") && svbJs.includes('getElementById("spot-vol-beta")'), "Vol Stress mounts on the desk and keeps the formula off the public card");
assert(svbJs.indexOf('"pct svb-gauge') < svbJs.indexOf('"svb-desk"'), "the gauge renders before the desk estimate");
assert(css.includes(".svb-plot") && css.includes(".svb-gauge") && css.includes(".svb-desk"), "Spot Vol Beta has a gauge, a desk estimate, and a chart plate");
assert(svbJs.includes('class: "svb-dial"') && svbJs.includes('class: "svb-needle"') && svbJs.includes("svbDial("), "Spot Vol Beta paints the live reading on a dial with a needle");
assert(css.includes(".svb-dial") && css.includes(".svb-dial-mark") && css.includes(".svb-instrument"), "Spot Vol Beta dial uses the house gold mark");
assert(Math.abs(gaugeFraction(2.98) - 2.98 / 4) < 1e-9 && gaugeFraction(2) === 0.5, "2.98 sits on the 0–4 dial and 2 is the top of the arc");
assert(gaugeFraction(-3) === 0 && gaugeFraction(8) === 1, "the dial clamps readings outside 0–4");
assert(readFileSync(join(root, "src/chart-svg.js"), "utf8").includes("export function drawDualLine"), "daily line drawer is shared with the Positioning charts");
for (const file of ["src/vault-svb.js", "public/data/vault/spot-vol-beta/series.json", "public/data/vault/spot-vol-beta/latest.json"]) {
  assert(!/tradingview|\btdv\b|\bpine\b|pinescript|<iframe|©/i.test(readFileSync(join(root, file), "utf8")), `${file} carries third-party chart branding, script source, or an embed`);
}

const svbDir = join(root, "public/data/vault/spot-vol-beta");
const svbSchema = JSON.parse(readFileSync(join(svbDir, "schema.json"), "utf8"));
const svbSeries = JSON.parse(readFileSync(join(svbDir, "series.json"), "utf8"));
const svbLatest = JSON.parse(readFileSync(join(svbDir, "latest.json"), "utf8"));
assert(svbSchema.$schema === "https://json-schema.org/draft/2020-12/schema", "spot vol beta schema is draft 2020-12");
assert(svbSchema.description.includes("Append one object"), "schema tells a writer to append one close");
assert(svbSchema.$defs.latest.description.includes("Primary gauge"), "schema names the gauge document");
validatePack(svbSchema, svbSchema, svbSeries, "svb");
validatePack(svbSchema, svbSchema.$defs.latest, svbLatest, "svb.latest");
assert(svbSeries.formula === FORMULA && svbSeries.formulaLabel === "desk estimate" && svbSeries.deskBeta === -0.7 && svbSeries.signal === 2, "desk estimate formula is the locked line");
assert(JSON.parse(readFileSync(join(svbDir, "index.json"), "utf8")).append.includes("one point"), "series index says to append one point per session");
const svbDates = svbSeries.points.map((point) => point.date);
assert(new Set(svbDates).size === svbDates.length, "one Spot Vol Beta point per session");
assert(JSON.stringify(svbDates) === JSON.stringify([...svbDates].sort()), "closes are appended in date order");
for (const date of svbDates) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  assert(weekday !== 0 && weekday !== 6, `${date} is not a weekday session`);
}
assert(!svbDates.includes("2026-09-07"), "Labor Day is not a session");
const svbLast = svbSeries.points.at(-1);
const svbCalibration = svbLatest.session === "2026-10-30" && !svbLatest.closed;
assert(svbLatest.feedLabel.includes("not wired") || svbLatest.live, "the card says the live feed is not wired");
if (svbLatest.closed) {
  assert(svbLast.date === svbLatest.session && svbLast.svb === svbLatest.gauge && svbLast.spx === svbLatest.spx, "a closed gauge is the last close on the line");
  assert(svbLast.origin === "close-routine" && svbLast.estimate?.value === readout(svbLatest, svbSeries).estimateValue, "a closed gauge carries the routine's desk estimate close");
} else {
  assert(svbLast.date < svbLatest.session && !svbDates.includes(svbLatest.session), "an open session is not appended to the close line");
  const impliedSpot = Math.round(svbLast.spx * (1 + svbLatest.spxPct / 100) * 100) / 100;
  assert(Math.abs(impliedSpot - svbLatest.spx) < 0.02, `session SPX ${svbLatest.spx} should match the prior close and SPX percent`);
}
const svbView = readout(svbLatest, svbSeries);
if (svbCalibration) {
  assert(svbLatest.asOf === "2026-10-30T12:18:00-05:00" && svbLatest.asOfLabel === "Fri Oct 30, 2026 · 12:18 CT", "gauge stamp is the calibration print");
  assert(svbLatest.gauge === 2.98 && svbLatest.live === false && svbLatest.closed === false, "gauge is the committed 2.98 print, not a close");
  assert(svbView.gauge === "2.98" && svbView.estimate === "2.57", `readout ${svbView.gauge} / ${svbView.estimate}`);
  assert(formatSvb(svbView.estimateValue) === "2.57", "desk estimate rounds to 2.57");
  assert(Math.abs(svbLatest.gauge - svbView.estimateValue - 0.41) < 0.001, "gauge and desk estimate keep the calibration gap");
  assert(svbView.inputs === "UV Δ 3.41 · SPX −1.20%" && svbView.formula === FORMULA, "desk estimate shows its inputs");
  assert(svbView.agreement === "Gauge and desk estimate are both at or above 2.", svbView.agreement);
  assert(svbView.formalWait.includes("VIX close"), "an intraday print at or above 2 waits on the VIX close");
  assert(svbView.session.includes("6,791.91") && svbView.session.includes("−1.20%"), `session line ${svbView.session}`);
}
const formal = svbSeries.points.find((point) => point.date === "2026-09-03");
const marked = svbSeries.points.find((point) => point.date === "2026-10-12");
const quiet = svbSeries.points.find((point) => point.date === "2026-10-29");
assert(formal.svb >= 2 && formal.vixCloseMove >= 2, "September close is a formal vol event");
assert(marked.svb >= 2 && marked.vixCloseMove < 2, "October close is the band without a formal vol event");
assert(quiet.svb === 1.84 && quiet.svb < 2, "the Oct 29 close sits under the band");
assert(spotVolTip(formal).includes("Possible bottom") && spotVolTip(formal).some((line) => line.startsWith("Formal vol event")), "hover names the band and a formal vol event");
assert(spotVolTip(marked).includes("Possible bottom") && !spotVolTip(marked).some((line) => line.startsWith("Formal")), "hover marks the band without calling a short VIX move formal");
assert(!spotVolTip(quiet).includes("Possible bottom") && spotVolTip(quiet)[1] === "Vol Stress 1.84" && spotVolTip(quiet)[2].startsWith("S&P 500 "), "hover on a quiet close is the date, Vol Stress, and the S&P 500");
assert(svbSeries.points.some((point) => point.svb >= svbSeries.signal) && svbSeries.note.includes("possible-bottom") && svbSeries.note.includes("prior SPX close"), "the series can paint the band and carries the house read");
const ticks = axisTicks(svbSeries.points).filter(Boolean);
const lastTick = `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(svbLast.date.slice(5, 7)) - 1]} ${Number(svbLast.date.slice(8))}`;
assert(ticks[0] === "Aug 3" && ticks.at(-1).startsWith(lastTick) && ticks.length <= 8, `axis ticks ${ticks}`);

/* Spot Vol Beta session closes: the gauge close and the desk estimate close, appended by the weekday close routine. */
const svbCloseDef = svbSchema.$defs.close;
assert(JSON.stringify(svbCloseDef.required) === '["date","svb","spx","origin"]', `close requires ${svbCloseDef.required}`);
assert(JSON.stringify(svbCloseDef.properties.origin.enum) === '["seed","close-routine"]', "close origin is seed or close-routine");
assert(JSON.stringify(svbCloseDef.properties.estimate.required) === '["uvDelta","spxPct","value"]', "desk estimate close keeps its inputs");
assert(svbCloseDef.properties.vixCloseMove.description.includes("Close-based"), "formal vol event is close-based");
svbSeries.points.forEach((point, index) => {
  const where = `svb close ${point.date}`;
  if (point.estimate) {
    assert(point.estimate.value === deskEstimate(point.estimate.uvDelta, point.estimate.spxPct, svbSeries.deskBeta), `${where} desk estimate ${point.estimate.value} is not ${FORMULA}`);
    assert(index > 0 && point.estimate.spxPct === closeSpxPct(point, svbSeries.points[index - 1]), `${where} SPX % ${point.estimate.spxPct} does not match the prior close`);
  }
  if (point.origin === "close-routine") {
    assert(point.estimate && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(point.recordedAt ?? ""), `${where} routine close carries the desk estimate and recordedAt`);
    assert(svbSeries.points.slice(index + 1).every((later) => later.origin === "close-routine"), `${where} seeded closes are never appended after routine closes`);
  }
});
assert(svbSeries.points.filter((point) => point.estimate).length >= 10, "the card has at least ten desk estimate closes to list");
const svbRows = closeRows(svbSeries, 10);
assert(svbRows.length === 10 && svbRows[0].date === svbLast.date && svbRows.at(-1).date < svbRows[0].date, "close history lists the last ten sessions, newest first");
const oct29 = svbRows.find((row) => row.date === "2026-10-29");
assert(oct29 && oct29.gauge === "1.84" && oct29.estimate === "1.47" && oct29.spxPct === "+0.27%" && oct29.event.label === "Below 2", `Oct 29 close row ${JSON.stringify(oct29)}`);
assert(oct29.origin === "Seeded" && oct29.seeded, "seeded closes are labelled Seeded");
assert(closeEvent(formal).label === "Formal vol event" && closeEvent(marked).label === "≥ 2 · no formal event" && closeEvent(quiet).label === "Below 2", "close read follows the ≥ 2 band and the VIX close rule");
assert(closeEvent({ svb: 1.2, vixCloseMove: 2.5 }).label === "VIX close +2 · gauge under 2", "a VIX close move without the band is not a formal vol event");
const builtClose = buildClose({ date: "2026-10-30", svb: 2.71, spx: 6801.2 }, { date: "2026-11-02", svb: 1.92, spx: 6801.25, uvDelta: 2.1, vixCloseMove: 1.4, recordedAt: "2026-11-02T15:55:00-06:00" });
assert(
  JSON.stringify(builtClose) ===
    '{"date":"2026-11-02","svb":1.92,"spx":6801.25,"vixCloseMove":1.4,"origin":"close-routine","recordedAt":"2026-11-02T15:55:00-06:00","estimate":{"uvDelta":2.1,"spxPct":0,"value":2.1}}',
  `buildClose ${JSON.stringify(builtClose)}`,
);
for (const [input, message] of [
  [{ date: "2026-10-30", svb: 1, spx: 6800 }, "a close at or before the last session"],
  [{ date: "2026-11-07", svb: 1, spx: 6800 }, "a Saturday close"],
  [{ date: "2026-11-02", svb: Number.NaN, spx: 6800 }, "a close without a gauge"],
  [{ date: "2026-11-02", svb: 1, spx: 6800, recordedAt: "2026-11-02 15:55" }, "a recordedAt without an offset"],
]) {
  let threw = false;
  try {
    buildClose({ date: "2026-10-30", svb: 2.71, spx: 6801.2 }, input);
  } catch {
    threw = true;
  }
  assert(threw, `buildClose refuses ${message}`);
}
const svbIndex = JSON.parse(readFileSync(join(svbDir, "index.json"), "utf8"));
assert(svbIndex.routine?.cadence.includes("3:30 PM CT") && svbIndex.routine.command.startsWith("npm run svb:close"), "series index documents the weekday 3:30 CT close routine");
const publicWall = readFileSync(join(root, "index.html"), "utf8");
const volPage = readFileSync(join(root, "vol/index.html"), "utf8");
assert(publicWall.includes(">Vol Stress</h2>") && publicWall.includes("NY Highs − Lows") && publicWall.includes("NY Advance − Decline"), "the public Dashboard wall names Vol Stress, NY highs−lows, and advance−decline");
assert(!/Spot Vol Beta|UV_|desk estimate|svb-dial/i.test(publicWall + volPage), "the public wall hides the gauge, the formula, and the old name");
assert(!publicWall.includes("on the day") && !publicWall.includes("MA(8)"), "the public wall does not ship the breadth status strip");
const familyWall = readFileSync(join(root, "insight/vol/index.html"), "utf8");
assert(FAMILY_ENTRY === "m4c8q" && familyWall.includes(`data-family-entry="${FAMILY_ENTRY}"`) && familyWall.includes('src="/src/hub-gate.js"') && familyWall.includes('id="vault-content"'), "the gauge stays on the family wall");
assert(svbJs.includes("isFamilySurface") && svbJs.includes("publicBody") && svbJs.includes("svbDial("), "family renders the gauge and the public card renders the desk number");
assert(readFileSync(join(root, "positioning/desk/index.html"), "utf8").includes(">Trade Idea</h2>"), "the public desk names Trade Idea");
assert(!readFileSync(join(root, "positioning/desk/index.html"), "utf8").includes("Study desk"), "Study desk is renamed on the public desk");
const ideasPage = readFileSync(join(root, "positioning/ideas/index.html"), "utf8");
assert(viteConfig.includes('"positioning/ideas/index.html"') && ideasPage.includes('id="pack"') && ideasPage.includes('data-public="1"'), "trade ideas render on the public Dashboard");
validatePack(svbSchema, svbCloseDef, svbIndex.routine.example, "svb.index.routine.example");
assert(svbIndex.routine.example.origin === "close-routine" && svbIndex.routine.example.estimate.value === deskEstimate(svbIndex.routine.example.estimate.uvDelta, svbIndex.routine.example.estimate.spxPct), "routine example is a valid close");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
assert(packageJson.scripts["svb:close"] === "node scripts/svb-close.mjs" && existsSync(join(root, "scripts/svb-close.mjs")), "npm run svb:close appends a close");
for (const piece of ["closesBlock(series)", "Session closes", "Gauge close", "Desk estimate close", "Entered by", "svb-close-table"]) assert(svbJs.includes(piece), `Spot Vol Beta card renders ${piece}`);
assert(css.includes(".svb-close-table") && css.includes(".svb-origin.is-seed"), "close history has a table and a seeded tag");

/* Breadth cards on the same wall: NY and Nasdaq Summation, 1Y / 1D default, 10Y range, −1000 buy line. */
assert(wallPage.includes('src="/src/vault-breadth.js"'), "wall page runs the breadth cards");
for (const [id, label] of [["nysi", "NY Summation"], ["nasi", "Nasdaq Summation"]]) {
  assert(wallTemplate.includes(`<article class="pchart is-wide bw-card" id="${id}" data-breadth="${id}"`), `wall carries the ${label} card`);
  assert(wallTemplate.includes(`>${label}</h2>`) && wallTemplate.includes(`<a href="#${id}">${label}</a>`), `wall names ${label} and links it from the subnav`);
}
assert(!/data-breadth|bw-card/.test(wallOutside), "breadth cards do not render outside the template");
assert(!statSync(join(root, "vault/wall"), { throwIfNoEntry: false }) && !viteConfig.includes("vault/wall/"), "breadth lives on the one Vault wall, not a second /vault/wall/ page");
assert(vaultTemplate.includes("NY · Nasdaq Summation"), "Vault home wall tile names the breadth cards");
assert(DEFAULT_MONTHS === 12 && MAX_MONTHS === 120 && BUY_LINE === -1000, "wall defaults: 1Y window, 10Y range, −1000 buy line");
assert(JSON.stringify(RANGES.map((range) => range.label)) === '["3M","6M","1Y","2Y","3Y","5Y","10Y"]', `wall range presets ${RANGES.map((range) => range.label)}`);
assert(monthsBack("2026-10-29", 12) === "2025-10-29" && monthsBack("2026-03-31", 1) === "2026-02-28", "monthsBack keeps the calendar day");
const breadthDir = join(root, "public/data/vault/breadth");
const breadthIndex = JSON.parse(readFileSync(join(breadthDir, "index.json"), "utf8"));
assert(breadthIndex.period === "1D" && breadthIndex.defaultRangeMonths === 12 && breadthIndex.maxRangeMonths === 120, "wall index: daily, 1Y default, 10Y range");
assert(JSON.stringify(breadthIndex.charts.map((chart) => chart.id)) === '["nysi","nasi","nyhl","nyad"]' && breadthIndex.overlay.id === "spx", "wall charts are NYSI, NASI, NYHL, and NYAD over SPX");
const breadthSpx = JSON.parse(readFileSync(join(breadthDir, breadthIndex.overlay.file), "utf8"));
const breadthDocs = Object.fromEntries(breadthIndex.charts.map((chart) => [chart.id, JSON.parse(readFileSync(join(breadthDir, chart.file), "utf8"))]));
const breadthWant = {
  nysi: { label: "NY Summation", symbol: "NYSI", close: -504.41, ma: -605.79, chg: 43.36, pct: 7.92 },
  nasi: { label: "Nasdaq Summation", symbol: "NASI", close: -699.51, ma: -769.33, chg: 33.01, pct: 4.51 },
};
for (const doc of [breadthDocs.nysi, breadthDocs.nasi, breadthSpx]) {
  const where = `wall ${doc.id}`;
  const bars = doc.bars;
  assert(doc.asOf === breadthIndex.asOf && bars[bars.length - 1].t === breadthIndex.asOf, `${where} runs to ${breadthIndex.asOf}`);
  assert(bars.every((bar, i) => /^\d{4}-\d{2}-\d{2}$/.test(bar.t) && Number.isFinite(bar.c) && (i === 0 || bar.t > bars[i - 1].t)), `${where} bars are dated closes in order`);
  assert(breadthWindowStart(bars, MAX_MONTHS) >= 7, `${where} covers ten years plus the MA(8) lead-in`);
  assert(JSON.stringify(bars.map((bar) => bar.t)) === JSON.stringify(breadthDocs.nysi.bars.map((bar) => bar.t)), `${where} sessions line up with NYSI`);
}
for (const [id, want] of Object.entries(breadthWant)) {
  const doc = breadthDocs[id];
  assert(doc.label === want.label && doc.symbol === want.symbol, `wall ${id} label ${doc.label}`);
  assert(doc.buyLine === -1000 && doc.ma === 8, `wall ${id} buy line ${doc.buyLine} and MA(${doc.ma})`);
  const at = doc.bars.findIndex((bar) => bar.t === "2026-10-29");
  assert(at >= 0 && doc.bars[at].c === want.close, `wall ${id} Oct 29 close ${doc.bars[at]?.c}`);
  assert(breadthSma(doc.bars, 8)[at] === want.ma, `wall ${id} Oct 29 MA(8) ${breadthSma(doc.bars, 8)[at]}`);
  const change = dayChange(doc.bars, at);
  assert(change.chg === want.chg && change.pct === want.pct, `wall ${id} Oct 29 change ${change.chg} (${change.pct}%)`);
  const firstOfYear = doc.bars[breadthWindowStart(doc.bars, DEFAULT_MONTHS)].t;
  assert(firstOfYear >= monthsBack(breadthIndex.asOf, 12) && firstOfYear <= "2025-11-03", `wall ${id} 1Y window opens ${firstOfYear}`);
  const read = breadthRead(doc);
  assert(read.buy === -1000 && read.touches > 0 && read.lastTouch, `wall ${id} finds closes through the buy line in ten years`);
}
for (const [id, spec] of [
  ["nyhl", { average: "sma", period: 50 }],
  ["nyad", { average: "ema", period: 89 }],
]) {
  const doc = breadthDocs[id];
  assert(doc.kind === "cumulative" && doc.average === spec.average && doc.period === spec.period && doc.defaultRangeMonths === (id === "nyhl" ? 60 : 36), `${id} is the cumulative line`);
  assert(doc.asOf === "2026-10-30" && doc.bars.at(-1).t === "2026-10-30" && doc.spx.at(-1).t === "2026-10-30" && doc.spx.at(-1).c === 7580.07, `${id} runs through the Oct 30 close`);
  assert(doc.bars.length === doc.spx.length && doc.bars.every((bar, i) => bar.t === doc.spx[i].t && (i === 0 || bar.t > doc.bars[i - 1].t)), `${id} sessions line up with its S&P 500 context`);
  const avg = averageOf(doc.bars, doc);
  const crosses = averageCrosses(doc.bars.map((bar) => bar.c), avg);
  assert(crosses.some((cross) => cross.side === "above") && crosses.some((cross) => cross.side === "below"), `${id} marks crosses above and below the average`);
}

/* Vault portfolio: personal book, gated like the other Vault pages. Open lines are still held. */
const bookFile = "vault/portfolio/index.html";
assert(viteConfig.includes(`"${bookFile}"`), `vite builds ${bookFile}`);
const bookPage = readFileSync(join(root, bookFile), "utf8");
assert(bookPage.includes('<body class="is-vault">'), "portfolio page carries the Vault theme");
assert(bookPage.includes('src="/src/vault-gate.js"') && bookPage.includes('src="/src/vault-portfolio.js"'), "portfolio page runs the gate and the journal");
assert(/class="lockup" href="\.\.\/\.\.\/"/.test(bookPage), "portfolio lockup links home");
const bookMain = bookPage.match(/<main id="content">([\s\S]*?)<\/main>/)?.[1] ?? "";
const bookTemplate = bookMain.match(/<template id="vault-content">([\s\S]*?)<\/template>/)?.[1] ?? "";
const bookOutside = bookMain.replace(/<template id="vault-content">[\s\S]*?<\/template>/, "");
assert(/<section class="vault-wall" id="vault-wall" data-state="checking"/.test(bookOutside), "portfolio sign-in card renders before the gate opens");
assert(/<h1 id="vault-wall-title">Sign in to open Vault<\/h1>/.test(bookOutside), "portfolio page reads Sign in to open Vault");
assert(
  bookOutside.match(/<section class="vault-wall"[\s\S]*?<\/section>/)?.[0].replaceAll('href="../../"', 'href="../"') ===
    vaultOutside.match(/<section class="vault-wall"[\s\S]*?<\/section>/)?.[0],
  "portfolio sign-in card is the same allowlist sign-in card as the Vault",
);
assert(bookTemplate.includes('id="journal"') && bookTemplate.includes('aria-current="page">Portfolio'), "portfolio shell lives in the template");
assert(!/id="journal"|pf-table|pf-board/.test(bookOutside), "portfolio content does not render outside the template");
assert(vaultTemplate.includes('class="tile vault-pack" href="portfolio/"') && vaultTemplate.includes(">Portfolio</h2>"), "signed-in Vault links to Portfolio");
assert(!vaultOutside.includes("portfolio/"), "the portfolio link stays inside the signed-in template");
for (const file of [...dashboardPages, "404.html"]) {
  assert(!readFileSync(join(root, file), "utf8").includes("portfolio/"), `${file} links into the Vault portfolio`);
}
const bookJs = readFileSync(join(root, "src/vault-portfolio.js"), "utf8");
for (const piece of ["data/vault/portfolio/journal.json", "exit_pending_fill", "renderPortfolio", '"vault-open"', "Pending", 'return "Open"', 'status === "open"']) {
  assert(bookJs.includes(piece), `portfolio page keeps ${piece}`);
}
assert(bookJs.includes("!isPending(trade)") || bookJs.includes("!isPending(trade)"), "closed total skips a working close");
const bookPath = join(root, "public/data/vault/portfolio/journal.json");
const book = JSON.parse(readFileSync(bookPath, "utf8"));
assert(bannedAllow.size === 0, "the mock book is not exempt from the source-name scan");
assert(book.schema === "ahead-portfolio-journal-v1", `portfolio schema ${book.schema}`);
assert(book.summary.book === "desk-mock" && book.summary.journal_lock === "2026-10-30-desk-mock" && book.summary.as_of_ct === "2026-10-30 ~3:20 PM CT", "portfolio journal is the desk mock book");
assert(book.summary.starting_balance_usd === 50000 && book.summary.ticket_usd === 4000, "mock book starts at 50000 with a 4000 ticket");
assert(book.summary.closed_pnl_usd === 1321 && book.summary.closed_count === 8 && book.summary.open_count === 4, "portfolio closed PnL, closed count, and open count");
assert(!("account" in book.summary), "mock book has no account identifier");
assert(JSON.stringify(book.summary.open_tickers) === JSON.stringify(["AZN", "NFLX", "GS", "XYZ"]), "open tickers are AZN, NFLX, GS, XYZ");
assert(
  book.summary.by_category.Spotlight === -4409 &&
    book.summary.by_category["Earnings Snapshot"] === 431 &&
    book.summary.by_category["Weekly Radar Earnings Preview"] === 5299,
  "portfolio category totals",
);
assert(book.trades.length === 12, `portfolio has ${book.trades.length} lines`);
assert(
  JSON.stringify(book.trades.map((trade) => trade.id)) ===
    JSON.stringify([
      "desk-fcx-spotlight-43676-lot1",
      "desk-fcx-spotlight-43676-lot2",
      "desk-gld-spotlight-43774",
      "desk-azn-featured-43721",
      "desk-be-earnings-snapshot-2026-10-19",
      "desk-meta-earnings-snapshot-2026-10-19",
      "desk-spcx-earnings-snapshot-2026-10-19",
      "desk-spot-earnings-snapshot-2026-10-19",
      "desk-nflx-earnings-snapshot-2026-10-19",
      "desk-txn-weekly-radar-43728",
      "desk-gs-weekly-radar-43728",
      "desk-xyz-spotlight-43878",
    ]),
  "portfolio lines are the locked twelve",
);
assert(book.trades.every((trade) => trade.ticket_lock === "desk 2026-10-30" && trade.ticket_usd === 4000), "every line is a 4000 ticket");
function ticketPnl(trade) {
  if (trade.exit_price == null || trade.status !== "closed") return null;
  const credit = String(trade.structure ?? "").trim().toLowerCase().startsWith("short");
  const ret = credit ? (trade.entry_price - trade.exit_price) / trade.entry_price : (trade.exit_price - trade.entry_price) / trade.entry_price;
  return Math.round(ret * 4000);
}
assert(book.trades.every((trade) => trade.pnl_usd === ticketPnl(trade)), "displayed PnL is the 4000 ticket, not a brokerage fill");
const byTicker = Object.fromEntries(book.trades.map((trade) => [trade.id, trade]));
const meta = byTicker["desk-meta-earnings-snapshot-2026-10-19"];
assert(meta.status === "closed" && meta.outcome === "loss" && meta.pnl_usd === -3253 && bookSide(meta) === "closed", "META is a filled close on the Closed tab");
assert(!isPending(meta) && !isOpen(meta) && resultLabel(meta) === "Loss", "META reads as a closed loss");
const xyz = byTicker["desk-xyz-spotlight-43878"];
assert(xyz.qty === 11 && xyz.entry_price === 3.5173 && xyz.status === "open" && xyz.outcome === "open" && bookSide(xyz) === "open", "XYZ is 11 at 3.5173 and lands on the Open tab");
assert(formatPx(xyz.entry_price) === "3.5173", `XYZ average renders ${formatPx(xyz.entry_price)}`);
assert(formatUsd(null) === "—" && formatUsd(undefined) === "—" && formatBook(50000) === "$50,000", "a missing PnL stays blank and the book prints unsigned");
const nflx = byTicker["desk-nflx-earnings-snapshot-2026-10-19"];
assert(nflx.status === "open" && nflx.outcome === null && nflx.pnl_usd === null, "NFLX stays open with an empty outcome");
assert(isOpen(nflx) && !isPending(nflx) && resultLabel(nflx) === "Open" && bookSide(nflx) === "open", "NFLX reads as open, not pending");
assert(
  JSON.stringify(book.trades.filter(isOpen).map((trade) => trade.ticker)) === JSON.stringify(["AZN", "NFLX", "GS", "XYZ"]),
  "open rows are AZN, NFLX, GS, XYZ",
);
assert(book.trades.filter((trade) => bookSide(trade) === "closed").map((trade) => trade.ticker).length === 8, "eight closed lines");
assert(book.trades.filter((trade) => bookSide(trade) === "open").length === 4, "four lines land on the Open tab");
assert(!book.trades.some(isPending), "this lock has no working close");
for (const [id, pnl] of [
  ["desk-fcx-spotlight-43676-lot1", 1210],
  ["desk-spcx-earnings-snapshot-2026-10-19", 743],
  ["desk-spot-earnings-snapshot-2026-10-19", 5863],
  ["desk-txn-weekly-radar-43728", 5299],
]) {
  assert(byTicker[id].outcome === "win" && byTicker[id].pnl_usd === pnl && resultLabel(byTicker[id]) === "Win", `${id} win ${pnl}`);
}
assert(resultLabel(book.trades[0]) === "Win" && resultLabel(book.trades[1]) === "Loss", "filled lines keep win and loss");
const working = { status: "exit_pending_fill", outcome: "loss_pending", pnl_usd: -1 };
assert(isPending(working) && !isOpen(working) && resultLabel(working) === "Pending" && bookSide(working) === "open", "a working close stays pending and on the Open tab");
assert(closedPnl(book) === book.summary.closed_pnl_usd, `closed sum ${closedPnl(book)} drifted from the lock`);
const path = equityPath(book);
assert(path.start === 50000 && path.equity === 51321 && path.points.length === 9, `mock equity path ${path.equity}`);
assert(bookJs.includes("dataset.tab") && bookJs.includes('["open"') && bookJs.includes("bookSide") && bookJs.includes("pf-curve"), "portfolio renders status tabs and the book path");
assert(css.includes(".pf-result.is-pending") && css.includes(".pf-result.is-open") && css.includes(".pf-table") && css.includes(".pf-tabs"), "portfolio table styles closed, pending, open rows, and tabs");

/* Portfolio: the page never shows a source name from the mock journal, the week strip reads the journal's own ISO week, and marks stay blank until the journal carries them. */
const shownFields = [book.summary.event, book.summary.journal_lock, book.summary.sources_note, book.summary.as_of_ct];
for (const trade of book.trades) shownFields.push(trade.notes, trade.ticket_lock, trade.title, trade.structure, trade.category, trade.ticket?.exact_ticket);
for (const text of shownFields) {
  const shown = deskCopy(text);
  const hit = bannedSource(shown) || (/\bwsj\b|wall street journal/i.test(shown) ? "wsj" : "");
  assert(!hit, `portfolio shows "${hit}" in ${shown}`);
}
assert(deskCopy(book.summary.event) === "Desk mock book", `portfolio headline ${deskCopy(book.summary.event)}`);
assert(deskCopy(xyz.ticket_lock) === "desk 2026-10-30" && deskCopy(byTicker["desk-be-earnings-snapshot-2026-10-19"].notes).includes("Call spread"), "journal copy stays on the ticket");
assert(deskCopy(["Options", "Hawk", " ", "Vol", "land"].join("")) === "", "a line that would still name a source is dropped");
for (const piece of ["deskCopy(summary.event)", "deskCopy(trade.notes)", "deskCopy(trade.ticket_lock)", "deskCopy(summary.journal_lock)"]) {
  assert(bookJs.includes(piece), `portfolio scrubs ${piece}`);
}
assert(!/summary\.event\)\);|trade\.notes\)\);|"pf-lock", trade\.ticket_lock/.test(bookJs), "portfolio does not render raw journal copy");
assert(stopOf(xyz) === 70 && targetOf(xyz) === 90 && stopOf(nflx) === null && targetOf(nflx) === null, "open lines read stop and target from the journal");
assert(JSON.stringify(markOf(xyz)) === '{"price":null,"pnl":null,"asOf":"","marked":false}', "a line without mtm fields has no mark");
assert(JSON.stringify(markOf({ mtm_price: 4.1, mtm_pnl_usd: 643, mtm_as_of_ct: "2026-10-30 3:00 PM CT" })) === '{"price":4.1,"pnl":643,"asOf":"2026-10-30 3:00 PM CT","marked":true}', "mtm fields read through");
assert(markOf({ mtm_price: "4.1", mtm_pnl_usd: Number.NaN }).marked === false, "a malformed mark stays blank");
const strip = weekStrip(book);
assert(strip.week === "2026-W44" && strip.start === "2026-10-26" && strip.end === "2026-11-01", `portfolio week ${strip.week}`);
assert(strip.closedPnl === -6495 && strip.closedCount === 5 && strip.wins === 1 && strip.losses === 4, `week closed ${strip.closedPnl} over ${strip.closedCount}`);
assert(JSON.stringify(strip.closedTickers) === '["FCX","GLD","BE","META","TXN"]' && strip.openCount === 4 && strip.markedCount === 0 && strip.markPnl === null, "week strip closes and open count");
const markedBook = structuredClone(book);
markedBook.trades.filter(isOpen).forEach((trade, index) => Object.assign(trade, { mtm_price: 1, mtm_pnl_usd: index * 10, mtm_as_of_ct: "2026-10-30 3:00 PM CT" }));
assert(weekStrip(markedBook).markPnl === 60 && weekStrip(markedBook).markedCount === 4, "open marks total only when every open line is marked");
assert(css.includes(".pf-week-cells") && css.includes(".pf-open-grid"), "portfolio styles the week strip and open lines");
const bookSchema = JSON.parse(readFileSync(join(root, "public/data/vault/portfolio/schema.json"), "utf8"));
validatePack(bookSchema, bookSchema, book, "portfolio");
for (const key of ["mtm_price", "mtm_pnl_usd", "mtm_as_of_ct"]) {
  assert(JSON.stringify(bookSchema.$defs.trade.properties[key]?.type) === `["${key === "mtm_as_of_ct" ? "string" : "number"}","null"]` && !bookSchema.$defs.trade.required.includes(key), `portfolio schema has optional ${key}`);
}
validatePack(bookSchema, bookSchema, markedBook, "portfolio with marks");

const printCss = css.slice(css.lastIndexOf("@media print {"));
for (const rule of ["@page {", "#pack #read { break-after: page; }", "#pack #charts { break-before: page; }", "#pack .pack-chart { break-before: page;", "#pack .pack-article { break-inside: avoid; }", "#pack .pack-sheet { display: block;", "body.is-vault .pack-bar"]) {
  assert(printCss.includes(rule), `pack print keeps ${rule}`);
}

/* Vault desk-day archive: an index over committed Desk weeks and New Today days, gated, grouped by ISO week. */
const archiveFile = "vault/archive/index.html";
assert(viteConfig.includes(`"${archiveFile}"`), `vite builds ${archiveFile}`);
const archivePage = readFileSync(join(root, archiveFile), "utf8");
assert(archivePage.includes('<body class="is-vault">'), "archive page carries the Vault theme");
assert(archivePage.includes('src="/src/vault-gate.js"') && archivePage.includes('src="/src/vault-archive.js"'), "archive page runs the gate and the archive");
const archiveMain = archivePage.match(/<main id="content">([\s\S]*?)<\/main>/)?.[1] ?? "";
const archiveTemplate = archiveMain.match(/<template id="vault-content">([\s\S]*?)<\/template>/)?.[1] ?? "";
const archiveOutside = archiveMain.replace(/<template id="vault-content">[\s\S]*?<\/template>/, "");
assert(
  archiveOutside.match(/<section class="vault-wall"[\s\S]*?<\/section>/)?.[0].replaceAll('href="../../"', 'href="../"') ===
    vaultOutside.match(/<section class="vault-wall"[\s\S]*?<\/section>/)?.[0],
  "archive sign-in card is the same allowlist sign-in card as the Vault",
);
for (const piece of ['id="archive-search"', 'id="archive-q"', 'data-kind="all"', 'data-kind="pack"', 'data-kind="day"', 'id="archive-count"', 'id="archive"', 'aria-current="page">Desk-day archive']) {
  assert(archiveTemplate.includes(piece), `archive template has ${piece}`);
}
assert(!/id="archive|archive-search/.test(archiveOutside), "archive content does not render outside the template");
assert(vaultTemplate.includes('class="tile vault-pack" href="archive/"') && !vaultOutside.includes("archive/"), "signed-in Vault links to the archive inside the template");
for (const file of [...dashboardPages, "404.html"]) {
  assert(!readFileSync(join(root, file), "utf8").includes("vault/archive"), `${file} links into the Vault archive`);
}
for (const file of ["vault/soft-crowded/index.html", "vault/vol-credit-momentum/index.html", "vault/portfolio/index.html"]) {
  assert(readFileSync(join(root, file), "utf8").includes('href="../archive/"'), `${file} links to the archive from the Vault nav`);
}
for (const file of Object.keys(vaultSurface)) {
  const ids = [...readFileSync(join(root, file), "utf8").matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const repeated = ids.filter((id, at) => ids.indexOf(id) !== at);
  assert(!repeated.length, `${file} repeats ids across the wall and the template: ${repeated}`);
}
const archiveEntries = [...deskWeekEntries(packIndex), ...newTodayDays(nt.items)];
const carriedRows = packIndex.weeks.filter((row) => row.carryForward);
assert(archiveEntries.filter((entry) => entry.kind === "pack").length === WEEKS.length + carriedRows.length, "archive lists every committed Desk Friday and every carry-forward pack");
assert(
  carriedRows.every((row) => archiveEntries.find((entry) => entry.kind === "pack" && entry.date === row.week)?.label.includes(`Carry-forward of the ${longDay(row.carryForward)} Desk freeze`)),
  "archive labels a carry-forward pack with the freeze it carries",
);
assert(
  JSON.stringify(archiveEntries.filter((entry) => entry.hasPack).map((entry) => [entry.isoWeek, entry.href])) ===
    JSON.stringify(packIndex.weeks.map((row) => [isoWeek(row.week), `../soft-crowded/?week=${isoWeek(row.week)}`])),
  "archive links pack weeks to the pack",
);
assert(archiveEntries.filter((entry) => entry.kind === "pack" && !entry.hasPack).every((entry) => entry.href.startsWith("../../positioning/desk/?source=jpm&week=")), "weeks without a pack open on the Desk");
assert(JSON.stringify(parseDateQuery("W44")) === '{"week":"2026-W44"}' && JSON.stringify(parseDateQuery("2026-w43")) === '{"week":"2026-W43"}', "archive reads ISO weeks");
for (const query of ["2026-10-28", "10/28", "Oct 28", "October 28, 2026", "Wed Oct 28"]) {
  assert(parseDateQuery(query)?.day === "2026-10-28", `archive reads ${query} as Oct 28`);
}
assert(parseDateQuery("XLE") === null, "a ticker is a word search");
const oct28 = archiveGroups(filterEntries(archiveEntries, "2026-10-28"));
const oct28Days = oct28[0]?.entries.filter((entry) => entry.kind === "day") ?? [];
assert(oct28.length === 1 && oct28Days.length === 1 && oct28Days[0].items.length === 8, "archive date search lists the eight Oct 28 items");
assert(oct28[0]?.entries.filter((entry) => entry.kind === "pack").every((entry) => entry.date === "2026-10-30"), "an Oct 28 search also shows that week's Friday pack");
const w44 = archiveGroups(filterEntries(archiveEntries, "W44"));
assert(
  w44.length === 1 && w44[0].week === "2026-W44" && w44[0].entries[0]?.kind === "pack" && w44[0].entries[0].hasPack && w44[0].entries[0].title === "2026-W44 Soft ↔ Crowded" && w44[0].gap === "",
  "W44 leads with its carry-forward pack",
);
const w45Day = { kind: "day", date: "2026-11-04", isoWeek: "2026-W45", items: [] };
assert(archiveGroups([w45Day])[0].gap === "No Soft ↔ Crowded print is committed for Fri Nov 6, 2026 yet.", "a week past the last pack says its Friday print is not committed");
const w43 = archiveGroups(filterEntries(archiveEntries, "2026-W43"));
assert(w43[0]?.entries[0]?.kind === "pack" && w43[0].entries[0].title === "2026-W43 Soft ↔ Crowded" && w43[0].gap === "", "W43 leads with its pack");
const archivePacks = archiveGroups(filterEntries(archiveEntries, "", "pack"));
assert(archivePacks.every((group) => group.entries.every((entry) => entry.kind === "pack")) && archivePacks[0].week === "2026-W44", "Soft ↔ Crowded filter lists packs newest first");
const wordHit = filterEntries(archiveEntries, "goldman", "day");
assert(wordHit.length > 0 && wordHit.every((entry) => entry.items.every((item) => item.text.includes("goldman"))), "a word search cuts a desk day to its matching lines");
assert(displaySource(["W", "SJ"].join("")) === "Press note" && displaySource("GS") === "GS" && displaySource("") === "Desk", "archive press labels read as a press note");
const archiveShown = archiveEntries.flatMap((entry) => [entry.title, entry.label, entry.summary, entry.headline ?? "", ...(entry.items ?? []).flatMap((item) => [item.title, item.summary, item.source])]).join("\n");
assert(!bannedSource(archiveShown) && !/\bwsj\b/i.test(archiveShown), "archive shows no source names");
assert(css.includes(".archive-entry") && css.includes(".archive-gap") && css.includes(".archive-items"), "archive styles entries, gaps, and items");

assert(breadthSpx.bars.find((bar) => bar.t === "2026-10-29")?.c === 7720.39, "wall SPX Oct 29 close 7720.39");
const breadthJs = readFileSync(join(root, "src/vault-breadth.js"), "utf8");
for (const piece of ["data/vault/breadth/", 'input.type = "range"', "MAX_MONTHS", "BUY ", "buyLine", "$SPX", "MA(", "directionRuns", "[data-breadth]", "onDeskReady", "bw-cross"]) {
  assert(breadthJs.includes(piece), `breadth cards render ${piece}`);
}
for (const file of ["src/vault-breadth.js", "src/breadth.js", "scripts/pull-breadth.mjs"]) {
  const text = readFileSync(join(root, file), "utf8");
  assert(!/stockcharts|<img\b|<iframe|©/i.test(text), `${file} carries chart-vendor branding or an embed`);
}

if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log("site checks ok");
