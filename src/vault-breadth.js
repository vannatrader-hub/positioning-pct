/**
 * Breadth cards on the Vault Vol · Credit · Momentum wall: NY and Nasdaq
 * Summation drawn as end-of-day line charts with the SPX pane on top, MA(8),
 * and the −1000 buy line. Fills the [data-breadth] cards on the public
 * Dashboard, or after the Vault gate opens a template, from public/data/vault/breadth/.
 */
import {
  BUY_LINE,
  DEFAULT_MONTHS,
  MAX_MONTHS,
  RANGES,
  averageCrosses,
  averageOf,
  breadthRead,
  clampMonths,
  dayChange,
  fixed,
  legendDate,
  longDate,
  monthMarks,
  paneDomain,
  plainDate,
  rangeLabel,
  signed,
  sma,
  ticks,
  utc,
  windowStart,
} from "./breadth.js";
import { isFamilySurface } from "./family-entry.js";
import { onDeskReady } from "./when-mounted.js";

const DATA = `${import.meta.env.BASE_URL}data/vault/breadth/`;
const NS = "http://www.w3.org/2000/svg";
const DAY = 86400000;

const INK = {
  frame: "#8f8f8f",
  grid: "rgba(0, 0, 0, 0.11)",
  axis: "#1a1a1a",
  up: "#000000",
  down: "#e0102e",
  ma: "#6a6fc0",
  spx: "#000000",
  buy: "#17853b",
  cross: "rgba(0, 0, 0, 0.45)",
};

const GRADIENT = [
  [0, "#bfe2d6"],
  [0.22, "#d9ead2"],
  [0.42, "#eeedc4"],
  [0.62, "#f3e3b6"],
  [0.82, "#f4d0b0"],
  [1, "#f1bea7"],
];

