/**
 * Weekly Soft | Mid | Crowded reads for the Market Health board.
 *
 * Green on Soft Vol and Vol Stress is an index-buy bias: a VIX surge, a
 * vol-stress surge, or wide credit leans those two rows green. Calm, cheap
 * vol leans red. The Credit row stays red when spreads are stressed. Mag 7,
 * the fund and COT proxies, and SPX extended above the 8/21 weekly EMAs stay
 * don't-add through a vol spike.
 *
 * Jul–Sep Soft↔Crowded percentiles are not in the vault. This module does
 * not read src/series.js. The only Soft Vol residuals used are the filed
 * pack facts for W42 and W43. W44’s residual is the Oct 23 carry and does
 * not color the cell. Global fund, Sharpies, and NAAIM are as-of Desk
 * proxies. Put/Call stays Demo.
 */

import { averageOf, ema } from "./breadth.js";
import { csrSeries, regimeOf } from "./csr.js";
import { isoWeek, isoWeekRange } from "./iso-week.js";
import { buildOscillator } from "./mag7-osc.js";

export const MARKET_HEALTH_YEAR = 2026;
export const MARKET_HEALTH_WEEKS = [29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44];

export const MARKET_HEALTH_STATES = {
  soft: { state: "soft", name: "Soft", voice: "Buy index / possible bottom" },
  "soft-extreme": { state: "soft-extreme", name: "Soft", voice: "Buy index / possible bottom" },
  mid: { state: "mid", name: "Mid", voice: "Mid" },
  crowded: { state: "crowded", name: "Crowded", voice: "Crowded / don’t add" },
  "crowded-extreme": { state: "crowded-extreme", name: "Crowded", voice: "Crowded / don’t add" },
};

export const MARKET_HEALTH_TIP = "Hover a box — Row · W{n} · Soft|Mid|Crowded";

export const BUYABLE_ROWS = ["soft-vol", "vol-stress"];

/** Filed pack facts only. W44 copies the Oct 23 residual and is not a new print. */
export const SOFT_VOL_PRINTS = {
  "2026-W42": { residual: -1.0, fresh: true, asOf: "2026-10-16" },
  "2026-W43": { residual: -1.2, fresh: true, asOf: "2026-10-23" },
  "2026-W44": { residual: -1.2, fresh: false, carriedFrom: "2026-10-23" },
};

/**
 * BoA FMS readings digitized from the July 16 and August 20, 2026 notes.
 * June is the prior those notes state. It sits before this board.
 * W43 repeats the August semis figure and is not colored as a fresh print.
 */
export const GLOBAL_FUND_PROXIES = [
  {
    isoWeek: "2026-W29",
    asOfLabel: "Jul 16, 2026",
    state: "crowded",
    cash: 3.6,
    priorCash: 4.1,
    sentiment: 7.2,
    priorSentiment: 6.0,
    direction: "Stretching",
  },
  {
    isoWeek: "2026-W34",
    asOfLabel: "Aug 20, 2026",
    state: "crowded-extreme",
    cash: 3.5,
    owGlobal: 56,
    semis: 53,
    direction: "Stretching",
  },
];

export const GLOBAL_FUND_UNCONFIRMED = {
  isoWeek: "2026-W43",
  cash: 3.9,
  semis: 53,
};

/** One CFTC hedger print from the July 16, 2026 note. No second dated point. */
export const SHARPIES_PROXIES = [
  {
    isoWeek: "2026-W29",
    asOfLabel: "Jul 16, 2026",
    state: "mid",
    hedger: -66.52,
    callout: "slightly net short",
  },
];

/** Single NAAIM reading. No percentile, so the cell stays empty of color. */
export const NAAIM_PROXIES = [
  {
    isoWeek: "2026-W42",
    asOfLabel: "Sat Oct 17, 2026",
    value: 74.5,
  },
];

