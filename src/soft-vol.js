/**
 * Soft Vol daily EOD series, lock 2026-11-02.
 *
 * Soft Vol = VIX close − HV20(SPX), rounded to 0.1.
 * HV20 uses the last 21 SPX closes (20 log returns), sample stdev (n−1),
 * × √252 × 100, rounded to 0.01 before the subtraction.
 *
 * Buckets are readings.js volLabel on that rounded tenth:
 * Soft Vol ≤ −0.4, Fair between, Stretched ≥ +0.4.
 * The chart scale is −5…+15. The ±0.4 bands stay on the raw residual.
 *
 * This series does not continue the weekly Desk blend in series.js.
 * It does not read underlying-vol change. Vol Stress is a separate series.
 */

import { volLabel } from "./readings.js";

export const SERIES_BREAK = "2026-11-02";
export const SERIES_BREAK_LABEL = "series break, new definition from 2026-11-02 lock";
export const FORMULA = "VIX close − HV20(SPX)";
export const CHART_MIN = -5;
export const CHART_MAX = 15;
export const CHART_SCALE = "-5..+15";
export const BAND = 0.4;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TONE_OF = { "Soft Vol": "soft", Fair: "mid", Stretched: "crowded" };

export function roundPlaces(value, places) {
  const rounded = Number(value.toFixed(places));
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function logReturns(closes) {
  const returns = [];
  for (let i = 1; i < closes.length; i += 1) returns.push(Math.log(closes[i] / closes[i - 1]));
  return returns;
}

/** Sample standard deviation, divisor n−1. */
export function sampleStdev(values) {
  if (!Array.isArray(values) || values.length < 2) throw new Error("n−1 stdev needs two or more returns");
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const square = values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  return Math.sqrt(square / (values.length - 1));
}

/**
 * 20-day realized vol in the same points as the VIX.
 * `closes` is 21 session closes, oldest first. The last close is the print session.
 */
export function hv20(closes) {
  if (!Array.isArray(closes) || closes.length !== 21) throw new Error("HV20 needs 21 SPX closes ending on the session");
  if (closes.some((close) => !Number.isFinite(close) || close <= 0)) throw new Error("SPX closes must be positive numbers");
  const sigma = sampleStdev(logReturns(closes));
  return roundPlaces(sigma * Math.sqrt(252) * 100, 2);
}

/** VIX close minus HV20, rounded to a tenth. HV20 is already rounded to 0.01. */
export function softVolOf(vix, hv) {
  if (!Number.isFinite(vix) || !Number.isFinite(hv)) throw new Error("soft vol needs a VIX close and HV20");
  return roundPlaces(vix - hv, 1);
}

export function bucketOf(softVol) {
  return volLabel(Math.round(softVol * 10));
}

export function toneOf(bucket) {
  return TONE_OF[bucket] ?? "mid";
}

export function scalePosition(value, min = CHART_MIN, max = CHART_MAX) {
  if (!Number.isFinite(value) || max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

export function bandCuts(min = CHART_MIN, max = CHART_MAX) {
  return [scalePosition(-BAND, min, max), scalePosition(BAND, min, max)];
}

/** Widths of Soft / Fair / Stretched on the −5…+15 scale. Fair stays the raw ±0.4 band. */
export function zoneWeights(min = CHART_MIN, max = CHART_MAX) {
  const span = max - min;
  return {
    soft: (-BAND - min) / span,
    fair: (2 * BAND) / span,
    stretched: (max - BAND) / span,
  };
}

export function formatSigned(value, digits = 1) {
  const text = Math.abs(value).toFixed(digits);
  if (Number(text) === 0) return (0).toFixed(digits);
  return `${value > 0 ? "+" : "−"}${text}`;
}

export function formatSession(iso, { weekday = false } = {}) {
  const [year, month, day] = iso.split("-").map(Number);
  const base = `${MONTHS[month - 1]} ${day}, ${year}`;
  if (!weekday) return base;
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${DAYS[date.getUTCDay()]} ${base}`;
}

export function shortSession(iso) {
  const [, month, day] = iso.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}`;
}

function assertSession(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) throw new Error("date must be YYYY-MM-DD");
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  if (weekday === 0 || weekday === 6) throw new Error(`${date} is not a weekday session`);
}

/**
 * The next close for series.json. Refuses a date before the last session.
 * The same session is refused unless replaceLast is set, which is how a
 * pre-close pass is overwritten once the official closes are out.
 */
export function buildSoftVolClose(previous, input) {
  const { date, vix, spxCloses, recordedAt, replaceLast = false } = input ?? {};
  assertSession(date);
  if (previous && date < previous.date) throw new Error(`${date} is before the last close ${previous.date}`);
  if (previous && date === previous.date && !replaceLast) throw new Error(`${date} is not after the last close ${previous.date}`);
  if (!Number.isFinite(vix) || vix < 0 || vix > 150) throw new Error("vix must be the VIX close, 0 to 150");
  const hv = hv20(spxCloses);
  const softVol = softVolOf(roundPlaces(vix, 2), hv);
  if (recordedAt !== undefined && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(recordedAt)) {
    throw new Error("recordedAt must carry a UTC offset");
  }
  const point = {
    date,
    vix: roundPlaces(vix, 2),
    hv20: hv,
    spx: roundPlaces(spxCloses[spxCloses.length - 1], 2),
    softVol,
    bucket: bucketOf(softVol),
    origin: "close-routine",
  };
  if (recordedAt) point.recordedAt = recordedAt;
  return point;
}

export function latestFrom(point, recordedAt) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(recordedAt ?? "")) {
    throw new Error("recordedAt must carry a UTC offset");
  }
  const time = recordedAt.slice(11, 16);
  return {
    $schema: "./schema.json#/$defs/latest",
    session: point.date,
    asOf: recordedAt,
    asOfLabel: `${formatSession(point.date, { weekday: true })} · ${time} CT · session close`,
    vix: point.vix,
    hv20: point.hv20,
    spx: point.spx,
    softVol: point.softVol,
    bucket: point.bucket,
    seriesBreak: SERIES_BREAK,
    chartScale: CHART_SCALE,
    closed: true,
    formula: FORMULA,
    note: SERIES_BREAK_LABEL,
  };
}

