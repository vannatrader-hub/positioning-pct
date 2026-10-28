/**
 * Trade-levels chart for a calling card: about six months of daily closes as
 * one line, with the lead option's strike and break-even drawn across it.
 * Drawn as SVG from the committed bars in public/data/flow/bars, so the page
 * needs no chart service and no account.
 */

const NS = "http://www.w3.org/2000/svg";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const DAY = 86400000;
const EXPIRY_REACH_DAYS = 80;

const COLORS = {
  grid: "rgba(255, 255, 255, 0.055)",
  axis: "#6b7280",
  price: "#22c55e",
  strike: "#f59e0b",
  breakeven: "#4ade80",
  expiry: "rgba(226, 232, 240, 0.42)",
  spot: "#e5e7eb",
  hover: "rgba(226, 232, 240, 0.5)",
};

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function utc(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function shortDate(isoDate, withYear = false) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return withYear ? `${MONTHS[month - 1]} ${day} '${String(year).slice(2)}` : `${MONTHS[month - 1]} ${day}`;
}

/** Standard monthly expiration: the third Friday of the month. */
export function thirdFriday(year, monthIndex) {
  const firstDay = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const firstFriday = 1 + ((5 - firstDay + 7) % 7);
  return iso(new Date(Date.UTC(year, monthIndex, firstFriday + 14)));
}

/** "December" → the next December monthly after the alert; "January 2028" → that month. */
export function resolveExpiry(text, alertDate) {
  const match = /^([A-Za-z]+)(?:\s+(\d{4}))?$/.exec((text ?? "").trim());
  if (!match) return null;
  const month = MONTHS_LONG.indexOf(match[1].toLowerCase());
  if (month < 0) return null;
  const year = match[2] ? Number(match[2]) : Number(alertDate.slice(0, 4));
  const date = thirdFriday(year, month);
  if (!match[2] && date < alertDate) return thirdFriday(year + 1, month);
  return date;
}

/** Calls: strike + premium. Puts: strike − premium. Unknown premium: no break-even. */
export function breakeven(lead) {
  if (lead.price === null || lead.price === undefined) return null;
  const value = lead.type === "put" ? lead.strike - lead.price : lead.strike + lead.price;
  return Math.round(value * 100) / 100;
}

export function sixMonths(bars) {
  const last = new Date(utc(bars[bars.length - 1].t));
  const from = iso(new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() - 6, last.getUTCDate())));
  return bars.filter((bar) => bar.t >= from);
}

export function niceTicks(lo, hi, target = 5) {
  const span = hi - lo || 1;
  const raw = span / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((value) => value >= raw);
  const ticks = [];
  for (let value = Math.ceil(lo / step) * step; value <= hi + 1e-9; value += step) {
    ticks.push(Math.round(value * 1e6) / 1e6);
  }
  return ticks;
}

export function usd(value) {
  return `$${value.toFixed(2)}`;
}

function node(tag, attrs = {}, text) {
  const item = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) item.setAttribute(key, String(value));
  if (text !== undefined) item.textContent = text;
  return item;
}

/**
 * Levels a card draws. `expiryInView` is set when expiry lands close enough
 * after the last bar to extend the time axis and mark it.
 */
export function chartLevels(play, bars) {
  const window = sixMonths(bars);
  const lead = play.lead;
  const expiry = resolveExpiry(lead.expiry, play.date);
  const last = window[window.length - 1];
  const expiryInView = Boolean(expiry) && utc(expiry) - utc(last.t) <= EXPIRY_REACH_DAYS * DAY && expiry > last.t;
  return {
    window,
    strike: lead.strike,
    breakeven: breakeven(lead),
    expiry,
    expiryInView,
    spot: last.c,
    spotDate: last.t,
  };
}