export const MARKET_HEALTH_ROWS = [
  { id: "soft-vol", label: "Soft Vol", kind: "live" },
  { id: "vol-stress", label: "Vol Stress", kind: "live" },
  { id: "mag7", label: "Mag 7", kind: "live" },
  { id: "credit", label: "Credit / CSR", kind: "live" },
  { id: "global-fund", label: "Global fund", kind: "proxy", mark: "Proxy" },
  { id: "sharpies", label: "Sharpies / COT", kind: "proxy", mark: "Proxy" },
  { id: "nysi", label: "NY Summation", kind: "live" },
  { id: "nasi", label: "Nasdaq Summation", kind: "live" },
  { id: "nyad", label: "NYAD", kind: "live" },
  { id: "nyhl", label: "NYHL", kind: "live" },
  { id: "put-call", label: "Put / Call", kind: "demo", mark: "Demo" },
  { id: "naaim", label: "NAAIM / risk appetite", kind: "proxy", mark: "Proxy" },
  { id: "spx-ema", label: "SPX vs 8/21 weekly EMA", kind: "live" },
];

const EXTENDED = 0.02;

export function marketHealthWeekKey(week) {
  return `${MARKET_HEALTH_YEAR}-W${String(week).padStart(2, "0")}`;
}

export function fmt(value, digits = 2) {
  if (!Number.isFinite(value)) return "—";
  const neg = value < 0;
  const trimmed = Math.abs(value)
    .toFixed(digits)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
  return `${neg ? "−" : ""}${trimmed}`;
}

export function fmtSigned(value, digits = 2) {
  if (!Number.isFinite(value)) return "—";
  if (value > 0) return `+${fmt(value, digits)}`;
  return fmt(value, digits);
}

function priorWeekKey(key) {
  const { start } = isoWeekRange(key);
  const [year, month, day] = start.split("-").map(Number);
  const prev = new Date(Date.UTC(year, month - 1, day - 1));
  return isoWeek(prev.toISOString().slice(0, 10));
}

function indexByWeek(dates) {
  const map = new Map();
  dates.forEach((date, index) => {
    if (!date) return;
    const key = isoWeek(date);
    const prev = map.get(key);
    if (!prev || date > prev.date) map.set(key, { date, index, key });
  });
  return map;
}

export function vixSurge(wow) {
  return Number.isFinite(wow) && wow >= 2;
}

/** House possible-bottom print is 2. A jump of 1 or more into 1.5 also counts as a surge. */
export function svbSurge(svb, wow) {
  if (!Number.isFinite(svb)) return false;
  const jump = Number.isFinite(wow) ? wow : 0;
  return svb >= 2 || (jump >= 1 && svb >= 1.5);
}

export function creditIsStress(z) {
  return Number.isFinite(z) && z >= 1;
}

/**
 * VIX week-over-week, inverted: a surge is buyable, calm or cheap vol is crowded.
 * `residual` is a filed Soft Vol print in vol points. Negative means the VIX
 * is cheap. Cheap vol without a surge stays crowded. A surge wins.
 */
export function bucketSoftVol({ vix, wow, residual = null }) {
  if (!Number.isFinite(vix) || !Number.isFinite(wow)) return null;
  if (wow >= 4) return "soft-extreme";
  if (wow >= 2) return "soft";
  const cheap = Number.isFinite(residual) && residual <= -0.4;
  const calm = vix <= 16;
  const fading = wow <= -1 && vix < 18;
  if (cheap && calm) return "crowded-extreme";
  if (cheap || calm || fading) return "crowded";
  return "mid";
}

export function bucketSvb({ svb, wow }) {
  if (!Number.isFinite(svb)) return null;
  const jump = Number.isFinite(wow) ? wow : 0;
  if (svb >= 3 || (svb >= 2 && jump >= 1)) return "soft-extreme";
  if (svbSurge(svb, wow)) return "soft";
  if (svb >= 1) return "mid";
  return "crowded";
}

export function bucketMag7(value, params = { caution: 9, bullish: 2, bearish: -2, stretched: -5 }) {
  if (!Number.isFinite(value)) return null;
  if (value >= params.caution) return "crowded-extreme";
  if (value >= params.bullish) return "crowded";
  if (value <= params.stretched) return "soft-extreme";
  if (value <= params.bearish) return "soft";
  return "mid";
}

