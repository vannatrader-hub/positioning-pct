/**
 * Spot Vol Beta card on the Vol · Credit · Momentum wall. Renders only after
 * the Vault gate opens the page.
 *
 * latest.json is the gauge. series.json is one close per session; append a
 * point at the close and leave earlier points alone.
 */

import { TONE, drawDualLine, mountPlot, svg } from "./chart-svg.js";

const DATA = `${import.meta.env?.BASE_URL ?? "/"}data/vault/spot-vol-beta/`;

export const SIGNAL = 2;
export const DIAL_MIN = 0;
export const DIAL_MAX = 4;
const DIAL_GOLD = "#f5c451";
const DIAL_TRACK = "rgba(255, 255, 255, 0.16)";
const DIAL_NEEDLE = "#e7eaef";
const DIAL_HUB = "#161b23";
export const DESK_BETA = -0.7;
export const FORMULA = "UV_Δ − (−0.70 × SPX%)";
export const FORMULA_LABEL = "desk estimate";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function deskEstimate(uvDelta, spxPct, beta = DESK_BETA) {
  const value = uvDelta - beta * spxPct;
  return Math.round(value * 100) / 100;
}

export function signalOn(value, level = SIGNAL) {
  return Number.isFinite(value) && value >= level;
}

/** Needle position on the 0–4 house dial. The possible-bottom band starts at 2, straight up. */
export function gaugeFraction(value, min = DIAL_MIN, max = DIAL_MAX) {
  if (!Number.isFinite(value) || max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
}

function arcPath(cx, cy, r, fromDeg, toDeg) {
  const [x1, y1] = polar(cx, cy, r, fromDeg);
  const [x2, y2] = polar(cx, cy, r, toDeg);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function svbDial(value, level) {
  const cx = 120;
  const cy = 108;
  const r = 74;
  const angle = (fraction) => 180 - fraction * 180;
  const on = signalOn(value, level);
  const root = svg("svg", { viewBox: "0 0 240 142", class: "svb-dial", "aria-hidden": "true" });
  const band = gaugeFraction(level);
  root.append(
    svg("path", {
      d: arcPath(cx, cy, r, angle(0), angle(1)),
      fill: "none",
      stroke: DIAL_TRACK,
      "stroke-width": 14,
      "stroke-linecap": "butt",
    }),
    svg("path", {
      class: "svb-dial-band",
      d: arcPath(cx, cy, r, angle(band), angle(1)),
      fill: "none",
      stroke: DIAL_GOLD,
      "stroke-width": 14,
      "stroke-linecap": "butt",
    }),
  );
  for (let step = 0; step <= 8; step += 1) {
    const a = angle(step / 8);
    const major = step % 2 === 0;
    const [x1, y1] = polar(cx, cy, r - 12, a);
    const [x2, y2] = polar(cx, cy, r - (major ? 22 : 18), a);
    root.append(
      svg("line", {
        x1: x1.toFixed(2),
        y1: y1.toFixed(2),
        x2: x2.toFixed(2),
        y2: y2.toFixed(2),
        stroke: major ? "rgba(255, 255, 255, 0.55)" : "rgba(255, 255, 255, 0.28)",
        "stroke-width": major ? 1.6 : 1,
      }),
    );
  }
  root.append(
    svg("text", { x: cx - r, y: cy + 22, "text-anchor": "middle", class: "svb-dial-tick", "font-size": 12, "font-weight": 650 }, "0"),
    svg("text", { x: cx, y: cy - r - 16, "text-anchor": "middle", class: "svb-dial-mark", "font-size": 12, "font-weight": 700 }, "≥ 2"),
    svg("text", { x: cx + r, y: cy + 22, "text-anchor": "middle", class: "svb-dial-tick", "font-size": 12, "font-weight": 650 }, String(DIAL_MAX)),
  );
  const a = angle(gaugeFraction(value));
  const rad = (a * Math.PI) / 180;
  const nx = Math.cos(rad);
  const ny = -Math.sin(rad);
  const px = -ny;
  const py = nx;
  const tip = r - 20;
  const base = 6.5;
  root.append(
    svg("path", {
      class: "svb-needle",
      d: `M ${(cx + px * base).toFixed(2)} ${(cy + py * base).toFixed(2)} L ${(cx + nx * tip).toFixed(2)} ${(cy + ny * tip).toFixed(2)} L ${(cx - px * base).toFixed(2)} ${(cy - py * base).toFixed(2)} Z`,
      fill: on ? DIAL_GOLD : DIAL_NEEDLE,
    }),
    svg("circle", { cx, cy, r: 9, fill: DIAL_HUB, stroke: on ? DIAL_GOLD : "rgba(255, 255, 255, 0.4)", "stroke-width": 2 }),
    svg("circle", { cx, cy, r: 3.2, fill: on ? DIAL_GOLD : "#f3f4f6" }),
  );
  return root;
}

export function formatSvb(value) {
  return (Math.round(value * 100) / 100).toFixed(2);
}

export function formatPct(value) {
  const rounded = (Math.round(Number(value) * 100) / 100).toFixed(2);
  const digits = rounded.replace("-", "");
  const sign = rounded.startsWith("-") ? "−" : Number(value) > 0 ? "+" : "";
  return `${sign}${digits}%`;
}

export function formatSpx(value) {
  return Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPts(value) {
  const rounded = (Math.round(value * 100) / 100).toFixed(2);
  const digits = rounded.replace("-", "");
  const sign = rounded.startsWith("-") ? "−" : Number(value) > 0 ? "+" : "";
  return `${sign}${digits}`;
}

export function formatSession(iso, { weekday = false } = {}) {
  const [year, month, day] = iso.split("-").map(Number);
  const base = `${MONTHS[month - 1]} ${day}, ${year}`;
  if (!weekday) return base;
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${DAYS[date.getUTCDay()]} ${base}`;
}

export function axisTicks(points) {
  return points.map((point, index) => {
    const previous = points[index - 1];
    const last = index === points.length - 1;
    if (previous && point.date.slice(0, 7) === previous.date.slice(0, 7) && !last) return "";
    const [year, month, day] = point.date.split("-").map(Number);
    const base = `${MONTHS[month - 1]} ${day}`;
    const yearChanged = previous && previous.date.slice(0, 4) !== point.date.slice(0, 4);
    return yearChanged ? `${base} ’${String(year).slice(2)}` : base;
  });
}

export function signalAgreement(gauge, estimate, level = SIGNAL) {
  const gaugeOn = signalOn(gauge, level);
  const estimateOn = signalOn(estimate, level);
  if (gaugeOn && estimateOn) return "Gauge and desk estimate are both at or above 2.";
  if (gaugeOn) return "Gauge is at or above 2. Desk estimate is below 2.";
  if (estimateOn) return "Desk estimate is at or above 2. Gauge is below 2.";
  return "Gauge and desk estimate are both below 2.";
}

export function spotVolTip(point, level = SIGNAL) {
  const lines = [
    formatSession(point.date),
    `Spot Vol Beta ${formatSvb(point.svb)}`,
    `SPX ${formatSpx(point.spx)}`,
  ];
  if (signalOn(point.svb, level)) lines.push("Possible bottom");
  if (Number.isFinite(point.vixCloseMove) && point.vixCloseMove >= 2) {
    lines.push(`Formal vol event · VIX ${formatPts(point.vixCloseMove)}`);
  }
  return lines;
}

export const ORIGIN_LABEL = {
  seed: "Seeded",
  "close-routine": "Close routine",
};

function round2(value) {
  return Math.round(value * 100) / 100;
}

/** SPX percent of a close versus the close before it, rounded to 2 places. */
export function closeSpxPct(point, previous) {
  if (!previous || !Number.isFinite(previous.spx) || previous.spx === 0) return null;
  return round2((point.spx / previous.spx - 1) * 100);
}

/** Close-based read: the ≥ 2 band on the gauge close, and a formal vol event only on a VIX close move of 2 points or more. */
export function closeEvent(point, level = SIGNAL) {
  const band = signalOn(point.svb, level);
  const formal = Number.isFinite(point.vixCloseMove) && point.vixCloseMove >= 2;
  if (band && formal) return { tone: "signal", label: "Formal vol event" };
  if (band) return { tone: "signal", label: "≥ 2 · no formal event" };
  if (formal) return { tone: "mid", label: "VIX close +2 · gauge under 2" };
  return { tone: "mid", label: "Below 2" };
}

/**
 * The next close for series.json, built the way the weekday close routine
 * writes it. Throws when the input would rewrite history or skip a check.
 */
export function buildClose(previous, input, beta = DESK_BETA) {
  const { date, svb, spx, uvDelta, vixCloseMove, recordedAt } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) throw new Error("date must be YYYY-MM-DD");
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  if (weekday === 0 || weekday === 6) throw new Error(`${date} is not a weekday session`);
  if (previous && date <= previous.date) throw new Error(`${date} is not after the last close ${previous.date}`);
  if (!Number.isFinite(svb) || svb < -8 || svb > 12) throw new Error("svb must be the gauge close, -8 to 12");
  if (!Number.isFinite(spx) || spx < 100 || spx > 20000) throw new Error("spx must be the SPX close");
  if (recordedAt !== undefined && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(recordedAt)) throw new Error("recordedAt must carry a UTC offset");
  const point = { date, svb: round2(svb), spx: round2(spx) };
  if (vixCloseMove !== undefined) {
    if (!Number.isFinite(vixCloseMove) || Math.abs(vixCloseMove) > 30) throw new Error("vixCloseMove must be the VIX close-to-close move in points");
    point.vixCloseMove = round2(vixCloseMove);
  }
  point.origin = "close-routine";
  if (recordedAt) point.recordedAt = recordedAt;
  if (uvDelta !== undefined) {
    if (!Number.isFinite(uvDelta) || Math.abs(uvDelta) > 20) throw new Error("uvDelta must be in vol points");
    const spxPct = closeSpxPct(point, previous);
    if (spxPct === null) throw new Error("the desk estimate needs a prior SPX close");
    point.estimate = { uvDelta: round2(uvDelta), spxPct, value: deskEstimate(uvDelta, spxPct, beta) };
  }
  return point;
}

/** The newest closes first, each with its SPX percent and close-based read. */
export function closeRows(series, count = 10) {
  const level = series.signal ?? SIGNAL;
  const points = series.points;
  return points
    .slice(-count)
    .map((point) => {
      const previous = points[points.indexOf(point) - 1];
      const spxPct = point.estimate?.spxPct ?? closeSpxPct(point, previous);
      const event = closeEvent(point, level);
      return {
        date: point.date,
        dateLabel: formatSession(point.date, { weekday: true }),
        gauge: formatSvb(point.svb),
        gaugeOn: signalOn(point.svb, level),
        estimate: point.estimate ? formatSvb(point.estimate.value) : "—",
        estimateOn: point.estimate ? signalOn(point.estimate.value, level) : false,
        spx: formatSpx(point.spx),
        spxPct: spxPct === null ? "—" : formatPct(spxPct),
        vix: Number.isFinite(point.vixCloseMove) ? formatPts(point.vixCloseMove) : "—",
        event,
        origin: ORIGIN_LABEL[point.origin] ?? "—",
        seeded: point.origin !== "close-routine",
      };
    })
    .reverse();
}

export function readout(latest, series) {
  const level = series.signal ?? SIGNAL;
  const estimate = deskEstimate(latest.uvDelta, latest.spxPct, series.deskBeta ?? DESK_BETA);
  const last = series.points[series.points.length - 1];
  const gaugeOn = signalOn(latest.gauge, level);
  return {
    gauge: formatSvb(latest.gauge),
    estimate: formatSvb(estimate),
    estimateValue: estimate,
    formula: series.formula,
    formulaLabel: series.formulaLabel,
    agreement: signalAgreement(latest.gauge, estimate, level),
    inputs: `UV Δ ${formatSvb(latest.uvDelta)} · SPX ${formatPct(latest.spxPct)}`,
    session: `SPX ${formatSpx(latest.spx)} · ${formatPct(latest.spxPct)} on the session`,
    gaugeOn,
    estimateOn: signalOn(estimate, level),
    feed: latest.live ? "Live gauge" : latest.feedLabel,
    closeNote: latest.closed
      ? `Session close ${formatSession(latest.session, { weekday: true })}.`
      : `The line is session closes through ${formatSession(last.date, { weekday: true })}. The gauge can move through the day and is written onto the line at the close.`,
    formalWait: !latest.closed && gaugeOn ? "A formal vol event still waits on the VIX close." : "",
    last,
  };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function statusPill(text, tone) {
  const status = el("p", `status lv-${tone}`);
  const dot = el("i");
  dot.setAttribute("aria-hidden", "true");
  status.append(dot, document.createTextNode(text));
  return status;
}

function swatch(className) {
  const mark = el("i", `sw ${className}`);
  mark.setAttribute("aria-hidden", "true");
  return mark;
}

function svbBody(series, view) {
  const read = el("div", "svb-read");
  const primary = el("div", "svb-hero");
  const instrument = el("div", "svb-instrument");
  instrument.append(svbDial(Number(view.gauge), series.signal ?? SIGNAL));
  const gauge = el("p", view.gaugeOn ? "pct svb-gauge is-signal" : "pct svb-gauge", view.gauge);
  gauge.dataset.svbGauge = view.gauge;
  gauge.setAttribute("aria-label", `Spot Vol Beta ${view.gauge}`);
  instrument.append(gauge);
  primary.append(instrument, el("p", "pct-kicker", "Spot Vol Beta"), statusPill(view.gaugeOn ? "Possible bottom" : "Below 2", view.gaugeOn ? "signal" : "mid"), el("p", "svb-session", view.session));

  const desk = el("div", "svb-desk");
  const est = el("p", view.estimateOn ? "svb-est is-signal" : "svb-est", view.estimate);
  est.dataset.svbEstimate = view.estimate;
  desk.append(est, el("p", "svb-kicker", view.formulaLabel));
  const formula = el("p", "svb-formula", view.formula);
  formula.dataset.svbFormula = view.formula;
  desk.append(formula, el("p", "svb-inputs", view.inputs), statusPill(view.estimateOn ? "At or above 2" : "Below 2", view.estimateOn ? "signal" : "mid"));
  read.append(primary, desk);

  const body = el("div", "pchart-body");
  body.append(read, el("p", "svb-agree", view.agreement));
  if (view.formalWait) body.append(el("p", "svb-wait", view.formalWait));

  const plate = el("div", "svb-plot");
  const legend = el("div", "legend");
  const line = el("span");
  line.append(swatch("svb-sw-line"), document.createTextNode("Spot Vol Beta"));
  const spx = el("span");
  spx.append(swatch("svb-sw-spx"), document.createTextNode("SPX"));
  const band = el("span");
  band.append(swatch("svb-sw-band"), document.createTextNode("≥ 2 possible bottom"));
  legend.append(line, spx, band);
  const host = el("div", "pc-plot");
  host.id = "svb-plot";
  plate.append(legend, host);

  const signals = series.points.filter((point) => signalOn(point.svb, series.signal));
  const list = el("ul", "visually-hidden");
  for (const point of signals) list.append(el("li", "", spotVolTip(point, series.signal).join(", ")));
  if (!signals.length) list.append(el("li", "", "No close at or above 2 in this series."));

  body.append(plate, list, closesBlock(series), el("p", "svb-note", series.note), el("p", "svb-close", view.closeNote));
  return { body, host };
}

function closeFigure(label, value, on, note) {
  const box = el("div", on ? "svb-close-figure is-signal" : "svb-close-figure");
  box.append(el("p", "svb-close-label", label), el("p", "svb-close-value", value));
  if (note) box.append(el("p", "svb-close-sub", note));
  return box;
}

function closesBlock(series) {
  const rows = closeRows(series, 10);
  const wrap = el("section", "svb-closes");
  wrap.setAttribute("aria-label", "Spot Vol Beta session closes");
  const head = el("div", "svb-closes-head");
  head.append(el("h3", "", "Session closes"), el("p", "svb-closes-hint", "One close per session, written after the cash close. The gauge above can move through the day; only closes land here."));
  wrap.append(head);
  if (!rows.length) {
    wrap.append(el("p", "svb-closes-empty", "No session close is recorded yet."));
    return wrap;
  }
  const last = rows[0];
  const latest = el("div", "svb-close-latest");
  latest.append(
    closeFigure("Spot Vol Beta · gauge close", last.gauge, last.gaugeOn, "Primary gauge"),
    closeFigure(`${series.formulaLabel ?? FORMULA_LABEL} close`, last.estimate, last.estimateOn, last.estimate === "—" ? "Inputs not recorded for this close" : series.formula),
  );
  const stamp = el("div", "svb-close-stamp");
  stamp.append(
    el("p", "svb-close-date", `${last.dateLabel} close`),
    el("p", "svb-close-sub", `SPX ${last.spx} · ${last.spxPct} · VIX close move ${last.vix}`),
    statusPill(last.event.label, last.event.tone),
  );
  const tag = el("span", last.seeded ? "svb-origin is-seed" : "svb-origin", last.origin);
  stamp.append(tag);
  latest.append(stamp);
  wrap.append(latest);

  const scroller = el("div", "svb-close-scroll");
  const table = el("table", "svb-close-table");
  const thead = el("thead");
  const headRow = el("tr");
  for (const label of ["Session", "Gauge close", "Desk estimate close", "SPX", "SPX %", "VIX move", "Close read", "Entered by"]) headRow.append(el("th", "", label));
  thead.append(headRow);
  const tbody = el("tbody");
  for (const row of rows) {
    const tr = el("tr");
    tr.dataset.session = row.date;
    tr.append(
      el("td", "", row.dateLabel),
      el("td", row.gaugeOn ? "is-num is-signal" : "is-num", row.gauge),
      el("td", row.estimateOn ? "is-num is-signal" : "is-num", row.estimate),
      el("td", "is-num", row.spx),
      el("td", "is-num", row.spxPct),
      el("td", "is-num", row.vix),
      el("td", row.event.tone === "signal" ? "is-signal" : "", row.event.label),
      el("td", row.seeded ? "is-seed" : "", row.origin),
    );
    tbody.append(tr);
  }
  table.append(thead, tbody);
  scroller.append(table);
  wrap.append(scroller);
  const seeded = rows.filter((row) => row.seeded).length;
  wrap.append(
    el(
      "p",
      "svb-closes-hint",
      seeded
        ? `${seeded} of the last ${rows.length} closes are seeded: committed with the wall before the close routine wrote a session. Closes from the routine land on top and earlier points are never rewritten. Desk estimate is ${series.formula}; ≥ 2 on the gauge close is the band, and a formal vol event needs a VIX close move of 2 points or more.`
        : `Desk estimate is ${series.formula}; ≥ 2 on the gauge close is the band, and a formal vol event needs a VIX close move of 2 points or more.`,
    ),
  );
  return wrap;
}

function chartSpec(series) {
  const level = series.signal ?? SIGNAL;
  return {
    label: `Spot Vol Beta daily closes, ${formatSession(series.points[0].date)} through ${formatSession(series.points.at(-1).date)}. Last close ${formatSvb(series.points.at(-1).svb)}. SPX behind the line. Band at ${formatSvb(level)}.`,
    labels: axisTicks(series.points),
    primary: series.points.map((point) => point.svb),
    overlay: series.points.map((point) => point.spx),
    signal: level,
    signalLabel: "≥ 2",
    primaryColor: TONE.ink,
    signalColor: "#9a6b12",
    overlayColor: "#4a6cf7",
    overlayFill: "rgba(74, 108, 247, 0.14)",
    bandFill: "rgba(245, 196, 81, 0.36)",
    markFill: "rgba(245, 196, 81, 0.5)",
    grid: TONE.grid,
    tip: (index) => spotVolTip(series.points[index], level),
  };
}

async function load(card) {
  const indexRes = await fetch(`${DATA}index.json`);
  if (!indexRes.ok) throw new Error(`index ${indexRes.status}`);
  const files = await indexRes.json();
  const seriesRes = await fetch(`${DATA}${files.series}`);
  const latestRes = await fetch(`${DATA}${files.latest}`);
  if (!seriesRes.ok || !latestRes.ok) throw new Error("spot vol beta files missing");
  const series = await seriesRes.json();
  const latest = await latestRes.json();
  if (series.sku !== "spot-vol-beta" || !Array.isArray(series.points) || series.points.length < 2) throw new Error("series is not a close line");
  if (typeof latest.gauge !== "number" || typeof latest.uvDelta !== "number" || typeof latest.spxPct !== "number") throw new Error("gauge is missing inputs");
  const view = readout(latest, series);
  const { body, host } = svbBody(series, view);
  card.querySelector("#svb-asof").textContent = `${latest.asOfLabel} · ${view.feed}`;
  card.querySelector("#svb-body").replaceChildren(body);
  const paint = mountPlot(host, drawDualLine);
  paint(chartSpec(series));
}

if (typeof document !== "undefined") {
  document.addEventListener("vault-open", () => {
    const card = document.getElementById("spot-vol-beta");
    if (!card || card.dataset.ready === "1") return;
    card.dataset.ready = "1";
    load(card).catch((error) => {
      console.error(error);
      const status = card.querySelector("#svb-status");
      if (status) status.textContent = "Spot Vol Beta did not load. Refresh to try again.";
    });
  });
}
