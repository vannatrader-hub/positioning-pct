/**
 * Credit Spread Regime: HY−IG excess OAS, EMA-smoothed, scored against its
 * trailing 252-session window. Pure functions so the Vault card and the site
 * checks read the same numbers.
 */

export const CSR_PARAMS = Object.freeze({
  smoothing: 5,
  lookback: 252,
  stress: 2,
  elevated: 1,
  low: -1,
  meanReversion: 2,
  base: -3,
  momentumBars: 5,
});

export const CSR_COLORS = Object.freeze({
  bull: [34, 197, 94],
  bear: [239, 68, 68],
  neutral: [115, 115, 115],
  text: [250, 250, 250],
  table: [23, 23, 23],
  header: [38, 38, 38],
});

export const CSR_REGIMES = ["LOW", "NORMAL", "ELEVATED", "STRESS"];

export function ema(values, length) {
  const alpha = 2 / (length + 1);
  const out = new Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    out[i] = i === 0 ? values[i] : alpha * values[i] + (1 - alpha) * out[i - 1];
  }
  return out;
}

/** Trailing mean and population deviation; null until the window is full. */
export function rollingStats(values, length) {
  const mean = new Array(values.length).fill(null);
  const std = new Array(values.length).fill(null);
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    sumSq += values[i] * values[i];
    if (i >= length) {
      sum -= values[i - length];
      sumSq -= values[i - length] * values[i - length];
    }
    if (i < length - 1) continue;
    const m = sum / length;
    mean[i] = m;
    std[i] = Math.sqrt(Math.max(0, sumSq / length - m * m));
  }
  return { mean, std };
}

/** Share of the previous `length` values at or below the current one, in percent. */
export function percentRank(values, length) {
  const out = new Array(values.length).fill(null);
  for (let i = length; i < values.length; i += 1) {
    let count = 0;
    for (let k = 1; k <= length; k += 1) if (values[i - k] <= values[i]) count += 1;
    out[i] = (count / length) * 100;
  }
  return out;
}

export function regimeOf(z, params = CSR_PARAMS) {
  if (z === null || Number.isNaN(z)) return null;
  if (z >= params.stress) return "STRESS";
  if (z >= params.elevated) return "ELEVATED";
  if (z >= params.low) return "NORMAL";
  return "LOW";
}

function mix(a, b, t) {
  const k = Math.min(1, Math.max(0, t));
  return a.map((value, index) => Math.round(value + (b[index] - value) * k));
}

/** Line color for a Z value: green below Low, grey through Normal, red at Stress. */
export function zColor(z, params = CSR_PARAMS) {
  const { bull, bear, neutral } = CSR_COLORS;
  if (z === null || Number.isNaN(z)) return bull;
  if (z >= params.stress) return bear;
  if (z >= params.elevated) return mix(neutral, bear, (z - params.elevated) / (params.stress - params.elevated));
  if (z >= params.low) return mix(bull, neutral, (z - params.low) / (params.elevated - params.low));
  return bull;
}

/** Background tint strength behind each session. */
export function bgAlpha(z, params = CSR_PARAMS) {
  if (z >= params.stress) return 0.25;
  if (z >= params.elevated) return 0.18;
  return 0.12;
}

export function cycleOf(z, roc, params = CSR_PARAMS) {
  if (z > params.elevated && roc > 0) return "DETERIORATING";
  if (z > params.elevated && roc < 0) return "RECOVERING";
  if (z < params.low && roc < 0) return "TIGHTENING";
  if (z < params.low && roc > 0) return "LOOSENING";
  return "STABLE";
}

export function biasOf(z, params = CSR_PARAMS) {
  if (z >= params.elevated) return "RISK-OFF";
  if (z < params.low) return "RISK-ON";
  return "NEUTRAL";
}

export function statusOf(z, params = CSR_PARAMS) {
  if (z >= params.meanReversion) return "STRESSED";
  if (z <= -params.meanReversion) return "CALM";
  return "NORMAL";
}

