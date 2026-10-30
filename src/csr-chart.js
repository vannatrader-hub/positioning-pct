/**
 * Credit Spread Regime pane: Z line with glow, zone fills, threshold lines,
 * per-session regime tint, mean-reversion markers, and an SPX close overlay.
 * Canvas, so a few hundred per-session colors stay cheap to redraw on hover.
 */
import { CSR_COLORS, bgAlpha, zColor } from "./csr.js";

const FONT = '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif';
const AXIS_RIGHT = 66;
const AXIS_BOTTOM = 28;
const MARKER_ROW = 30;
const RIGHT_PAD = 0.07;
const MIN_BARS = 30;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const rgba = (rgb, alpha = 1) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
const minus = (text) => text.replace(/^-/, "−");

function parseDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Session dates past the last print, weekdays only, so the time axis can run into the right margin. */
function futureDays(lastIso, count) {
  const out = [];
  const day = parseDay(lastIso);
  while (out.length < count) {
    day.setUTCDate(day.getUTCDate() + 1);
    if (day.getUTCDay() % 6) out.push(new Date(day));
  }
  return out;
}

export function crosshairDate(date) {
  return `${DAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} '${String(date.getUTCFullYear()).slice(2)}`;
}

function niceStep(span, slots) {
  const raw = span / Math.max(1, slots);
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const mult of [1, 2, 2.5, 4, 5, 10]) if (mult * mag >= raw) return mult * mag;
  return 10 * mag;
}