/** Wide spreads are red. Tight credit is mid, or crowded when Mag 7 is already extended. */
export function bucketCredit({ z, regime, mag7 }) {
  if (!Number.isFinite(z)) return null;
  if (regime === "STRESS" || z >= 2) return "crowded-extreme";
  if (regime === "ELEVATED" || z >= 1) return "crowded";
  if (regime === "LOW" || z <= -1) {
    return mag7 === "crowded" || mag7 === "crowded-extreme" ? "crowded" : "mid";
  }
  return "mid";
}

/** Summation versus its average and the washout line. A high line above the average is crowded. */
export function bucketSummation({ close, ma, prev, buyLine = -1000 }) {
  if (!Number.isFinite(close) || !Number.isFinite(ma)) return null;
  const slope = Number.isFinite(prev) ? close - prev : 0;
  const below = close < ma;
  if (Number.isFinite(buyLine) && close <= buyLine) return slope < 0 ? "soft-extreme" : "soft";
  if (below && close <= -500) return "soft-extreme";
  if (below && slope < 0) return "soft";
  if (below) return "mid";
  if (close >= 100 && slope >= 0) return "crowded";
  return "mid";
}

/** Cumulative breadth versus its own average. Distance is a percent of the level. */
export function bucketCumulative({ close, ma, prev }) {
  if (!Number.isFinite(close) || !Number.isFinite(ma) || close === 0) return null;
  const slope = Number.isFinite(prev) ? close - prev : 0;
  const pct = ((close - ma) / Math.abs(close)) * 100;
  if (pct <= -0.5 && slope < 0) return "soft-extreme";
  if (pct <= -0.15 && slope <= 0) return "soft";
  if (pct < 0) return "mid";
  if (pct >= 0.7 && slope >= 0) return "crowded-extreme";
  if (pct >= 0.25 && slope >= 0) return "crowded";
  return "mid";
}

/** Above both weekly EMAs is don't-add. Below both is soft. Between them is the crossover. */
export function bucketSpxEma({ close, ema8, ema21 }) {
  if (![close, ema8, ema21].every((value) => Number.isFinite(value))) return null;
  const above8 = close > ema8;
  const above21 = close > ema21;
  if (above8 && above21) return (close - ema8) / ema8 >= EXTENDED ? "crowded-extreme" : "crowded";
  if (!above8 && !above21) return (ema8 - close) / ema8 >= EXTENDED ? "soft-extreme" : "soft";
  return "mid";
}

/** Vol and credit stress lean only the buyable rows. An empty week stays empty. */
export function paintCell(rowId, state, flags) {
  if (!BUYABLE_ROWS.includes(rowId)) return state;
  if (!flags?.active || !state || state === "empty") return state;
  if (state === "soft" || state === "soft-extreme") return state;
  return "soft";
}

export function biasPhrase(flags) {
  const parts = [];
  if (flags?.vixSurge) parts.push("VIX surge");
  if (flags?.svbSurge) parts.push("vol-stress surge");
  if (flags?.creditStress) parts.push("credit stress");
  if (!parts.length) return "";
  const verb = parts.length > 1 ? "lean" : "leans";
  return `${parts.join(" and ")} ${verb} buy index`;
}

function fmtPlaces(value, digits) {
  if (!Number.isFinite(value)) return "—";
  const neg = value < 0;
  return `${neg ? "−" : ""}${Math.abs(value).toFixed(digits)}`;
}

function gapCell(label, week) {
  return {
    state: "empty",
    base: null,
    name: "",
    voice: "",
    tip: `${label} · W${week} · No print`,
    sr: "No print.",
    kind: "gap",
  };
}

function coloredCell(label, week, state, base, fact, kind) {
  const spec = MARKET_HEALTH_STATES[state];
  const tail = fact ? ` · ${fact}` : "";
  return {
    state,
    base: base ?? state,
    name: spec.name,
    voice: spec.voice,
    tip: `${label} · W${week} · ${spec.name}${tail}`,
    sr: `${spec.name}. ${spec.voice}.${fact ? ` ${fact}.` : ""}`,
    kind,
  };
}