/**
 * Build every per-session read from the committed series document.
 * `metric` is "excess" (HY − IG, default) or "hy" (HY OAS alone).
 */
export function csrSeries(doc, { metric = "excess", params = CSR_PARAMS } = {}) {
  const { t, hy, ig, spx, vix } = doc.series;
  const excess = hy.map((value, index) => value - ig[index]);
  const raw = metric === "hy" ? hy : excess;
  const spread = ema(raw, params.smoothing);
  const { mean, std } = rollingStats(spread, params.lookback);
  const z = spread.map((value, index) => (mean[index] === null ? null : (value - mean[index]) / Math.max(std[index], 0.001)));
  const pct = percentRank(spread, params.lookback);
  const roc = spread.map((value, index) => value - (index >= params.momentumBars ? spread[index - params.momentumBars] : 0));
  const sell = z.map((value, index) => value !== null && index > 0 && value >= params.meanReversion && spread[index] < spread[index - 1]);
  const buy = z.map((value, index) => value !== null && index > 0 && value <= -params.meanReversion && spread[index] > spread[index - 1]);
  const first = z.findIndex((value) => value !== null);
  return { metric, params, t, hy, ig, excess, spx, vix, spread, mean, std, z, pct, roc, sell, buy, first };
}

/** The statistics panel at one session (the last one by default). */
export function csrPanel(series, at = series.t.length - 1) {
  const z = series.z[at];
  const roc = series.roc[at];
  return {
    date: series.t[at],
    hy: series.hy[at],
    ig: series.ig[at],
    excess: series.excess[at],
    z,
    regime: regimeOf(z, series.params),
    percentile: series.pct[at],
    momentum: roc,
    vix: series.vix?.[at] ?? null,
    status: statusOf(z, series.params),
    cycle: cycleOf(z, roc, series.params),
    bias: biasOf(z, series.params),
    spx: series.spx?.[at] ?? null,
  };
}

/** Value tones used by the panel: "bear", "bull", or "neutral". */
export function panelTones(panel) {
  const band = (value, hi, lo) => (value > hi ? "bear" : value < lo ? "bull" : "neutral");
  return {
    hy: band(panel.hy, 500, 300),
    ig: band(panel.ig, 150, 80),
    excess: band(panel.excess, 350, 200),
    percentile: band(panel.percentile, 70, 30),
    momentum: panel.momentum > 0 ? "bear" : "bull",
    vix: panel.vix === null ? "neutral" : band(panel.vix, 25, 15),
    status: panel.status === "STRESSED" ? "bear" : panel.status === "CALM" ? "bull" : "neutral",
    cycle: panel.cycle === "DETERIORATING" ? "bear" : panel.cycle === "TIGHTENING" ? "bull" : "neutral",
    bias: panel.bias === "RISK-OFF" ? "bear" : panel.bias === "RISK-ON" ? "bull" : "neutral",
    regime: panel.regime === "STRESS" ? "bear" : panel.regime === "ELEVATED" ? "bear-soft" : panel.regime === "NORMAL" ? "neutral" : "bull",
  };
}

/** Rounded the way the panel prints them. */
export function panelText(panel) {
  const fixed = (value, digits) => (value === null || value === undefined ? "—" : Number(value.toFixed(digits)).toString());
  const signed = (text) => text.replace(/^-/, "−");
  return {
    hy: `${Math.round(panel.hy)} bps`,
    ig: `${Math.round(panel.ig)} bps`,
    excess: `${Math.round(panel.excess)} bps`,
    z: signed(fixed(panel.z, 2)),
    regime: panel.regime ?? "—",
    percentile: `${fixed(panel.percentile, 1)}%`,
    momentum: `${signed(fixed(panel.momentum, 1))} bps`,
    vix: panel.vix === null ? "—" : fixed(panel.vix, 1),
    status: panel.status,
    cycle: panel.cycle,
    bias: panel.bias,
  };
}