let gradientSeq = 0;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgNode(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

function minus(text) {
  return text.replace(/^-/, "−").replace(/ -/g, " −");
}

/* Header in the chart frame: symbol and name, the session's values, the date. Follows the hovered bar. */
function cumulativeHead(doc) {
  const head = el("div", "bw-head");
  const name = el("p", "bw-name");
  name.append(el("strong", "bw-sym", doc.label), document.createTextNode(` · ${doc.title}`));
  const values = el("p", "bw-values");
  const date = el("p", "bw-date");
  head.append(name, values, date);
  const show = (bars, index, extra = {}) => {
    const bar = bars[index];
    values.replaceChildren(el("b", "", "Close"), document.createTextNode(` ${levelText(bar.c)} `));
    if (extra.average != null) {
      values.append(el("b", "", doc.average === "ema" ? "EMA" : "MA"), document.createTextNode(` ${levelText(extra.average)} `));
    }
    if (extra.spx != null) values.append(el("b", "", "SPX"), document.createTextNode(` ${fixed(extra.spx)} `));
    if (extra.cross) values.append(el("span", extra.cross === "above" ? "bw-up" : "bw-down", extra.cross === "above" ? " Crossed above" : " Crossed below"));
    date.textContent = longDate(bar.t);
  };
  return { head, show };
}

function frameHead(doc) {
  if (doc.kind === "cumulative") return cumulativeHead(doc);
  const head = el("div", "bw-head");
  const name = el("p", "bw-name");
  name.append(el("strong", "bw-sym", `$${doc.symbol}`), document.createTextNode(` ${doc.title} (EOD) INDX`));
  const values = el("p", "bw-values");
  const date = el("p", "bw-date");
  head.append(name, values, date);
  const show = (bars, index) => {
    const bar = bars[index];
    const close = fixed(bar.c);
    const { chg, pct } = dayChange(bars, index);
    values.replaceChildren();
    for (const label of ["Open", "High", "Low", "Close"]) values.append(el("b", "", label), document.createTextNode(` ${close} `));
    values.append(el("b", "", "Chg"), document.createTextNode(" "), el("span", chg >= 0 ? "bw-up" : "bw-down", `${signed(chg)} (${signed(pct)}%)`));
    date.textContent = longDate(bar.t);
  };
  return { head, show };
}

/* Toolbar: Daily period, range presets, the range slider out to ten years, SPX pane on or off. */
function toolbar(doc, state, onChange) {
  const bar = el("div", "pchart-controls bw-controls");

  const period = el("div", "pchart-control");
  period.append(el("span", "pchart-control-label", "Period"), el("span", "bw-period", "Daily · 1D"));

  const range = el("div", "pchart-control");
  const seg = el("div", "seg bw-seg");
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", `${doc.label} range`);
  const buttons = RANGES.map((preset) => {
    const button = el("button", "", preset.label);
    button.type = "button";
    button.dataset.months = String(preset.months);
    button.addEventListener("click", () => onChange({ months: preset.months }));
    seg.append(button);
    return button;
  });
  range.append(el("span", "pchart-control-label", "Range"), seg);

  const slide = el("label", "pchart-control bw-slide");
  const slideHead = el("span", "pchart-control-label");
  const slideValue = el("output", "bw-slide-value");
  slideHead.append(document.createTextNode("Range slider "), slideValue);
  const input = el("input");
  input.type = "range";
  input.min = "1";
  input.max = String(MAX_MONTHS);
  input.step = "1";
  input.setAttribute("aria-label", `${doc.label} range in months, up to ten years`);
  input.addEventListener("input", () => onChange({ months: Number(input.value) }));
  const scale = el("span", "bw-slide-scale");
  scale.append(el("span", "", "1M"), el("span", "", "10Y"));
  slide.append(slideHead, input, scale);

  const overlay = el("div", "pchart-control");
  const toggle = el("button", "toggle bw-toggle", "SPX pane");
  toggle.type = "button";
  toggle.addEventListener("click", () => onChange({ overlay: !state.overlay }));
  overlay.append(el("span", "pchart-control-label", "Context"), toggle);

  bar.append(period, range, slide, overlay);

  const sync = () => {
    for (const button of buttons) {
      const on = Number(button.dataset.months) === state.months;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", String(on));
    }
    input.value = String(state.months);
    input.style.setProperty("--fill", `${((state.months - 1) / (MAX_MONTHS - 1)) * 100}%`);
    slideValue.textContent = rangeLabel(state.months);
    toggle.classList.toggle("is-on", state.overlay);
    toggle.setAttribute("aria-pressed", String(state.overlay));
  };
  return { bar, sync };
}

/* Runs of the line split where direction turns, so rising stretches draw black and falling ones red. */
function directionRuns(points, closes) {
  const runs = [];
  let run = null;
  for (let i = 1; i < points.length; i += 1) {
    const up = closes[i] >= closes[i - 1];
    if (!run || run.up !== up) {
      run = { up, pts: [points[i - 1]] };
      runs.push(run);
    }
    run.pts.push(points[i]);
  }
  return runs;
}

function axisTag(layer, { x, y, text, stroke, color, fill = "#ffffff", bold = false }) {
  const width = text.length * 6 + 8;
  layer.append(
    svgNode("rect", { x: x + 1, y: y - 7.5, width, height: 15, fill, stroke, "stroke-width": 1, rx: 1.5 }),
    svgNode("text", { x: x + 5, y: y + 3.6, fill: color, class: `bw-axis${bold ? " is-bold" : ""}` }, text),
  );
}

/** Spread right-axis tags so none overlap; keeps each tag as close to its value as it can. */
function spreadTags(tags, top, bottom) {
  const sorted = [...tags].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i += 1) sorted[i].y = Math.max(sorted[i].y, sorted[i - 1].y + 15);
  const overflow = sorted.length ? sorted[sorted.length - 1].y - (bottom - 7) : 0;
  if (overflow > 0) for (const tag of sorted) tag.y -= overflow;
  for (const tag of sorted) tag.y = Math.max(tag.y, top + 7);
  return sorted;
}

