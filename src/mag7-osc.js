/**
 * MAG7 Oscillator math. Pure, so the Vault card and `npm run check` read the
 * same numbers. Bars before `momentumLength` momentum read 0 and smoothing
 * windows that touch a missing value read null, so warmup bars stay off the plot.
 */

export const MAG7 = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META"];

export const DEFAULTS = {
  momentumLength: 14,
  smoothingLength: 5,
  bullishThreshold: 2,
  bearishThreshold: -2,
  divergenceThreshold: 1,
  stretched: -5,
  caution: 9,
};

export const MODES = [
  { id: "mag7", label: "MAG7" },
  { id: "ew", label: "S&P EW" },
  { id: "relative", label: "Relative" },
];

export const TYPES = ["Momentum", "RSI", "Stochastic", "Williams %R", "CCI"];

export const RANGES = [
  { id: "6m", label: "6M", months: 6 },
  { id: "1y", label: "1Y", months: 12 },
  { id: "desk", label: "Since Jan 2025" },
  { id: "max", label: "Max" },
];

/** Extra bars held back on top of momentum + smoothing so RSI and CCI have settled before Max starts. */
const SETTLE = 60;

export const COLORS = {
  bull: "#4CAF50",
  bear: "#FF5252",
  neutral: "#2196F3",
};

const ok = (value) => typeof value === "number" && Number.isFinite(value);

export function momentum(closes, length) {
  return closes.map((close, index) => {
    if (index < length) return 0;
    const then = closes[index - length];
    if (!ok(close) || !ok(then) || then === 0) return 0;
    return ((close - then) / then) * 100;
  });
}

export function sma(source, length) {
  const out = new Array(source.length).fill(null);
  for (let index = length - 1; index < source.length; index += 1) {
    let sum = 0;
    let valid = true;
    for (let back = 0; back < length; back += 1) {
      const value = source[index - back];
      if (!ok(value)) {
        valid = false;
        break;
      }
      sum += value;
    }
    if (valid) out[index] = sum / length;
  }
  return out;
}

/** Wilder smoothing, seeded with the simple average of the first full window. */
function rma(source, length) {
  const out = new Array(source.length).fill(null);
  const seed = sma(source, length);
  let prev = null;
  for (let index = 0; index < source.length; index += 1) {
    const value = source[index];
    if (prev === null) {
      prev = seed[index];
    } else if (ok(value)) {
      prev = (value + (length - 1) * prev) / length;
    } else {
      prev = null;
    }
    out[index] = prev;
  }
  return out;
}

export function rsi(source, length) {
  const change = source.map((value, index) => (index && ok(value) && ok(source[index - 1]) ? value - source[index - 1] : null));
  const up = rma(change.map((value) => (ok(value) ? Math.max(value, 0) : null)), length);
  const down = rma(change.map((value) => (ok(value) ? -Math.min(value, 0) : null)), length);
  return source.map((_, index) => {
    if (!ok(up[index]) || !ok(down[index])) return null;
    if (down[index] === 0) return 100;
    if (up[index] === 0) return 0;
    return 100 - 100 / (1 + up[index] / down[index]);
  });
}

function windowed(source, length, pick) {
  return source.map((_, index) => {
    if (index < length - 1) return null;
    const slice = source.slice(index - length + 1, index + 1);
    return slice.every(ok) ? pick(...slice) : null;
  });
}

/** Smooth the raw momentum, then reshape it into the chosen oscillator type, centred on zero. */
export function transform(raw, type, params = DEFAULTS) {
  const smoothed = sma(raw, params.smoothingLength);
  if (type === "RSI") {
    return rsi(smoothed.map((value) => (ok(value) ? value + 50 : null)), 14).map((value) => (ok(value) ? value - 50 : null));
  }
  if (type === "Stochastic" || type === "Williams %R") {
    const high = windowed(smoothed, params.momentumLength, Math.max);
    const low = windowed(smoothed, params.momentumLength, Math.min);
    return smoothed.map((value, index) => {
      if (!ok(value) || !ok(high[index]) || !ok(low[index])) return null;
      const range = high[index] - low[index];
      if (range === 0) return 0;
      const pct = type === "Stochastic" ? (value - low[index]) / range : (high[index] - value) / range;
      return pct * 100 - 50;
    });
  }
  if (type === "CCI") {
    const mean = sma(smoothed, 20);
    const deviation = sma(smoothed.map((value, index) => (ok(value) && ok(mean[index]) ? Math.abs(value - mean[index]) : null)), 20);
    return smoothed.map((value, index) => {
      if (!ok(value) || !ok(mean[index]) || !ok(deviation[index])) return null;
      if (deviation[index] === 0) return 0;
      return (value - mean[index]) / (0.015 * deviation[index]) / 5;
    });
  }
  return smoothed;
}