function creditWeeks(csr) {
  if (!csr?.series?.t || !csr?.series?.vix) return new Map();
  const built = csrSeries(csr);
  const indexed = indexByWeek(built.t);
  const out = new Map();
  for (const [key, hit] of indexed) {
    const prev = indexed.get(priorWeekKey(key));
    const vix = built.vix[hit.index];
    const z = built.z[hit.index];
    out.set(key, {
      date: hit.date,
      vix,
      wow: prev ? vix - built.vix[prev.index] : null,
      z,
      regime: regimeOf(z),
      pct: built.pct[hit.index],
    });
  }
  return out;
}

function svbWeeks(series, latest) {
  const points = [...(series?.points ?? [])];
  const last = points[points.length - 1];
  if (latest?.session && Number.isFinite(latest.gauge) && (!last || latest.session > last.date)) {
    points.push({
      date: latest.session,
      svb: latest.gauge,
      provisional: latest.closed === false,
    });
  }
  const indexed = indexByWeek(points.map((point) => point.date));
  const out = new Map();
  for (const [key, hit] of indexed) {
    const prev = indexed.get(priorWeekKey(key));
    const point = points[hit.index];
    out.set(key, {
      date: hit.date,
      svb: point.svb,
      wow: prev ? point.svb - points[prev.index].svb : null,
      provisional: Boolean(point.provisional),
    });
  }
  return out;
}

function mag7Weeks(doc) {
  if (!doc?.dates?.length) return { map: new Map(), params: null };
  const osc = buildOscillator(doc);
  const indexed = indexByWeek(osc.dates);
  const params = {
    caution: osc.params.caution,
    bullish: osc.params.bullishThreshold,
    bearish: osc.params.bearishThreshold,
    stretched: osc.params.stretched,
  };
  const map = new Map();
  for (const [key, hit] of indexed) {
    map.set(key, { date: hit.date, value: osc.values[hit.index], params });
  }
  return { map, params };
}

function breadthWeeks(doc, bucket) {
  if (!doc?.bars?.length) return new Map();
  const period = doc.period ?? doc.ma ?? 8;
  const average = doc.average === "ema" ? "ema" : "sma";
  const ma = averageOf(doc.bars, { average, period });
  const indexed = indexByWeek(doc.bars.map((bar) => bar.t));
  const out = new Map();
  for (const [key, hit] of indexed) {
    const prev = indexed.get(priorWeekKey(key));
    out.set(key, {
      date: hit.date,
      close: doc.bars[hit.index].c,
      ma: ma[hit.index],
      prev: prev ? doc.bars[prev.index].c : null,
      buyLine: doc.buyLine,
      state: bucket({
        close: doc.bars[hit.index].c,
        ma: ma[hit.index],
        prev: prev ? doc.bars[prev.index].c : null,
        buyLine: doc.buyLine,
      }),
    });
  }
  return out;
}

function spxWeeks(doc) {
  if (!doc?.bars?.length) return new Map();
  const closes = new Map();
  for (const bar of doc.bars) closes.set(isoWeek(bar.t), { date: bar.t, close: bar.c });
  const keys = [...closes.keys()].sort();
  const values = keys.map((key) => closes.get(key).close);
  const ema8 = ema(values, 8);
  const ema21 = ema(values, 21);
  const out = new Map();
  keys.forEach((key, index) => {
    const row = closes.get(key);
    out.set(key, {
      date: row.date,
      close: row.close,
      ema8: ema8[index],
      ema21: ema21[index],
      state: bucketSpxEma({ close: row.close, ema8: ema8[index], ema21: ema21[index] }),
    });
  });
  return out;
}

function flagsFor(credit, vix, svb) {
  const flags = {
    vixSurge: vixSurge(vix?.wow),
    svbSurge: svbSurge(svb?.svb, svb?.wow),
    creditStress: creditIsStress(credit?.z),
  };
  flags.active = flags.vixSurge || flags.svbSurge || flags.creditStress;
  return flags;
}