function drawChart(host, doc, spx, state, head) {
  const svg = svgNode("svg", { class: "bw-svg", role: "img" });
  host.replaceChildren(svg);
  const gradientId = `bw-grad-${(gradientSeq += 1)}`;
  const ma = sma(doc.bars, doc.ma);
  const spxBy = new Map(spx.bars.map((bar) => [bar.t, bar.c]));
  const buy = doc.buyLine ?? BUY_LINE;
  let geometry = null;
  let hoverLayer = null;

  const draw = () => {
    const width = Math.round(host.clientWidth);
    const height = Math.round(host.clientHeight);
    if (!width || !height) return;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.replaceChildren();

    const from = windowStart(doc.bars, state.months);
    const bars = doc.bars.slice(from);
    const avg = ma.slice(from);
    const closes = bars.map((bar) => bar.c);
    const spxCloses = bars.map((bar) => spxBy.get(bar.t) ?? null);
    const lastIndex = bars.length - 1;
    const last = bars[lastIndex];

    svg.setAttribute(
      "aria-label",
      `${doc.label}, daily closes ${plainDate(bars[0].t)} to ${plainDate(last.t)}. Last ${minus(fixed(last.c))}, MA(${doc.ma}) ${minus(fixed(avg[lastIndex]))}. Buy line at ${minus(String(buy))}.${state.overlay ? ` SPX ${fixed(spxCloses[lastIndex])}.` : ""}`,
    );

    const pad = { top: 3, right: 64, bottom: 19, left: 3 };
    const gap = 7;
    const left = pad.left;
    const right = width - pad.right;
    const plotW = right - left;
    const usable = height - pad.top - pad.bottom;
    const topH = state.overlay ? Math.max(70, Math.round((usable - gap) * 0.27)) : 0;
    const mainTop = pad.top + (state.overlay ? topH + gap : 0);
    const mainH = height - pad.bottom - mainTop;
    const t0 = utc(bars[0].t);
    const t1 = utc(last.t) + DAY;
    const x = (t) => left + 2 + ((t - t0) / (t1 - t0)) * (plotW - 6);
    const xs = bars.map((bar) => x(utc(bar.t)));

    const defs = svgNode("defs");
    const gradient = svgNode("linearGradient", { id: gradientId, x1: 0, y1: pad.top, x2: 0, y2: height - pad.bottom, gradientUnits: "userSpaceOnUse" });
    for (const [offset, color] of GRADIENT) gradient.append(svgNode("stop", { offset, "stop-color": color }));
    defs.append(gradient);
    svg.append(defs);

    const marks = monthMarks(bars[0].t, last.t, (plotW - 6) / ((t1 - t0) / DAY));
    const panes = [];

    const pane = (top, h, values, mark) => {
      const { lo, hi } = paneDomain(values, mark);
      const y = (value) => top + (1 - (value - lo) / (hi - lo)) * h;
      svg.append(svgNode("rect", { x: left, y: top, width: plotW, height: h, fill: `url(#${gradientId})` }));
      const grid = svgNode("g", { class: "bw-grid" });
      for (const tick of ticks(lo, hi, Math.max(3, Math.round(h / 22)))) {
        const ty = y(tick);
        grid.append(svgNode("line", { x1: left, x2: right, y1: ty, y2: ty, stroke: INK.grid }));
        grid.append(svgNode("line", { x1: right, x2: right + 4, y1: ty, y2: ty, stroke: INK.frame }));
        grid.append(svgNode("text", { x: right + 6, y: ty + 3.5, fill: INK.axis, class: "bw-axis" }, String(tick)));
      }
      for (const mark of marks) {
        const mx = x(utc(mark.t));
        grid.append(svgNode("line", { x1: mx, x2: mx, y1: top, y2: top + h, stroke: INK.grid }));
      }
      svg.append(grid);
      panes.push({ top, h, y });
      return y;
    };

    const finishPane = (top, h) => {
      svg.append(svgNode("rect", { x: left, y: top, width: plotW, height: h, fill: "none", stroke: INK.frame }));
    };

    const legend = (top, rows) => {
      const group = svgNode("g", { class: "bw-legend" });
      rows.forEach((row, index) => {
        const ly = top + 12 + index * 12;
        group.append(
          svgNode("line", { x1: left + 6, x2: left + 18, y1: ly - 3.5, y2: ly - 3.5, stroke: row.color, "stroke-width": 1.6 }),
          svgNode("text", { x: left + 22, y: ly, fill: row.text ?? INK.axis, class: "bw-legend-text" }, row.label),
        );
      });
      svg.append(group);
    };

    const tags = [];
    let spxY = null;

    if (state.overlay) {
      spxY = pane(pad.top, topH, spxCloses);
      const pts = [];
      spxCloses.forEach((value, i) => {
        if (value !== null) pts.push(`${xs[i].toFixed(1)},${spxY(value).toFixed(1)}`);
      });
      svg.append(svgNode("polyline", { points: pts.join(" "), fill: "none", stroke: INK.spx, "stroke-width": 1.15, "stroke-linejoin": "round" }));
      finishPane(pad.top, topH);
      legend(pad.top, [{ color: INK.spx, label: `$SPX ${fixed(spxCloses[lastIndex])} (${legendDate(last.t)})` }]);
      const spxTags = spreadTags([{ y: spxY(spxCloses[lastIndex]), text: fixed(spxCloses[lastIndex]), stroke: INK.spx, color: INK.spx, bold: true }], pad.top, pad.top + topH);
      for (const tag of spxTags) axisTag(svg, { x: right, ...tag });
    }

    const y = pane(mainTop, mainH, [...closes, ...avg], buy);

    const by = y(buy);
    svg.append(
      svgNode("line", { x1: left, x2: right, y1: by, y2: by, stroke: INK.buy, "stroke-width": 1.6, "stroke-dasharray": "7 4", class: "bw-buy" }),
      svgNode("text", { x: right - 6, y: by - 5, "text-anchor": "end", fill: INK.buy, class: "bw-buy-label" }, `BUY ${minus(String(buy))}`),
    );

    const maPts = [];
    avg.forEach((value, i) => {
      if (value !== null) maPts.push(`${xs[i].toFixed(1)},${y(value).toFixed(1)}`);
    });
    svg.append(svgNode("polyline", { points: maPts.join(" "), fill: "none", stroke: INK.ma, "stroke-width": 1.3, "stroke-linejoin": "round" }));

    const pts = closes.map((value, i) => `${xs[i].toFixed(1)},${y(value).toFixed(1)}`);
    for (const run of directionRuns(pts, closes)) {
      svg.append(
        svgNode("polyline", {
          points: run.pts.join(" "),
          fill: "none",
          stroke: run.up ? INK.up : INK.down,
          "stroke-width": 1.9,
          "stroke-linejoin": "round",
          "stroke-linecap": "round",
        }),
      );
    }
    finishPane(mainTop, mainH);

    legend(mainTop, [
      { color: INK.up, label: `$${doc.symbol} (Daily) ${fixed(last.c)} (${legendDate(last.t)})` },
      { color: INK.ma, label: `MA(${doc.ma}) ${fixed(avg[lastIndex])}` },
      { color: INK.buy, label: `Buy line ${buy}`, text: INK.buy },
    ]);

    tags.push(
      { y: y(last.c), text: fixed(last.c), stroke: INK.up, color: INK.up, bold: true },
      { y: y(avg[lastIndex]), text: fixed(avg[lastIndex]), stroke: INK.ma, color: INK.ma },
      { y: by, text: String(buy), stroke: INK.buy, color: "#ffffff", fill: INK.buy, bold: true },
    );
    for (const tag of spreadTags(tags, mainTop, mainTop + mainH)) axisTag(svg, { x: right, ...tag });

    const axis = svgNode("g", { class: "bw-grid" });
    for (const mark of marks) {
      const mx = x(utc(mark.t));
      axis.append(
        svgNode("line", { x1: mx, x2: mx, y1: height - pad.bottom, y2: height - pad.bottom + 4, stroke: INK.frame }),
        svgNode("text", { x: mx, y: height - 5, "text-anchor": "middle", fill: INK.axis, class: `bw-axis${mark.year ? " is-bold" : ""}` }, mark.label),
      );
    }
    svg.append(axis);

    hoverLayer = svgNode("g", { class: "bw-hover", visibility: "hidden" });
    hoverLayer.append(
      svgNode("line", { y1: pad.top, y2: height - pad.bottom, stroke: INK.cross, "stroke-dasharray": "3 3" }),
      svgNode("circle", { r: 3.2, fill: "#ffffff", stroke: INK.up, "stroke-width": 1.6 }),
      svgNode("circle", { r: 3.2, fill: "#ffffff", stroke: INK.spx, "stroke-width": 1.4, display: state.overlay ? "inline" : "none" }),
    );
    svg.append(hoverLayer);
    geometry = { bars, xs, y, spxY, spxCloses, left, right, from };
  };

  const hover = (event) => {
    if (!geometry || !hoverLayer) return;
    const box = svg.getBoundingClientRect();
    const px = event.clientX - box.left;
    const { bars, xs, y, spxY, spxCloses, left, right, from } = geometry;
    if (px < left || px > right) {
      leave();
      return;
    }
    let lo = 0;
    let hi = xs.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] < px) lo = mid;
      else hi = mid;
    }
    const i = Math.abs(xs[lo] - px) <= Math.abs(xs[hi] - px) ? lo : hi;
    const [line, dot, spxDot] = hoverLayer.children;
    line.setAttribute("x1", xs[i]);
    line.setAttribute("x2", xs[i]);
    dot.setAttribute("cx", xs[i]);
    dot.setAttribute("cy", y(bars[i].c));
    if (spxY && spxCloses[i] !== null) {
      spxDot.setAttribute("cx", xs[i]);
      spxDot.setAttribute("cy", spxY(spxCloses[i]));
    }
    hoverLayer.setAttribute("visibility", "visible");
    head.show(doc.bars, from + i);
  };
  const leave = () => {
    hoverLayer?.setAttribute("visibility", "hidden");
    head.show(doc.bars, doc.bars.length - 1);
  };

  svg.addEventListener("pointermove", hover);
  svg.addEventListener("pointerleave", leave);
  const observer = new ResizeObserver(draw);
  observer.observe(host);
  draw();
  return draw;
}

