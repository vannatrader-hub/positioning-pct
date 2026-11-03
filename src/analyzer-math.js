/**
 * Call-credit spread math for the Family Hub teach widget.
 * Expiration payoff is exact. The as-of curve is a European call mark
 * so the date thumb can walk today toward 0DTE until the two lines meet.
 */

export const MULTIPLIER = 100;
export const RATE = 0.045;
export const IV_LOW = 0.11;
export const IV_HIGH = 0.33;

const SQRT2PI = Math.sqrt(2 * Math.PI);

export function chicagoYmd(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function utcParts(ymd) {
  const [year, month, day] = ymd.split("-").map(Number);
  return { year, month, day };
}

export function calendarDays(fromYmd, toYmd) {
  const from = utcParts(fromYmd);
  const to = utcParts(toYmd);
  const a = Date.UTC(from.year, from.month - 1, from.day);
  const b = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((b - a) / 86400000);
}

export function addDays(ymd, days) {
  const { year, month, day } = utcParts(ymd);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

export function yearFraction(days) {
  return Math.max(0, days) / 365;
}

export function formatWeekday(ymd, withWeekday = true) {
  const { year, month, day } = utcParts(ymd);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (withWeekday) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
      .format(date)
      .replace(",", "");
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

function normPdf(x) {
  return Math.exp(-0.5 * x * x) / SQRT2PI;
}

function erf(z) {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sign * y;
}

function normCdf(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

export function callValue(spot, strike, years, sigma, rate = RATE) {
  if (!(spot > 0) || !(strike > 0)) return 0;
  if (years <= 1e-8 || sigma <= 1e-8) return Math.max(0, spot - strike);
  const volSqrt = sigma * Math.sqrt(years);
  const d1 = (Math.log(spot / strike) + (rate + 0.5 * sigma * sigma) * years) / volSqrt;
  const d2 = d1 - volSqrt;
  return spot * normCdf(d1) - strike * Math.exp(-rate * years) * normCdf(d2);
}

export function callGreeks(spot, strike, years, sigma, rate = RATE) {
  if (!(spot > 0) || !(strike > 0)) return { value: 0, delta: 0, theta: 0, vega: 0 };
  if (years <= 1e-8 || sigma <= 1e-8) {
    const value = Math.max(0, spot - strike);
    const delta = spot > strike ? 1 : spot < strike ? 0 : 0.5;
    return { value, delta, theta: 0, vega: 0 };
  }
  const sqrtT = Math.sqrt(years);
  const volSqrt = sigma * sqrtT;
  const d1 = (Math.log(spot / strike) + (rate + 0.5 * sigma * sigma) * years) / volSqrt;
  const d2 = d1 - volSqrt;
  const value = spot * normCdf(d1) - strike * Math.exp(-rate * years) * normCdf(d2);
  const delta = normCdf(d1);
  const thetaAnnual = (-spot * normPdf(d1) * sigma) / (2 * sqrtT) - rate * strike * Math.exp(-rate * years) * normCdf(d2);
  return {
    value,
    delta,
    theta: thetaAnnual / 365,
    vega: (spot * normPdf(d1) * sqrtT) / 100,
  };
}

export function creditOf(shortLeg, longLeg) {
  const mid = Number(shortLeg.mark) - Number(longLeg.mark);
  const natural = Number(shortLeg.bid) - Number(longLeg.ask);
  const last = Number(shortLeg.last) - Number(longLeg.last);
  const credit = Number.isFinite(mid) ? mid : Number.isFinite(natural) ? natural : last;
  return {
    mid,
    natural,
    last,
    credit,
  };
}

export function spreadStats(shortStrike, longStrike, credit, multiplier = MULTIPLIER) {
  const width = Math.abs(longStrike - shortStrike);
  const perShare = credit;
  return {
    width,
    credit: perShare,
    maxGain: perShare * multiplier,
    maxLoss: (width - perShare) * multiplier,
    breakeven: shortStrike + perShare,
    multiplier,
  };
}

/** Intrinsic call-credit P/L, dollars per contract. */
export function expirationPnL(spot, shortStrike, longStrike, credit, multiplier = MULTIPLIER) {
  const shortPay = Math.max(0, spot - shortStrike);
  const longPay = Math.max(0, spot - longStrike);
  return (credit - (shortPay - longPay)) * multiplier;
}

/** Mark-to-market P/L as of a remaining year-fraction and IV, dollars per contract. */
export function markPnL(spot, shortStrike, longStrike, years, shortIv, longIv, credit, multiplier = MULTIPLIER, rate = RATE) {
  if (years <= 1e-8) return expirationPnL(spot, shortStrike, longStrike, credit, multiplier);
  const shortMark = callValue(spot, shortStrike, years, shortIv, rate);
  const longMark = callValue(spot, longStrike, years, longIv, rate);
  return (credit - (shortMark - longMark)) * multiplier;
}

export function positionGreeks(spot, shortStrike, longStrike, years, shortIv, longIv, multiplier = MULTIPLIER, rate = RATE) {
  const short = callGreeks(spot, shortStrike, years, shortIv, rate);
  const long = callGreeks(spot, longStrike, years, longIv, rate);
  return {
    delta: -short.delta + long.delta,
    theta: (-short.theta + long.theta) * multiplier,
    vega: (-short.vega + long.vega) * multiplier,
    short,
    long,
  };
}

/** First 5-point strike at least a tick out of the money, then +width. */
export function pickStrikes(spot, width = 5) {
  const minOtm = Math.ceil(spot + 0.01);
  const short = Math.ceil(minOtm / 5) * 5;
  return { short, long: short + width };
}

export function upcomingFridays(todayYmd, count = 8) {
  const { year, month, day } = utcParts(todayYmd);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dates = [];
  while (dates.length < count) {
    if (date.getUTCDay() === 5) dates.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return dates;
}

export function pickExpiry(dates, todayYmd, targetDays = 10) {
  const future = dates
    .map((d) => ({ d, days: calendarDays(todayYmd, d) }))
    .filter((item) => item.days >= 5);
  if (!future.length) return dates.find((d) => calendarDays(todayYmd, d) > 0) ?? dates[0] ?? addDays(todayYmd, 10);
  future.sort((a, b) => Math.abs(a.days - targetDays) - Math.abs(b.days - targetDays));
  return future[0].d;
}

export function priceDomain(spot, shortStrike, longStrike) {
  const lo = Math.min(spot, shortStrike, longStrike);
  const hi = Math.max(spot, shortStrike, longStrike);
  const pad = Math.max(24, Math.round((hi - lo) * 3));
  const min = Math.floor((lo - pad) / 5) * 5;
  const max = Math.ceil((hi + pad) / 5) * 5;
  return { min, max };
}

export function sampleSpots(min, max, steps = 96) {
  const spots = [];
  const span = max - min;
  for (let i = 0; i <= steps; i += 1) spots.push(min + (span * i) / steps);
  return spots;
}

export function shiftIv(quoted, current, slider) {
  if (!Number.isFinite(quoted) || quoted <= 0) return Math.max(0.01, slider);
  return Math.max(0.01, quoted + (slider - current));
}