function withBias(rowId, base, flags, label, week, fact) {
  const state = paintCell(rowId, base, flags);
  const parts = fact ? [fact] : [];
  if (state !== base) {
    const phrase = biasPhrase(flags);
    if (phrase) parts.push(phrase);
  }
  return coloredCell(label, week, state, base, parts.join(" · "), "live");
}

function globalFundCell(label, week, key) {
  const print = GLOBAL_FUND_PROXIES.find((row) => row.isoWeek === key);
  if (print) {
    const bits = [`Desk proxy as of ${print.asOfLabel}`, "BoA FMS"];
    if (print.priorCash != null) bits.push(`cash ${fmtPlaces(print.cash, 1)}% (June was ${fmtPlaces(print.priorCash, 1)}%)`);
    else bits.push(`cash ${fmtPlaces(print.cash, 1)}%`);
    if (print.sentiment != null) {
      const prior = print.priorSentiment != null ? ` (June was ${fmtPlaces(print.priorSentiment, 1)})` : "";
      bits.push(`sentiment ${fmtPlaces(print.sentiment, 1)}${prior}`);
    }
    if (print.owGlobal != null) bits.push(`global equities ${fmtPlaces(print.owGlobal, 0)}% overweight`);
    if (print.semis != null) bits.push(`long global semis ${fmtPlaces(print.semis, 0)}%`);
    bits.push("Cash Rule sell", print.direction, "not a Soft↔Crowded percentile");
    const fact = bits.join(" · ");
    return coloredCell(label, week, print.state, print.state, fact, "proxy");
  }
  if (key === GLOBAL_FUND_UNCONFIRMED.isoWeek) {
    const quote = GLOBAL_FUND_UNCONFIRMED;
    return {
      state: "empty",
      base: null,
      name: "",
      voice: "",
      tip: `${label} · W${week} · Quoted cash ${fmtPlaces(quote.cash, 1)}% and long global semis ${fmtPlaces(quote.semis, 0)}% · verify-carry of the August print · not a fresh print · not a Soft↔Crowded percentile`,
      sr: `Quoted cash ${fmtPlaces(quote.cash, 1)}% and long global semis ${fmtPlaces(quote.semis, 0)}%. Verify-carry of the August print. Not a fresh print. Not a Soft↔Crowded percentile.`,
      kind: "unconfirmed",
    };
  }
  return gapCell(label, week);
}

function sharpiesCell(label, week, key) {
  const print = SHARPIES_PROXIES.find((row) => row.isoWeek === key);
  if (!print) return gapCell(label, week);
  const fact = `Desk proxy as of ${print.asOfLabel} · CFTC major-index hedgers ${fmtPlaces(print.hedger, 2)} · ${print.callout} · one print · not a Soft↔Crowded percentile`;
  return coloredCell(label, week, print.state, print.state, fact, "proxy");
}

function naaimCell(label, week, key) {
  const print = NAAIM_PROXIES.find((row) => row.isoWeek === key);
  if (!print) return gapCell(label, week);
  return {
    state: "empty",
    base: null,
    name: "",
    voice: "",
    tip: `${label} · W${week} · Desk proxy ${fmtPlaces(print.value, 1)} · as of ${print.asOfLabel} · as-of reading, not a Soft↔Crowded percentile`,
    sr: `Desk proxy ${fmtPlaces(print.value, 1)} as of ${print.asOfLabel}. As-of reading, not a Soft↔Crowded percentile.`,
    kind: "proxy",
  };
}

function demoCell(label, week) {
  return {
    state: "empty",
    base: null,
    name: "",
    voice: "",
    tip: `${label} · W${week} · Demo · no live series`,
    sr: "Demo. No live series.",
    kind: "demo",
  };
}

/**
 * `docs` is the committed vault: csr, svb series, svb latest, mag7 oscillator,
 * and the breadth files. Missing files leave that row empty. Proxies and the
 * Put/Call Demo row do not depend on those files.
 */
