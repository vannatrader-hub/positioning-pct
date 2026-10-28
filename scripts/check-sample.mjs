import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HOUSES, INDICATORS, SECTIONS, readIndicator } from "../src/desk.js";
import { CANON, WEEKS, buildReading, ordinal } from "../src/readings.js";
import { CURRICULUM, creditSpreadMath, leapMath, price } from "../src/study.js";
import { breakeven, chartLevels, resolveExpiry } from "../src/flow-chart.js";
import { SIDES, alertLabel, sortPlays } from "../src/options-flow.js";
import { SECTION_ORDER, STATUS, allPlays, ladderLevels, sortCards } from "../src/spotlights.js";

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
  const plan = CURRICULUM[side];
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
  const math = creditSpreadMath(structures[CURRICULUM[side].spread]);
  const leap = leapMath(structures[CURRICULUM[side].leap]);
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
const flowTickers = ["JCI", "CRWD", "DDOG", "CORT", "QCOM", "MMM", "COIN", "ALAB", "CSCO"];
assert(
  JSON.stringify(sortPlays(flow.plays).map((play) => play.ticker)) === JSON.stringify(flowTickers),
  `flow watchlist newest alert first: ${sortPlays(flow.plays).map((play) => play.ticker)}`,
);
assert(
  JSON.stringify(flow.plays.map((play) => play.ticker)) === JSON.stringify(flowTickers),
  "plays.json is stored newest alert first",
);
const windowStart = new Date(Date.UTC(2026, 9, 27) - 21 * 86400000).toISOString().slice(0, 10);
for (const play of flow.plays) {
  const where = `flow ${play.ticker}`;
  assert(play.confidence === "$$$", `${where} confidence`);
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
    assert(/\d{1,2}\/\d{1,2}$|last week$/.test(line.detail), `${play.ticker} customerPurchased "${line.detail}" names when it traded`);
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
assert(flowBy.QCOM.customerPurchased.length === 0, "QCOM flow names no recent customer trade");
assert(flowBy.QCOM.lead === null, "QCOM has no lead without a recent customer trade");
const qcomBars = JSON.parse(readFileSync(join(root, "public/data/flow/bars/QCOM.json"), "utf8")).bars;
const qcomLevels = chartLevels(flowBy.QCOM, qcomBars);
assert(qcomLevels.lines.length === 0 && !qcomLevels.expiryInView, "QCOM chart draws price only");
const cortBars = JSON.parse(readFileSync(join(root, "public/data/flow/bars/CORT.json"), "utf8")).bars;
assert(
  JSON.stringify(chartLevels(flowBy.CORT, cortBars).lines.map((line) => line.value)) === JSON.stringify([120, 160, 130.94]),
  "CORT chart draws the $120/$160 spread and its break-even",
);
for (const ticker of ["COIN", "ALAB"]) {
  assert(flowBy[ticker].customerPurchased.every((line) => line.detail.includes("sold")), `${ticker} short puts read as sold`);
}
const beWant = { JCI: 163.54, MMM: 179.8, COIN: 123.5, ALAB: 183.8, CORT: 130.94, CRWD: null, DDOG: null, CSCO: null };
for (const [ticker, want] of Object.entries(beWant)) {
  assert(breakeven(flowBy[ticker].lead) === want, `${ticker} break-even ${breakeven(flowBy[ticker].lead)} !== ${want}`);
}
assert(resolveExpiry("December", "2026-10-27") === "2026-12-18", "December resolves to Dec 18, 2026");
assert(resolveExpiry("January", "2026-10-22") === "2027-01-15", "January resolves to Jan 15, 2027");
assert(resolveExpiry("January 2028", "2026-10-25") === "2028-01-21", "January 2028 resolves to Jan 21, 2028");
assert(resolveExpiry("", "2026-10-25") === null, "blank expiry resolves to null");
assert(alertLabel("2026-10-27 05:15 PM CT") === "Alerted Oct 27, 5:15 PM CT", "alert label");
const jciBars = JSON.parse(readFileSync(join(root, "public/data/flow/bars/JCI.json"), "utf8")).bars;
assert(chartLevels(flowBy.JCI, jciBars).expiryInView, "JCI Dec expiry is marked on the chart");
assert(!chartLevels(flowBy.CRWD, JSON.parse(readFileSync(join(root, "public/data/flow/bars/CRWD.json"), "utf8")).bars).expiryInView, "CRWD 2028 expiry stays off the axis");
const chartSource = readFileSync(join(root, "src/flow-chart.js"), "utf8").toLowerCase();
for (const phrase of ["tradingview", "candlestick", "max gain", "dip buyer"]) {
  assert(!chartSource.includes(phrase), `trade-levels chart should not include "${phrase}"`);
}

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

const spot = JSON.parse(readFileSync(join(root, "public/data/flow/spotlights.json"), "utf8"));
assert(spot.live === true && !("sample" in spot), "Spotlight trades are live tickets");
assert(JSON.stringify(spot.sections.map((section) => section.id)) === JSON.stringify(SECTION_ORDER), "Spotlight rows are Active, Open, Closed");
assert(
  JSON.stringify(spot.sections.map((section) => Boolean(section.defaultOpen))) === "[true,false,false]",
  "only the Active row opens by default",
);
const spotRows = Object.fromEntries(spot.sections.map((section) => [section.id, section.plays.map((play) => play.ticker)]));
assert(JSON.stringify(spotRows) === JSON.stringify({ active: ["GLD", "FCX"], open: ["HOOD", "FSLY"], closed: ["V"] }), `Spotlight rows ${JSON.stringify(spotRows)}`);
const { start: activeStart, end: activeEnd } = spot.activeWindow;
assert(activeStart.startsWith("2026-10-") && activeEnd.startsWith("2026-10-") && activeEnd === spot.asOf, "Active window sits inside October 2026");
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
      assert(/^https:\/\/x\.com\//.test(play.closeEvidenceUrl), `${where} close evidence ${play.closeEvidenceUrl}`);
    }
    const lines = ladderLevels(play);
    assert(lines.length === play.levels.length, `${where} has a level with an unknown label`);
    const by = Object.fromEntries(lines.map((line) => [line.kind, line.value]));
    assert(by.stop === play.stop && by.target === play.target && by.be === play.breakeven && by.spot === play.spotAtPost, `${where} ladder matches stop/target/B/E/spot`);
    assert(play.side === "puts" ? play.target < play.stop : play.target > play.stop, `${where} target sits past the stop`);
  }
}
const spotBy = Object.fromEntries(allPlays(spot).map((play) => [play.ticker, play]));
const spotWant = {
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
assert(spotBy.V.closedAt === "2026-10-12" && spotBy.V.result === "+107%", "V closed Oct 12 at +107%");
assert(JSON.stringify(ladderLevels(spotBy.FCX).map((line) => line.value)) === "[80,78.25,75,69.2,63]", "FCX ladder runs target $80 down to stop $63");
const spotPage = readFileSync(join(root, "options-flow/spotlights/index.html"), "utf8");
for (const id of ["spot-rows", "spot-card", "sc-rec", "sc-close-note", "sl-tiles", "sl-ladder"]) {
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
  assert(name.panels && name.desk_analysis, `${where} trade card panels`);
});
assert(/^Advisory only/.test(board.advisory), "scorecard keeps the advisory-only footer");
for (const item of board.spotlight_watch) assert(item.ticker && item.title && item.structure, `spotlight watch ${item.ticker}`);

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
