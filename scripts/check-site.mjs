import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GLOW_CROWDED_MIN, GLOW_SOFT_MAX, HOUSES, INDICATORS, SECTIONS, drift, extremeOf, isSoftCrowded, readIndicator } from "../src/desk.js";
import { CANON, JPM_MONITOR_REF, WEEKS, buildReading, formatWeek, ordinal } from "../src/readings.js";
import { STRUCTURES, creditSpreadMath, leapMath, price } from "../src/study.js";
import { calendarDays, callValue, expirationPnL, markPnL, pickStrikes, spreadStats } from "../src/analyzer-math.js";
import { breakeven, chartLevels, resolveExpiry } from "../src/flow-chart.js";
import { SIDES, alertLabel, sortPlays } from "../src/options-flow.js";
import { SECTION_ORDER, STATUS, allPlays, levelKind, outcomeLabel, sortCards, spotlightLevels, spotlightLines } from "../src/spotlights.js";
import { activeSpotlights, earningsBoxes, spotlightStar, tradeDates } from "../src/scorecard.js";
import { VAULT_ALLOWLIST, isAllowlisted } from "../src/vault-allowlist.js";
import { FAMILY_ALLOWLIST, FAMILY_ENTRY } from "../src/family-allowlist.js";
import { PRODUCT_FEEDS } from "../src/product-feeds.js";
import { errorCopy, nextStep } from "../src/vault-signin.js";
import { NT_SECTIONS, PUBLIC_NT_SECTIONS, SOURCE_LABELS, catchUpChip, catchUpCountText, catchUpDays, catchUpSummary, catchUpWindowLabel, dayRelation, deskDay, deskDayStart, deskStateUrl, deskWindow, earlierState, emptyDeskMessage, feedLine, itemsForDay, laterState, publicDeskItems, readDeskState, rowDayLabel, visibleDeskItems, windowLabel, yesterdayNote } from "../src/new-today-window.js";
import { itemFromSoftCrowded, itemFromVolStress, planNewToday, runSelfTest, scrubCopy } from "./new-today-pack.mjs";
import { BUY_LINE, CROWDED_PCTILE, DEFAULT_MONTHS, MAX_MONTHS, PCT_RAILS, RANGES, SOFT_PCTILE, averageCrosses, averageOf, breadthRead, bucketPctile, dayChange, monthsBack, percentileRank, pctileOrdinal, pctileRead, sma as breadthSma, windowStart as breadthWindowStart } from "../src/breadth.js";
import { CSR_PARAMS, biasOf, csrPanel, csrSeries, cycleOf, panelText, regimeOf as csrRegimeOf, zColor } from "../src/csr.js";
import { buildPulse, creditChip, cushionOf, runwayMarker } from "../src/pulse-pack.js";
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
  sectorAsOf,
  sectorChart,
  shortWeek,
  softVolChart,
  weekMark,
} from "../src/pct-charts.js";
import { columnMoves, isoWeek, isoWeekRange, packFrame } from "../src/vault-pack-frame.js";
import { FORMULA, axisTicks, buildClose, closeEvent, closeRows, closeSpxPct, deskEstimate, formatSvb, gaugeFraction, readout, spotVolTip } from "../src/vault-svb.js";
import { JPM_VOL, VOL_SHIFT } from "../src/series.js";
import {
  SERIES_BREAK,
  SERIES_BREAK_LABEL,
  bucketOf,
  buildSoftVolClose,
  hv20,
  hubFact,
  liveRead,
  softVolOf,
  tipLines,
} from "../src/soft-vol.js";
import { archiveGroups, deskWeekEntries, displaySource, filterEntries, longDay, newTodayDays, parseDateQuery } from "../src/vault-archive.js";
import { THEMES, THEME_KEY, THEME_PAGE, resolveTheme } from "../src/theme.js";
import { MARKET_HEALTH_ROWS, MARKET_HEALTH_STATES, MARKET_HEALTH_WEEKS } from "../src/market-health.js";
import {
  BUYABLE_ROWS,
  GLOBAL_FUND_PROXIES,
  GLOBAL_FUND_UNCONFIRMED,
  NAAIM_PROXIES,
  SHARPIES_PROXIES,
  SOFT_VOL_PRINTS,
  biasPhrase,
  bucketCredit,
  bucketCumulative,
  bucketMag7,
  bucketSoftVol,
  bucketSpxEma,
  bucketSummation,
  bucketSvb,
  buildMarketHealth,
  creditIsStress,
  paintCell,
  svbSurge,
  vixSurge,
} from "../src/market-health-engine.js";
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
    if (isSoftCrowded(read.ends)) {
      assert(/^(very )?(soft|crowded) → (stretching|unwinding|steady)$|^mid → (stretching|unwinding|steady)$/.test(read.pill), `${indicator.id} pill "${read.pill}"`);
    } else {
      const scale = [read.ends[0].toLowerCase(), "mid", read.ends[1].toLowerCase()];
      assert(scale.includes(read.pill), `${indicator.id} week ${week} custom-scale chip "${read.pill}" must be a ${read.ends.join(" ↔ ")} level word`);
      const doublespeak = read.pill.replace(read.ends[0].toLowerCase(), "");
      assert(!/stretching|unwinding|steady|→/.test(doublespeak), `${indicator.id} week ${week} custom-scale chip "${read.pill}" uses Stretching / Unwinding drift`);
    }
    assert(read.extreme === extremeOf(read.pct, read.ends), `${indicator.id} week ${week} extreme follows the level`);
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

/* Soft ↔ Crowded extreme glow (CEO 2026-10-31): level only, Stretching / Unwinding chips. */
assert(drift(97, 78) === "stretching" && drift(63, 69) === "unwinding", "crowded side: up stretches, down unwinds");
assert(drift(16, 32) === "stretching" && drift(30, 18) === "unwinding", "soft side: down stretches, up unwinds");
assert(drift(77, 79) === "steady" && drift(50, 60) === "unwinding", "small moves are steady; landing on mid unwinds");
assert(extremeOf(GLOW_SOFT_MAX) === "soft" && extremeOf(GLOW_SOFT_MAX + 1) === null, "soft glow at or under the soft line");
assert(extremeOf(GLOW_CROWDED_MIN) === "crowded" && extremeOf(GLOW_CROWDED_MIN - 1) === null, "crowded glow at or over the crowded line");
assert(extremeOf(16, ["Unwinding", "Extending"]) === null, "glow is for Soft ↔ Crowded scale cards only");
const latestReads = INDICATORS.map((indicator) => readIndicator(indicator, WEEKS.length - 1));
const readById = (id) => latestReads.find((read) => read.id === id);
assert(readById("gs-mag7").extreme === "crowded" && readById("gs-mag7").pill === "very crowded → stretching", `Mag 7 ${readById("gs-mag7").pill}`);
assert(readById("jpm-smh-retail").extreme === "crowded", "SMH retail at the 98th glows crowded");
assert(readById("gs-semis-software").extreme === null && readById("gs-semis-software").pill === "crowded → unwinding", "Semis vs software stays quiet");
assert(readById("gs-global-ai").extreme === null, "Global AI at the 77th stays quiet");