export function buildMarketHealth(docs = {}) {
  const credit = creditWeeks(docs.csr);
  const svb = svbWeeks(docs.svbSeries, docs.svbLatest);
  const mag7 = mag7Weeks(docs.mag7);
  const nysi = breadthWeeks(docs.nysi, bucketSummation);
  const nasi = breadthWeeks(docs.nasi, bucketSummation);
  const nyad = breadthWeeks(docs.nyad, bucketCumulative);
  const nyhl = breadthWeeks(docs.nyhl, bucketCumulative);
  const spx = spxWeeks(docs.spx);

  const rows = MARKET_HEALTH_ROWS.map((row) => {
    const cells = MARKET_HEALTH_WEEKS.map((week) => {
      const key = marketHealthWeekKey(week);
      if (row.id === "global-fund") return globalFundCell(row.label, week, key);
      if (row.id === "sharpies") return sharpiesCell(row.label, week, key);
      if (row.id === "naaim") return naaimCell(row.label, week, key);
      if (row.id === "put-call") return demoCell(row.label, week);
      const creditRow = credit.get(key);
      const svbRow = svb.get(key);
      const magRow = mag7.map.get(key);
      const flags = flagsFor(creditRow, creditRow, svbRow);
      if (row.id === "soft-vol") {
        if (!creditRow || !Number.isFinite(creditRow.wow)) return gapCell(row.label, week);
        const print = SOFT_VOL_PRINTS[key];
        const base = bucketSoftVol({
          vix: creditRow.vix,
          wow: creditRow.wow,
          residual: print?.fresh ? print.residual : null,
        });
        const facts = [`VIX ${fmt(creditRow.vix)}`, `week ${fmtSigned(creditRow.wow)}`];
        if (print?.fresh) facts.push(`Desk Soft Vol ${fmtPlaces(print.residual, 1)} pts`);
        if (print && !print.fresh) facts.push(`Soft Vol ${fmtPlaces(print.residual, 1)} pts carried from Oct 23`);
        return withBias(row.id, base, flags, row.label, week, facts.join(" · "));
      }
      if (row.id === "vol-stress") {
        if (!svbRow) return gapCell(row.label, week);
        const base = bucketSvb(svbRow);
        const facts = [`gauge ${fmt(svbRow.svb)}`, svbRow.date];
        if (svbRow.provisional) facts.push("close not appended");
        return withBias(row.id, base, flags, row.label, week, facts.join(" · "));
      }
      if (row.id === "mag7") {
        if (!magRow || !Number.isFinite(magRow.value)) return gapCell(row.label, week);
        const base = bucketMag7(magRow.value, magRow.params);
        return coloredCell(row.label, week, base, base, `oscillator ${fmt(magRow.value)}`, "live");
      }
      if (row.id === "credit") {
        if (!creditRow || !Number.isFinite(creditRow.z)) return gapCell(row.label, week);
        const mag7State = magRow ? bucketMag7(magRow.value, magRow.params) : null;
        const base = bucketCredit({ z: creditRow.z, regime: creditRow.regime, mag7: mag7State });
        const tight = base === "crowded" && (creditRow.regime === "LOW" || creditRow.z <= -1);
        const fact = `z ${fmt(creditRow.z)} · ${creditRow.regime}${tight ? " · tight credit with Mag 7 extended" : ""}`;
        return coloredCell(row.label, week, base, base, fact, "live");
      }
      if (row.id === "nysi" || row.id === "nasi" || row.id === "nyad" || row.id === "nyhl") {
        const source = { nysi, nasi, nyad, nyhl }[row.id];
        const read = source.get(key);
        if (!read?.state) return gapCell(row.label, week);
        return coloredCell(row.label, week, read.state, read.state, `${fmt(read.close)} vs its average ${fmt(read.ma)}`, "live");
      }
      if (row.id === "spx-ema") {
        const read = spx.get(key);
        if (!read?.state) return gapCell(row.label, week);
        const fact = `close ${fmt(read.close)} · 8-week ${fmt(read.ema8)} · 21-week ${fmt(read.ema21)}`;
        return coloredCell(row.label, week, read.state, read.state, fact, "live");
      }
      return gapCell(row.label, week);
    });
    return { ...row, cells };
  });

  return { weeks: MARKET_HEALTH_WEEKS, rows };
}
