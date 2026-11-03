/**
 * Bid / ask / last for the Hub call-credit widget.
 * Tries the live desk feed first. If that feed is unreachable, the committed
 * snapshot is used and the widget must label PREVIEW — never a silent fill.
 */

import { chicagoYmd, creditOf, pickExpiry, pickStrikes, upcomingFridays } from "./analyzer-math.js";

const base = import.meta.env ? import.meta.env.BASE_URL : "/";

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mid(bid, ask, last) {
  if (Number.isFinite(bid) && Number.isFinite(ask) && ask > 0) return (bid + ask) / 2;
  if (Number.isFinite(last)) return last;
  return bid ?? ask ?? null;
}

function asLeg(row, fallback = {}) {
  const bid = num(row.bid ?? row.bid_price);
  const ask = num(row.ask ?? row.ask_price);
  const last = num(row.last ?? row.last_trade_price);
  const mark = num(row.mark ?? row.mark_price ?? row.adjusted_mark_price) ?? mid(bid, ask, last);
  return {
    type: row.type ?? fallback.type ?? "call",
    strike: num(row.strike ?? row.strike_price) ?? fallback.strike,
    instrumentId: row.instrumentId ?? row.instrument_id ?? fallback.instrumentId ?? null,
    bid,
    ask,
    last,
    mark,
    iv: num(row.iv ?? row.implied_volatility) ?? fallback.iv ?? null,
    delta: num(row.delta),
    theta: num(row.theta),
    vega: num(row.vega),
  };
}

function asUnderlying(row, fallback = {}) {
  const last = num(row.last ?? row.last_trade_price ?? row.spot);
  const bid = num(row.bid ?? row.bid_price);
  const ask = num(row.ask ?? row.ask_price);
  return {
    spot: last ?? mid(bid, ask) ?? fallback.spot,
    bid,
    ask,
    last,
    previousClose: num(row.previousClose ?? row.previous_close ?? row.adjusted_previous_close) ?? fallback.previousClose,
  };
}

function pack(raw, source) {
  const short = asLeg(raw.short);
  const long = asLeg(raw.long);
  const underlying = asUnderlying(raw.underlying);
  const credits = creditOf(short, long);
  return {
    source,
    asOf: raw.asOf ?? new Date().toISOString(),
    asOfLabel: raw.asOfLabel ?? "",
    symbol: raw.symbol ?? "SPY",
    chainId: raw.chainId ?? null,
    underlying,
    expiration: raw.expiration,
    short,
    long,
    ivBand: {
      low: num(raw.ivBand?.low) ?? 0.11,
      high: num(raw.ivBand?.high) ?? 0.33,
    },
    credits,
    preview: source !== "live",
  };
}

export const SNAPSHOT_URL = `${base}data/hub-analyzer-marks.json`;

export async function loadSnapshot() {
  const response = await fetch(SNAPSHOT_URL, { cache: "no-cache" });
  if (!response.ok) throw new Error(`marks ${response.status}`);
  return pack(await response.json(), "preview");
}

async function readJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) throw new Error(String(response.status));
  const type = response.headers.get("content-type") ?? "";
  if (type && !/json|text\/plain/i.test(type)) throw new Error("type");
  return response.json();
}

function origins() {
  return [(path) => `/desk-marks${path}`];
}

async function firstJson(path) {
  const attempts = origins().map((make) => readJson(make(path)));
  return Promise.any(attempts);
}

function strikeParam(strike) {
  return Number(strike).toFixed(4);
}

function quoteRow(entry) {
  return entry?.quote ?? entry ?? {};
}

async function liveMarks({ symbol, expiration, shortStrike, longStrike }) {
  const ticker = (symbol ?? "SPY").toUpperCase();
  const equity = await firstJson(`/quotes/?symbols=${encodeURIComponent(ticker)}`);
  const equityRow = equity.results?.[0] ?? equity;
  const underlying = asUnderlying(equityRow);
  const today = chicagoYmd();
  let expiry = expiration;
  if (!expiry) {
    expiry = pickExpiry(upcomingFridays(today), today);
  }
  const spot = underlying.spot;
  const strikes = shortStrike && longStrike ? { short: shortStrike, long: longStrike } : pickStrikes(spot);
  const [shortInst, longInst] = await Promise.all([
    firstJson(`/options/instruments/?chain_symbol=${encodeURIComponent(ticker)}&expiration_dates=${expiry}&type=call&state=active&strike_price=${strikeParam(strikes.short)}`),
    firstJson(`/options/instruments/?chain_symbol=${encodeURIComponent(ticker)}&expiration_dates=${expiry}&type=call&state=active&strike_price=${strikeParam(strikes.long)}`),
  ]);
  const shortRow = (shortInst.results ?? [])[0];
  const longRow = (longInst.results ?? [])[0];
  if (!shortRow?.id || !longRow?.id) throw new Error("instruments");
  const ids = `${shortRow.id},${longRow.id}`;
  const market = await firstJson(`/marketdata/options/?ids=${ids}`);
  const rows = (market.results ?? []).map(quoteRow);
  const byId = new Map(rows.map((row) => [row.instrument_id ?? row.instrumentId, row]));
  const shortQuote = byId.get(shortRow.id) ?? rows[0];
  const longQuote = byId.get(longRow.id) ?? rows[1];
  if (!shortQuote || !longQuote) throw new Error("quotes");
  const short = asLeg({ ...shortQuote, strike: strikes.short, type: "call", instrumentId: shortRow.id });
  const long = asLeg({ ...longQuote, strike: strikes.long, type: "call", instrumentId: longRow.id });
  if (!(short.bid > 0 && short.ask > 0 && long.bid > 0 && long.ask > 0)) throw new Error("empty");
  return pack(
    {
      asOf: shortQuote.updated_at ?? new Date().toISOString(),
      asOfLabel: "",
      symbol: ticker,
      chainId: shortRow.chain_id,
      underlying,
      expiration: expiry,
      short,
      long,
      ivBand: { low: 0.11, high: 0.33 },
    },
    "live",
  );
}

export async function loadAnalyzerMarks(request = {}) {
  let snapshot;
  try {
    snapshot = await loadSnapshot();
  } catch {
    snapshot = null;
  }
  try {
    const live = await liveMarks({
      symbol: request.symbol ?? snapshot?.symbol ?? "SPY",
      expiration: request.expiration ?? snapshot?.expiration,
      shortStrike: request.shortStrike ?? snapshot?.short.strike,
      longStrike: request.longStrike ?? snapshot?.long.strike,
    });
    return live;
  } catch {
    if (snapshot) return snapshot;
    throw new Error("marks");
  }
}

/** Snapshot first so the card paints; live bid/ask replace it when the desk feed answers. */
export async function loadAnalyzerMarksProgressive(request, onMarks) {
  const snapshot = await loadSnapshot();
  onMarks(snapshot);
  try {
    const live = await liveMarks({
      symbol: request?.symbol ?? snapshot.symbol,
      expiration: request?.expiration ?? snapshot.expiration,
      shortStrike: request?.shortStrike ?? snapshot.short.strike,
      longStrike: request?.longStrike ?? snapshot.long.strike,
    });
    onMarks(live);
    return live;
  } catch {
    return snapshot;
  }
}