/** Gauge + column model for the live chart and the desk tip. */
export function liveRead(series, latest) {
  const points = series?.points;
  if (!Array.isArray(points) || points.length === 0) throw new Error("soft vol series is empty");
  const last = points[points.length - 1];
  const session = latest?.session === last.date ? latest.session : last.date;
  const softVol = latest?.session === last.date ? latest.softVol : last.softVol;
  const bucket = latest?.session === last.date ? latest.bucket : last.bucket;
  return {
    points: points.map((point) => point.softVol),
    labels: points.map((point) => shortSession(point.date)),
    sessions: points,
    softVol,
    display: formatSigned(softVol),
    bucket,
    tone: toneOf(bucket),
    position: scalePosition(softVol),
    cuts: bandCuts(),
    ticks: ["−5", "+5", "+15"],
    marks: [{ position: scalePosition(0), label: "0" }],
    session,
    sessionLabel: formatSession(session, { weekday: true }),
    vix: latest?.session === last.date ? latest.vix : last.vix,
    hv20: latest?.session === last.date ? latest.hv20 : last.hv20,
    seriesBreakLabel: series.seriesBreakLabel || SERIES_BREAK_LABEL,
    domain: [CHART_MIN, CHART_MAX],
    scaleTicks: [CHART_MIN, 0, 5, 10, CHART_MAX],
    zone: zoneWeights(),
  };
}

export function hubFact(latest) {
  return `Desk · ${latest.bucket} ${formatSigned(latest.softVol)} pts`;
}

/** Hover lines for one daily print. No week-over-week. */
export function tipLines(point) {
  return [
    formatSession(point.date, { weekday: true }),
    `Desk ${formatSigned(point.softVol)} pts · ${point.bucket}`,
    `VIX ${Number(point.vix).toFixed(2)} · HV20 ${Number(point.hv20).toFixed(2)}`,
    SERIES_BREAK_LABEL,
  ];
}