/** Draws the chart into `host` and keeps it sized to the host. Returns an unmount function. */
export function mountLevels(host, play, bars) {
  const levels = chartLevels(play, bars);
  const { window: series, strike, breakeven: be, expiry, expiryInView, spot } = levels;
  const svg = node("svg", { class: "tl-svg", role: "img" });
  const summary = [
    `${play.ticker} daily closes, ${shortDate(series[0].t, true)} to ${shortDate(levels.spotDate, true)}.`,
    `Spot ${usd(spot)}. Strike ${usd(strike)}.`,
    be === null ? "" : `Break-even ${usd(be)}.`,
  ];
  svg.setAttribute("aria-label", summary.join(" ").trim());
  host.replaceChildren(svg);

  let hoverLayer = null;
  let geometry = null;

  const draw = () => {
    const width = Math.round(host.clientWidth);
    const height = Math.round(host.clientHeight);
    if (!width || !height) return;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.replaceChildren();

    const pad = { top: 16, right: 14, bottom: 26, left: 48 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const t0 = utc(series[0].t);
    const lastT = utc(series[series.length - 1].t);
    const t1 = expiryInView ? utc(expiry) + 6 * DAY : lastT + 3 * DAY;
    const closes = series.map((bar) => bar.c);
    const marks = [strike, ...(be === null ? [] : [be])];
    let lo = Math.min(...closes, ...marks);
    let hi = Math.max(...closes, ...marks);
    const margin = (hi - lo) * 0.08 || 1;
    lo -= margin;
    hi += margin;

    const x = (t) => pad.left + ((t - t0) / (t1 - t0)) * plotW;
    const y = (value) => pad.top + (1 - (value - lo) / (hi - lo)) * plotH;
    const right = pad.left + plotW;

    const grid = node("g", { class: "tl-grid" });
    for (const tick of niceTicks(lo, hi, Math.max(3, Math.round(plotH / 70)))) {
      const ty = y(tick);
      grid.append(node("line", { x1: pad.left, x2: right, y1: ty, y2: ty, stroke: COLORS.grid }));
      grid.append(
        node("text", { x: pad.left - 8, y: ty + 3.5, "text-anchor": "end", fill: COLORS.axis, class: "tl-axis" }, `$${tick % 1 ? tick.toFixed(1) : tick}`),
      );
    }
    const firstMonth = new Date(t0);
    const minGap = 46;
    let lastLabelX = -Infinity;
    for (let month = new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + 1, 1)); month.getTime() <= t1; month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1))) {
      const tx = x(month.getTime());
      if (tx - lastLabelX < minGap) continue;
      lastLabelX = tx;
      grid.append(node("line", { x1: tx, x2: tx, y1: pad.top, y2: pad.top + plotH, stroke: COLORS.grid }));
      grid.append(
        node("text", { x: tx, y: height - 8, "text-anchor": "middle", fill: COLORS.axis, class: "tl-axis" }, MONTHS[month.getUTCMonth()]),
      );
    }
    svg.append(grid);

    if (expiryInView) {
      const ex = x(utc(expiry));
      svg.append(
        node("line", { x1: ex, x2: ex, y1: pad.top, y2: pad.top + plotH, stroke: COLORS.expiry, "stroke-dasharray": "3 4", "stroke-width": 1 }),
        node("text", { x: ex - 5, y: pad.top + 10, "text-anchor": "end", fill: COLORS.expiry, class: "tl-tag" }, `Exp ${shortDate(expiry)}`),
      );
    }

    const placed = [];
    const levelLine = (value, color, label, above, dash) => {
      const ly = y(value);
      svg.append(
        node("line", { x1: pad.left, x2: right, y1: ly, y2: ly, stroke: color, "stroke-width": 1.4, "stroke-dasharray": dash ?? "none", opacity: 0.95 }),
      );
      const ty = above ? ly - 6 : ly + 14;
      placed.push(ty);
      svg.append(node("text", { x: right - 4, y: ty, "text-anchor": "end", fill: color, class: "tl-tag" }, label));
    };
    const strikeAbove = be === null ? y(strike) - pad.top > 22 : strike >= be;
    levelLine(strike, COLORS.strike, `Strike ${usd(strike)}`, strikeAbove, "6 5");
    if (be !== null) levelLine(be, COLORS.breakeven, `B/E ${usd(be)}`, be > strike);

    const points = series.map((bar) => `${x(utc(bar.t)).toFixed(1)},${y(bar.c).toFixed(1)}`);
    svg.append(
      node("polyline", {
        points: points.join(" "),
        fill: "none",
        stroke: COLORS.price,
        "stroke-width": 2,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      }),
    );

    const sx = x(lastT);
    const sy = y(spot);
    let labelY = sy - 9;
    if (placed.some((ty) => Math.abs(ty - labelY) < 13)) labelY = sy + 17;
    if (placed.some((ty) => Math.abs(ty - labelY) < 13)) labelY = sy - 22;
    svg.append(
      node("circle", { cx: sx, cy: sy, r: 6, fill: COLORS.price, opacity: 0.22 }),
      node("circle", { cx: sx, cy: sy, r: 3, fill: COLORS.price }),
      node("text", { x: sx - 8, y: labelY, "text-anchor": "end", fill: COLORS.spot, class: "tl-tag" }, `Spot ${usd(spot)}`),
    );

    hoverLayer = node("g", { class: "tl-hover", visibility: "hidden" });
    hoverLayer.append(
      node("line", { y1: pad.top, y2: pad.top + plotH, stroke: COLORS.hover, "stroke-dasharray": "2 3" }),
      node("circle", { r: 3.5, fill: "#0b0d12", stroke: COLORS.price, "stroke-width": 2 }),
      node("rect", { rx: 7, height: 22, fill: "rgba(17, 21, 28, 0.94)", stroke: "rgba(255,255,255,0.1)" }),
      node("text", { fill: "#e5e7eb", class: "tl-tag" }),
    );
    svg.append(hoverLayer);
    geometry = { x, y, pad, plotW, plotH, width };
  };

  const hover = (event) => {
    if (!geometry || !hoverLayer) return;
    const box = svg.getBoundingClientRect();
    const px = event.clientX - box.left;
    const { x, y, pad, plotW } = geometry;
    if (px < pad.left || px > pad.left + plotW) {
      hoverLayer.setAttribute("visibility", "hidden");
      return;
    }
    let best = series[0];
    for (const bar of series) if (Math.abs(x(utc(bar.t)) - px) < Math.abs(x(utc(best.t)) - px)) best = bar;
    const hx = x(utc(best.t));
    const hy = y(best.c);
    const [line, dot, rect, text] = hoverLayer.children;
    line.setAttribute("x1", hx);
    line.setAttribute("x2", hx);
    dot.setAttribute("cx", hx);
    dot.setAttribute("cy", hy);
    text.textContent = `${shortDate(best.t, true)} · ${usd(best.c)}`;
    const textW = text.textContent.length * 6.4 + 14;
    const left = Math.min(Math.max(hx - textW / 2, pad.left), pad.left + plotW - textW);
    rect.setAttribute("x", left);
    rect.setAttribute("y", pad.top - 2);
    rect.setAttribute("width", textW);
    text.setAttribute("x", left + 7);
    text.setAttribute("y", pad.top + 13);
    hoverLayer.setAttribute("visibility", "visible");
  };
  const leave = () => hoverLayer?.setAttribute("visibility", "hidden");

  svg.addEventListener("pointermove", hover);
  svg.addEventListener("pointerleave", leave);
  const observer = new ResizeObserver(draw);
  observer.observe(host);
  draw();

  return () => {
    observer.disconnect();
    host.replaceChildren();
  };
}