const CROSS_INK = { above: "#17853b", below: "#e0102e" };

function drawCumulative(host, doc, spx, state, head) {
  const svg = svgNode("svg", { class: "bw-svg", role: "img" });
  host.replaceChildren(svg);
  const gradientId = `bw-grad-${(gradientSeq += 1)}`;
  const avgAll = averageOf(doc.bars, doc);
  const crosses = averageCrosses(doc.bars.map((bar) => bar.c), avgAll);
  const crossAt = new Map(crosses.map((cross) => [cross.index, cross.side]));
  const spxBy = new Map(spx.bars.map((bar) => [bar.t, bar.c]));
  const avgName = doc.average === "ema" ? "EMA" : "MA";
  let geometry = null;
  let hoverLayer = null;

  const draw = () => {
    const width = Math.round(host.clientWidth);
    const height = Math.round(host.clientHeight);
    if (!width || !height) return;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.replaceChildren();

    const from = windowStart(doc.bars, state.months);
    const bars = doc.bars.slice(from);
    const avg = avgAll.slice(from);
    const closes = bars.map((bar) => bar.c);
    const spxCloses = bars.map((bar) => spxBy.get(bar.t) ?? null);
    const lastIndex = bars.length - 1;
    const last = bars[lastIndex];
    const above = avg[lastIndex] != null && last.c >= avg[lastIndex];
    svg.setAttribute(
      "aria-label",
      `${doc.label}, ${plainDate(bars[0].t)} to ${plainDate(last.t)}. Last ${levelText(last.c)}, ${above ? "above" : "below"} the ${avgName}(${doc.period}). Green lines are crosses above. Red lines are crosses below.`,
    );

    const pad = { top: 3, right: 72, bottom: 19, left: 3 };
    const gap = 7;
    const left = pad.left;
    const right = width - pad.right;
    const plotW = right - left;
    const usable = height - pad.top - pad.bottom;
    const topH = state.overlay ? Math.max(70, Math.round((usable - gap) * 0.27)) : 0;
    const mainTop = pad.top + (state.overlay ? topH + gap : 0);
    const mainH = height - pad.bottom - mainTop;
    const t0 = utc(bars[0].t);
    const t1 = utc(last.t) + DAY;
    const x = (t) => left + 2 + ((t - t0) / (t1 - t0)) * (plotW - 6);
    const xs = bars.map((bar) => x(utc(bar.t)));

    const defs = svgNode("defs");
    const gradient = svgNode("linearGradient", { id: gradientId, x1: 0, y1: pad.top, x2: 0, y2: height - pad.bottom, gradientUnits: "userSpaceOnUse" });
    for (const [offset, color] of GRADIENT) gradient.append(svgNode("stop", { offset, "stop-color": color }));
    defs.append(gradient);
    svg.append(defs);

    const marks = monthMarks(bars[0].t, last.t, (plotW - 6) / ((t1 - t0) / DAY));
    const pane = (top, h, values) => {
      const { lo, hi } = paneDomain(values, null);
      const y = (value) => top + (1 - (value - lo) / (hi - lo)) * h;
      svg.append(svgNode("rect", { x: left, y: top, width: plotW, height: h, fill: `url(#${gradientId})` }));
      const grid = svgNode("g", { class: "bw-grid" });
      for (const tick of ticks(lo, hi, Math.max(3, Math.round(h / 22)))) {
        const ty = y(tick);
        grid.append(svgNode("line", { x1: left, x2: right, y1: ty, y2: ty, stroke: INK.grid }));
        grid.append(svgNode("text", { x: right + 6, y: ty + 3.5, fill: INK.axis, class: "bw-axis" }, levelText(tick)));
      }
      svg.append(grid);
      return y;
    };
    const finishPane = (top, h) => {
      svg.append(svgNode("rect", { x: left, y: top, width: plotW, height: h, fill: "none", stroke: INK.frame }));
    };
    const legend = (top, rows) => {
      const group = svgNode("g", { class: "bw-legend" });
      rows.forEach((row, index) => {
        const ly = top + 12 + index * 12;
        group.append(
          svgNode("line", { x1: left + 6, x2: left + 18, y1: ly - 3.5, y2: ly - 3.5, stroke: row.color, "stroke-width": row.dash ? 1.4 : 1.8, "stroke-dasharray": row.dash ?? "none" }),
          svgNode("text", { x: left + 22, y: ly, fill: INK.axis, class: "bw-legend-text" }, row.label),
        );
      });
      svg.append(group);
    };

    let spxY = null;
    if (state.overlay) {
      spxY = pane(pad.top, topH, spxCloses.filter((value) => value !== null));
      const pts = [];
      spxCloses.forEach((value, i) => {
        if (value !== null) pts.push(`${xs[i].toFixed(1)},${spxY(value).toFixed(1)}`);
      });
      svg.append(svgNode("polyline", { points: pts.join(" "), fill: "none", stroke: INK.spx, "stroke-width": 1.15, "stroke-linejoin": "round" }));
      finishPane(pad.top, topH);
      legend(pad.top, [{ color: INK.spx, label: `SPX ${spxCloses[lastIndex] == null ? "—" : fixed(spxCloses[lastIndex])}` }]);
    }

    const y = pane(mainTop, mainH, [...closes, ...avg.filter((value) => value !== null)]);
    for (const cross of crosses) {
      if (cross.index < from) continue;
      const i = cross.index - from;
      svg.append(svgNode("line", {
        x1: xs[i],
        x2: xs[i],
        y1: pad.top,
        y2: mainTop + mainH,
        stroke: CROSS_INK[cross.side],
        "stroke-width": 1.35,
        class: `bw-cross is-${cross.side}`,
      }));
    }
    const maPts = [];
    avg.forEach((value, i) => {
      if (value !== null) maPts.push(`${xs[i].toFixed(1)},${y(value).toFixed(1)}`);
    });
    if (maPts.length) svg.append(svgNode("polyline", { points: maPts.join(" "), fill: "none", stroke: INK.ma, "stroke-width": 1.45, "stroke-linejoin": "round" }));
    const pts = closes.map((value, i) => `${xs[i].toFixed(1)},${y(value).toFixed(1)}`);
    for (const run of directionRuns(pts, closes)) {
      svg.append(svgNode("polyline", {
        points: run.pts.join(" "),
        fill: "none",
        stroke: run.up ? INK.up : INK.down,
        "stroke-width": 1.9,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      }));
    }
    finishPane(mainTop, mainH);
    legend(mainTop, [
      { color: INK.up, label: `${doc.label} ${levelText(last.c)}` },
      { color: INK.ma, label: `${avgName}(${doc.period}) ${avg[lastIndex] == null ? "—" : levelText(avg[lastIndex])}` },
      { color: CROSS_INK.above, label: "Cross above" },
      { color: CROSS_INK.below, label: "Cross below" },
    ]);

    const axis = svgNode("g", { class: "bw-grid" });
    for (const mark of marks) {
      const mx = x(utc(mark.t));
      axis.append(
        svgNode("line", { x1: mx, x2: mx, y1: height - pad.bottom, y2: height - pad.bottom + 4, stroke: INK.frame }),
        svgNode("text", { x: mx, y: height - 5, "text-anchor": "middle", fill: INK.axis, class: `bw-axis${mark.year ? " is-bold" : ""}` }, mark.label),
      );
    }
    svg.append(axis);

    hoverLayer = svgNode("g", { class: "bw-hover", visibility: "hidden" });
    hoverLayer.append(
      svgNode("line", { y1: pad.top, y2: height - pad.bottom, stroke: INK.cross, "stroke-dasharray": "3 3" }),
      svgNode("circle", { r: 3.2, fill: "#ffffff", stroke: INK.up, "stroke-width": 1.6 }),
      svgNode("circle", { r: 3.2, fill: "#ffffff", stroke: INK.spx, "stroke-width": 1.4, display: state.overlay ? "inline" : "none" }),
    );
    svg.append(hoverLayer);
    geometry = { bars, xs, y, spxY, spxCloses, avg, left, right, from };
  };

  const hover = (event) => {
    if (!geometry || !hoverLayer) return;
    const box = svg.getBoundingClientRect();
    const px = event.clientX - box.left;
    const { bars, xs, y, spxY, spxCloses, avg, left, right, from } = geometry;
    if (px < left || px > right) {
      leave();
      return;
    }
    let lo = 0;
    let hi = xs.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] < px) lo = mid;
      else hi = mid;
    }
    const i = Math.abs(xs[lo] - px) <= Math.abs(xs[hi] - px) ? lo : hi;
    const [line, dot, spxDot] = hoverLayer.children;
    line.setAttribute("x1", xs[i]);
    line.setAttribute("x2", xs[i]);
    dot.setAttribute("cx", xs[i]);
    dot.setAttribute("cy", y(bars[i].c));
    if (spxY && spxCloses[i] !== null) {
      spxDot.setAttribute("cx", xs[i]);
      spxDot.setAttribute("cy", spxY(spxCloses[i]));
    }
    hoverLayer.setAttribute("visibility", "visible");
    head.show(doc.bars, from + i, { average: avg[i], spx: spxCloses[i], cross: crossAt.get(from + i) });
  };
  const leave = () => {
    hoverLayer?.setAttribute("visibility", "hidden");
    const last = doc.bars.length - 1;
    head.show(doc.bars, last, { average: avgAll[last], spx: spxBy.get(doc.bars[last].t) ?? null, cross: crossAt.get(last) });
  };

  svg.addEventListener("pointermove", hover);
  svg.addEventListener("pointerleave", leave);
  const observer = new ResizeObserver(draw);
  observer.observe(host);
  draw();
  leave();
  return draw;
}