export function regimeOf(value, upper, lower) {
  if (!ok(value)) return null;
  if (value > upper) return "bull";
  if (value < lower) return "bear";
  return "neutral";
}

/**
 * doc: the committed oscillator document. Returns the plotted series for one
 * mode and type, with per-bar regime and Mag7 breadth (share of names whose
 * own momentum is above zero).
 */
export function buildOscillator(doc, { mode = "mag7", type = "Momentum" } = {}) {
  const params = { ...DEFAULTS, ...doc.params };
  const names = doc.names ?? MAG7;
  const n = doc.dates.length;
  const perName = names.map((ticker) => momentum(doc.closes[ticker], params.momentumLength));
  const raw = doc.dates.map((_, index) => perName.reduce((sum, series) => sum + series[index], 0) / names.length);
  const breadth = doc.dates.map((_, index) => (perName.filter((series) => series[index] > 0).length / names.length) * 100);
  const ewRaw = doc.ew?.ticker ? momentum(doc.closes[doc.ew.ticker], params.momentumLength) : new Array(n).fill(0);

  const mag7 = transform(raw, type, params);
  const ew = transform(ewRaw, type, params);
  const relative = mag7.map((value, index) => (ok(value) && ok(ew[index]) ? value - ew[index] : null));
  const values = mode === "ew" ? ew : mode === "relative" ? relative : mag7;

  const upper = mode === "relative" ? params.divergenceThreshold : params.bullishThreshold;
  const lower = mode === "relative" ? -params.divergenceThreshold : params.bearishThreshold;
  const regime = values.map((value) => regimeOf(value, upper, lower));
  const warm = params.momentumLength + params.smoothingLength - 1 + SETTLE;
  let start = values.findIndex((value, index) => index >= warm && ok(value));
  if (start < 0) start = n - 1;

  return {
    dates: doc.dates,
    values,
    raw,
    mag7,
    ew,
    relative,
    breadth,
    regime,
    mode,
    type,
    params,
    names,
    start,
    thresholds: { upper, lower },
    pivots: mode === "mag7" && type === "Momentum" ? { caution: params.caution, stretched: params.stretched } : null,
  };
}

function addMonths(iso, months) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, day));
  return date.toISOString().slice(0, 10);
}

/** First plotted bar for a range id. */
export function rangeStart(result, rangeId, defaultFrom) {
  const { dates, start } = result;
  const last = dates[dates.length - 1];
  const range = RANGES.find((item) => item.id === rangeId);
  let from = null;
  if (range?.months) from = addMonths(last, -range.months);
  else if (rangeId === "desk") from = defaultFrom;
  if (!from) return start;
  const index = dates.findIndex((date) => date >= from);
  return Math.max(start, index < 0 ? start : index);
}

/** Table-style number: up to two decimals, trailing zeros dropped, typographic minus. */
export function fmtPct(value, decimals = 2) {
  if (!ok(value)) return "—";
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  const text = String(Math.abs(rounded));
  return `${rounded < 0 ? "−" : ""}${text}`;
}

export function fmtAxis(value) {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded < 0 ? "−" : ""}${Math.abs(rounded).toFixed(2)}`;
}

const SIGNALS = {
  bull: { plain: "BULLISH", relative: "OUTPERFORM" },
  bear: { plain: "BEARISH", relative: "UNDERPERFORM" },
  neutral: { plain: "NEUTRAL", relative: "NEUTRAL" },
};

/** The stats panel for one bar: Value, Mode, Signal, Type, Breadth, Threshold (and the two legs in Relative). */
export function panelAt(result, index) {
  const value = result.values[index];
  const tone = result.regime[index] ?? "neutral";
  const breadth = Math.round(result.breadth[index]);
  const relative = result.mode === "relative";
  const threshold = relative ? result.params.divergenceThreshold : Math.abs(result.params.bullishThreshold);
  return {
    date: result.dates[index],
    value,
    valueRounded: ok(value) ? Math.round(value * 100) / 100 : null,
    valueText: `${fmtPct(value)}%`,
    tone,
    mode: MODES.find((item) => item.id === result.mode)?.label ?? "MAG7",
    signal: SIGNALS[tone][relative ? "relative" : "plain"],
    type: result.type,
    breadth,
    breadthTone: breadth > 60 ? "bull" : breadth < 40 ? "bear" : "neutral",
    breadthUp: Math.round((result.breadth[index] / 100) * result.names.length),
    threshold: `±${fmtPct(threshold, 1)}%`,
    legs: relative
      ? [
          { label: "MAG7", value: result.mag7[index], text: `${fmtPct(result.mag7[index])}%`, tone: result.mag7[index] > 0 ? "bull" : "bear" },
          { label: "S&P EW", value: result.ew[index], text: `${fmtPct(result.ew[index])}%`, tone: result.ew[index] > 0 ? "bull" : "bear" },
        ]
      : [],
  };
}
