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

  body.append(plate, list, el("p", "svb-note", series.note), el("p", "svb-close", view.closeNote));
  return { body, host };
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