export function createCsrChart(frame, { onHover } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "csr-canvas";
  canvas.tabIndex = 0;
  frame.prepend(canvas);
  const ctx = canvas.getContext("2d");

  let series = null;
  let showSpx = true;
  let view = null;
  let hover = null;
  let pointerY = null;
  let drag = null;
  let width = 0;
  let height = 0;
  let dates = [];
  let future = [];
  let frameRequest = 0;

  const lastIndex = () => series.t.length - 1;
  const span = () => view.to - view.from;

  function fullView() {
    const first = series.first;
    const bars = lastIndex() - first + 1;
    return { from: first - 0.5, to: lastIndex() + 0.5 + bars * RIGHT_PAD };
  }

  function rangeView(bars) {
    if (!bars) return fullView();
    const last = lastIndex();
    const from = Math.max(series.first, last - bars + 1) - 0.5;
    const visible = last + 0.5 - from;
    return { from, to: last + 0.5 + visible * RIGHT_PAD };
  }

  function clampView(next) {
    const full = fullView();
    let { from, to } = next;
    const fullSpan = full.to - full.from;
    let size = Math.min(Math.max(to - from, MIN_BARS), fullSpan * 1.15);
    if (from < full.from) from = full.from;
    to = from + size;
    const maxTo = full.to + (to - from) * 0.4;
    if (to > maxTo) {
      to = maxTo;
      from = to - size;
    }
    if (from < full.from) from = full.from;
    return { from, to };
  }

  function geometry() {
    const left = 0;
    const right = width - AXIS_RIGHT;
    const top = 0;
    const bottom = height - AXIS_BOTTOM;
    const bw = (right - left) / span();
    const x = (i) => left + (i - view.from) * bw;
    const lo = Math.max(series.first, Math.floor(view.from));
    const hi = Math.min(lastIndex(), Math.ceil(view.to));
    let zMin = series.params.base;
    let zMax = series.params.stress;
    for (let i = lo; i <= hi; i += 1) {
      const z = series.z[i];
      if (z === null) continue;
      if (z < zMin) zMin = z;
      if (z > zMax) zMax = z;
    }
    const pad = (zMax - zMin) * 0.06;
    zMin -= pad;
    zMax += pad;
    const plotTop = top + MARKER_ROW;
    const y = (z) => bottom - ((z - zMin) / (zMax - zMin)) * (bottom - plotTop);
    const zAt = (py) => zMin + ((bottom - py) / (bottom - plotTop)) * (zMax - zMin);
    let sMin = Infinity;
    let sMax = -Infinity;
    for (let i = lo; i <= hi; i += 1) {
      const v = series.spx[i];
      if (v < sMin) sMin = v;
      if (v > sMax) sMax = v;
    }
    const sPad = (sMax - sMin) * 0.08 || 1;
    const sy = (v) => bottom - 6 - ((v - (sMin - sPad)) / (sMax - sMin + 2 * sPad)) * (bottom - plotTop - 6);
    return { left, right, top, bottom, plotTop, bw, x, y, zAt, lo, hi, zMin, zMax, sy, sMin, sMax };
  }

  function dateAt(i) {
    if (i <= lastIndex()) return dates[i];
    return future[i - lastIndex() - 1] ?? null;
  }

  function drawBackground(g) {
    let current = "";
    const last = lastIndex();
    for (let i = g.lo; i <= g.hi; i += 1) {
      const z = series.z[i];
      if (z === null) continue;
      const style = rgba(zColor(z, series.params), bgAlpha(z, series.params));
      if (style !== current) {
        ctx.fillStyle = style;
        current = style;
      }
      const x0 = Math.floor(g.x(i - 0.5));
      const x1 = i === last ? g.x(i + 0.5) : Math.ceil(g.x(i + 0.5));
      ctx.fillRect(x0, g.top, Math.max(1, x1 - x0), g.bottom - g.top);
    }
  }

  function zoneSpan(g) {
    const x0 = Math.max(g.left, g.x(series.first - 0.5));
    const x1 = Math.min(g.right, g.x(lastIndex() + 0.5));
    return [x0, x1];
  }

  function drawZones(g) {
    const p = series.params;
    const { bull, bear, neutral } = CSR_COLORS;
    const [x0, x1] = zoneSpan(g);
    if (x1 <= x0) return;
    const band = (hi, lo, color) => {
      const top = g.y(hi);
      ctx.fillStyle = color;
      ctx.fillRect(x0, top, x1 - x0, g.y(lo) - top);
    };
    band(p.stress, p.elevated, rgba(bear, 0.1));
    band(p.elevated, p.low, rgba(neutral, 0.07));
    band(p.low, p.base, rgba(bull, 0.1));
  }

  function hLine(g, value, color, dash) {
    const [x0, x1] = dash ? [g.left, g.right] : zoneSpan(g);
    if (x1 <= x0) return;
    const yy = Math.round(g.y(value)) + 0.5;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(x0, yy);
    ctx.lineTo(x1, yy);
    ctx.stroke();
    ctx.restore();
  }

  function drawLevels(g) {
    const p = series.params;
    const { bull, bear, neutral } = CSR_COLORS;
    hLine(g, 0, rgba(neutral, 0.5), [4, 4]);
    hLine(g, p.stress, rgba(bear, 0.5));
    hLine(g, p.elevated, rgba(bear, 0.3));
    hLine(g, p.low, rgba(bull, 0.3));
    hLine(g, p.stress, rgba(bear, 0.4));
    hLine(g, -p.stress, rgba(bull, 0.4));
  }

  function drawSpx(g) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.left, g.plotTop, g.right - g.left, g.bottom - g.plotTop);
    ctx.clip();
    ctx.beginPath();
    for (let i = Math.max(0, g.lo - 1); i <= Math.min(lastIndex(), g.hi + 1); i += 1) {
      const px = g.x(i);
      const py = g.sy(series.spx[i]);
      if (i === Math.max(0, g.lo - 1)) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = "rgba(214, 220, 230, 0.42)";
    ctx.lineWidth = 1.25;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.font = `10.5px ${FONT}`;
    ctx.fillStyle = "rgba(214, 220, 230, 0.5)";
    ctx.textBaseline = "middle";
    const step = niceStep(g.sMax - g.sMin, 3);
    for (let v = Math.ceil(g.sMin / step) * step; v <= g.sMax; v += step) {
      const py = g.sy(v);
      if (py < g.plotTop + 8 || py > g.bottom - 8) continue;
      ctx.fillText(Math.round(v).toLocaleString("en-US"), g.left + 6, py);
    }
    ctx.restore();
  }

  function drawLine(g) {
    const layers = [
      [12, 0.1],
      [8, 0.15],
      [5, 0.25],
      [3, 0.5],
      [2, 1],
    ];
    const from = Math.max(series.first, g.lo - 1);
    const to = Math.min(lastIndex(), g.hi + 1);
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.left, g.top, g.right - g.left, g.bottom - g.top);
    ctx.clip();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [lineWidth, alpha] of layers) {
      ctx.lineWidth = lineWidth;
      let style = "";
      let open = false;
      for (let i = from + 1; i <= to; i += 1) {
        const next = rgba(zColor(series.z[i], series.params), alpha);
        if (next !== style) {
          if (open) ctx.stroke();
          ctx.strokeStyle = next;
          style = next;
          ctx.beginPath();
          ctx.moveTo(g.x(i - 1), g.y(series.z[i - 1]));
          open = true;
        }
        ctx.lineTo(g.x(i), g.y(series.z[i]));
      }
      if (open) ctx.stroke();
    }
    ctx.restore();
  }

  function drawMarkers(g) {
    const { bull, bear } = CSR_COLORS;
    const yy = g.top + MARKER_ROW / 2;
    const r = Math.max(2.5, Math.min(4, g.bw * 0.45));
    for (let i = g.lo; i <= g.hi; i += 1) {
      const px = g.x(i);
      if (px < g.left || px > g.right) continue;
      if (series.sell[i]) {
        ctx.fillStyle = rgba(bear);
        ctx.beginPath();
        ctx.arc(px, yy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (series.buy[i]) {
        ctx.strokeStyle = rgba(bull);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px - r, yy);
        ctx.lineTo(px + r, yy);
        ctx.moveTo(px, yy - r);
        ctx.lineTo(px, yy + r);
        ctx.stroke();
      }
    }
  }

  function drawPriceAxis(g) {
    ctx.save();
    ctx.font = `12px ${FONT}`;
    ctx.fillStyle = "#b2b5be";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const step = niceStep(g.zMax - g.zMin, Math.max(3, Math.floor((g.bottom - g.plotTop) / 46)));
    for (let v = Math.ceil(g.zMin / step) * step; v <= g.zMax + 1e-9; v += step) {
      const py = g.y(v);
      if (py < 8 || py > g.bottom - 6) continue;
      const text = Math.abs(v) < 1e-9 ? "0.000" : minus(v.toFixed(3));
      ctx.fillText(text, g.right + 10, py);
    }
    ctx.restore();
  }

  function timeTicks(g) {
    const ticks = [];
    let prev = null;
    const from = Math.max(series.first, Math.ceil(view.from));
    const to = Math.floor(view.to);
    for (let i = from; i <= to; i += 1) {
      const date = dateAt(i);
      if (!date) continue;
      const key = date.getUTCFullYear() * 12 + date.getUTCMonth();
      if (prev !== null && key !== prev) ticks.push({ i, date, key });
      prev = key;
    }
    const pxPerMonth = (g.right - g.left) / Math.max(1, ticks.length + 1);
    const every = [1, 2, 3, 6, 12].find((n) => pxPerMonth * n >= 52) ?? 12;
    return ticks.filter((tick) => tick.date.getUTCMonth() % every === 0);
  }

  function drawTimeAxis(g) {
    ctx.save();
    ctx.font = `12px ${FONT}`;
    ctx.fillStyle = "#b2b5be";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const yy = g.bottom + AXIS_BOTTOM / 2 + 1;
    for (const tick of timeTicks(g)) {
      const px = g.x(tick.i);
      if (px < 18 || px > g.right - 14) continue;
      const month = tick.date.getUTCMonth();
      ctx.fillText(month === 0 ? String(tick.date.getUTCFullYear()) : MONTHS[month], px, yy);
    }
    ctx.restore();
  }

  function tag(text, cx, cy, align) {
    ctx.save();
    ctx.font = `12px ${FONT}`;
    const w = ctx.measureText(text).width + 12;
    const h = 20;
    let x0 = align === "center" ? cx - w / 2 : cx;
    x0 = Math.max(0, Math.min(width - w, x0));
    ctx.fillStyle = "#363a45";
    ctx.beginPath();
    ctx.roundRect(x0, cy - h / 2, w, h, 3);
    ctx.fill();
    ctx.fillStyle = "#f0f3fa";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x0 + 6, cy + 0.5);
    ctx.restore();
  }

  function drawCrosshair(g) {
    if (hover === null) return;
    const px = Math.round(g.x(hover)) + 0.5;
    ctx.save();
    ctx.strokeStyle = "rgba(150, 155, 168, 0.75)";
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, g.top);
    ctx.lineTo(px, g.bottom);
    if (pointerY !== null) {
      const py = Math.round(pointerY) + 0.5;
      ctx.moveTo(g.left, py);
      ctx.lineTo(g.right, py);
    }
    ctx.stroke();
    ctx.restore();
    const z = series.z[hover];
    if (z !== null) {
      ctx.fillStyle = rgba(zColor(z, series.params));
      ctx.beginPath();
      ctx.arc(g.x(hover), g.y(z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (pointerY !== null) tag(minus(g.zAt(pointerY).toFixed(3)), g.right + 4, pointerY, "left");
    const date = dateAt(hover);
    if (date) tag(crosshairDate(date), g.x(hover), g.bottom + AXIS_BOTTOM / 2, "center");
  }

  function draw() {
    frameRequest = 0;
    if (!series || !width || !height) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    const g = geometry();
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.left, g.top, g.right - g.left, g.bottom - g.top);
    ctx.clip();
    drawBackground(g);
    if (showSpx) drawSpx(g);
    drawZones(g);
    drawLevels(g);
    ctx.restore();
    drawLine(g);
    drawMarkers(g);
    drawPriceAxis(g);
    drawTimeAxis(g);
    drawCrosshair(g);
  }

  function schedule() {
    if (!frameRequest) frameRequest = requestAnimationFrame(draw);
  }

  function resize() {
    const box = frame.getBoundingClientRect();
    width = Math.round(box.width);
    height = Math.round(box.height);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    draw();
  }

  function indexAt(clientX) {
    const box = canvas.getBoundingClientRect();
    const px = clientX - box.left;
    if (px > width - AXIS_RIGHT) return null;
    const i = Math.round(view.from + px / ((width - AXIS_RIGHT) / span()));
    return Math.max(series.first, Math.min(lastIndex(), i));
  }

  function setHover(i, y) {
    hover = i;
    pointerY = y;
    onHover?.(i);
    schedule();
  }

  canvas.addEventListener("pointermove", (event) => {
    const box = canvas.getBoundingClientRect();
    if (drag) {
      const bw = (width - AXIS_RIGHT) / span();
      const shift = (drag.x - event.clientX) / bw;
      view = clampView({ from: drag.view.from + shift, to: drag.view.to + shift });
    }
    const y = event.clientY - box.top;
    setHover(indexAt(event.clientX), y < height - AXIS_BOTTOM ? y : null);
  });

  canvas.addEventListener("pointerleave", () => {
    if (!drag) setHover(null, null);
  });

  canvas.addEventListener("pointerdown", (event) => {
    canvas.focus({ preventScroll: true });
    frame.dataset.active = "1";
    drag = { x: event.clientX, view: { ...view } };
    canvas.setPointerCapture(event.pointerId);
    frame.classList.add("is-dragging");
  });

  const endDrag = () => {
    drag = null;
    frame.classList.remove("is-dragging");
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener(
    "wheel",
    (event) => {
      if (frame.dataset.active !== "1") return;
      event.preventDefault();
      const box = canvas.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / (width - AXIS_RIGHT)));
      const anchor = view.from + ratio * span();
      const factor = Math.exp(Math.sign(event.deltaY) * Math.min(Math.abs(event.deltaY), 120) * 0.0022);
      const size = span() * factor;
      view = clampView({ from: anchor - ratio * size, to: anchor + (1 - ratio) * size });
      schedule();
    },
    { passive: false },
  );

  canvas.addEventListener("blur", () => {
    delete frame.dataset.active;
  });

  canvas.addEventListener("dblclick", () => api.reset());

  canvas.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 21 : 1;
    const at = hover ?? lastIndex();
    if (event.key === "ArrowLeft") setHover(Math.max(series.first, at - step), null);
    else if (event.key === "ArrowRight") setHover(Math.min(lastIndex(), at + step), null);
    else if (event.key === "Home") setHover(series.first, null);
    else if (event.key === "End") setHover(lastIndex(), null);
    else if (event.key === "Escape") setHover(null, null);
    else if (event.key === "+" || event.key === "=" || event.key === "-") {
      const size = span() * (event.key === "-" ? 1.25 : 0.8);
      const anchor = hover ?? lastIndex();
      view = clampView({ from: anchor - size * 0.75, to: anchor + size * 0.25 });
      schedule();
    } else return;
    event.preventDefault();
  });

  new ResizeObserver(resize).observe(frame);

  let range = 0;
  const api = {
    setSeries(next, { keepView = false } = {}) {
      series = next;
      dates = series.t.map(parseDay);
      future = futureDays(series.t[series.t.length - 1], Math.ceil(series.t.length * 0.6));
      if (!keepView || !view) view = rangeView(range);
      schedule();
    },
    setRange(bars) {
      range = bars;
      view = rangeView(bars);
      schedule();
    },
    setSpx(on) {
      showSpx = on;
      schedule();
    },
    reset() {
      view = rangeView(range);
      schedule();
    },
    redraw: schedule,
  };
  if (frame.isConnected) requestAnimationFrame(resize);
  return api;
}