function levelText(value) {
  if (value == null || Number.isNaN(value)) return "—";
  if (Math.abs(value) >= 1000) return minus(Math.round(value).toLocaleString("en-US"));
  return minus(fixed(value));
}

function readLine(doc, { plain = false } = {}) {
  if (doc.kind === "cumulative") {
    const avg = averageOf(doc.bars, doc);
    const last = doc.bars.at(-1).c;
    const ma = avg.at(-1);
    const above = ma != null && last >= ma;
    const status = el("span", `bw-status ${above ? "is-firm" : "is-weak"}`);
    status.textContent = above ? "Above the average" : "Below the average";
    const line = el("p", "bw-read");
    line.append(status, el("strong", "bw-read-value", levelText(last)));
    if (!plain && ma != null) {
      const name = doc.average === "ema" ? "EMA" : "MA";
      line.append(document.createTextNode(` · ${above ? "above" : "below"} ${name}(${doc.period}) ${levelText(ma)}`));
    }
    return { line, read: null };
  }
  const read = breadthRead(doc);
  const line = el("p", "bw-read");
  const status = el("span", `bw-status ${read.atBuy ? "is-buy" : read.close < 0 ? "is-weak" : "is-firm"}`);
  status.textContent = read.atBuy ? "At the buy line" : read.close < 0 ? "Below zero" : "Above zero";
  line.append(status, el("strong", "bw-read-value", minus(fixed(read.close))));
  if (!plain) {
    line.append(
      document.createTextNode(
        ` ${minus(signed(read.chg))} on the day · ${read.aboveMa ? "above" : "below"} MA(${doc.ma}) ${minus(fixed(read.ma))} · ${read.atBuy ? `${minus(fixed(-read.gap))} under` : `${fixed(read.gap)} over`} the ${minus(String(read.buy))} buy line`,
      ),
    );
  }
  return { line, read };
}