/* Custom-scale chips (CEO 2026-10-31): scale-native level word only, never Stretching / Unwinding drift. */
const customReads = latestReads.filter((read) => !isSoftCrowded(read.ends));
assert(customReads.length >= 7, `expected at least 7 custom-scale cards, got ${customReads.length}`);
assert(readById("desk-ai-pair").pill === "unwinding" && readById("desk-ai-pair").extreme === null, `AI enablers vs hyperscalers chip "${readById("desk-ai-pair").pill}"`);
assert(readById("ms-momentum").pill === "unwinding" && readById("ms-momentum").extreme === null, `Momentum chip "${readById("ms-momentum").pill}"`);
assert(readById("gs-region-flow").pill === "net sold", `Prime region flow chip "${readById("gs-region-flow").pill}"`);
assert(readById("desk-cta").pill === "de-risking", `CTA chip "${readById("desk-cta").pill}"`);
assert(readById("desk-cb-tightening").pill === "tightening", `CB tightening chip "${readById("desk-cb-tightening").pill}"`);
assert(readById("desk-breadth").pill === "mid" && readById("boa-hikes-cuts").pill === "mid", "Narrow ↔ Broad and Easing ↔ Tightening mid chips");
for (const read of customReads) {
  assert(!/stretching|unwinding → |→ unwinding|steady/.test(read.pill), `${read.id} custom-scale chip "${read.pill}" is Stretching / Unwinding doublespeak`);
}
assert(readById("jpm-retail-impulse").pill === "very soft → stretching", `Soft ↔ Crowded soft side keeps its direction: ${readById("jpm-retail-impulse").pill}`);
assert(readById("jpm-broad").pill === "crowded → unwinding", `Soft ↔ Crowded unwinding stays: ${readById("jpm-broad").pill}`);
const glowing = latestReads.filter((read) => read.extreme);
assert(glowing.length > 0 && glowing.length <= latestReads.length / 3, `${glowing.length} of ${latestReads.length} cards glow; tighten the thresholds`);
const glowCss = readFileSync(join(root, "src/styles.css"), "utf8");
assert(glowCss.includes(`--sc-glow-soft-max: ${GLOW_SOFT_MAX};`) && glowCss.includes(`--sc-glow-crowded-min: ${GLOW_CROWDED_MIN};`), "glow tokens match the desk thresholds");
const glowRules = [...glowCss.matchAll(/\.sc-card\[data-extreme[^{]*\{([^}]*)\}/g)].map((match) => match[1]).join("");
assert(glowRules.includes("box-shadow") && !/border(-width)?\s*:|outline\s*:/.test(glowRules), "extreme cards glow with a shadow, never an outline");
const deskJs = readFileSync(join(root, "src/positioning.js"), "utf8");
assert(deskJs.includes("sc-card") && deskJs.includes("card.dataset.extreme = read.extreme"), "desk theme cards carry data-extreme");

/* Pulse + TTWD pick-3: thesis, runway, HY/IG/excess trio, track dials, bull/bear, family brief. */
assert(creditChip(12, 2).chip === "Widening fast" && creditChip(3, 3).chip === "Widening" && creditChip(9, -1).chip === "Widening" && creditChip(0, 0).chip === "Quiet", "credit chips follow the day and the month");
assert(cushionOf(97) === 0 && cushionOf(77) === 13 && runwayMarker(0) === 3, "a theme inside the Crowded extreme has no cushion and sits on the trigger");
const pulseIndex = JSON.parse(readFileSync(join(root, "public/data/vault/soft-crowded/index.json"), "utf8"));
const pulseCsr = JSON.parse(readFileSync(join(root, "public/data/vault/credit-spread-regime/csr.json"), "utf8"));
const pulseSvb = JSON.parse(readFileSync(join(root, "public/data/vault/spot-vol-beta/latest.json"), "utf8"));
const pulseXlf = buildReading("jpm", WEEKS.length - 1, 4).sectors.XLF;
const pulse = buildPulse({ csr: pulseCsr, vol: pulseSvb.gauge, asOf: pulseSvb.session, financials: { points: pulseXlf.points }, weeks: pulseIndex.weeks });
assert(pulse.title.signal === "Mag 7 crowding is the story" && pulse.title.rest.startsWith("semis are unwinding") && pulse.title.tone === "crowded", "thesis leads with Mag 7 crowding");
assert(pulse.runway.cushion === 0 && pulse.runway.pills.map((pill) => pill.text).join("") === "Near triggerArmed", "runway is armed on the extreme and near-trigger on credit");
assert(pulse.runway.callout.includes("NEAR TRIGGER") && pulse.runway.callout.includes("326 bp"), `credit callout ${pulse.runway.callout}`);
assert(JSON.stringify(pulse.credit.legs.map((leg) => leg.id)) === '["hy","ig","excess"]', "credit trio is HY, IG, and the excess — csr.json has no BBB or AA column");
assert(pulse.credit.legs[0].bp === 326 && pulse.credit.legs[0].chip === "Widening fast" && pulse.credit.legs[1].bp === 89 && pulse.credit.legs[2].bp === 237, "credit cards use the committed Oct 29 prints");
assert(pulse.dials[0].extreme === "crowded" && pulse.dials[1].extreme === null && pulse.dials[1].pill === "crowded → unwinding" && pulse.dials[3].extreme === "soft", "dials glow only at the Soft and Crowded extremes");
assert(pulse.dials.every((dial) => /→ (stretching|unwinding|steady)$/.test(dial.pill)) && pulse.layers.length === 6, "layer cards stay on the Soft ↔ Crowded scale");
assert(pulse.cases.bull.length >= 3 && pulse.cases.bull.length <= 5 && pulse.cases.bear.length >= 3 && pulse.cases.bear.length <= 5, "bull and bear each close with 3 to 5 bullets");
assert(pulse.cases.bear.some((line) => line.includes("2.98")) && pulse.brief.paragraphs.map((paragraph) => paragraph.kw).join("") === "Soft↔Crowded.Credit.What changes the current picture.Note.", "the brief and the bear case use the W44 vol print");
assert(!/bbb|aa\b/i.test(pulse.credit.legs.map((leg) => leg.label).join(" ")), "the credit cards do not invent a BBB or AA series");
const pulseCss = readFileSync(join(root, "src/styles.css"), "utf8");
assert(pulseCss.includes("--p-armed: #c43c3c") && pulseCss.includes("--p-near-trigger: #c4784a") && pulseCss.includes("--p-brief-kw: var(--p-pct)") && !pulseCss.includes("sparkline"), "pick-3 tokens use the brand red and the stylesheet has no sparkline treatment");
assert(pulseCss.includes(".pulse-track") && pulseCss.includes(".pulse-runway") && !/\.pulse[^{]*needle|\.pulse[^{]*gauge/.test(pulseCss), "the dial pattern is a track, not a gauge");
for (const [file, href] of [
  ["index.html", 'data-pulse="pack"'],
  ["positioning/desk/index.html", 'data-pulse="pack"'],
  ["vault/soft-crowded/index.html", 'data-pulse="cases"'],
]) {
  const html = readFileSync(join(root, file), "utf8");
  assert(html.includes(href) && html.includes('src="/src/pulse-render.js"'), `${file} mounts the pulse pack`);
}
assert(readFileSync(join(root, `${FAMILY_ENTRY}/index.html`), "utf8").includes('data-desk-brief="open"') && readFileSync(join(root, `${FAMILY_ENTRY}/index.html`), "utf8").includes('src="/src/desk-brief.js"'), "the signed-in family entry opens the desk brief");
assert(readFileSync(join(root, "insight/vol/index.html"), "utf8").includes('data-desk-brief') && readFileSync(join(root, "insight/vol/index.html"), "utf8").includes('data-theme-set="dark"'), "the family wall keeps the brief and the theme toggle");

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
const flowTickers = ["GPC", "AVAV", "ASML", "KKR", "FROG", "CCJ", "CBRE", "LH", "SBUX", "EPD", "MPWR", "INSM", "UBS", "EXE", "DAR", "JAZZ", "CASY", "JCI", "CRWD", "DDOG", "CORT"];
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
const cortBars = JSON.parse(readFileSync(join(root, "public/data/flow/bars/CORT.json"), "utf8")).bars;
assert(
  JSON.stringify(chartLevels(flowBy.CORT, cortBars).lines.map((line) => line.value)) === JSON.stringify([120, 160, 130.94]),
  "CORT chart draws the $120/$160 spread and its break-even",
);
for (const ticker of ["KKR", "FROG"]) {
  assert(flowBy[ticker].customerPurchased.every((line) => line.detail.includes("sold")), `${ticker} short puts read as sold`);
}
const beWant = { CASY: 671.2, JCI: 163.54, GPC: 127.92, KKR: 89.2, FROG: 94.04, CORT: 130.94, CRWD: null, DDOG: null, EPD: null, SBUX: null, LH: null, CBRE: null, CCJ: 86.74 };
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
assert(!flowBy.ABBV && !flowBy.CNC, "ABBV and CNC are $$ alerts and stay off the $$$ watchlist");
assert(!flowBy.W && !flowBy.WFC, "W and WFC are $$ alerts and stay off the $$$ watchlist");
assert(!flowBy.VZ, "VZ is a $$ alert and stays off the $$$ watchlist");
assert(!flowBy.TSCO && !flowBy.UBER, "TSCO and UBER are $$ alerts and stay off the $$$ watchlist");
assert(!flowBy.PYPL && !flowBy.CBOE, "PYPL and CBOE are $$ alerts and stay off the $$$ watchlist");
assert(!flowBy.ARES && !flowBy.MSI, "ARES and MSI are $$ alerts and stay off the $$$ watchlist");
assert(!flowBy.BURL, "BURL is a $$ alert and stays off the $$$ watchlist");
assert(!flowBy.TGT, "TGT is a $$ alert and stays off the $$$ watchlist");
assert(!flowBy.IONQ, "IONQ is a $$ alert and stays off the $$$ watchlist");
assert(!flowBy.COHR && !flowBy.AKAM, "COHR and AKAM are $$ alerts and stay off the $$$ watchlist");
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
assert(
  JSON.stringify(flowBy.EXE.lead) === JSON.stringify({ type: "call", action: "bought", qty: 3000, strike: 120, expiry: "January 2028", price: null }),
  `EXE lead is the Jan 2028 $120 call buy ${JSON.stringify(flowBy.EXE.lead)}`,
);
assert(flowBy.EXE.customerPurchased[0]?.contract === "Jan 2028 $120 calls" && flowBy.EXE.customerPurchased[0]?.side === "calls_bought", "EXE Customer purchased is the Jan 2028 $120 call buy");
const exeLevels = chartLevels(flowBy.EXE, JSON.parse(readFileSync(join(root, "public/data/flow/bars/EXE.json"), "utf8")).bars);
assert(JSON.stringify(exeLevels.lines.map((line) => line.value)) === "[120]", `EXE chart draws only the $120 strike ${exeLevels.lines.map((line) => line.value)}`);
assert(
  JSON.stringify(flowBy.UBS.lead) === JSON.stringify({ type: "call", action: "bought", qty: 2700, strike: 52.5, expiry: "January 2028", price: null }),
  `UBS lead is the Jan 2028 $52.5 call buy ${JSON.stringify(flowBy.UBS.lead)}`,
);
assert(flowBy.UBS.customerPurchased[0]?.contract === "Jan 2028 $52.5 calls" && flowBy.UBS.customerPurchased[0]?.side === "calls_bought", "UBS Customer purchased is the Jan 2028 $52.5 call buy");
const ubsLevels = chartLevels(flowBy.UBS, JSON.parse(readFileSync(join(root, "public/data/flow/bars/UBS.json"), "utf8")).bars);
assert(JSON.stringify(ubsLevels.lines.map((line) => line.value)) === "[52.5]", `UBS chart draws only the $52.5 strike ${ubsLevels.lines.map((line) => line.value)}`);
assert(
  JSON.stringify(flowBy.MPWR.lead) === JSON.stringify({ type: "call", action: "bought", qty: 150, strike: 1400, expiry: "February", price: null }),
  `MPWR lead is the Feb $1400 call buy ${JSON.stringify(flowBy.MPWR.lead)}`,
);
assert(flowBy.MPWR.customerPurchased[0]?.contract === "Feb $1400 calls" && flowBy.MPWR.customerPurchased[0]?.side === "calls_bought", "MPWR Customer purchased is the Feb $1400 call buy");
const mpwrLevels = chartLevels(flowBy.MPWR, JSON.parse(readFileSync(join(root, "public/data/flow/bars/MPWR.json"), "utf8")).bars);
assert(JSON.stringify(mpwrLevels.lines.map((line) => line.value)) === "[1400]", `MPWR chart draws only the $1400 strike ${mpwrLevels.lines.map((line) => line.value)}`);
assert(
  JSON.stringify(flowBy.INSM.lead) === JSON.stringify({ type: "call", action: "bought", qty: 5000, strike: 110, expiry: "January", price: 8.62 }),
  `INSM lead is the Jan $110 call buy ${JSON.stringify(flowBy.INSM.lead)}`,
);
assert(flowBy.INSM.customerPurchased[0]?.contract === "Jan $110 calls" && flowBy.INSM.customerPurchased[0]?.side === "calls_bought", "INSM Customer purchased is the Jan $110 call buy");
const insmLevels = chartLevels(flowBy.INSM, JSON.parse(readFileSync(join(root, "public/data/flow/bars/INSM.json"), "utf8")).bars);
assert(JSON.stringify(insmLevels.lines.map((line) => line.value)) === "[110,118.62]", `INSM chart draws the $110 strike and break-even ${insmLevels.lines.map((line) => line.value)}`);
assert(
  JSON.stringify(flowBy.EPD.lead) === JSON.stringify({ type: "call", action: "bought", qty: 10000, strike: 40, expiry: "March", price: null }),
  `EPD lead is the March $40 call buy ${JSON.stringify(flowBy.EPD.lead)}`,
);
assert(flowBy.EPD.customerPurchased[0]?.contract === "March $40 calls" && flowBy.EPD.customerPurchased[0]?.side === "calls_bought", "EPD Customer purchased is the March $40 call buy");
const epdLevels = chartLevels(flowBy.EPD, JSON.parse(readFileSync(join(root, "public/data/flow/bars/EPD.json"), "utf8")).bars);
assert(JSON.stringify(epdLevels.lines.map((line) => line.value)) === "[40]", `EPD chart draws only the $40 strike ${epdLevels.lines.map((line) => line.value)}`);
assert(
  JSON.stringify(flowBy.SBUX.lead) === JSON.stringify({ type: "call", action: "bought", qty: 7500, strike: 105, expiry: "January", price: null }),
  `SBUX lead is the Jan $105 call buy ${JSON.stringify(flowBy.SBUX.lead)}`,
);
assert(flowBy.SBUX.customerPurchased[0]?.contract === "Jan $105 calls" && flowBy.SBUX.customerPurchased[0]?.side === "calls_bought", "SBUX Customer purchased is the Jan $105 call buy");
const sbuxLevels = chartLevels(flowBy.SBUX, JSON.parse(readFileSync(join(root, "public/data/flow/bars/SBUX.json"), "utf8")).bars);
assert(JSON.stringify(sbuxLevels.lines.map((line) => line.value)) === "[105]", `SBUX chart draws only the $105 strike ${sbuxLevels.lines.map((line) => line.value)}`);
assert(
  JSON.stringify(flowBy.LH.lead) === JSON.stringify({ type: "call", action: "bought", qty: 600, strike: 420, expiry: "May", price: null }),
  `LH lead is the May $420 call buy ${JSON.stringify(flowBy.LH.lead)}`,
);
assert(flowBy.LH.customerPurchased[0]?.contract === "May $420 calls" && flowBy.LH.customerPurchased[0]?.side === "calls_bought", "LH Customer purchased is the May $420 call buy");
const lhLevels = chartLevels(flowBy.LH, JSON.parse(readFileSync(join(root, "public/data/flow/bars/LH.json"), "utf8")).bars);
assert(JSON.stringify(lhLevels.lines.map((line) => line.value)) === "[420]", `LH chart draws only the $420 strike ${lhLevels.lines.map((line) => line.value)}`);
assert(
  JSON.stringify(flowBy.CBRE.lead) === JSON.stringify({ type: "call", action: "bought", strike: 135, expiry: "December", price: null }),
  `CBRE lead is the Dec $135 call buy ${JSON.stringify(flowBy.CBRE.lead)}`,
);
assert(flowBy.CBRE.customerPurchased[0]?.contract === "Dec $135 calls" && flowBy.CBRE.customerPurchased[0]?.side === "calls_bought", "CBRE Customer purchased is the Dec $135 call buy");
const cbreLevels = chartLevels(flowBy.CBRE, JSON.parse(readFileSync(join(root, "public/data/flow/bars/CBRE.json"), "utf8")).bars);
assert(JSON.stringify(cbreLevels.lines.map((line) => line.value)) === "[135]", `CBRE chart draws only the $135 strike ${cbreLevels.lines.map((line) => line.value)}`);
assert(
  JSON.stringify(flowBy.CCJ.lead) === JSON.stringify({ type: "call", action: "bought", qty: 10500, strike: 85, expiry: "December", price: 1.74 }),
  `CCJ lead is the Dec $85 call buy ${JSON.stringify(flowBy.CCJ.lead)}`,
);
assert(flowBy.CCJ.customerPurchased[0]?.contract === "Dec $85 calls" && flowBy.CCJ.customerPurchased[0]?.side === "calls_bought", "CCJ Customer purchased is the Dec $85 call buy");
const ccjLevels = chartLevels(flowBy.CCJ, JSON.parse(readFileSync(join(root, "public/data/flow/bars/CCJ.json"), "utf8")).bars);
assert(JSON.stringify(ccjLevels.lines.map((line) => line.value)) === "[85,86.74]", `CCJ chart draws the $85 strike and break-even ${ccjLevels.lines.map((line) => line.value)}`);
assert(
  JSON.stringify(flowBy.KKR.lead) === JSON.stringify({ type: "put", action: "sold", qty: 2000, strike: 100, expiry: "May", price: 10.8 }),
  `KKR lead is the May $100 put sale ${JSON.stringify(flowBy.KKR.lead)}`,
);
assert(flowBy.KKR.customerPurchased[0]?.contract === "May $100 puts" && flowBy.KKR.customerPurchased[0]?.side === "puts_sold", "KKR Customer purchased is the May $100 put sale");
const kkrLevels = chartLevels(flowBy.KKR, JSON.parse(readFileSync(join(root, "public/data/flow/bars/KKR.json"), "utf8")).bars);
assert(JSON.stringify(kkrLevels.lines.map((line) => line.value)) === "[100,89.2]", `KKR chart draws the $100 strike and break-even ${kkrLevels.lines.map((line) => line.value)}`);
assert(
  JSON.stringify(flowBy.FROG.lead) === JSON.stringify({ type: "put", action: "sold", qty: 1000, strike: 105, expiry: "December", price: 10.96 }),
  `FROG lead is the Dec $105 put sale ${JSON.stringify(flowBy.FROG.lead)}`,
);
assert(flowBy.FROG.customerPurchased[0]?.contract === "Dec $105 puts" && flowBy.FROG.customerPurchased[0]?.side === "puts_sold", "FROG Customer purchased is the Dec $105 put sale");
const frogLevels = chartLevels(flowBy.FROG, JSON.parse(readFileSync(join(root, "public/data/flow/bars/FROG.json"), "utf8")).bars);
assert(JSON.stringify(frogLevels.lines.map((line) => line.value)) === "[105,94.04]", `FROG chart draws the $105 strike and break-even ${frogLevels.lines.map((line) => line.value)}`);
assert(
  JSON.stringify(flowBy.AVAV.lead) === JSON.stringify({ type: "call", action: "bought", qty: 600, strike: 165, expiry: "January", price: null }),
  `AVAV lead is the Jan $165 call buy ${JSON.stringify(flowBy.AVAV.lead)}`,
);
assert(flowBy.AVAV.customerPurchased[0]?.contract === "Jan $165 calls" && flowBy.AVAV.customerPurchased[0]?.side === "calls_bought", "AVAV Customer purchased is the Jan $165 call buy");
const avavLevels = chartLevels(flowBy.AVAV, JSON.parse(readFileSync(join(root, "public/data/flow/bars/AVAV.json"), "utf8")).bars);
assert(JSON.stringify(avavLevels.lines.map((line) => line.value)) === "[165]", `AVAV chart draws the $165 strike ${avavLevels.lines.map((line) => line.value)}`);
assert(
  JSON.stringify(flowBy.ASML.lead) === JSON.stringify({ type: "call", action: "bought", qty: 1960, strike: 1740, shortStrike: 1820, expiry: "February", price: null }),
  `ASML lead is the Feb $1740/$1820 call spread ${JSON.stringify(flowBy.ASML.lead)}`,
);
assert(flowBy.ASML.customerPurchased[0]?.contract === "Feb $1740/$1820 call spreads" && flowBy.ASML.customerPurchased[0]?.side === "calls_bought", "ASML Customer purchased is the Feb $1740/$1820 call spread");
const asmlLevels = chartLevels(flowBy.ASML, JSON.parse(readFileSync(join(root, "public/data/flow/bars/ASML.json"), "utf8")).bars);
assert(JSON.stringify(asmlLevels.lines.map((line) => line.value)) === "[1740,1820]", `ASML chart draws the $1740/$1820 spread ${asmlLevels.lines.map((line) => line.value)}`);
assert(
  JSON.stringify(flowBy.GPC.lead) === JSON.stringify({ type: "call", action: "bought", qty: 2550, strike: 125, expiry: "December", price: 2.92 }),
  `GPC lead is the Dec $125 call buy ${JSON.stringify(flowBy.GPC.lead)}`,
);
assert(flowBy.GPC.customerPurchased[0]?.contract === "Dec $125 calls" && flowBy.GPC.customerPurchased[0]?.side === "calls_bought", "GPC Customer purchased is the Dec $125 call buy");
const gpcLevels = chartLevels(flowBy.GPC, JSON.parse(readFileSync(join(root, "public/data/flow/bars/GPC.json"), "utf8")).bars);
assert(JSON.stringify(gpcLevels.lines.map((line) => line.value)) === "[125,127.92]", `GPC chart draws the $125 strike and break-even ${gpcLevels.lines.map((line) => line.value)}`);
assert(!flowBy.CSCO, "CSCO aged out of the 3-week $$$ window on the Nov 4 as-of");
assert(!flowBy.ALAB, "ALAB aged out of the 3-week $$$ window on the Nov 5 as-of");
assert(!flowBy.COIN, "COIN aged out of the 3-week $$$ window on the Nov 10 as-of");
assert(!flowBy.QCOM && !flowBy.MMM, "QCOM and MMM aged out of the 3-week $$$ window on the Nov 12 as-of");
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
const softestAll = sectorChart("jpm", 7, "softest").bars;
assert(softestAll.at(-1).ticker === "XLRE" && softestAll.at(-1).available === false, "Softest first parks the JPM N/A (XLRE) at the end");
assert(sectorChart("jpm", 7, "fund").bars.map((bar) => bar.ticker).join() === CANON.join(), "XLF → XLC keeps canonical order, including an unprinted XLRE");
const latestAsOf = sectorAsOf(WEEKS.at(-1));
assert(latestAsOf === "As of W43 · Fri Oct 23, 2026 CT", `latest sector as-of ${latestAsOf}`);
assert(sectorAsOf(WEEKS[0]) === "As of W36 · Fri Sep 4, 2026 CT", `first sector as-of ${sectorAsOf(WEEKS[0])}`);
assert(weekMark(WEEKS.at(-1)) === "W43" && weekMark(WEEKS[0]) === "W36", "week marks come from the series Fridays");
for (const iso of WEEKS) {
  const text = sectorAsOf(iso);
  assert(text.startsWith("As of W") && text.endsWith(" CT") && text.includes(formatWeek(iso)), `as-of ${iso} → ${text}`);
  assert(!/Data from|TBD|—/.test(text), `as-of must name the series week, got ${text}`);
}
assert(chartsPage.includes('id="sectors-asof"') && chartsPage.includes('id="sectors-week"'), "sectors card has an as-of line and a week slider");
assert(chartsPage.includes(latestAsOf), "sectors card as-of matches the latest series Friday");
assert(chartsPage.includes(`aria-valuetext="${latestAsOf}"`), "sectors week slider names the same as-of string");
assert(!chartsPage.includes("Data from"), "charts page has no Data from placeholder");
const chartsScript = readFileSync(join(root, "src/charts.js"), "utf8");
const chartSvg = readFileSync(join(root, "src/chart-svg.js"), "utf8");
const siteStyles = readFileSync(join(root, "src/styles.css"), "utf8");
assert(chartsScript.includes('scrub.setAttribute("aria-valuetext", text)') && chartsScript.includes("sectorAsOf"), "sectors slider aria-valuetext tracks the as-of string");
assert(!chartsScript.includes("Data from"), "charts script has no Data from placeholder");
assert(chartSvg.includes('bar.dataset.state = "na"') && chartSvg.includes('value.textContent = "N/A"'), "missing sector print draws an N/A stub");
assert(!chartSvg.includes('class: "pc-val" }, "—"'), "sector chart does not label a missing print with an em dash");
assert(siteStyles.includes('.sec-bar[data-state="na"]') && siteStyles.includes("height: 72px !important"), "N/A stub is a 72px hatched bar");
assert(siteStyles.includes("--sec-mid: #9e978c"), "light Mid band is #9e978c, distinct from the N/A fill");
assert(siteStyles.includes("--sec-na-fill: #e8e4dc") && siteStyles.includes("--sec-na-outline: #8a857c"), "N/A stub uses the grey fill and outline");
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
assert(
  JSON.stringify(spotRows) === JSON.stringify({ active: ["MDB", "XYZ"], open: ["HOOD"], closed: ["GLD", "FCX", "V", "FSLY"] }),
  `Spotlight rows ${JSON.stringify(spotRows)}`,
);
const { start: activeStart, end: activeEnd } = spot.activeWindow;
assert(activeStart === "2026-10-20" && activeEnd === "2026-11-10", "Active window is the Oct 20 – Nov 10 book");
assert(spot.asOf === "2026-11-11" && spot.asOfStamp === "2026-11-11T00:15:00-06:00", `Spotlight asOf ${spot.asOf} ${spot.asOfStamp}`);
assert(/2026-11-10/.test(spot.sourceNote) && /MDB/.test(spot.sourceNote), `Spotlight source note ${spot.sourceNote}`);
assert(/2026-10-30/.test(spot.sourceNote) && /stopped/i.test(spot.sourceNote), `Spotlight source note still names the GLD/FCX stop ${spot.sourceNote}`);
assert(!/no new close notes for GLD/i.test(spot.sourceNote), "source note no longer leaves GLD and FCX open");
const barsLag = (Date.parse(`${spot.asOf}T00:00:00Z`) - Date.parse(`${spot.barsThrough}T00:00:00Z`)) / 86400000;
assert(spot.barsThrough === "2026-11-10" && barsLag === 1, `Spotlight bars stay through ${spot.barsThrough} after the 2026-11-11 auto-ship`);
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
      assert(play.closedAt > play.published && play.closeNote, `${where} needs a close date and note`);
      assert(["banked", "expired", "stopped"].includes(play.outcome), `${where} outcome ${play.outcome}`);
      if (play.outcome === "banked" || play.outcome === "expired") assert(play.result, `${where} needs a result`);
      if (play.outcome === "stopped") {
        assert(!("result" in play) && !("closeQuote" in play) && !("closeEvidenceUrl" in play), `${where} stopped close invents a result or quote`);
      }
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
  MDB: { debit: 15, stop: 305, target: 430, breakeven: 385, spotAtPost: 331, published: "2026-11-10" },
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
assert(spotBy.MDB.status === "active" && spotBy.XYZ.status === "active" && spotBy.HOOD.status === "open" && spotBy.V.outcome === "banked", "MDB and XYZ stay Active, HOOD stays Open, V stays banked");
for (const ticker of ["GLD", "FCX"]) {
  const play = spotBy[ticker];
  assert(play.status === "closed" && play.outcome === "stopped" && play.closedAt === "2026-10-30", `${ticker} stopped on the 2026-10-30 desk close`);
  assert(outcomeLabel(play) === "Stopped", `${ticker} labels Stopped, not Banked`);
  assert(/stock stop/i.test(play.closeNote) && /2026-10-30/.test(play.closeNote) && /stopped out/i.test(play.closeNote), `${ticker} close note ${play.closeNote}`);
  assert(/^Was long /.test(play.recommendation) && /2026-10-30/.test(play.recommendation), `${ticker} recommendation ${play.recommendation}`);
  assert(!/2026-11-01/.test(`${play.closedAt} ${play.closeNote} ${play.recommendation}`), `${ticker} must not use a Nov 1 fill`);
}
const fsly = spotBy.FSLY;
const fslyChart = spotlightLevels(fsly, JSON.parse(readFileSync(join(root, "public/data/flow/bars/FSLY.json"), "utf8")).bars);
assert(fsly.outcome === "expired" && outcomeLabel(fsly) === "Expired worthless", "FSLY expired worthless");
assert(fslyChart.expiry === "2026-10-16" && fsly.closedAt === fslyChart.expiry, `FSLY closes at the ${fslyChart.expiry} October OpEx`);
assert(/OpEx expired/.test(fsly.closeNote) && /worthless/.test(fsly.closeNote), `FSLY close note ${fsly.closeNote}`);
assert(fslyChart.closeBar.c < 25, `FSLY closed ${fslyChart.closeBar.c} at expiry, under the $25 strike`);
assert(JSON.stringify(spotlightLines(spotBy.FCX).map((line) => line.value)) === "[80,78.25,75,63]", "FCX chart lines run target $80 down to stop $63");
assert(JSON.stringify(spotlightLines(spotBy.MDB).map((line) => line.value)) === "[430,385,370,305]", "MDB chart lines run short/target $430, B/E $385, long $370, stop $305");
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
  // Six months of sessions, or the full regular-session history when the name listed inside that window.
  const listedInsideWindow = name.chart[0].date > "2026-05-01";
  assert(
    (name.chart.length >= 100 || (listedInsideWindow && name.chart.length >= 60)) &&
      name.chart.every((bar, i) => i === 0 || bar.date > name.chart[i - 1].date),
    `${where} six-month chart`,
  );
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
assert(JSON.stringify([...activeSet]) === '["MDB","XYZ"]', `Active Spotlights ${[...activeSet]}`);
assert(spotlightStar("GLD", activeSet) === "" && spotlightStar("FCX", activeSet) === "", "stopped Spotlights are not Active stars");
assert(spotlightStar("MDB", activeSet).includes("sb-star") && spotlightStar("XYZ", activeSet).includes("sb-star") && spotlightStar("AAPL", activeSet) === "", "star only marks Active Spotlights");
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
assert(ntPage.includes("today and yesterday") && ntPage.includes("Each row keeps"), "New Today lede includes yesterday and keeps the original calendar day");
assert(
  readFileSync(join(root, `${FAMILY_ENTRY}/new-today/index.html`), "utf8").includes("today and yesterday"),
  "private New Today lede includes yesterday",
);
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
assert(readFileSync(join(root, "src/new-today-window.js"), "utf8").includes("Feed updated"), "New Today copy names when the feed was updated");
assert(readFileSync(join(root, "src/new-today.js"), "utf8").includes("rowDayLabel"), "New Today rows keep a Today or Yesterday label");
const chipJs = readFileSync(join(root, "src/new-today-chip.js"), "utf8");
assert(chipJs.includes("catchUpChip"), "the Dashboard chip counts today and yesterday");
assert(chipJs.includes("onDeskReady"), "the New Today chip mounts after the Vault gate clones the template");
assert(chipJs.includes('dataset.public === "1"'), "only data-public=1 chips drop Options Flow");
assert(
  JSON.stringify(NT_SECTIONS.map((section) => section.title)) === '["Positioning","Options Flow","SPX Levels","Research desk"]',
  "New Today sections run Positioning, Options Flow, SPX Levels, Research desk",
);
assert(JSON.stringify(PUBLIC_NT_SECTIONS.map((section) => section.id)) === '["positioning","spx","research"]', "public New Today drops Options Flow");
assert(publicDeskItems([{ section: "options-flow" }, { section: "positioning" }]).length === 1, "public desk items keep Positioning and drop Options Flow");
assert(homePage.includes('class="nt-chip"') && homePage.includes('data-public="1"'), "Dashboard home shows the public New Today chip");
assert(!homePage.includes('data-public="0"'), "Dashboard chip stays on the public count");
for (const id of ["spot-vol-beta", "credit-spread-regime", "mag7", "nysi", "nasi", "ncfd", "ndtw", "ncfi", "ncth"]) {
  assert(homePage.includes(`id="${id}"`), `Dashboard shows the ${id} wall widget`);
}
assert(homePage.includes('src="/src/vault-wall.js"') && homePage.includes('src="/src/vault-breadth.js"'), "Dashboard runs the wall widgets");
const mhLabels = [
  "Soft Vol",
  "Vol Stress",
  "Mag 7",
  "Credit / CSR",
  "Global fund",
  "Sharpies / COT",
  "NY Summation",
  "Nasdaq Summation",
  "Nasdaq 5-day",
  "Nasdaq-100 20-day",
  "Nasdaq 50-day",
  "Nasdaq 200-day",
  "NYAD",
  "NYHL",
  "Put / Call",
  "NAAIM / risk appetite",
  "SPX vs 8/21 weekly EMA",
];
assert(JSON.stringify(MARKET_HEALTH_ROWS.map((row) => row.label)) === JSON.stringify(mhLabels), "Market Health rows stay in the locked order");
assert(MARKET_HEALTH_WEEKS.length >= 12 && MARKET_HEALTH_WEEKS.length <= 16, "Market Health shows about 12 to 16 ISO weeks");
assert(JSON.stringify(MARKET_HEALTH_WEEKS) === JSON.stringify([29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44]), "Market Health stays on W29–W44");
assert(MARKET_HEALTH_STATES.soft.state === "soft" && MARKET_HEALTH_STATES["soft-extreme"].name === "Soft", "soft cells keep the buy-index name");
assert(MARKET_HEALTH_STATES.crowded.voice === "Crowded / don’t add" && MARKET_HEALTH_STATES.mid.name === "Mid", "crowded and mid keep the locked voice");
assert(JSON.stringify(BUYABLE_ROWS) === JSON.stringify(["soft-vol", "vol-stress"]), "only Soft Vol and Vol Stress take the index-buy lean");
const pulseAt = homePage.indexOf('data-pulse="pack"');
const mhAt = homePage.indexOf('id="market-health"');
const tilesAt = homePage.indexOf('class="tile-grid"');
const wallAt = homePage.indexOf('id="wall"');
assert(pulseAt !== -1 && mhAt > pulseAt && tilesAt > mhAt && wallAt > tilesAt, "Market Health sits below the Pulse read and above the tiles");
assert(homePage.includes("MARKET HEALTH SNAPSHOT · as of Fri Oct 30, 2026 close CT"), "snapshot eyebrow keeps the Fri Oct 30 as-of");
assert(!homePage.includes("Demo pattern"), "the snapshot no longer calls the whole board a demo pattern");
assert(homePage.includes("Green = buy index funds / possible bottom · Grey = mid · Red = crowded / don’t add."), "snapshot one-liner uses the buy-index voice");
assert(homePage.includes("Buy index / possible bottom") && homePage.includes(">Mid<") && homePage.includes("Crowded / don’t add"), "snapshot pills use the buy-index voice");
assert(homePage.includes("Desk read · not a forecast · Put/Call stays Demo · Global fund, Sharpies, and NAAIM are Desk proxies · Nasdaq % above MA uses that series’ historical percentile (soft ≤20th, crowded ≥80th)"), "snapshot footnote names Demo, Desk proxies, and Nasdaq percentile bands");
assert(homePage.includes('src="/src/market-health.js"') && !homePage.includes('data-demo="true"'), "Dashboard mounts the live board");
assert(!homePage.includes("PREVIEW MOCK") && !homePage.includes("NOT SHIPPED"), "the preview banner stays off the Dashboard");
const mhCss = css.slice(css.indexOf("/* Market Health Soft-boxes"));
assert(mhCss.startsWith("/* Market Health Soft-boxes"), "stylesheet has the Market Health block");
assert(mhCss.includes("--mh-soft: #2f7a4a") && mhCss.includes("--mh-mid: #c8c2b6") && mhCss.includes("--mh-mid: #4a443a") && mhCss.includes("--mh-crowded: #b83232"), "snapshot cells use the locked green, grey, and red");
assert(!mhCss.includes("#e91e63") && !mhCss.includes("#e91e8c"), "the snapshot board does not use the theme-card magenta");
assert(css.includes("--sc-crowded: #e91e63") && css.includes("--sc-glow-crowded-rgb: 233, 30, 99"), "Soft ↔ Crowded theme-card magenta glow stays");
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
assert(itemsForDay(nt.items ?? [], "2026-10-28").length === 0, "Oct 28 desk day rolled off the eight-day New Today window");
const earlyThursday = (nt.items ?? []).filter((item) => item.publishedAt === "2026-10-29T04:05:00-05:00");
assert(earlyThursday.length === 0, "Oct 29 4:05 AM CT research notes rolled off the eight-day New Today window");
assert(itemsForDay(nt.items ?? [], "2026-10-29").length === 0, "Oct 29 desk day rolled off the eight-day New Today window");
assert(itemsForDay(nt.items ?? [], "2026-10-30").length === 0, "Oct 30 desk day rolled off the eight-day New Today window");
assert(itemsForDay(nt.items ?? [], "2026-10-31").length === 0, "Oct 31 desk day rolled off the eight-day New Today window");
assert(itemsForDay(nt.items ?? [], "2026-11-01").length === 0, "Nov 1 desk day rolled off the eight-day New Today window");
assert(itemsForDay(nt.items ?? [], "2026-11-02").length === 0, "Nov 2 desk day rolled off the eight-day New Today window");
assert(itemsForDay(nt.items ?? [], "2026-11-03").length === 0, "Nov 3 desk day rolled off the eight-day New Today window");
assert(itemsForDay(nt.items ?? [], "2026-11-04").length === 0, "Nov 4 desk day rolled off the eight-day New Today window");
assert(itemsForDay(nt.items ?? [], "2026-11-05").length === 3, "Nov 5 desk day lists the SBUX shopping-list alert and the PYPL and CBOE featured alerts");
assert(itemsForDay(nt.items ?? [], "2026-11-06").length === 2, "Nov 6 desk day lists the open wrap and the market wrap");
assert(itemsForDay(nt.items ?? [], "2026-11-07").length === 1, "Nov 7 desk day lists the LH shopping-list alert");
assert(itemsForDay(nt.items ?? [], "2026-11-08").length === 2, "Nov 8 desk day lists the ARES and MSI featured alerts");
assert(itemsForDay(nt.items ?? [], "2026-11-09").length === 5, "Nov 9 desk day lists the CCJ and CBRE shopping-list alerts, the BURL featured alert, and the open and market wraps");
assert(itemsForDay(nt.items ?? [], "2026-11-10").length === 4, "Nov 10 desk day lists the MDB Spotlight, the KKR and FROG shopping-list alerts, and the TGT featured alert");
assert(itemsForDay(nt.items ?? [], "2026-11-11").length === 3, "Nov 11 desk day lists the AVAV and ASML shopping-list alerts and the IONQ featured alert");
assert(itemsForDay(nt.items ?? [], "2026-11-12").length === 3, "Nov 12 desk day lists the GPC shopping-list alert and the COHR and AKAM featured alerts");
assert(
  visibleDeskItems(nt.items, { today: "2026-11-09", mode: "catchup" }).map((item) => item.id).join() ===
    "2026-11-09-ccj-dollar,2026-11-09-burl-flow,2026-11-09-cbre-dollar,2026-11-09-desk-recap,2026-11-09-desk-blitz,2026-11-08-ares-flow,2026-11-08-msi-flow",
  "Nov 9 catch-up is today plus yesterday and keeps each row's original date",
);
assert(
  rowDayLabel("2026-11-09T18:44:00-06:00", "2026-11-09").label === "Today · Mon, Nov 9" &&
    rowDayLabel("2026-11-08T18:30:00-06:00", "2026-11-09").label === "Yesterday · Sun, Nov 8",
  "Nov 9 rows stay Today and Nov 8 rows stay Yesterday",
);
assert(
  visibleDeskItems(nt.items, { today: "2026-11-10", mode: "catchup" }).map((item) => item.id).join() ===
    "2026-11-10-mdb-spotlight,2026-11-10-kkr-dollar,2026-11-10-frog-dollar,2026-11-10-tgt-flow,2026-11-09-ccj-dollar,2026-11-09-burl-flow,2026-11-09-cbre-dollar,2026-11-09-desk-recap,2026-11-09-desk-blitz",
  "Nov 10 catch-up is today plus yesterday and keeps each row's original date",
);
assert(
  rowDayLabel("2026-11-09T18:44:00-06:00", "2026-11-10").label === "Yesterday · Mon, Nov 9" &&
    rowDayLabel("2026-11-10T20:45:00-06:00", "2026-11-10").label === "Today · Tue, Nov 10",
  "Nov 10 rows stay Today and Nov 9 rows stay Yesterday on the Nov 10 catch-up",
);
assert(
  visibleDeskItems(nt.items, { today: "2026-11-11", mode: "catchup" }).map((item) => item.id).join() ===
    "2026-11-11-avav-dollar,2026-11-11-asml-dollar,2026-11-11-ionq-flow,2026-11-10-mdb-spotlight,2026-11-10-kkr-dollar,2026-11-10-frog-dollar,2026-11-10-tgt-flow",
  "Nov 11 catch-up is today plus yesterday and keeps each row's original date",
);
assert(
  rowDayLabel("2026-11-10T20:45:00-06:00", "2026-11-11").label === "Yesterday · Tue, Nov 10" &&
    rowDayLabel("2026-11-11T18:12:00-06:00", "2026-11-11").label === "Today · Wed, Nov 11",
  "Nov 11 rows stay Today and Nov 10 rows stay Yesterday on the Nov 11 catch-up",
);
assert(
  visibleDeskItems(nt.items, { today: "2026-11-12", mode: "catchup" }).map((item) => item.id).join() ===
    "2026-11-12-gpc-dollar,2026-11-12-cohr-flow,2026-11-12-akam-flow,2026-11-11-avav-dollar,2026-11-11-asml-dollar,2026-11-11-ionq-flow",
  "Nov 12 catch-up is today plus yesterday and keeps each row's original date",
);
assert(
  rowDayLabel("2026-11-11T18:12:00-06:00", "2026-11-12").label === "Yesterday · Wed, Nov 11" &&
    rowDayLabel("2026-11-12T21:04:00-06:00", "2026-11-12").label === "Today · Thu, Nov 12",
  "Nov 12 rows stay Today and Nov 11 rows stay Yesterday on the Nov 12 catch-up",
);
assert(
  visibleDeskItems(nt.items, { today: "2026-11-13", mode: "catchup" }).map((item) => item.id).join() ===
    "2026-11-12-gpc-dollar,2026-11-12-cohr-flow,2026-11-12-akam-flow",
  "Nov 13 morning catch-up keeps yesterday's Nov 12 rows with date labels and drops Nov 11",
);
assert(
  rowDayLabel("2026-11-12T21:04:00-06:00", "2026-11-13").label === "Yesterday · Thu, Nov 12",
  "Nov 12 GPC row stays Yesterday on the Nov 13 catch-up",
);

/* Default New Today is two Chicago calendar days. Yesterday keeps its own date. */
const nov6Today = "2026-11-06";
assert(JSON.stringify(catchUpDays(nov6Today)) === '["2026-11-06","2026-11-05"]', "Nov 6 catch-up is today then yesterday");
assert(
  catchUpWindowLabel(nov6Today) === "Today Fri, Nov 6 · Yesterday Thu, Nov 5 · 12:00 AM CT through 11:59 PM CT",
  `catch-up window ${catchUpWindowLabel(nov6Today)}`,
);
assert(
  yesterdayNote(nov6Today) === "Nothing new today (Fri, Nov 6). Rows below landed yesterday (Thu, Nov 5) and keep that date.",
  `yesterday note ${yesterdayNote(nov6Today)}`,
);
const beforeMidnight = "2026-11-06T05:59:59Z";
const afterMidnight = "2026-11-06T06:00:00Z";
assert(deskDay(beforeMidnight) === "2026-11-05" && deskDay(afterMidnight) === "2026-11-06", "midnight CT rolls the desk day from Nov 5 to Nov 6");
const beforeRoll = visibleDeskItems(nt.items, { today: deskDay(beforeMidnight), mode: "catchup" });
const afterRoll = visibleDeskItems(nt.items, { today: deskDay(afterMidnight), mode: "catchup" });
assert(beforeRoll.some((item) => item.id === "2026-11-05-sbux-dollar"), "before midnight, Nov 5 is today");
assert(beforeRoll.every((item) => ["2026-11-05", "2026-11-04"].includes(deskDay(item.publishedAt))), "the pre-midnight catch-up stays on those two dates");
assert(!beforeRoll.some((item) => item.id.startsWith("2026-11-03")), "Nov 3 leaves the default view once Nov 4 is yesterday");
for (const id of ["2026-11-05-sbux-dollar", "2026-11-05-pypl-flow", "2026-11-05-cboe-flow"]) {
  const stored = (nt.items ?? []).find((item) => item.id === id);
  const shown = afterRoll.find((item) => item.id === id);
  assert(shown === stored, `${id} shows on the Nov 6 default view without a copied stamp`);
  assert(shown.publishedAt.startsWith("2026-11-05T"), `${id} keeps its Nov 5 publishedAt`);
  const dated = rowDayLabel(shown.publishedAt, nov6Today);
  assert(dated.relation === "yesterday" && dated.day === "2026-11-05" && dated.label === "Yesterday · Thu, Nov 5", `${id} stays labelled ${dated.label}`);
  assert(dayRelation(dated.day, nov6Today) === "yesterday", `${id} is not relabelled as today`);
}
assert(
  afterRoll.length === 5 &&
    afterRoll.filter((item) => deskDay(item.publishedAt) === "2026-11-06").length === 2 &&
    afterRoll.filter((item) => deskDay(item.publishedAt) === "2026-11-05").length === 3,
  "Nov 6 default lists the two Nov 6 wraps plus the three Nov 5 flow rows",
);
assert(!afterRoll.some((item) => item.id.startsWith("2026-11-04")), "Nov 4 drops out of the default view at the Nov 6 midnight rollover");
const publicNov6 = visibleDeskItems(nt.items, { today: nov6Today, mode: "catchup", publicOnly: true });
assert(JSON.stringify(publicNov6.map((item) => item.id)) === "[]", "public /new-today/ on Nov 6 lists no eligible row");
const nov5Public = (nt.items ?? []).filter(
  (item) => deskDay(item.publishedAt) === "2026-11-05" && PUBLIC_NT_SECTIONS.some((section) => section.id === item.section),
);
assert(nov5Public.length === 0, "Nov 5 has no Positioning, SPX, or Research row for the public page");
const tradeCopy = /\$\d|\bcalls\b|\bputs\b|\bstrike\b|\bpremium\b/i;
for (const id of ["2026-11-05-sbux-dollar", "2026-11-05-pypl-flow", "2026-11-05-cboe-flow"]) {
  const item = (nt.items ?? []).find((row) => row.id === id);
  assert(item.section === "options-flow" && item.href.startsWith("options-flow/"), `${id} is vault flow and links at the gated flow pages`);
  assert(!("publicTitle" in item) && !("publicSummary" in item) && !("publicHref" in item), `${id} has no public activity fields`);
  assert(tradeCopy.test(`${item.title} ${item.summary}`), `${id} copy is trade detail and stays off the public page`);
  assert(!publicNov6.some((row) => row.id === id), `${id} is absent from the public Nov 6 page`);
}
assert(
  PRODUCT_FEEDS.find((feed) => feed.id === "flow-plays").surfaces.join() === "vault,private",
  "the Shopping List feed stays off the public Dashboard",
);
for (const file of ["options-flow/index.html", "options-flow/dollar/index.html", "options-flow/spotlights/index.html", "options-flow/scorecard/index.html"]) {
  assert(readFileSync(join(root, file), "utf8").includes('src="/src/vault-gate.js"'), `${file} keeps the Vault gate in front of flow detail`);
}
assert(
  visibleDeskItems(nt.items, { today: nov6Today, mode: "catchup", section: "options-flow" }).map((item) => item.id).join() ===
    "2026-11-06-desk-recap,2026-11-06-desk-blitz,2026-11-05-sbux-dollar,2026-11-05-pypl-flow,2026-11-05-cboe-flow",
  "section filter keeps the Nov 6 wraps and the three Nov 5 flow rows, newest first",
);
assert(visibleDeskItems(nt.items, { today: nov6Today, mode: "catchup", section: "positioning" }).length === 0, "Nov 6 positioning filter does not borrow Nov 5 flow rows");
const nov5Only = visibleDeskItems(nt.items, { today: nov6Today, mode: "day", day: "2026-11-05" });
assert(nov5Only.length === 3 && nov5Only.every((item) => deskDay(item.publishedAt) === "2026-11-05"), "an older desk day stays a single calendar day");
assert(!nov5Only.some((item) => item.id.includes("2026-11-06")), "Nov 6 rows do not leak into the Nov 5 page");

const utcTrap = { id: "utc-trap", section: "spx", publishedAt: "2026-11-06T04:30:00Z", title: "UTC date is still Thursday in Chicago" };
const utcToday = { id: "utc-today", section: "spx", publishedAt: "2026-11-06T06:30:00Z", title: "UTC instant after Chicago midnight" };
assert(deskDay(utcTrap.publishedAt) === "2026-11-05", "04:30Z on Nov 6 is still Nov 5 in Chicago");
assert(deskDay(utcToday.publishedAt) === "2026-11-06", "06:30Z on Nov 6 is Nov 6 in Chicago");
assert(rowDayLabel(utcTrap.publishedAt, nov6Today).relation === "yesterday" && rowDayLabel(utcTrap.publishedAt, nov6Today).label === "Yesterday · Thu, Nov 5", "a UTC Nov 6 stamp before 06:00Z stays yesterday");
assert(rowDayLabel(utcToday.publishedAt, nov6Today).relation === "today" && rowDayLabel(utcToday.publishedAt, nov6Today).label === "Today · Fri, Nov 6", "a UTC stamp after Chicago midnight is today");

const dstRows = [
  { id: "fb-before", section: "positioning", publishedAt: "2026-11-01T01:30:00-05:00" },
  { id: "fb-after", section: "research", publishedAt: "2026-11-01T01:30:00-06:00" },
  { id: "fb-next", section: "spx", publishedAt: "2026-11-02T00:30:00-06:00" },
  { id: "fb-prior", section: "positioning", publishedAt: "2026-10-31T23:00:00-05:00" },
  { id: "sf-early", section: "positioning", publishedAt: "2026-03-08T06:30:00Z" },
  { id: "sf-late", section: "research", publishedAt: "2026-03-08T07:30:00Z" },
  { id: "sf-edge", section: "spx", publishedAt: "2026-03-09T04:30:00Z" },
  { id: "sf-today", section: "positioning", publishedAt: "2026-03-09T05:00:00Z" },
];
assert(deskDay("2026-11-01T01:30:00-05:00") === "2026-11-01" && deskDay("2026-11-01T01:30:00-06:00") === "2026-11-01", "both fall-back 1:30 AM hours stay on Nov 1");
const fallCatch = visibleDeskItems(dstRows, { today: "2026-11-02", mode: "catchup" });
assert(fallCatch.map((item) => item.id).join() === "fb-next,fb-after,fb-before", `fall-back catch-up ${fallCatch.map((item) => item.id).join()}`);
assert(rowDayLabel(fallCatch[0].publishedAt, "2026-11-02").relation === "today", "Nov 2 12:30 AM CST is today after the fall-back");
assert(fallCatch.slice(1).every((item) => rowDayLabel(item.publishedAt, "2026-11-02").relation === "yesterday"), "both Nov 1 hours are yesterday on Nov 2");
assert(!fallCatch.some((item) => item.id === "fb-prior"), "Oct 31 is outside the Nov 2 catch-up");
assert(deskDay("2026-03-08T06:30:00Z") === "2026-03-08" && deskDay("2026-03-08T07:30:00Z") === "2026-03-08", "spring-forward keeps 1:30 AM CST and 2:30 AM CDT on Mar 8");
assert(deskDay("2026-03-09T04:30:00Z") === "2026-03-08" && deskDay("2026-03-09T05:00:00Z") === "2026-03-09", "Mar 9 04:30Z is still Mar 8 in Chicago; 05:00Z is Mar 9");
const springCatch = visibleDeskItems(dstRows, { today: "2026-03-09", mode: "catchup" });
assert(springCatch.map((item) => item.id).join() === "sf-today,sf-edge,sf-late,sf-early", `spring-forward catch-up ${springCatch.map((item) => item.id).join()}`);
assert(rowDayLabel("2026-03-09T04:30:00Z", "2026-03-09").relation === "yesterday", "the UTC Mar 9 stamp before Chicago midnight is yesterday");
assert(rowDayLabel("2026-03-09T05:00:00Z", "2026-03-09").label.startsWith("Today"), "Chicago midnight on Mar 9 is today");
assert(catchUpDays("2026-03-01")[1] === "2026-02-28", "yesterday of Mar 1 2026 is Feb 28");
assert(catchUpDays("2024-03-01")[1] === "2024-02-29", "yesterday of Mar 1 2024 is Feb 29");
assert(catchUpDays("2026-01-01")[1] === "2025-12-31", "yesterday of Jan 1 is Dec 31");
assert(catchUpDays("2026-11-02")[1] === "2026-11-01", "yesterday of the post-fallback day is the 25-hour day");

const mixed = [
  { id: "today-pos", section: "positioning", publishedAt: "2026-11-06T15:00:00-06:00" },
  { id: "today-res", section: "research", publishedAt: "2026-11-06T09:00:00-06:00" },
  { id: "y-flow", section: "options-flow", publishedAt: "2026-11-05T19:56:00-06:00" },
  { id: "y-pos", section: "positioning", publishedAt: "2026-11-05T08:00:00-06:00" },
  { id: "old-res", section: "research", publishedAt: "2026-11-04T21:00:00-06:00" },
  utcTrap,
];
const mixedCatch = visibleDeskItems(mixed, { today: nov6Today, mode: "catchup" });
assert(mixedCatch.map((item) => item.id).join() === "today-pos,today-res,utc-trap,y-flow,y-pos", `mixed catch-up order ${mixedCatch.map((item) => item.id).join()}`);
assert(mixedCatch.every((item) => item.publishedAt === mixed.find((row) => row.id === item.id).publishedAt), "mixed rows keep their original stamps");
assert(!mixedCatch.some((item) => item.id === "old-res"), "the day before yesterday stays off the default view");
const mixedPos = visibleDeskItems(mixed, { today: nov6Today, mode: "catchup", section: "positioning" });
assert(mixedPos.map((item) => item.id).join() === "today-pos,y-pos", "section filter keeps both days and drops the other sections");
assert(rowDayLabel(mixedPos[0].publishedAt, nov6Today).relation === "today" && rowDayLabel(mixedPos[1].publishedAt, nov6Today).relation === "yesterday", "filtered rows keep Today and Yesterday");
const mixedPublic = visibleDeskItems(mixed, { today: nov6Today, mode: "catchup", publicOnly: true });
assert(!mixedPublic.some((item) => item.section === "options-flow") && mixedPublic.some((item) => item.id === "y-pos") && mixedPublic.some((item) => item.id === "utc-trap"), "public filter drops flow and keeps yesterday's other sections");
const vaultChip = catchUpChip(catchUpSummary(mixed, nov6Today), "");
const publicChipNov6 = catchUpChip(catchUpSummary(publicDeskItems(mixed), nov6Today), "");
assert(vaultChip.sub === "2 today · 3 yesterday" && publicChipNov6.sub === "2 today · 2 yesterday", "Vault chip counts flow; public chip does not");
const mixedOld = visibleDeskItems(mixed, { today: nov6Today, mode: "day", day: "2026-11-04", section: "research" });
assert(mixedOld.map((item) => item.id).join() === "old-res", "an older day filter does not pull yesterday forward");
const mixedSummary = catchUpSummary(mixed, nov6Today);
assert(mixedSummary.todayCount === 2 && mixedSummary.yesterdayCount === 3 && mixedSummary.total === 5, "mixed counts split today from yesterday");
assert(catchUpCountText(mixedSummary) === "2 today · 3 yesterday", "a mixed badge names both days");
assert(catchUpCountText(catchUpSummary(afterRoll, nov6Today)) === "2 today · 3 yesterday", "Nov 6 catch-up names today and yesterday");
assert(emptyDeskMessage("catchup") === "Nothing new today or yesterday." && emptyDeskMessage("day") === "Nothing new that desk day.", "empty copy follows the view");
const yChip = catchUpChip(catchUpSummary(nt.items, nov6Today), nt.updatedAt);
assert(yChip.sub === "2 today · 3 yesterday" && yChip.lit === true && yChip.quiet === false, "Nov 6 chip names today and yesterday and pulses");
assert(yChip.aria.includes("2 today") && yChip.aria.includes("3 yesterday") && !yChip.aria.includes("since 12"), "Nov 6 chip keeps yesterday separate");
const publicNov6Chip = catchUpChip(catchUpSummary(publicDeskItems(nt.items), nov6Today), nt.updatedAt);
assert(publicNov6Chip.quiet === true && publicNov6Chip.lit === false, "public Nov 6 chip stays quiet because those rows are Options Flow");
const quietChip = catchUpChip(catchUpSummary([], nov6Today), "");
assert(quietChip.sub === "Quiet since yesterday" && quietChip.quiet === true && quietChip.lit === false, "a two-day quiet chip says so");
const bothChip = catchUpChip(mixedSummary, "2026-11-06T14:00:00-06:00");
assert(bothChip.lit === true && bothChip.sub === "2 today · 3 yesterday", "today's rows light the chip and the subtitle keeps yesterday separate");
assert(!feedLine(nt.updatedAt, { quiet: false, mode: "catchup" }).includes("nothing new"), "a catch-up with rows does not say the desk is empty");
assert(feedLine(nt.updatedAt, { quiet: true, mode: "catchup" }).endsWith("nothing new today or yesterday"), "a quiet catch-up names both days");
assert(feedLine("2026-11-06T00:14:03-06:00", { quiet: false, mode: "day" }).startsWith("Feed updated"), "the feed line still names the update");

const homeState = readDeskState("", nov6Today);
assert(homeState.mode === "catchup" && homeState.day === nov6Today && homeState.view === "sections" && deskStateUrl(homeState) === "./", "the default URL is the two-day catch-up");
assert(readDeskState("?day=2026-11-06", nov6Today).mode === "catchup", "asking for today stays on the catch-up");
assert(readDeskState("?day=nope", nov6Today).mode === "catchup", "a bad day stays on the catch-up");
const earlier = earlierState(homeState);
assert(earlier.mode === "day" && earlier.day === "2026-11-04" && deskStateUrl(earlier) === "?day=2026-11-04", "Earlier from the catch-up opens the day before yesterday");
const yesterdayState = readDeskState("?day=2026-11-05&view=all", nov6Today);
assert(yesterdayState.mode === "day" && yesterdayState.day === "2026-11-05" && yesterdayState.view === "all", "an explicit yesterday URL is one desk day");
assert(laterState(yesterdayState).mode === "catchup" && deskStateUrl(laterState(yesterdayState)) === "?view=all", "Later from yesterday returns to the catch-up and keeps All");
assert(laterState(earlier).mode === "day" && laterState(earlier).day === "2026-11-05", "Later from the day before yesterday opens yesterday alone");
assert(deskStateUrl({ ...homeState, view: "all" }) === "?view=all", "All on the catch-up stays free of a day param");
assert(laterState(homeState) === null, "the catch-up has no later day");
const ntReadme = readFileSync(join(root, "README.md"), "utf8");
assert(ntReadme.includes("npm run new-today:pack"), "README shows the New Today pack command");
assert(ntReadme.includes("Midnight auto-ship") && ntReadme.includes("6:30 AM CT") && ntReadme.includes("Afternoon auto-ship"), "README tells midnight, morning, and afternoon auto-ship to run the same pack");
assert(runSelfTest() === "new-today pack self-test ok", "New Today pack self-test");
const ntScrubbed = scrubCopy("OptionsHawk Darkroom Volland note");
assert(ntScrubbed.length > 0 && !/hawk|darkroom|volland/i.test(ntScrubbed), "pack scrub drops upstream names");
const ntPackIndex = JSON.parse(readFileSync(join(root, "public/data/vault/soft-crowded/index.json"), "utf8"));
const ntPackWeek = JSON.parse(readFileSync(join(root, "public/data/vault/soft-crowded", `${ntPackIndex.latest}.json`), "utf8"));
const ntVolLatest = JSON.parse(readFileSync(join(root, "public/data/vault/spot-vol-beta/latest.json"), "utf8"));
const ntSoft = itemFromSoftCrowded(ntPackIndex, ntPackWeek);
const ntVol = itemFromVolStress(ntVolLatest);
assert(!(nt.items ?? []).some((item) => item.id === ntSoft?.id), "soft-crowded row rolled off the eight-day New Today window");
assert(!(nt.items ?? []).some((item) => item.id === ntVol?.id), "vol-stress row rolled off the eight-day New Today window");
assert(ntVol?.summary.includes("not a session close") && ntVol?.publishedAt === "2026-10-30T12:18:00-05:00", "vol stress row is the 12:18 CT intraday gauge");
assert(ntSoft?.publishedAt === "2026-10-30T05:00:00-05:00" && ntSoft?.summary.includes("Oct 23"), "soft-crowded row uses the pack asOf and the carry-forward date");
assert(ntSoft?.sourceLabel === "Desk" && ntSoft?.section === "positioning", "soft-crowded builder stays a Desk positioning row");
assert(ntVol?.sourceLabel === "Desk" && ntVol?.section === "positioning", "vol-stress builder stays a Desk positioning row");
const ntPlan = planNewToday({ root, now: new Date("2026-11-01T18:00:00Z") });
assert(ntPlan.added.length === 0 && ntPlan.updated.length === 0, `new-today pack is current (would add ${ntPlan.added.map((item) => item.id).join(", ")}; update ${ntPlan.updated.map((item) => item.id).join(", ")})`);
const ntMissing = planNewToday({
  root,
  now: new Date("2026-11-01T18:00:00Z"),
  lastShip: "/no/such/new-today-last-ship.json",
  flowPosts: "/no/such/new-today-flow-posts",
  flowSeen: "/no/such/new-today-seen.json",
  chartState: "/no/such/new-today-STATE.md",
  chartDirs: "/no/such/new-today-charts",
});
assert(ntMissing.added.length === 0 && ntMissing.updated.length === 0, "missing session watchers do not invent rows");
assert(
  ntMissing.gaps.some((gap) => /flow-post/.test(gap)) && ntMissing.gaps.some((gap) => /chart-note/.test(gap)),
  "missing session watchers are gaps, not invented rows",
);
const ntSorted = [...(nt.items ?? [])].map((item) => item.publishedAt);
assert(JSON.stringify(ntSorted) === JSON.stringify([...ntSorted].sort((a, b) => Date.parse(b) - Date.parse(a) || 0)), "new-today.json is newest first");

const nav = /<nav class="nav" aria-label="Pages">[\s\S]*?<\/nav>/;
const dashboardPages = ["index.html", "positioning/index.html", "positioning/desk/index.html", "positioning/charts/index.html", "positioning/ideas/index.html", "vol/index.html", "spx-levels/index.html", "new-today/index.html"];
const vaultSurface = {
  "vault/index.html": { dashboard: "../", vault: "./" },
  "vault/soft-crowded/index.html": { dashboard: "../../", vault: "../" },
  "vault/vol-credit-momentum/index.html": { dashboard: "../../", vault: "../" },
  "vault/portfolio/index.html": { dashboard: "../../", vault: "../" },
  "vault/archive/index.html": { dashboard: "../../", vault: "../" },
  "vault/new-today/index.html": { dashboard: "../../", vault: "../" },
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
  ...["index.html", "positioning/index.html", "positioning/charts/index.html", "options-flow/index.html", "spx-levels/index.html", "new-today/index.html", "vault/index.html", "vault/soft-crowded/index.html", "vault/vol-credit-momentum/index.html", "vault/portfolio/index.html", "vault/archive/index.html", "vault/new-today/index.html", "insight/index.html", "404.html", `${FAMILY_ENTRY}/index.html`, `${FAMILY_ENTRY}/options-flow/index.html`, `${FAMILY_ENTRY}/new-today/index.html`].map((file) => [
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
assert(
  [...vaultTemplate.matchAll(/<span class="vault-dash-num">(\d+)<\/span>/g)].map((match) => match[1]).join() === "01,02,03,04,05,06",
  "Vault dash tiles run 01 through 06",
);
assert(
  vaultTemplate.includes('href="new-today/"') && vaultTemplate.includes('data-new-today') && vaultTemplate.includes('data-public="0"'),
  "signed-in Vault dash has a vault-scope New Today chip linking to /vault/new-today/",
);
assert(vaultPage.includes('src="/src/new-today-chip.js"'), "Vault home runs the New Today chip");
assert(!vaultOutside.includes("soft-crowded"), "the pack link stays inside the signed-in template");
assert(!vaultOutside.includes("new-today"), "the New Today tile stays inside the signed-in template");
assert(!/vault-hero|vault-tile|vault-desk|vault-pack|vault-dash/.test(vaultOutside), "no Vault content renders outside the template");
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
assert(JSON.stringify(wallOrder) === '["spot-vol-beta","credit-spread-regime","mag7","nysi","nasi","ncfd","ndtw","ncfi","ncth","nyhl","nyad"]', `wall order ${wallOrder}`);
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

/* Soft Vol daily EOD: VIX close minus HV20. Separate from Vol Stress and from the weekly Desk blend. */
const softVolDir = join(root, "public/data/vault/soft-vol");
const softVolSchema = JSON.parse(readFileSync(join(softVolDir, "schema.json"), "utf8"));
const softVolSeriesDoc = JSON.parse(readFileSync(join(softVolDir, "series.json"), "utf8"));
const softVolLatestDoc = JSON.parse(readFileSync(join(softVolDir, "latest.json"), "utf8"));
const softVolIndex = JSON.parse(readFileSync(join(softVolDir, "index.json"), "utf8"));
const oct30Closes = [7722.72, 7773.95, 7818.93, 7801.77, 7765.36, 7811.54, 7807.24, 7805.45, 7718.94, 7744.06, 7659.44, 7690.73, 7712.57, 7757.17, 7663.43, 7623.68, 7676.77, 7722.6, 7743.98, 7720.39, 7580.07];
assert(hv20(oct30Closes) === 11.78, `Oct 30 HV20 ${hv20(oct30Closes)}`);
assert(softVolOf(19.42, 11.78) === 7.6 && bucketOf(7.6) === "Stretched", "Oct 30 Soft Vol is +7.6 Stretched");
assert(bucketOf(-0.4) === "Soft Vol" && bucketOf(-0.3) === "Fair" && bucketOf(0.3) === "Fair" && bucketOf(0.4) === "Stretched", "buckets stay on tenths ±0.4");
assert(JSON.stringify(JPM_VOL) === JSON.stringify([-2, -4, -6, -8, -10, -11, -12, -14]), "weekly JPM_VOL blend is unchanged");
assert(JSON.stringify(VOL_SHIFT) === JSON.stringify({ jpm: 0, ms: 4, boa: -3, gs: 6 }), "weekly VOL_SHIFT blend is unchanged");
assert(softVolSeriesDoc.seriesBreak === SERIES_BREAK && softVolSeriesDoc.seriesBreakLabel === SERIES_BREAK_LABEL, "series carries the 2026-11-02 break");
assert(softVolSeriesDoc.points.length === 1 && softVolSeriesDoc.points[0].date === "2026-10-30", "daily series starts at the 2026-10-30 seed");
assert(softVolSeriesDoc.points[0].softVol === 7.6 && softVolSeriesDoc.points[0].bucket === "Stretched" && softVolSeriesDoc.points[0].vix === 19.42 && softVolSeriesDoc.points[0].hv20 === 11.78 && softVolSeriesDoc.points[0].spx === 7580.07, "seed print is the reconstructable Oct 30 close");
assert(softVolSeriesDoc.points[0].softVol === softVolOf(softVolSeriesDoc.points[0].vix, softVolSeriesDoc.points[0].hv20), "seed residual is VIX minus HV20");
assert(softVolLatestDoc.session === "2026-10-30" && softVolLatestDoc.softVol === 7.6 && softVolLatestDoc.bucket === "Stretched" && softVolLatestDoc.seriesBreak === "2026-11-02" && softVolLatestDoc.chartScale === "-5..+15" && softVolLatestDoc.closed === true, "latest.json is the Oct 30 seed");
assert(!("uvDelta" in softVolLatestDoc) && !softVolSeriesDoc.points.some((point) => "uvDelta" in point), "Soft Vol does not store an underlying-vol change");
validatePack(softVolSchema, softVolSchema, softVolSeriesDoc, "soft-vol.series");
validatePack(softVolSchema, softVolSchema.$defs.latest, softVolLatestDoc, "soft-vol.latest");
validatePack(softVolSchema, softVolSchema.$defs.close, softVolSeriesDoc.points[0], "soft-vol.seed");
const softVolView = liveRead(softVolSeriesDoc, softVolLatestDoc);
assert(softVolView.display === "+7.6" && softVolView.bucket === "Stretched" && softVolView.domain[0] === -5 && softVolView.domain[1] === 15, `live read ${softVolView.display} ${softVolView.bucket}`);
assert(softVolView.position > softVolView.cuts[1] && softVolView.cuts[0] < softVolView.cuts[1], "Stretched +7.6 sits past the +0.4 band on the widened scale");
assert(hubFact(softVolLatestDoc) === "Desk · Stretched +7.6 pts", `hub fact ${hubFact(softVolLatestDoc)}`);
assert(chartFacts()["soft-vol"] === "Desk · Soft Vol −1.2 pts", "weekly chart facts keep the filed Desk blend");
assert(readFileSync(join(root, "src/positioning-hub.js"), "utf8").includes("fact(\"chart-soft-vol\", `${hubFact(softVolLatest)} · ${liveVol.seriesBreakLabel}`)"), "the hub chart tile shows the daily print and the series break");
assert(tipLines(softVolSeriesDoc.points[0]).includes(SERIES_BREAK_LABEL) && !tipLines(softVolSeriesDoc.points[0]).some((line) => /WoW|week-over-week/i.test(line)), "hover names the series break and does not invent a week-over-week");
assert(softVolChart("desk", 7).display === "−1.2", "the weekly Desk blend helper still reads −1.2 for the filed weeks");
const seededClose = buildSoftVolClose(undefined, { date: "2026-10-30", vix: 19.42, spxCloses: oct30Closes, recordedAt: "2026-10-30T15:00:00-05:00" });
assert(seededClose.hv20 === 11.78 && seededClose.softVol === 7.6 && seededClose.bucket === "Stretched" && seededClose.spx === 7580.07, `buildSoftVolClose seed ${JSON.stringify(seededClose)}`);
for (const [input, message] of [
  [{ date: "2026-10-29", vix: 19, spxCloses: oct30Closes }, "a close before the last session"],
  [{ date: "2026-10-30", vix: 19, spxCloses: oct30Closes }, "the same session without replace-last"],
  [{ date: "2026-11-01", vix: 19, spxCloses: oct30Closes }, "a Sunday close"],
  [{ date: "2026-11-02", vix: 19, spxCloses: oct30Closes.slice(0, 20) }, "a window that is not 21 closes"],
]) {
  let threw = false;
  try {
    buildSoftVolClose(softVolSeriesDoc.points.at(-1), input);
  } catch {
    threw = true;
  }
  assert(threw, `buildSoftVolClose refuses ${message}`);
}
const replaced = buildSoftVolClose(softVolSeriesDoc.points.at(-1), { date: "2026-10-30", vix: 19.42, spxCloses: oct30Closes, recordedAt: "2026-10-30T16:15:00-05:00", replaceLast: true });
assert(replaced.date === "2026-10-30" && replaced.origin === "close-routine" && replaced.softVol === 7.6, "replace-last rewrites only the same session");
let backdated = false;
try {
  buildSoftVolClose(softVolSeriesDoc.points.at(-1), { date: "2026-10-29", vix: 19.42, spxCloses: oct30Closes, replaceLast: true });
} catch {
  backdated = true;
}
assert(backdated, "replace-last still refuses a date before the last session");
assert(packageJson.scripts["soft-vol:close"] === "node scripts/soft-vol-close.mjs" && existsSync(join(root, "scripts/soft-vol-close.mjs")), "npm run soft-vol:close appends a close");
assert(readFileSync(join(root, "scripts/soft-vol-close.mjs"), "utf8").includes("re-commit"), "the close script tells a pre-close pass to re-commit after the official close");
assert(softVolIndex.routine.command.startsWith("npm run soft-vol:close") && softVolIndex.routine.cadence.includes("3:30 CT"), "series index documents the cash-close routine");
validatePack(softVolSchema, softVolSchema.$defs.close, softVolIndex.routine.example, "soft-vol.index.routine.example");
assert(softVolIndex.routine.rules.some((rule) => rule.includes("shape")), "the routine example is marked as a shape");
const chartsSoft = readFileSync(join(root, "src/charts.js"), "utf8");
const deskSoft = readFileSync(join(root, "src/positioning.js"), "utf8");
assert(chartsSoft.includes("liveRead") && chartsSoft.includes("series-break") && deskSoft.includes("liveRead"), "the chart and the desk gauge read the daily series");
assert(chartsSoft.includes("domain: model.domain") && chartsSoft.includes('ticks: model.scaleTicks'), "the Soft Vol columns use the −5 to +15 scale");
assert(!chartsSoft.includes("uvDelta") && !deskSoft.includes("uvDelta"), "Soft Vol UI does not read an underlying-vol change");
assert(chartsPage.includes(SERIES_BREAK_LABEL), "the Soft Vol card labels the series break");
for (const piece of ["closesBlock(series)", "Session closes", "Gauge close", "Desk estimate close", "Entered by", "svb-close-table"]) assert(svbJs.includes(piece), `Spot Vol Beta card renders ${piece}`);
assert(css.includes(".svb-close-table") && css.includes(".svb-origin.is-seed"), "close history has a table and a seeded tag");

/* Breadth cards on the same wall: NY and Nasdaq Summation, 1Y / 1D default, 10Y range, −1000 buy line. */
assert(wallPage.includes('src="/src/vault-breadth.js"'), "wall page runs the breadth cards");
for (const [id, label] of [
  ["nysi", "NY Summation"],
  ["nasi", "Nasdaq Summation"],
  ["ncfd", "Nasdaq 5-day"],
  ["ndtw", "Nasdaq-100 20-day"],
  ["ncfi", "Nasdaq 50-day"],
  ["ncth", "Nasdaq 200-day"],
]) {
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
assert(JSON.stringify(breadthIndex.charts.map((chart) => chart.id)) === '["nysi","nasi","ncfd","ndtw","ncfi","ncth","nyhl","nyad"]' && breadthIndex.overlay.id === "spx", "wall charts are NYSI, NASI, the Nasdaq % above MA stack, NYHL, and NYAD over SPX");
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

const pctWant = {
  ncfd: { label: "Nasdaq 5-day", symbol: "NCFD", window: 5, universe: "nasdaq-comp", close: 38.87, months: 24 },
  ndtw: { label: "Nasdaq-100 20-day", symbol: "NDTW", window: 20, universe: "nasdaq-100", close: 50.51, months: 60 },
  ncfi: { label: "Nasdaq 50-day", symbol: "NCFI", window: 50, universe: "nasdaq-comp", close: 33.98, months: 24 },
  ncth: { label: "Nasdaq 200-day", symbol: "NCTH", window: 200, universe: "nasdaq-comp", close: 37.71, months: 60 },
};
assert(JSON.stringify(PCT_RAILS) === "[20,40,60,80]" && SOFT_PCTILE === 20 && CROWDED_PCTILE === 80, "participation rails and Soft/Crowded %ile bands are 20 / 80");
assert(percentileRank([10, 20, 30, 40, 50], 10) === 10 && percentileRank([10, 20, 30, 40, 50], 50) === 90, "percentile rank counts ties as half");
assert(bucketPctile(20) === "soft" && bucketPctile(20.01) === "mid" && bucketPctile(80) === "crowded", "Soft is ≤20th %ile and Crowded is ≥80th %ile");
assert(pctileOrdinal(20) === "20th" && pctileOrdinal(21) === "21st" && pctileOrdinal(12) === "12th", "percentile ordinals keep 11–13 as th");
for (const [id, want] of Object.entries(pctWant)) {
  const doc = breadthDocs[id];
  assert(doc.kind === "pct-above-ma" && doc.symbol === want.symbol && doc.label === want.label && doc.window === want.window, `${id} is the participation pane`);
  assert(doc.universe === want.universe && JSON.stringify(doc.rails) === "[20,40,60,80]" && doc.softPctile === 20 && doc.crowdedPctile === 80, `${id} keeps 20/80 Soft/Crowded bands`);
  assert(doc.defaultRangeMonths === want.months && doc.asOf === "2026-11-02" && doc.bars.at(-1).t === "2026-11-02" && doc.bars.at(-1).c === want.close, `${id} last ${doc.bars.at(-1)?.c} on ${doc.bars.at(-1)?.t}`);
  assert(doc.provenance?.kind === "desk-computed" && doc.provenance.feedSymbol === `$${want.symbol}` && !/tradingview|darkmatter|optionshawk/i.test(JSON.stringify(doc)), `${id} is a desk-computed series with a feed replacement path`);
  assert(doc.bars.length >= 1500 && doc.bars.every((bar, i) => /^\d{4}-\d{2}-\d{2}$/.test(bar.t) && bar.c >= 0 && bar.c <= 100 && (i === 0 || bar.t > doc.bars[i - 1].t)), `${id} is a dated 0–100 series`);
  assert(breadthWindowStart(doc.bars, MAX_MONTHS) >= 0 && doc.bars[breadthWindowStart(doc.bars, MAX_MONTHS)].t <= monthsBack("2026-11-02", 120), `${id} covers ten years`);
  const read = pctileRead(doc);
  assert(read.close === want.close && read.date === "2026-11-02" && Number.isFinite(read.pctile) && bucketPctile(read.pctile) === read.state, `${id} card read uses this series’ historical %ile`);
}
assert(pctileRead(breadthDocs.ncfi).state === "soft" && pctileRead(breadthDocs.ncfi).pctile <= 20, "Nov 2 Nasdaq 50-day sits in the left-tail %ile (Soft)");
assert(pctileRead(breadthDocs.ncfd).state === "mid", "Nov 2 Nasdaq 5-day is mid, not a raw-level washout");
assert(readFileSync(join(root, "scripts/pull-breadth.mjs"), "utf8").includes("$NCFD") && readFileSync(join(root, "scripts/pull-breadth.mjs"), "utf8").includes("PCT_IDS"), "the breadth pull refreshes NCFD / NDTW / NCFI / NCTH and leaves NYHL / NYAD in place");
assert(packageJson.scripts["seed:nasdaq-ma"] === "node scripts/seed-nasdaq-ma.mjs", "npm run seed:nasdaq-ma rebuilds the computed participation series");

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
assert(!bookPage.includes("Every line is a 4,000 ticket") && !bookPage.includes("4,000 ticket on every line"), "portfolio copy does not size every line to 4,000");
assert(bookTemplate.includes("are 1 contract") && bookTemplate.includes("4,000 ticket"), "portfolio lede states both sizing rules");
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
assert(book.summary.book === "desk-mock" && book.summary.journal_lock === "2026-10-30-desk-mock" && book.summary.as_of_ct === "2026-11-04 CT" && book.summary.updated_ct === "2026-11-04 CT", "portfolio journal is the desk mock book stamped 2026-11-04 CT");
assert(book.summary.starting_balance_usd === 50000 && book.summary.ticket_usd === 4000, "mock book starts at 50000 with a 4000 ticket for Spotlight and Featured");
assert(book.summary.closed_pnl_usd === -493.03 && book.summary.closed_count === 9 && book.summary.open_count === 3, "portfolio closed PnL, closed count, and open count");
assert(!("account" in book.summary), "mock book has no account identifier");
assert(JSON.stringify(book.summary.open_tickers) === JSON.stringify(["AZN", "NFLX", "GS"]), "open tickers are AZN, NFLX, GS");
assert(
  book.summary.by_category.Spotlight === -853.03 &&
    book.summary.by_category["Earnings Snapshot"] === -452 &&
    book.summary.by_category["Weekly Radar Earnings Preview"] === 812,
  "portfolio category totals",
);
assert(
  book.summary.sources_note.includes("4,000 ticket on a 50,000 book") &&
    book.summary.sources_note.includes("Earnings Snapshot, Weekly Radar Earnings Preview, and Weekly Radar Credit Spread of the Week are 1 contract"),
  "sources note states the 4000 ticket and the 1-contract exceptions",
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
const oneLotCategories = new Set(["Earnings Snapshot", "Weekly Radar Earnings Preview", "Weekly Radar Credit Spread of the Week"]);
assert(book.trades.every((trade) => trade.ticket_lock === "desk 2026-10-30"), "ticket lock stays desk 2026-10-30");
assert(
  book.trades.every((trade) =>
    oneLotCategories.has(trade.category) ? trade.qty === 1 && trade.ticket_usd === Math.round(trade.entry_price * 100) : trade.ticket_usd === 4000,
  ),
  "earnings and weekly credit lines are 1 contract; Spotlight and Featured stay a 4000 ticket",
);
function ticketPnl(trade) {
  if (trade.exit_price == null || trade.status !== "closed") return null;
  const credit = String(trade.structure ?? "").trim().toLowerCase().startsWith("short");
  const signed = credit ? trade.entry_price - trade.exit_price : trade.exit_price - trade.entry_price;
  if (trade.id === "desk-xyz-spotlight-43878") return Math.round(signed * 100 * trade.qty * 100) / 100;
  if (oneLotCategories.has(trade.category)) return Math.round(signed * 100 * trade.qty);
  return Math.round((signed / trade.entry_price) * 4000);
}
assert(book.trades.every((trade) => trade.pnl_usd === ticketPnl(trade)), "displayed PnL matches the line's sizing rule");
const byTicker = Object.fromEntries(book.trades.map((trade) => [trade.id, trade]));
const meta = byTicker["desk-meta-earnings-snapshot-2026-10-19"];
assert(meta.status === "closed" && meta.outcome === "loss" && meta.qty === 1 && meta.pnl_usd === -666 && bookSide(meta) === "closed", "META is a 1-lot filled close on the Closed tab");
assert(!isPending(meta) && !isOpen(meta) && resultLabel(meta) === "Loss", "META reads as a closed loss");
const xyz = byTicker["desk-xyz-spotlight-43878"];
assert(
  xyz.qty === 11 &&
    xyz.entry_price === 3.5173 &&
    xyz.exit_price === 6.75 &&
    xyz.exit_ts_ct === "2026-11-04 8:34 AM CT" &&
    xyz.closedAt === "2026-11-04" &&
    xyz.status === "closed" &&
    xyz.outcome === "win" &&
    xyz.pnl_usd === 3555.97 &&
    xyz.return_label === "+92%" &&
    bookSide(xyz) === "closed" &&
    resultLabel(xyz) === "Win",
  "XYZ Spotlight 43878 is a filled win at 6.75 on 2026-11-04",
);
assert(!isOpen(xyz) && !isPending(xyz), "XYZ is off the Open tab");
assert(formatPx(xyz.entry_price) === "3.5173" && formatPx(xyz.exit_price) === "6.75", `XYZ prices render entry ${formatPx(xyz.entry_price)} exit ${formatPx(xyz.exit_price)}`);
assert(formatUsd(xyz.pnl_usd) === "+$3,555.97" && formatUsd(1210) === "+$1,210" && formatUsd(-493.03) === "−$493.03" && formatUsd(-4049) === "−$4,049", "XYZ PnL keeps cents and whole-dollar lines stay whole");
assert(formatUsd(null) === "—" && formatUsd(undefined) === "—" && formatUsd(0) === "$0" && formatBook(50000) === "$50,000", "a missing PnL stays blank and the book prints unsigned");
const nflx = byTicker["desk-nflx-earnings-snapshot-2026-10-19"];
assert(nflx.status === "open" && nflx.qty === 1 && nflx.ticket_usd === 227 && nflx.outcome === null && nflx.pnl_usd === null, "NFLX stays open at 1 contract with an empty outcome");
assert(isOpen(nflx) && !isPending(nflx) && resultLabel(nflx) === "Open" && bookSide(nflx) === "open", "NFLX reads as open, not pending");
assert(
  JSON.stringify(book.trades.filter(isOpen).map((trade) => trade.ticker)) === JSON.stringify(["AZN", "NFLX", "GS"]),
  "open rows are AZN, NFLX, GS",
);
assert(book.trades.filter((trade) => bookSide(trade) === "closed").map((trade) => trade.ticker).length === 9, "nine closed lines");
assert(book.trades.filter((trade) => bookSide(trade) === "open").length === 3, "three lines land on the Open tab");
assert(!book.trades.some(isPending), "this lock has no working close");
const azn = byTicker["desk-azn-featured-43721"];
assert(azn.status === "open" && azn.outcome === "open" && azn.entry_price === 4.5 && azn.exit_price === null && azn.pnl_usd === null && bookSide(azn) === "open", "AZN featured debit stays open");
const gs = byTicker["desk-gs-weekly-radar-43728"];
assert(gs.status === "open" && gs.qty === 1 && gs.ticket_usd === 480 && gs.pnl_usd === null && gs.exit_price === null, "GS weekly credit spread stays open at 1 contract");
assert(byTicker["desk-be-earnings-snapshot-2026-10-19"].pnl_usd === -1133, "BE 1-lot loss");
for (const id of ["desk-fcx-spotlight-43676-lot1", "desk-fcx-spotlight-43676-lot2", "desk-gld-spotlight-43774", "desk-xyz-spotlight-43878", "desk-azn-featured-43721"]) {
  assert(byTicker[id].ticket_usd === 4000 && !oneLotCategories.has(byTicker[id].category), `${id} stays on the 4000 ticket`);
}
for (const [id, pnl] of [
  ["desk-fcx-spotlight-43676-lot1", 1210],
  ["desk-spcx-earnings-snapshot-2026-10-19", 277],
  ["desk-spot-earnings-snapshot-2026-10-19", 1070],
  ["desk-txn-weekly-radar-43728", 812],
]) {
  assert(byTicker[id].outcome === "win" && byTicker[id].pnl_usd === pnl && resultLabel(byTicker[id]) === "Win", `${id} win ${pnl}`);
}
assert(resultLabel(book.trades[0]) === "Win" && resultLabel(book.trades[1]) === "Loss", "filled lines keep win and loss");
const working = { status: "exit_pending_fill", outcome: "loss_pending", pnl_usd: -1 };
assert(isPending(working) && !isOpen(working) && resultLabel(working) === "Pending" && bookSide(working) === "open", "a working close stays pending and on the Open tab");
const moneyCents = (value) => Math.round(Number(value) * 100);
assert(moneyCents(closedPnl(book)) === moneyCents(book.summary.closed_pnl_usd), `closed sum ${closedPnl(book)} drifted from the lock`);
const path = equityPath(book);
assert(path.start === 50000 && path.equity === 49506.97 && path.points.length === 10, `mock equity path ${path.equity}`);
assert(bookJs.includes("dataset.tab") && bookJs.includes('["open"') && bookJs.includes("bookSide") && bookJs.includes("pf-curve") && bookJs.includes("return_label"), "portfolio renders status tabs, the book path, and a close return");
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
assert(deskCopy(xyz.ticket_lock) === "desk 2026-10-30" && deskCopy(xyz.notes).includes("+92%") && deskCopy(xyz.notes).includes("6.75") && deskCopy(byTicker["desk-be-earnings-snapshot-2026-10-19"].notes).includes("Call spread"), "journal copy stays on the ticket");
assert(deskCopy(["Options", "Hawk", " ", "Vol", "land"].join("")) === "", "a line that would still name a source is dropped");
for (const piece of ["deskCopy(summary.event)", "deskCopy(trade.notes)", "deskCopy(trade.ticket_lock)", "deskCopy(summary.journal_lock)"]) {
  assert(bookJs.includes(piece), `portfolio scrubs ${piece}`);
}
assert(!/summary\.event\)\);|trade\.notes\)\);|"pf-lock", trade\.ticket_lock/.test(bookJs), "portfolio does not render raw journal copy");
assert(stopOf(xyz) === 70 && targetOf(xyz) === 90 && stopOf(nflx) === null && targetOf(nflx) === null, "XYZ keeps stock stop 70 and target 90; NFLX has neither");
assert(JSON.stringify(markOf(xyz)) === '{"price":null,"pnl":null,"asOf":"","marked":false}', "a line without mtm fields has no mark");
assert(JSON.stringify(markOf({ mtm_price: 4.1, mtm_pnl_usd: 643, mtm_as_of_ct: "2026-10-30 3:00 PM CT" })) === '{"price":4.1,"pnl":643,"asOf":"2026-10-30 3:00 PM CT","marked":true}', "mtm fields read through");
assert(markOf({ mtm_price: "4.1", mtm_pnl_usd: Number.NaN }).marked === false, "a malformed mark stays blank");
const strip = weekStrip(book);
assert(strip.week === "2026-W45" && strip.start === "2026-11-02" && strip.end === "2026-11-08", `portfolio week ${strip.week}`);
assert(strip.closedPnl === 3555.97 && strip.closedCount === 1 && strip.wins === 1 && strip.losses === 0, `week closed ${strip.closedPnl} over ${strip.closedCount}`);
assert(JSON.stringify(strip.closedTickers) === '["XYZ"]' && strip.openCount === 3 && strip.markedCount === 0 && strip.markPnl === null, "week strip closes and open count");
const markedBook = structuredClone(book);
markedBook.trades.filter(isOpen).forEach((trade, index) => Object.assign(trade, { mtm_price: 1, mtm_pnl_usd: index * 10, mtm_as_of_ct: "2026-10-30 3:00 PM CT" }));
assert(weekStrip(markedBook).markPnl === 30 && weekStrip(markedBook).markedCount === 3, "open marks total only when every open line is marked");
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
  const html = readFileSync(join(root, file), "utf8");
  assert(!html.includes("vault/archive"), `${file} links into the Vault archive`);
  assert(!html.includes("vault/new-today"), `${file} links into the Vault New Today page`);
}
for (const file of ["vault/soft-crowded/index.html", "vault/vol-credit-momentum/index.html", "vault/portfolio/index.html", "vault/new-today/index.html"]) {
  assert(readFileSync(join(root, file), "utf8").includes('href="../archive/"'), `${file} links to the archive from the Vault nav`);
}

const vaultNtFile = "vault/new-today/index.html";
assert(viteConfig.includes(`"${vaultNtFile}"`), `vite builds ${vaultNtFile}`);
const vaultNtPage = readFileSync(join(root, vaultNtFile), "utf8");
assert(vaultNtPage.includes('<body class="is-vault">'), "Vault New Today carries the Vault theme");
assert(!vaultNtPage.includes('data-surface="public"'), "Vault New Today is not the public surface");
assert(vaultNtPage.includes('src="/src/vault-gate.js"') && vaultNtPage.includes('src="/src/new-today.js"'), "Vault New Today runs the Vault gate and new-today.js");
const vaultNtMain = vaultNtPage.match(/<main id="content">([\s\S]*?)<\/main>/)?.[1] ?? "";
const vaultNtTemplate = vaultNtMain.match(/<template id="vault-content">([\s\S]*?)<\/template>/)?.[1] ?? "";
const vaultNtOutside = vaultNtMain.replace(/<template id="vault-content">[\s\S]*?<\/template>/, "");
assert(
  vaultNtOutside.match(/<section class="vault-wall"[\s\S]*?<\/section>/)?.[0].replaceAll('href="../../"', 'href="../"') ===
    vaultOutside.match(/<section class="vault-wall"[\s\S]*?<\/section>/)?.[0],
  "Vault New Today sign-in card is the same allowlist sign-in card as the Vault",
);
for (const piece of ['id="nt-body"', 'id="nt-pill"', 'id="nt-fresh"', 'href="#nt-options-flow"', "including Options Flow"]) {
  assert(vaultNtTemplate.includes(piece), `Vault New Today template has ${piece}`);
}
assert(!vaultNtOutside.includes("nt-body") && !vaultNtOutside.includes("nt-options-flow"), "Vault New Today rows stay inside the signed-in template");
assert(readFileSync(join(root, "src/new-today.js"), "utf8").includes('dataset.surface === "public"'), "New Today only hides Options Flow on the public surface");
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
assert(oct28.length === 1 && oct28Days.length === 0, "Oct 28 New Today rows rolled off the archive with the eight-day window");
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
const wordHit = filterEntries(archiveEntries, "kkr", "day");
assert(wordHit.length > 0 && wordHit.every((entry) => entry.items.every((item) => item.text.includes("kkr"))), "a word search cuts a desk day to its matching lines");
assert(displaySource(["W", "SJ"].join("")) === "Press note" && displaySource("GS") === "GS" && displaySource("") === "Desk", "archive press labels read as a press note");
const archiveShown = archiveEntries.flatMap((entry) => [entry.title, entry.label, entry.summary, entry.headline ?? "", ...(entry.items ?? []).flatMap((item) => [item.title, item.summary, item.source])]).join("\n");
assert(!bannedSource(archiveShown) && !/\bwsj\b/i.test(archiveShown), "archive shows no source names");
assert(css.includes(".archive-entry") && css.includes(".archive-gap") && css.includes(".archive-items"), "archive styles entries, gaps, and items");

assert(breadthSpx.bars.find((bar) => bar.t === "2026-10-29")?.c === 7720.39, "wall SPX Oct 29 close 7720.39");
const breadthJs = readFileSync(join(root, "src/vault-breadth.js"), "utf8");
for (const piece of ["data/vault/breadth/", 'input.type = "range"', "MAX_MONTHS", "BUY ", "buyLine", "$SPX", "MA(", "directionRuns", "[data-breadth]", "onDeskReady", "bw-cross", "pct-above-ma", "PCT_LINE"]) {
  assert(breadthJs.includes(piece), `breadth cards render ${piece}`);
}
for (const file of ["src/vault-breadth.js", "src/breadth.js", "scripts/pull-breadth.mjs", "scripts/seed-nasdaq-ma.mjs"]) {
  const text = readFileSync(join(root, file), "utf8");
  assert(!/stockcharts|<img\b|<iframe|©|tradingview|darkmatter|optionshawk/i.test(text), `${file} carries chart-vendor branding or an embed`);
}

/* Light + dark: stored choice wins; first visit with nothing stored is always light. */
assert(THEME_KEY === "p-theme" && THEMES.join() === "light,dark", "theme persists under p-theme as light | dark");
assert(resolveTheme("dark", false) === "dark" && resolveTheme("light", true) === "light", "a stored theme beats the first-visit default");
assert(resolveTheme(null, true) === "light" && resolveTheme(null, false) === "light" && resolveTheme("sepia", true) === "light", "first visit defaults to light");
assert(THEME_PAGE.light === "#f3f1ec" && THEME_PAGE.dark === "#161410", "theme-color follows the page token");
const lightBlock = css.match(/:root,\s*\[data-theme="light"\] \{([^}]*)\}/)?.[1] ?? "";
const darkBlock = css.match(/@media screen \{\s*:root\[data-theme="dark"\] \{([^}]*)\}/)?.[1] ?? "";
for (const token of ["--p-page: #f3f1ec;", "--p-card: #ffffff;", "--p-ink: #141414;", "--sc-glow-alpha: 0.45;"]) assert(lightBlock.includes(token), `light theme keeps ${token}`);
for (const token of ["--p-page: #161410;", "--p-card: #1e1b16;", "--p-ink: #f0e6d6;", "--sc-glow-alpha: 0.55;"]) assert(darkBlock.includes(token), `dark theme sets ${token}`);
assert(!/#12141a/i.test(css), "dark theme is the warm night twin, not the rejected ledger dark");
assert(css.includes(".theme-toggle") && /@media print \{\s*\.theme-toggle \{ display: none; \}/.test(css), "toggle is styled on screen and hidden in print");
for (const file of viteInputs) {
  const html = readFileSync(join(root, file), "utf8");
  if (!html.includes('href="/src/styles.css"')) continue;
  const boot = html.indexOf('localStorage.getItem("p-theme")');
  assert(boot > -1 && boot < html.indexOf('href="/src/styles.css"'), `${file} sets data-theme before the stylesheet paints`);
  assert(html.includes('if(t!=="light"&&t!=="dark"){t="light";localStorage.setItem("p-theme",t)}'), `${file} first-visit boot is light`);
  assert(!html.includes("prefers-color-scheme"), `${file} boot does not follow the OS color scheme`);
  assert(html.includes('<script type="module" src="/src/theme.js"></script>'), `${file} loads the theme toggle`);
  if (!html.includes('class="topbar"')) continue;
  const toggles = html.match(/<div class="theme-toggle" role="group" aria-label="Theme">[\s\S]*?<\/div>/g) ?? [];
  assert(toggles.length === 1 && toggles[0].includes('data-theme-set="dark"') && toggles[0].includes('data-theme-set="light"'), `${file} topbar carries one light/dark toggle`);
}
const familyEntry = readFileSync(join(root, "m4c8q/index.html"), "utf8");
assert(familyEntry.replace(/<template id="vault-content">[\s\S]*?<\/template>/, "").includes("theme-toggle") === false && familyEntry.includes("theme-toggle"), "family entry toggle lives inside the gated header");
for (const file of ["src/vault-breadth.js", "src/csr-chart.js", "src/mag7-chart.js", "src/flow-chart.js"]) {
  assert(!/data-theme|var\(--p-/.test(readFileSync(join(root, file), "utf8")), `${file} chart embed stays as shipped`);
}

/* Market Health engine: inverse vol, credit stress, and honest gaps. */
assert(bucketSoftVol({ vix: 28, wow: 10, residual: -1.2 }) === "soft-extreme", "a VIX surge is soft even when the residual is cheap");
assert(bucketSoftVol({ vix: 19.99, wow: 5.15, residual: -1 }) === "soft-extreme", "W42-sized VIX jump is soft-extreme");
assert(bucketSoftVol({ vix: 18.77, wow: 3.74 }) === "soft", "a surge under 4 points is soft");
assert(bucketSoftVol({ vix: 13, wow: -0.2 }) === "crowded", "calm low VIX is crowded");
assert(bucketSoftVol({ vix: 19.45, wow: -0.54, residual: -1.2 }) === "crowded", "cheap Soft Vol without a surge is crowded");
assert(bucketSoftVol({ vix: 19.45, wow: -0.54 }) === "mid", "the same week without a filed residual stays mid");
assert(bucketSoftVol({ vix: 14.5, wow: null }) === null, "a missing week-over-week VIX move is not invented");
assert(vixSurge(2) && !vixSurge(1.9), "VIX surge starts at a 2 point week");
assert(bucketSvb({ svb: 2.98, wow: 1.87 }) === "soft-extreme", "a 2.98 gauge jump is soft-extreme");
assert(bucketSvb({ svb: 0.55, wow: 0 }) === "crowded", "a calm vol-stress gauge is crowded");
assert(bucketSvb({ svb: 1.11, wow: 0.21 }) === "mid", "a gauge between 1 and 2 is mid");
assert(svbSurge(2.18, 1.73) && svbSurge(1.58, 1.12) && !svbSurge(0.9, -0.68), "vol-stress surge is the signal or a jump through 1.5");
assert(bucketMag7(12) === "crowded-extreme" && bucketMag7(8.13) === "crowded" && bucketMag7(0) === "mid", "Mag 7 extended is crowded");
assert(bucketMag7(-4.58) === "soft" && bucketMag7(-6) === "soft-extreme", "a washed-out Mag 7 oscillator is soft");
assert(bucketCredit({ z: 2.58, regime: "STRESS", mag7: "soft" }) === "crowded-extreme", "credit stress stays red");
assert(bucketCredit({ z: 1.85, regime: "ELEVATED", mag7: "soft" }) === "crowded", "elevated credit is crowded");
assert(bucketCredit({ z: -1.51, regime: "LOW", mag7: "mid" }) === "mid", "tight credit alone is mid");
assert(bucketCredit({ z: -1.51, regime: "LOW", mag7: "crowded" }) === "crowded", "tight credit with Mag 7 extended is crowded");
assert(bucketCredit({ z: -0.44, regime: "NORMAL", mag7: "crowded" }) === "mid", "a normal spread stays mid");
assert(creditIsStress(1) && !creditIsStress(-1.5), "credit-stress bias starts at elevated, not at a tight spread");
assert(bucketSummation({ close: -1100, ma: -900, prev: -800, buyLine: -1000 }) === "soft-extreme", "through the buy line and falling is soft-extreme");
assert(bucketSummation({ close: 378.62, ma: 356.57, prev: 347.09, buyLine: -1000 }) === "crowded", "a high summation above its average is crowded");
assert(bucketSummation({ close: -767.23, ma: -633.37, prev: -559.16, buyLine: -1000 }) === "soft-extreme", "a deep summation under its average is soft-extreme");
assert(bucketSummation({ close: -722.68, ma: -765.07, prev: -782.79, buyLine: -1000 }) === "mid", "a rebound still below zero stays mid");
assert(bucketCumulative({ close: 647913, ma: 643986.89, prev: 647664 }) === "crowded", "NYAD extended above its average is crowded");
assert(bucketCumulative({ close: 642128, ma: 645622.81, prev: 644227 }) === "soft-extreme", "NYAD falling through its average is soft-extreme");
assert(bucketSpxEma({ close: 7757.64, ema8: 7515.2, ema21: 7322.01 }) === "crowded-extreme", "SPX extended above both weekly EMAs is crowded");
assert(bucketSpxEma({ close: 7659.44, ema8: 7698.73, ema21: 7562.69 }) === "mid", "SPX between the 8- and 21-week EMAs is mid");
assert(bucketSpxEma({ close: 7100, ema8: 7200, ema21: 7400 }) === "soft", "SPX under both weekly EMAs is soft");
assert(bucketSpxEma({ close: 7000, ema8: 7200, ema21: 7400 }) === "soft-extreme", "SPX extended under both weekly EMAs is soft-extreme");
assert(paintCell("mag7", "crowded-extreme", { active: true, vixSurge: true, creditStress: true }) === "crowded-extreme", "Mag 7 stays crowded through a vol spike and credit stress");
assert(paintCell("spx-ema", "crowded", { active: true, vixSurge: true, creditStress: true }) === "crowded", "SPX extended stays crowded through a vol spike");
assert(paintCell("global-fund", "crowded", { active: true, vixSurge: true }) === "crowded", "the fund proxy stays crowded through a VIX surge");
assert(paintCell("sharpies", "mid", { active: true, vixSurge: true }) === "mid", "the COT proxy is not repainted by a VIX surge");
assert(paintCell("credit", "crowded-extreme", { active: true, vixSurge: true }) === "crowded-extreme", "credit stress stays red when vol surges");
assert(paintCell("soft-vol", "crowded", { active: true, creditStress: true }) === "soft", "credit stress leans Soft Vol green");
assert(paintCell("vol-stress", "mid", { active: true, vixSurge: true }) === "soft", "a VIX surge leans Vol Stress green");
assert(paintCell("vol-stress", "empty", { active: true, vixSurge: true }) === "empty", "a missing vol-stress week is not filled from the VIX");
assert(paintCell("soft-vol", "soft-extreme", { active: true, creditStress: true }) === "soft-extreme", "a surge that is already soft-extreme stays there");
assert(biasPhrase({ vixSurge: true, creditStress: true }).includes("lean buy index"), "the bias names the buy-index lean");
assert(GLOBAL_FUND_PROXIES.map((row) => row.isoWeek).join() === "2026-W29,2026-W34", "Global fund proxies are the July and August notes only");
assert(GLOBAL_FUND_PROXIES[0].cash === 3.6 && GLOBAL_FUND_PROXIES[0].priorCash === 4.1 && GLOBAL_FUND_PROXIES[0].sentiment === 7.2, "July fund proxy is cash 3.6% from 4.1% and sentiment 7.2");
assert(GLOBAL_FUND_PROXIES[1].cash === 3.5 && GLOBAL_FUND_PROXIES[1].owGlobal === 56 && GLOBAL_FUND_PROXIES[1].semis === 53, "August fund proxy is cash 3.5%, equities 56% overweight, semis 53%");
assert(GLOBAL_FUND_PROXIES.every((row) => row.direction === "Stretching"), "June through August fund direction is Stretching");
assert(GLOBAL_FUND_UNCONFIRMED.isoWeek === "2026-W43" && GLOBAL_FUND_UNCONFIRMED.cash === 3.9 && GLOBAL_FUND_UNCONFIRMED.semis === 53, "W43 fund quote is recorded and not a fresh proxy");
assert(SHARPIES_PROXIES.length === 1 && SHARPIES_PROXIES[0].hedger === -66.52 && SHARPIES_PROXIES[0].isoWeek === "2026-W29", "Sharpies is the single July −66.52 print");
assert(NAAIM_PROXIES.length === 1 && NAAIM_PROXIES[0].value === 74.5 && NAAIM_PROXIES[0].asOfLabel === "Sat Oct 17, 2026", "NAAIM is 74.5 as of Sat Oct 17, 2026");
assert(SOFT_VOL_PRINTS["2026-W42"].residual === -1 && SOFT_VOL_PRINTS["2026-W42"].fresh, "W42 Soft Vol residual is the filed −1.0 print");
assert(SOFT_VOL_PRINTS["2026-W43"].residual === -1.2 && SOFT_VOL_PRINTS["2026-W43"].fresh, "W43 Soft Vol residual is the filed −1.2 print");
assert(SOFT_VOL_PRINTS["2026-W44"].fresh === false && SOFT_VOL_PRINTS["2026-W44"].carriedFrom === "2026-10-23", "W44 Soft Vol residual is the Oct 23 carry");
const engineSrc = readFileSync(join(root, "src/market-health-engine.js"), "utf8");
assert(!engineSrc.includes("JPM_VOL") && !engineSrc.includes('from "./series.js"'), "the board does not read the illustrative sector or vol path");
for (const file of ["2026-10-16.json", "2026-10-23.json", "2026-10-30.json"]) {
  const pack = JSON.parse(readFileSync(join(root, "public/data/vault/soft-crowded", file), "utf8"));
  const fact = pack.charts.refs.find((ref) => ref.id === "soft-vol").fact;
  const print = SOFT_VOL_PRINTS[pack.isoWeek];
  assert(fact.includes(String(Math.abs(print.residual))), `${pack.isoWeek} Soft Vol residual matches ${fact}`);
}
const carryPack = JSON.parse(readFileSync(join(root, "public/data/vault/soft-crowded/2026-10-30.json"), "utf8"));
assert(carryPack.carryForward.from === "2026-10-23", "W44 pack is the Oct 23 carry");

const mhDocs = {
  csr: csrDoc,
  svbSeries: JSON.parse(readFileSync(join(root, "public/data/vault/spot-vol-beta/series.json"), "utf8")),
  svbLatest: pulseSvb,
  mag7: oscDoc,
  nysi: breadthDocs.nysi,
  nasi: breadthDocs.nasi,
  ncfd: breadthDocs.ncfd,
  ndtw: breadthDocs.ndtw,
  ncfi: breadthDocs.ncfi,
  ncth: breadthDocs.ncth,
  nyad: breadthDocs.nyad,
  nyhl: breadthDocs.nyhl,
  spx: breadthSpx,
};
const mhBoard = buildMarketHealth(mhDocs);
const mhRow = (id) => mhBoard.rows.find((row) => row.id === id);
const mhAtWeek = (id, week) => mhRow(id).cells[MARKET_HEALTH_WEEKS.indexOf(week)];
assert(mhBoard.rows.length === 17 && mhBoard.rows.every((row) => row.cells.length === 16), "the engine paints 17 rows and 16 weeks");
assert(mhAtWeek("soft-vol", 29).state === "soft" && mhAtWeek("soft-vol", 29).tip.includes("+3.74"), "W29 VIX surge is green on Soft Vol");
assert(mhAtWeek("soft-vol", 33).state === "crowded" && mhAtWeek("soft-vol", 39).state === "crowded", "calm September VIX stays crowded");
assert(mhAtWeek("soft-vol", 42).state === "soft-extreme" && mhAtWeek("soft-vol", 42).tip.includes("−1.0"), "W42 surge stays green and names the filed residual");
assert(mhAtWeek("soft-vol", 43).base === "crowded" && mhAtWeek("soft-vol", 43).state === "soft", "W43 cheap vol is leaned green by credit stress");
assert(mhAtWeek("soft-vol", 44).tip.includes("carried from Oct 23"), "W44 names the carried residual");
assert(mhAtWeek("vol-stress", 29).state === "empty" && mhAtWeek("vol-stress", 32).state === "crowded", "Vol Stress starts with the August closes");
assert(mhAtWeek("vol-stress", 36).state === "soft-extreme" && mhAtWeek("vol-stress", 44).state === "soft-extreme", "the 2.18 and 2.98 gauges are soft");
assert(mhAtWeek("vol-stress", 44).tip.includes("2.98") && mhAtWeek("vol-stress", 44).tip.includes("close not appended"), "W44 uses the latest gauge and says the close is not appended");
assert(mhAtWeek("mag7", 29).state === "crowded" && mhAtWeek("mag7", 44).state === "soft", "Mag 7 is crowded in July and soft at the Oct 30 oscillator");
assert(mhAtWeek("credit", 42).state === "crowded-extreme" && mhAtWeek("credit", 44).state === "crowded", "stressed credit stays red");
assert(mhAtWeek("credit", 30).state === "mid", "tight credit without an extended Mag 7 is mid");
assert(mhAtWeek("spx-ema", 32).state === "crowded-extreme" && mhAtWeek("spx-ema", 29).state === "crowded", "SPX above both weekly EMAs stays crowded");
assert(mhAtWeek("spx-ema", 42).state === "mid", "the W42 dip under the 8-week EMA is mid, including through the VIX surge");
assert(mhAtWeek("nysi", 29).state === "crowded" && mhAtWeek("nysi", 40).state === "soft-extreme" && mhAtWeek("nysi", 42).state === "mid", "NY summation distinguishes a high line, a washout, and a rebound");
assert(mhAtWeek("ncfd", 42).state === "soft" && mhAtWeek("ncfd", 42).tip.includes("%ile") && mhAtWeek("ncfd", 44).state === "mid", "Nasdaq 5-day Soft-box uses this series’ %ile, not raw 20/80");
assert(mhAtWeek("ncfi", 42).state === "soft" && mhAtWeek("ncfi", 44).state === "soft" && mhAtWeek("ncth", 42).state === "soft", "left-tail %ile of 50-day and 200-day participation is Soft");
assert(mhAtWeek("ndtw", 37).state === "soft" && mhAtWeek("ndtw", 32).state === "mid", "Nasdaq-100 20-day only goes Soft in the left tail");
for (const id of ["mag7", "credit", "spx-ema", "nysi", "nasi", "ncfd", "ndtw", "ncfi", "ncth", "nyad", "nyhl", "global-fund", "sharpies"]) {
  assert(mhRow(id).cells.every((cell) => cell.base == null || cell.state === cell.base), `${id} is not leaned green by vol or credit stress`);
}
const fund = mhRow("global-fund");
assert(fund.mark === "Proxy" && mhAtWeek("global-fund", 29).state === "crowded" && mhAtWeek("global-fund", 29).tip.includes("3.6") && mhAtWeek("global-fund", 29).tip.includes("Stretching"), "July fund proxy is crowded and labeled");
assert(mhAtWeek("global-fund", 34).state === "crowded-extreme" && mhAtWeek("global-fund", 34).tip.includes("53%") && mhAtWeek("global-fund", 34).tip.includes("not a Soft↔Crowded percentile"), "August fund proxy names semis 53% and is not a percentile");
assert(mhAtWeek("global-fund", 43).kind === "unconfirmed" && mhAtWeek("global-fund", 43).state === "empty" && mhAtWeek("global-fund", 43).tip.includes("verify-carry"), "W43 fund quote is an uncolored verify-carry");
assert(fund.cells.filter((cell) => cell.kind === "proxy").length === 2, "Global fund has two proxy weeks, not a filled path");
assert(!fund.cells.some((cell) => /%ile|percentile of/.test(cell.tip)), "Global fund tips do not invent a percentile");
const sharpies = mhRow("sharpies");
assert(sharpies.mark === "Proxy" && sharpies.cells.filter((cell) => cell.kind === "proxy").length === 1, "Sharpies is a one-print proxy");
assert(mhAtWeek("sharpies", 29).state === "mid" && mhAtWeek("sharpies", 29).tip.includes("−66.52") && mhAtWeek("sharpies", 29).tip.includes("slightly net short"), "the July COT print is labeled on W29");
assert(mhRow("put-call").mark === "Demo" && mhRow("put-call").cells.every((cell) => cell.kind === "demo" && cell.state === "empty" && cell.sr.includes("Demo")), "Put/Call stays an empty Demo row");
assert(mhRow("naaim").mark === "Proxy" && mhAtWeek("naaim", 42).state === "empty" && mhAtWeek("naaim", 42).tip.includes("74.5") && mhAtWeek("naaim", 42).tip.includes("Sat Oct 17, 2026"), "NAAIM 74.5 is labeled on W42 without a color");
assert(mhRow("naaim").cells.filter((cell) => cell.kind === "proxy").length === 1, "NAAIM is not copied onto other weeks");
const bare = buildMarketHealth({});
assert(bare.rows.find((row) => row.id === "soft-vol").cells.every((cell) => cell.kind === "gap"), "missing vault files leave Soft Vol empty");
assert(bare.rows.find((row) => row.id === "global-fund").cells.some((cell) => cell.kind === "proxy"), "Desk proxies still render when the vault fetch fails");
assert(!engineSrc.includes("Ssmmcc") && !readFileSync(join(root, "src/market-health.js"), "utf8").includes("Ssmmcc"), "the demo cell alphabet is gone");

/* Family Hub call-credit analyzer: teach widget on the gated desk only. */
assert(pickStrikes(518).short === 520 && pickStrikes(518).long === 525, "a 518 spot rounds to a 5-wide 520/525 call credit");
assert(pickStrikes(753.75).short === 755 && pickStrikes(753.75).long === 760, "a 753.75 spot rounds to a 5-wide 755/760 call credit");
const analyzerDemo = spreadStats(520, 525, 1.35);
assert(analyzerDemo.maxGain === 135 && analyzerDemo.maxLoss === 365 && analyzerDemo.breakeven === 521.35, "tip-sheet max gain, max loss, and BE");
assert(expirationPnL(500, 520, 525, 1.35) === 135, "left of the short strike the credit is kept");
assert(Math.abs(expirationPnL(521.35, 520, 525, 1.35)) < 1e-9, "P/L is 0 at breakeven");
assert(expirationPnL(525, 520, 525, 1.35) === -365 && expirationPnL(540, 520, 525, 1.35) === -365, "loss is capped at the long strike");
assert(Math.abs(markPnL(518, 520, 525, 0, 0.21, 0.21, 1.35) - expirationPnL(518, 520, 525, 1.35)) < 1e-9, "the as-of curve meets expiration at 0DTE");
const atmCall = callValue(100, 100, 30 / 365, 0.2);
assert(atmCall > 1.5 && atmCall < 4, `30-day ATM 20% call should be a few dollars, got ${atmCall}`);
assert(callValue(753.75, 755, 10 / 365, 0.18768) > 4 && callValue(753.75, 755, 10 / 365, 0.18768) < 16, "10-day 755c on 753.75 is in a live-mark range");
const liveMtm = markPnL(753.75, 755, 760, 5 / 365, 0.18768, 0.178292, 2.685);
assert(liveMtm > -250 && liveMtm < 280, `5-day mark stays inside the defined-risk band, got ${liveMtm}`);
assert(markPnL(518, 520, 525, 6 / 365, 0.33, 0.33, 1.35) < markPnL(518, 520, 525, 6 / 365, 0.11, 0.11, 1.35), "higher IV sags the today curve on a short call credit");
assert(calendarDays("2026-11-03", "2026-11-13") === 10, "Nov 3 to Nov 13 is 10 calendar days");
const familyHubPage = readFileSync(join(root, `${FAMILY_ENTRY}/index.html`), "utf8");
const familyHubTemplate = familyHubPage.match(/<template id="vault-content">([\s\S]*?)<\/template>/)?.[1] ?? "";
assert(familyHubPage.includes('src="/src/hub-analyzer.js"') && familyHubTemplate.includes('id="hub-analyzer"'), "the signed-in Hub desk mounts the call-credit analyzer");
assert(familyHubPage.includes('src="/src/desk-brief.js"') && familyHubTemplate.includes('data-desk-brief="open"'), "the Hub analyzer sits with the desk brief");
const anCss = readFileSync(join(root, "src/analyzer.css"), "utf8");
assert(anCss.includes("--an-loss: #c43c3c") && anCss.includes("--an-profit: #2d7d46") && !/#e91e/i.test(anCss), "analyzer loss is brand % red, not Soft↔Crowded magenta");
assert(anCss.includes("--an-now:") && anCss.includes(".an-chip"), "analyzer keeps the today-curve token and the credit chip");
assert(readFileSync(join(root, "src/hub-analyzer.js"), "utf8").includes("PREVIEW"), "fallback copy names PREVIEW");
assert(readFileSync(join(root, "src/analyzer-marks.js"), "utf8").includes("preview: source !== \"live\""), "non-live marks carry preview");
for (const file of publicPages) {
  const html = readFileSync(join(root, file), "utf8");
  assert(!html.includes("hub-analyzer") && !html.includes("analyzer.css") && !html.includes("hub-analyzer.js"), `${file} does not load the Hub analyzer`);
}
assert(readFileSync(join(root, "src/study.js"), "utf8").includes("Call chain strip"), "the public Trade Idea call-chain strip stays on the desk");
const anMarks = JSON.parse(readFileSync(join(root, "public/data/hub-analyzer-marks.json"), "utf8"));
assert(anMarks.short.bid <= anMarks.short.mark && anMarks.short.mark <= anMarks.short.ask, "snapshot short mark sits inside bid/ask");
assert(anMarks.long.bid <= anMarks.long.mark && anMarks.long.mark <= anMarks.long.ask, "snapshot long mark sits inside bid/ask");
assert(anMarks.short.strike < anMarks.long.strike && anMarks.short.type === "call" && anMarks.long.type === "call", "snapshot is a short call over a higher long call");
assert(PRODUCT_FEEDS.some((feed) => feed.id === "hub-analyzer-marks" && feed.surfaces.join() === "private"), "analyzer marks stay on the private Hub feed");

if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log("site checks ok");
