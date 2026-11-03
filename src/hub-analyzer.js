/**
 * Family Hub call-credit spread analyzer. Mounts only into #hub-analyzer
 * on the gated Hub template so the public wall never sees it.
 */
import "./analyzer.css";
import { onDeskReady } from "./when-mounted.js";
import { loadAnalyzerMarks, loadAnalyzerMarksProgressive } from "./analyzer-marks.js";
import {
  IV_HIGH,
  IV_LOW,
  MULTIPLIER,
  addDays,
  calendarDays,
  chicagoYmd,
  expirationPnL,
  formatWeekday,
  markPnL,
  positionGreeks,
  priceDomain,
  sampleSpots,
  shiftIv,
  spreadStats,
  yearFraction,
} from "./analyzer-math.js";

const NS = "http://www.w3.org/2000/svg";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svg(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

function money(n, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "−" : "";
  return `${sign}$${Math.abs(n).toFixed(digits)}`;
}

function pnlText(n) {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "−" : n > 0 ? "+" : "";
  return `${sign}$${Math.abs(Math.round(n))}`;
}

function tone(n) {
  if (n > 0.005) return "is-pos";
  if (n < -0.005) return "is-neg";
  return "";
}

function fillTrack(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const pct = max === min ? 0 : ((Number(input.value) - min) / (max - min)) * 100;
  input.style.setProperty("--an-pct-fill", `${pct}%`);
}

function linePath(points, xOf, yOf) {
  return points.map((point, i) => `${i ? "L" : "M"}${xOf(point.s).toFixed(1)},${yOf(point.v).toFixed(1)}`).join(" ");
}

function drawChart(host, view) {
  const width = Math.round(host.clientWidth);
  const height = Math.round(host.clientHeight);
  if (width < 240 || height < 160) return;
  const pad = { l: 54, r: 16, t: 28, b: 52 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const xOf = (s) => pad.l + ((s - view.xMin) / (view.xMax - view.xMin)) * innerW;
  const yOf = (v) => pad.t + ((view.yMax - v) / (view.yMax - view.yMin)) * innerH;
  const root = svg("svg", {
    class: "an-svg",
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    role: "img",
    "aria-label": "Call credit spread profit and loss",
  });

  const beX = xOf(view.breakeven);
  const plot = { x: pad.l, y: pad.t, w: innerW, h: innerH };
  const clipId = "an-plot-clip";
  const defs = svg("defs");
  const clip = svg("clipPath", { id: clipId });
  clip.append(svg("rect", { x: plot.x, y: plot.y, width: plot.w, height: plot.h }));
  defs.append(clip);
  root.append(defs);

  root.append(
    svg("rect", { x: plot.x, y: plot.y, width: Math.max(0, beX - plot.x), height: plot.h, fill: "var(--an-profit-wash)" }),
    svg("rect", { x: beX, y: plot.y, width: Math.max(0, plot.x + plot.w - beX), height: plot.h, fill: "var(--an-loss-wash)" }),
  );

  const grid = svg("g", { fill: "none", stroke: "var(--an-line)", "stroke-width": "1" });
  for (let s = view.xMin; s <= view.xMax + 0.01; s += view.xStep) {
    grid.append(svg("line", { x1: xOf(s), x2: xOf(s), y1: plot.y, y2: plot.y + plot.h }));
  }
  root.append(grid);

  root.append(svg("line", { x1: plot.x, x2: plot.x + plot.w, y1: yOf(0), y2: yOf(0), stroke: "var(--an-zero)", "stroke-width": "1" }));
  root.append(svg("line", { x1: beX, x2: beX, y1: plot.y, y2: plot.y + plot.h, stroke: "var(--an-be)", "stroke-width": "1", "stroke-dasharray": "3 3" }));

  const beLabel = `Breakeven ${money(view.breakeven)}`;
  const beW = Math.min(168, beLabel.length * 6.4 + 16);
  const beLeft = Math.min(Math.max(beX - beW / 2, plot.x), plot.x + plot.w - beW);
  root.append(
    svg("rect", { x: beLeft, y: plot.y - 18, width: beW, height: 16, rx: 4, fill: "var(--an-card)", stroke: "var(--an-line)" }),
    svg("text", { x: beLeft + beW / 2, y: plot.y - 6.5, "text-anchor": "middle", fill: "var(--an-ink)", "font-size": "10", "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace" }, beLabel),
  );

  root.append(
    svg("path", { d: linePath(view.exp, xOf, yOf), fill: "none", stroke: "var(--an-exp)", "stroke-width": "2.1", "stroke-linejoin": "round", "clip-path": `url(#${clipId})` }),
    svg("path", { d: linePath(view.now, xOf, yOf), fill: "none", stroke: "var(--an-now)", "stroke-width": "2.25", "stroke-linejoin": "round", "clip-path": `url(#${clipId})` }),
  );

  const profitY = yOf(view.maxGain) + 14;
  root.append(
    svg("text", { x: plot.x + 10, y: profitY, fill: "var(--an-profit)", "font-size": "10", "font-weight": "700", "letter-spacing": "0.04em" }, `PROFIT ZONE · price below ${money(view.breakeven)}`),
    svg("text", { x: plot.x + plot.w - 10, y: yOf(view.maxLoss) - 10, "text-anchor": "end", fill: "var(--an-loss)", "font-size": "10", "font-weight": "700", "letter-spacing": "0.04em" }, `LOSS ZONE · capped at ${pnlText(view.maxLoss)}`),
  );

  const spotX = xOf(view.spot);
  const spotNow = view.now.reduce((best, point) => (Math.abs(point.s - view.spot) < Math.abs(best.s - view.spot) ? point : best), view.now[0]);
  root.append(svg("line", { x1: spotX, x2: spotX, y1: plot.y, y2: plot.y + plot.h, stroke: "var(--an-meta)", "stroke-width": "1", "stroke-dasharray": "2 4" }));
  if (spotNow) {
    root.append(
      svg("circle", { cx: spotX, cy: yOf(spotNow.v), r: 3.2, fill: "var(--an-now)", stroke: "var(--an-card)", "stroke-width": "1.5" }),
      svg("text", { x: spotX + 8, y: yOf(spotNow.v) - 8, fill: "var(--an-ink)", "font-size": "11", "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace" }, `${money(view.spot)} → ${pnlText(spotNow.v)}`),
    );
  }

  const cursorX = xOf(view.cursor);
  if (Math.abs(view.cursor - view.spot) > 0.15) {
    root.append(svg("line", { x1: cursorX, x2: cursorX, y1: plot.y, y2: plot.y + plot.h, stroke: "var(--an-ink)", "stroke-width": "1", opacity: "0.35" }));
  }

  root.append(svg("text", { x: plot.x, y: plot.y - 8, fill: "var(--an-meta)", "font-size": "10" }, "P/L per contract"));
  root.append(svg("text", { x: plot.x + plot.w, y: height - 6, "text-anchor": "end", fill: "var(--an-meta)", "font-size": "10" }, `${view.symbol} price at that date →`));

  const yTicks = [
    [view.maxGain, pnlText(view.maxGain)],
    [0, "$0"],
    [view.maxLoss, pnlText(view.maxLoss)],
  ];
  for (const [value, label] of yTicks) {
    root.append(svg("text", { x: plot.x - 8, y: yOf(value) + 3.5, "text-anchor": "end", fill: "var(--an-meta)", "font-size": "11", "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace" }, label));
  }
  for (let s = view.xMin; s <= view.xMax + 0.01; s += view.xStep) {
    root.append(svg("text", { x: xOf(s), y: plot.y + plot.h + 16, "text-anchor": "middle", fill: "var(--an-meta)", "font-size": "11", "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace" }, money(s, 0)));
  }

  const strikes = [
    { s: view.shortK, color: "var(--an-loss)", label: `Sell ${view.shortK}C` },
    { s: view.longK, color: "var(--an-profit)", label: `Buy ${view.longK}C` },
  ];
  for (const strike of strikes) {
    const x = xOf(strike.s);
    root.append(
      svg("circle", { cx: x, cy: plot.y + plot.h, r: 3.4, fill: strike.color }),
      svg("text", { x, y: plot.y + plot.h + 30, "text-anchor": "middle", fill: strike.color, "font-size": "10", "font-weight": "650" }, strike.label),
    );
  }

  host.replaceChildren(root);

  const fromEvent = (event) => {
    const box = root.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * width;
    const s = view.xMin + ((px - pad.l) / innerW) * (view.xMax - view.xMin);
    return Math.min(view.xMax, Math.max(view.xMin, s));
  };
  root.addEventListener("pointermove", (event) => view.onCursor?.(fromEvent(event)));
  root.addEventListener("pointerleave", () => view.onCursor?.(view.spot));
}

function buildCard(root) {
  const card = el("article", "an-card");
  card.setAttribute("aria-label", "Call credit spread");

  card.append(el("p", "an-eyebrow", "Call credit spread · teach mode"));
  card.append(el("h2", "an-title", "See the trade — breakeven, profit, credit"));
  card.append(el("p", "an-lede", "Sell a call, buy a higher call. You keep the credit if price stays below breakeven."));

  const legs = el("div", "an-legs");
  const symbol = document.createElement("input");
  symbol.type = "text";
  symbol.maxLength = 6;
  symbol.setAttribute("aria-label", "Underlying");
  const short = document.createElement("input");
  short.type = "number";
  short.step = "1";
  short.setAttribute("aria-label", "Short call strike");
  const long = document.createElement("input");
  long.type = "number";
  long.step = "1";
  long.setAttribute("aria-label", "Long call strike");
  const expiry = document.createElement("input");
  expiry.type = "date";
  expiry.setAttribute("aria-label", "Expiration");
  const credit = el("span", "is-credit", "");
  credit.dataset.an = "credit-leg";
  const edit = el("span", "an-edit", "Editable");
  edit.dataset.an = "edit";
  const shortLabel = el("label", "is-short");
  shortLabel.append(el("span", "", "Sell"), short, el("span", "", "C"));
  const longLabel = el("label", "is-long");
  longLabel.append(el("span", "", "Buy"), long, el("span", "", "C"));
  const expLabel = el("label");
  expLabel.append(el("span", "", "Exp"), expiry);
  legs.append(symbol, el("span", "an-dot", "·"), shortLabel, el("span", "an-dot", "·"), longLabel, el("span", "an-dot", "·"), el("span", "", "Credit"), credit, el("span", "an-dot", "·"), expLabel, edit);
  card.append(legs);

  const chip = el("div", "an-chip");
  chip.append(el("span", "an-chip-mark", "%"), el("span", "", ""));
  chip.lastChild.dataset.an = "chip";
  card.append(chip);

  const legend = el("div", "an-legend");
  const keys = [
    ["an-swatch", "At expiration"],
    ["an-swatch is-now", "As of selected date"],
    ["an-swatch is-profit", "Profit zone"],
    ["an-swatch is-loss", "Loss zone"],
  ];
  for (const [cls, label] of keys) {
    const key = el("span", "an-key");
    key.append(el("i", cls), document.createTextNode(label));
    legend.append(key);
  }
  card.append(legend);

  const chart = el("div", "an-chart");
  chart.dataset.an = "chart";
  card.append(chart);

  const sliders = el("div", "an-sliders");
  const dateSlide = el("div", "an-slide");
  dateSlide.innerHTML = "";
  const dateTop = el("div", "an-slide-top");
  dateTop.append(el("span", "", "Date"), el("strong", "", ""));
  dateTop.lastChild.dataset.an = "days";
  const dateInput = document.createElement("input");
  dateInput.type = "range";
  dateInput.setAttribute("aria-label", "Days to expiration");
  const dateFoot = el("div", "an-slide-foot");
  dateFoot.append(el("span", "", ""), el("span", "", "Expiration (0DTE)"));
  dateFoot.firstChild.dataset.an = "today";
  dateSlide.append(dateTop, dateInput, dateFoot);

  const ivSlide = el("div", "an-slide");
  const ivTop = el("div", "an-slide-top");
  ivTop.append(el("span", "", "Implied volatility"), el("span", "an-slide-iv", ""));
  ivTop.lastChild.dataset.an = "iv-now";
  const ivInput = document.createElement("input");
  ivInput.type = "range";
  ivInput.min = "110";
  ivInput.max = "330";
  ivInput.step = "1";
  ivInput.setAttribute("aria-label", "Implied volatility");
  const ivFoot = el("div", "an-slide-foot");
  ivFoot.append(el("span", "", "52W low 11%"), el("span", "", "current"), el("span", "", "52W high 33%"));
  ivFoot.children[1].dataset.an = "iv-tick";
  ivSlide.append(ivTop, ivInput, ivFoot);
  sliders.append(dateSlide, ivSlide);
  card.append(sliders);

  const greeks = el("div", "an-greeks");
  greeks.innerHTML = "";
  greeks.append(
    el("span", ""),
    el("span", ""),
    el("span", ""),
    el("span", ""),
    el("span", "an-at", ""),
  );
  const [dEl, tEl, vEl, pEl, atEl] = greeks.children;
  dEl.dataset.an = "delta";
  tEl.dataset.an = "theta";
  vEl.dataset.an = "vega";
  pEl.dataset.an = "pnl";
  atEl.dataset.an = "at";
  card.append(greeks);

  const hint = el("p", "an-hint", "");
  hint.dataset.an = "hint";
  card.append(hint);

  const foot = el("p", "an-foot", "");
  foot.dataset.an = "foot";
  card.append(foot);

  root.replaceChildren(card);
  return { card, symbol, short, long, expiry, dateInput, ivInput, chart };
}

function viewOf(state) {
  const { marks, daysLeft, iv, cursor } = state;
  const shortK = marks.short.strike;
  const longK = marks.long.strike;
  const credit = marks.credits.credit;
  const stats = spreadStats(shortK, longK, credit);
  const years = yearFraction(daysLeft);
  const currentIv = marks.short.iv ?? iv;
  const shortIv = shiftIv(marks.short.iv ?? iv, currentIv, iv);
  const longIv = shiftIv(marks.long.iv ?? iv, currentIv, iv);
  const domain = priceDomain(marks.underlying.spot, shortK, longK);
  const xStep = domain.max - domain.min > 80 ? 10 : 5;
  const spots = sampleSpots(domain.min, domain.max);
  const exp = spots.map((s) => ({ s, v: expirationPnL(s, shortK, longK, credit) }));
  const now = spots.map((s) => ({ s, v: markPnL(s, shortK, longK, years, shortIv, longIv, credit) }));
  const at = cursor ?? marks.underlying.spot;
  const greeks = positionGreeks(at, shortK, longK, years, shortIv, longIv);
  const pnl = markPnL(at, shortK, longK, years, shortIv, longIv, credit);
  const nowVals = now.map((point) => point.v);
  const yLo = Math.min(-stats.maxLoss, ...nowVals);
  const yHi = Math.max(stats.maxGain, ...nowVals);
  return {
    symbol: marks.symbol,
    spot: marks.underlying.spot,
    shortK,
    longK,
    credit,
    maxGain: stats.maxGain,
    maxLoss: -stats.maxLoss,
    breakeven: stats.breakeven,
    xMin: domain.min,
    xMax: domain.max,
    xStep,
    yMin: yLo - Math.abs(yLo) * 0.08,
    yMax: yHi + Math.abs(yHi) * 0.14,
    exp,
    now,
    cursor: at,
    stats,
    greeks,
    pnl,
    years,
    shortIv,
    longIv,
  };
}

function paint(ui, state) {
  const view = viewOf(state);
  const { marks } = state;
  const q = (name) => ui.card.querySelector(`[data-an="${name}"]`);
  ui.symbol.value = marks.symbol;
  ui.short.value = String(marks.short.strike);
  ui.long.value = String(marks.long.strike);
  ui.expiry.value = marks.expiration;
  q("credit-leg").textContent = money(view.credit);
  q("edit").textContent = marks.preview ? "PREVIEW · Editable" : "Editable";
  q("edit").classList.toggle("is-preview", marks.preview);
  q("chip").replaceChildren(
    document.createTextNode("Credit collected "),
    el("strong", "", money(view.credit)),
    document.createTextNode(`  (= max gain ${money(view.stats.maxGain, 0)})`),
  );

  const today = chicagoYmd();
  const daysTotal = Math.max(0, calendarDays(today, marks.expiration));
  ui.dateInput.min = "0";
  ui.dateInput.max = String(daysTotal);
  ui.dateInput.value = String(Math.max(0, daysTotal - state.daysLeft));
  fillTrack(ui.dateInput);
  q("days").textContent = state.daysLeft === 0 ? "0 days left · 0DTE" : `${state.daysLeft} day${state.daysLeft === 1 ? "" : "s"} left · ${formatWeekday(addDays(today, daysTotal - state.daysLeft), false)}`;
  q("today").textContent = `Today · ${formatWeekday(today)}`;

  const ivBps = Math.round(state.iv * 1000);
  ui.ivInput.min = String(Math.round(IV_LOW * 1000));
  ui.ivInput.max = String(Math.round(IV_HIGH * 1000));
  ui.ivInput.value = String(ivBps);
  fillTrack(ui.ivInput);
  q("iv-now").textContent = `${(state.iv * 100).toFixed(1)}%`;
  q("iv-tick").textContent = `current ${(state.iv * 100).toFixed(0)}%`;

  const setGreek = (node, label, text, value) => {
    node.className = tone(value);
    node.replaceChildren(el("span", "an-greek-lbl", label), document.createTextNode(text));
  };
  const deltaAbs = Math.abs(view.greeks.delta).toFixed(2);
  const deltaSign = view.greeks.delta < 0 ? "−" : view.greeks.delta > 0 ? "+" : "";
  setGreek(q("delta"), "Δ", ` ${deltaSign}${deltaAbs}`, view.greeks.delta);
  setGreek(q("theta"), "Θ", ` ${pnlText(view.greeks.theta)}/day`, view.greeks.theta);
  setGreek(q("vega"), "ν", ` ${pnlText(view.greeks.vega)}/IV pt`, view.greeks.vega);
  setGreek(q("pnl"), "PnL", ` ${pnlText(view.pnl)}`, view.pnl);
  q("at").textContent = `at ${marks.symbol} ${money(view.cursor)}`;

  q("hint").textContent = marks.preview
    ? "Move your pointer across the chart to check P/L at any underlying price. Greeks per contract · desk math · PREVIEW."
    : "Move your pointer across the chart to check P/L at any underlying price. Greeks per contract · live marks.";
  q("foot").replaceChildren();
  q("foot").append(
    el("span", "", "Max gain = credit "),
    el("strong", "", money(view.stats.maxGain, 0)),
    el("span", "", " · Max loss = width − credit "),
    el("strong", "", money(view.stats.maxLoss, 0)),
    el("span", "", " · BE = short strike + credit "),
    el("strong", "", money(view.stats.breakeven)),
  );

  view.onCursor = (spot) => {
    if (Math.abs(spot - state.cursor) < 0.05) return;
    state.cursor = spot;
    paint(ui, state);
  };
  drawChart(ui.chart, view);
}

async function reload(state, ui, request) {
  try {
    const marks = await loadAnalyzerMarks(request);
    state.marks = marks;
    const today = chicagoYmd();
    const total = Math.max(0, calendarDays(today, marks.expiration));
    state.daysLeft = Math.round(total / 2);
    state.iv = marks.short.iv ?? (IV_LOW + IV_HIGH) / 2;
    state.cursor = marks.underlying.spot;
    paint(ui, state);
  } catch (error) {
    console.error(error);
    ui.card.querySelector('[data-an="hint"]').textContent = "Marks could not be loaded right now. Refresh to try again.";
  }
}

export function mountAnalyzer(root = document.getElementById("hub-analyzer")) {
  if (!root || root.dataset.anReady) return;
  root.dataset.anReady = "1";
  const ui = buildCard(root);
  const state = { marks: null, daysLeft: 0, iv: 0.21, cursor: 0 };

  const apply = () => {
    if (!state.marks) return;
    paint(ui, state);
  };

  ui.dateInput.addEventListener("input", () => {
    const total = Number(ui.dateInput.max);
    state.daysLeft = total - Number(ui.dateInput.value);
    apply();
  });
  ui.ivInput.addEventListener("input", () => {
    state.iv = Number(ui.ivInput.value) / 1000;
    apply();
  });

  const retarget = () => {
    const symbol = ui.symbol.value.trim().toUpperCase() || "SPY";
    const shortStrike = Number(ui.short.value);
    const longStrike = Number(ui.long.value);
    const expiration = ui.expiry.value;
    if (!(shortStrike > 0 && longStrike > shortStrike && expiration)) return;
    reload(state, ui, { symbol, shortStrike, longStrike, expiration });
  };
  for (const input of [ui.symbol, ui.short, ui.long, ui.expiry]) {
    input.addEventListener("change", retarget);
  }

  new ResizeObserver(() => {
    if (state.marks) drawChart(ui.chart, { ...viewOf(state), onCursor: (spot) => { state.cursor = spot; paint(ui, state); } });
  }).observe(ui.chart);
  new MutationObserver(() => {
    if (state.marks) apply();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  let seeded = false;
  const applyMarks = (marks) => {
    const first = !seeded;
    seeded = true;
    state.marks = marks;
    if (first) {
      const today = chicagoYmd();
      const total = Math.max(0, calendarDays(today, marks.expiration));
      state.daysLeft = Math.round(total / 2);
      state.iv = marks.short.iv ?? (IV_LOW + IV_HIGH) / 2;
      state.cursor = marks.underlying.spot;
    }
    paint(ui, state);
  };

  loadAnalyzerMarksProgressive({}, applyMarks).catch((error) => {
    console.error(error);
    root.replaceChildren(el("p", "hint", "Marks could not be loaded right now. Refresh to try again."));
  });
}

onDeskReady(() => mountAnalyzer());