function fillCard(card, doc, spx, defaults) {
  const plain = !isFamilySurface();
  const head = card.querySelector(".pchart-head");
  const { line, read } = readLine(doc, { plain });
  head.append(line);

  const state = { months: clampMonths(Number(card.dataset.months) || doc.defaultRangeMonths || defaults.months), overlay: true };
  const overlay = doc.spx?.length ? { bars: doc.spx } : spx;
  const frame = el("div", "bw-frame");
  const frameHeader = frameHead(doc);
  const plot = el("div", "bw-plot");
  frame.append(frameHeader.head, plot);
  frameHeader.show(doc.bars, doc.bars.length - 1);

  let redraw = () => {};
  const tools = toolbar(doc, state, (change) => {
    if ("months" in change) state.months = clampMonths(change.months);
    if ("overlay" in change) state.overlay = change.overlay;
    tools.sync();
    redraw();
  });
  tools.sync();

  card.querySelector(".bw-load")?.remove();
  card.append(tools.bar, frame);
  if (!plain && doc.kind !== "cumulative" && read) {
    card.append(
      el(
        "p",
        "bw-note",
        `Running total of the ratio-adjusted McClellan Oscillator on ${doc.exchange} advancing and declining issues. Daily closes through ${plainDate(read.date)}. The green line at ${minus(String(read.buy))} is the desk buy line, a breadth washout${read.lastTouch ? `; the last close through it was ${plainDate(read.lastTouch)}` : ""}.`,
      ),
    );
  }
  redraw = (doc.kind === "cumulative" ? drawCumulative : drawChart)(plot, doc, overlay, state, frameHeader);
}

