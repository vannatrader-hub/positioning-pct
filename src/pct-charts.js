/**
 * Positioning % charts, batch 1: six reads redrawn as interactive charts.
 *
 * Pure data. Every chart reads the same committed weekly series as the desk
 * (`src/series.js` through `readings.js`, and `INDICATORS` in `desk.js`), so a
 * chart and its desk card always agree. Houses are public labels only.
 */

import { CANON, WEEKS, buildReading, levelOf, ordinal, volLabel, volSeries } from "./readings.js";
import { HOUSES, INDICATORS, changeText, readIndicator } from "./desk.js";

export const CHART_SOURCES = ["jpm", "ms", "gs", "boa", "desk"];

export const CHARTS = [
  {
    id: "soft-vol",
    nav: "Soft Vol",
    title: "Soft Vol ↔ Stretched VIX",
    house: "desk",
    sub: "The VIX against what the S&P 500 implies, as a residual in vol points. Below zero the VIX is cheap.",
    deskSection: "vol",
    sources: CHART_SOURCES,
    defaultSource: "desk",
  },
  {
    id: "sectors",
    nav: "Sectors",
    title: "Sector Soft ↔ Crowded",
    house: "jpm",
    sub: "The 11 Select Sector funds, XLF to XLC, as positioning percentiles on one Soft ↔ Crowded scale.",
    deskSection: "sectors",
    sources: CHART_SOURCES,
    defaultSource: "jpm",
  },
  {
    id: "broad-equity",
    nav: "Broad equity",
    title: "Broad equity positioning",
    house: "jpm",
    sub: "The Equities line of the cross-asset positioning monitor, as a percentile. Add other lines to compare.",
    deskSection: "broad",
    reads: ["jpm-broad"],
  },
  {
    id: "credit-stress",
    nav: "Credit",
    title: "Credit stress",
    house: "desk",
    sub: "CDX default swaps and the BBB minus AAA spread on one time axis. Wider means investors are paying for risk.",
    deskSection: "credit",
    reads: ["desk-cdx", "desk-bbb-aaa"],
  },
  {
    id: "fund-managers",
    nav: "Fund managers",
    title: "Fund manager survey · crowded trades",
    house: "boa",
    sub: "The survey’s most crowded trade and the cash fund managers hold, week by week.",
    deskSection: "retail",
    reads: ["boa-fms-crowded", "boa-fms-cash"],
  },
  {
    id: "risk-appetite",
    nav: "Risk appetite",
    title: "GS risk appetite",
    house: "gs",
    sub: "Risk appetite, equity positioning, risky versus safe assets, and the short-term composite on one panel.",
    deskSection: "broad",
    reads: ["gs-risk-appetite", "gs-sentiment", "gs-risky-safe", "desk-st-composite"],
  },
];

export const CHART_IDS = CHARTS.map((chart) => chart.id);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortWeek(iso) {
  const [, month, day] = iso.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}`;
}

export const WEEK_LABELS = WEEKS.map(shortWeek);

export function signed(value, digits = 1) {
  const text = Math.abs(value).toFixed(digits);
  if (Number(text) === 0) return (0).toFixed(digits);
  return `${value > 0 ? "+" : "−"}${text}`;
}

function clampWeek(week) {
  return Math.min(WEEKS.length - 1, Math.max(0, Number.isInteger(week) ? week : WEEKS.length - 1));
}

function indicator(id) {
  const found = INDICATORS.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown indicator ${id}`);
  return found;
}

/** A desk indicator read for one week, plus its full weekly path for drawing. */
export function chartRead(id, week) {
  const source = indicator(id);
  const read = readIndicator(source, clampWeek(week));
  return {
    ...read,
    houseLabel: HOUSES[read.house],
    path: [...source.values],
    pctPath: [...source.pcts],
    shown: source.values.map((value) => source.show(value)),
  };
}

/* 1 · Soft Vol ↔ Stretched */

export const VOL_RANGE = 3;

export function volTone(points) {
  if (points <= -0.4) return "soft";
  if (points >= 0.4) return "crowded";
  return "mid";
}

