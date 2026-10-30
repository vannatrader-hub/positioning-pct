/**
 * Frozen week for the Vault weekly pack. Pure data, shared by the pack build
 * script and `npm run check`.
 *
 * Every number is read from the same committed Desk series as the public
 * charts (`src/pct-charts.js`), cut at the pack week so a pack never shows a
 * later print. The pack file stores the result, so the pack keeps reading the
 * same after the Desk's eight-week window rolls forward.
 */

import { HOUSES } from "./desk.js";
import { CANON, WEEKS, buildReading, formatWeek } from "./readings.js";
import {
  CHARTS,
  SECTOR_BUCKETS,
  broadEquityChart,
  chartFacts,
  creditChart,
  fundManagerChart,
  riskChart,
  sectorChart,
  softVolChart,
} from "./pct-charts.js";

export const PACK_HOUSE = "jpm";
export const PACK_WINDOW = 4;
export const PACK_OPEN_CT = "05:00";

/** ISO 8601 week of a calendar date, as "2026-W43". */
export function isoWeek(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - first) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Monday and Sunday of an ISO week, as YYYY-MM-DD. */
export function isoWeekRange(label) {
  const [, year, week] = label.match(/^(\d{4})-W(\d{2})$/).map(Number);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

/** Chicago offset on a calendar date at 5:00 AM: CDT from the second Sunday of March to the first Sunday of November. */
function chicagoOffset(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  const nthSunday = (m, n) => {
    const first = new Date(Date.UTC(year, m - 1, 1)).getUTCDay();
    return 1 + ((7 - first) % 7) + (n - 1) * 7;
  };
  const key = month * 100 + day;
  const dstOn = 300 + nthSunday(3, 2);
  const dstOff = 1100 + nthSunday(11, 1);
  return key >= dstOn && key < dstOff ? "-05:00" : "-06:00";
}

export function packWeekIndex(week) {
  return WEEKS.indexOf(week);
}

function weeksThrough(at) {
  return WEEKS.slice(0, at + 1);
}

function cut(values, at) {
  return values.slice(0, at + 1);
}

function figure(read, label) {
  return { label, value: read.value, unit: read.unit ?? "", pill: read.pill, tone: read.tone };
}

function softVolSnapshot(at) {
  const read = softVolChart("desk", at);
  return {
    kind: "residual",
    weeks: weeksThrough(at),
    figures: [{ label: "Desk Soft Vol residual", value: read.display, unit: "pts", pill: read.name, tone: read.tone }],
    values: cut(read.points, at),
    note: read.change,
  };
}

function sectorsSnapshot(at) {
  const data = sectorChart(PACK_HOUSE, at);
  return {
    kind: "sectors",
    weeks: weeksThrough(at),
    figures: SECTOR_BUCKETS.map((bucket) => ({
      label: bucket.title,
      value: String(data.counts[bucket.level]),
      unit: "",
      pill: bucket.range,
      tone: bucket.tone,
    })),
    bars: data.bars.map((bar) =>
      bar.available
        ? { ticker: bar.ticker, short: bar.short, points: bar.points, display: bar.display, tone: bar.tone, bucket: bar.bucket, note: `${bar.ile} · ${bar.pill} · ${bar.wowText}` }
        : { ticker: bar.ticker, short: bar.short, points: null, display: "—", tone: null, bucket: null, note: bar.note },
    ),
    note: `${data.bars.filter((bar) => bar.available).length} of 11 funds printed · ${data.basis}`,
  };
}

function broadSnapshot(at) {
  const { read } = broadEquityChart(at);
  return {
    kind: "lines",
    weeks: weeksThrough(at),
    figures: [{ ...figure(read, "Equities percentile"), unit: "" }],
    panels: [
      {
        label: "Equities line of the cross-asset monitor, percentile",
        format: "pct",
        domain: [0, 100],
        guides: [],
        series: [{ label: "Equities", values: cut(read.pctPath, at) }],
      },
    ],
    note: read.change,
  };
}

function creditSnapshot(at) {
  const data = creditChart(at);
  return {
    kind: "lines",
    weeks: weeksThrough(at),
    figures: [figure(data.cdx, "CDX"), figure(data.bbb, "BBB minus AAA"), { label: "Both panels", value: String(data.pct), unit: "%ile", pill: data.caption, tone: data.pct >= 67 ? "crowded" : data.pct < 40 ? "soft" : "mid" }],
    panels: [
      { label: "CDX, bp", format: "whole", guides: [], series: [{ label: "CDX", values: cut(data.cdx.path, at) }] },
      { label: "BBB minus AAA, pts", format: "fixed2", guides: [], series: [{ label: "BBB−AAA", values: cut(data.bbb.path, at) }] },
    ],
    rows: at === WEEKS.length - 1 ? data.gap.rows.items.map((item) => ({ label: item.label, text: item.text })) : [],
    note: data.change,
  };
}

function fundSnapshot(at) {
  const data = fundManagerChart(at);
  return {
    kind: "lines",
    weeks: weeksThrough(at),
    figures: [figure(data.crowded, "Most crowded trade"), figure(data.cash, "Fund manager cash")],
    panels: [
      { label: `Crowded-trade share · ${data.survey}`, format: "percent0", guides: [], series: [{ label: "Crowded share", values: cut(data.crowded.path, at) }] },
      { label: "Fund manager cash", format: "percent1", guides: [{ value: 4, label: "4% line" }], series: [{ label: "Cash", values: cut(data.cash.path, at) }] },
    ],
    rows: data.trades[0]?.value === data.crowded.path[at] ? data.trades.map((item) => ({ label: item.label, text: item.text })) : [],
    note: data.crowded.change,
  };
}

function riskSnapshot(at) {
  const { reads } = riskChart(at);
  const byId = Object.fromEntries(reads.map((read) => [read.id, read]));
  const panel = (read, format) => ({
    label: `${read.title} · ${read.houseLabel}`,
    format,
    guides: read.guides.map((guide) => ({ value: guide.value, label: guide.label })),
    series: [{ label: read.title, values: cut(read.path, at) }],
  });
  return {
    kind: "lines",
    weeks: weeksThrough(at),
    figures: reads.map((read) => figure(read, `${read.houseLabel} · ${read.title}`)),
    panels: [panel(byId["gs-risk-appetite"], "z"), panel(byId["gs-sentiment"], "z")],
    note: byId["gs-risk-appetite"].change,
  };
}

const SNAPSHOTS = {
  "soft-vol": softVolSnapshot,
  sectors: sectorsSnapshot,
  "broad-equity": broadSnapshot,
  "credit-stress": creditSnapshot,
  "fund-managers": fundSnapshot,
  "risk-appetite": riskSnapshot,
};

export function chartSnapshot(id, at) {
  return SNAPSHOTS[id](at);
}

/** Sector buckets for the pack week, softest first inside each column, as the Desk shows them. */
export function packBuckets(at) {
  const reading = buildReading(PACK_HOUSE, at, PACK_WINDOW);
  const buckets = SECTOR_BUCKETS.map((bucket) => ({
    level: bucket.level,
    title: bucket.title,
    range: bucket.range,
    tone: bucket.tone,
    sectors: CANON.filter((ticker) => reading.sectors[ticker].available && reading.sectors[ticker].level === bucket.level)
      .map((ticker) => reading.sectors[ticker])
      .sort((a, b) => a.points - b.points || a.ticker.localeCompare(b.ticker))
      .map((sector) => ({
        ticker: sector.ticker,
        short: sector.short,
        name: sector.name,
        points: sector.points,
        display: sector.display,
        ile: sector.ile,
        pill: sector.pill,
        caption: sector.caption,
        wowText: sector.wowText,
        regime: sector.regime,
        level: sector.level,
      })),
  }));
  const unprinted = CANON.filter((ticker) => !reading.sectors[ticker].available).map((ticker) => {
    const sector = reading.sectors[ticker];
    return { ticker, short: sector.short, name: sector.name, note: sector.unavailable };
  });
  return { reading, buckets, unprinted };
}

/** Sectors that changed Soft ↔ Crowded column since the prior Desk week. */
export function columnMoves(at) {
  if (at < 1) return [];
  const now = buildReading(PACK_HOUSE, at, PACK_WINDOW).sectors;
  const then = buildReading(PACK_HOUSE, at - 1, PACK_WINDOW).sectors;
  return CANON.filter((ticker) => now[ticker].available && then[ticker].available && now[ticker].level !== then[ticker].level).map((ticker) => ({
    ticker,
    from: then[ticker].level,
    to: now[ticker].level,
  }));
}

/**
 * Everything in a pack week that comes from the Desk series. The written
 * parts (`read`, and each chart's `article`) are added by hand on the Friday.
 */
export function packFrame(week) {
  const at = packWeekIndex(week);
  if (at < 0) throw new Error(`${week} is not a Desk week`);
  const { reading, buckets, unprinted } = packBuckets(at);
  const facts = chartFacts(at);
  const iso = isoWeek(week);
  return {
    sku: "soft-crowded",
    product: "SKU1",
    week,
    weekLabel: reading.weekLabel,
    isoWeek: iso,
    title: `${iso} Soft ↔ Crowded`,
    asOf: `${week}T${PACK_OPEN_CT}:00${chicagoOffset(week)}`,
    asOfLabel: `${formatWeekday(week)} desk day · from the ${formatHour(PACK_OPEN_CT)} CT open`,
    house: PACK_HOUSE,
    houseLabel: HOUSES[PACK_HOUSE],
    windowWeeks: PACK_WINDOW,
    basis: sectorChart(PACK_HOUSE, at).basis,
    sectorSource: reading.sectorSource,
    buckets,
    unprinted,
    charts: {
      batch: 1,
      refs: CHARTS.map((chart) => ({
        id: chart.id,
        nav: chart.nav,
        title: chart.title,
        house: chart.house,
        houseLabel: HOUSES[chart.house],
        deskSection: chart.deskSection,
        fact: facts[chart.id],
        snapshot: chartSnapshot(chart.id, at),
      })),
    },
  };
}

function formatWeekday(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  const name = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${name} ${formatWeek(iso)}`;
}

function formatHour(hhmm) {
  const [hour, minute] = hhmm.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}