async function getJson(file) {
  const res = await fetch(`${DATA}${file}`);
  if (!res.ok) throw new Error(`${file} ${res.status}`);
  return res.json();
}

async function load(cards) {
  const index = await getJson("index.json");
  const [spx, ...docs] = await Promise.all([getJson(index.overlay.file), ...index.charts.map((chart) => getJson(chart.file))]);
  const defaults = { months: clampMonths(index.defaultRangeMonths ?? DEFAULT_MONTHS) };
  for (const doc of docs) {
    const end = doc.asOf || index.asOf;
    if (!Array.isArray(doc.bars) || doc.bars.length < 2 || doc.bars[doc.bars.length - 1].t !== end) {
      throw new Error(`${doc.id} series does not run to ${end}`);
    }
    const card = cards.find((item) => item.dataset.breadth === doc.id);
    if (card) fillCard(card, doc, spx, defaults);
  }
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

onDeskReady(() => {
  const cards = [...document.querySelectorAll("[data-breadth]")].filter((card) => card.dataset.ready !== "1");
  if (!cards.length) return;
  for (const card of cards) card.dataset.ready = "1";
  load(cards).catch((error) => {
    console.error(error);
    for (const card of cards) {
      const status = card.querySelector(".bw-load");
      if (status) status.textContent = "The breadth series did not load. Refresh to try again.";
    }
  });
});