export function softVolChart(sourceId, week) {
  const source = CHART_SOURCES.includes(sourceId) ? sourceId : "desk";
  const at = clampWeek(week);
  const tenths = volSeries(source);
  const points = tenths.map((value) => value / 10);
  const now = points[at];
  const back = points[Math.max(0, at - 4)];
  const delta = Math.round((now - back) * 10) / 10;
  return {
    source,
    houseLabel: HOUSES[source],
    week: at,
    points,
    now,
    display: signed(now),
    name: volLabel(tenths[at]),
    tone: volTone(now),
    position: Math.min(1, Math.max(0, (now + VOL_RANGE) / (2 * VOL_RANGE))),
    change: delta === 0 ? "Unchanged vs 4 wks ago" : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)} pts vs 4 wks ago`,
    houses: Object.fromEntries(CHART_SOURCES.map((id) => [id, volSeries(id).map((value) => value / 10)])),
  };
}

/* 2 · Sector Soft ↔ Crowded */

export const SECTOR_BUCKETS = [
  { level: "extreme soft", title: "Extreme soft", range: "under 0.25", tone: "xsoft", from: 0, to: 25 },
  { level: "soft", title: "Soft", range: "0.25 – 0.39", tone: "soft", from: 25, to: 40 },
  { level: "mid", title: "Mid", range: "0.40 – 0.66", tone: "mid", from: 40, to: 67 },
  { level: "crowded", title: "Crowded", range: "0.67 and up", tone: "crowded", from: 67, to: 100 },
];

export function bucketOf(points) {
  const level = levelOf(points);
  return SECTOR_BUCKETS.find((bucket) => bucket.level === level);
}

export function sectorChart(sourceId, week, order = "fund") {
  const source = CHART_SOURCES.includes(sourceId) ? sourceId : "jpm";
  const reading = buildReading(source, clampWeek(week), 4);
  const bars = CANON.map((ticker) => {
    const sector = reading.sectors[ticker];
    if (!sector.available) {
      return { ticker, short: sector.short, name: sector.name, available: false, note: sector.unavailable };
    }
    const bucket = bucketOf(sector.points);
    return {
      ticker,
      short: sector.short,
      name: sector.name,
      available: true,
      points: sector.points,
      display: sector.display,
      ile: sector.ile,
      pill: sector.pill,
      regime: sector.regime,
      wowText: sector.wowText,
      series: sector.series,
      bucket: bucket.level,
      tone: bucket.tone,
    };
  });
  if (order === "softest") {
    bars.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return (a.points ?? 0) - (b.points ?? 0) || a.ticker.localeCompare(b.ticker);
    });
  }
  const counts = Object.fromEntries(SECTOR_BUCKETS.map((bucket) => [bucket.level, 0]));
  for (const bar of bars) if (bar.available) counts[bar.bucket] += 1;
  return {
    source,
    houseLabel: HOUSES[source],
    basis: source === "desk" ? "Desk composite of JPM, MS, GS, BoA" : source === "jpm" ? "Ref chart 06-Oct-26 (JPM)" : `${HOUSES[source]} sector reads`,
    week: reading.weekIndex,
    bars,
    counts,
  };
}

/* 3 · Broad equity */

export function broadEquityChart(week) {
  const read = chartRead("jpm-broad", week);
  const monitor = indicator("jpm-cross-asset");
  const lines = monitor.assets.map((asset) => ({ label: asset.label, path: [...asset.path] }));
  return { read, lines, overlays: lines.filter((line) => line.label !== "Equities").map((line) => line.label) };
}

/* 4 · Credit stress */

export function creditChart(week) {
  const cdx = chartRead("desk-cdx", week);
  const bbb = chartRead("desk-bbb-aaa", week);
  const gap = chartRead("desk-credit-gap", week);
  const at = clampWeek(week);
  const combined = cdx.pctPath.map((pct, index) => Math.round((pct + bbb.pctPath[index]) / 2));
  const pct = combined[at];
  return {
    cdx,
    bbb,
    gap,
    combined,
    pct,
    caption: `${ordinal(pct)} %ile · CDX and BBB−AAA`,
    change: changeText(pct - combined[Math.max(0, at - 4)], 4),
  };
}

/* 5 · Fund manager survey */

export function fundManagerChart(week) {
  const crowded = chartRead("boa-fms-crowded", week);
  const cash = chartRead("boa-fms-cash", week);
  return { crowded, cash, trades: crowded.rows.items.map((item) => ({ ...item })), survey: indicator("boa-fms-crowded").ref };
}

/* 6 · GS risk appetite */

export const RISK_GUIDES = {
  "gs-risk-appetite": [{ value: 0, label: "Neutral" }],
  "gs-sentiment": [{ value: 1, label: "+1.0 stretched" }],
  "gs-risky-safe": [{ value: 50, label: "Median" }],
  "desk-st-composite": [],
};

export function riskChart(week) {
  const reads = CHARTS.find((chart) => chart.id === "risk-appetite").reads.map((id) => ({
    ...chartRead(id, week),
    guides: RISK_GUIDES[id],
  }));
  return { reads };
}

/** One line per chart for the hub calling cards, from the latest week. */
export function chartFacts(week = WEEKS.length - 1) {
  const vol = softVolChart("desk", week);
  const sectors = sectorChart("jpm", week);
  const broad = broadEquityChart(week).read;
  const credit = creditChart(week);
  const fms = fundManagerChart(week);
  const risk = riskChart(week).reads[0];
  return {
    "soft-vol": `Desk · ${vol.name} ${vol.display} pts`,
    sectors: `JPM · ${sectors.counts["extreme soft"] + sectors.counts.soft} soft · ${sectors.counts.mid} mid · ${sectors.counts.crowded} crowded`,
    "broad-equity": `JPM · Equities ${broad.value} · ${broad.caption}`,
    "credit-stress": `Desk · CDX ${credit.cdx.value} bp · BBB−AAA ${credit.bbb.value}`,
    "fund-managers": `BoA · ${fms.trades[0].label} ${fms.crowded.value}% · cash ${fms.cash.value}%`,
    "risk-appetite": `GS · risk appetite ${risk.value} z · ${risk.caption}`,
  };
}
