/**
 * SVG drawers for the Positioning % charts, on the Desk light theme.
 * Each plot redraws at its host's size, so axis text stays crisp at any width.
 */

import { niceTicks } from "./flow-chart.js";

const NS = "http://www.w3.org/2000/svg";

export const TONE = {
  xsoft: "#1f6e43",
  soft: "#2f8a55",
  softLight: "#7cb995",
  mid: "#aeb3bc",
  crowded: "#e91e8c",
  ink: "#0b0d12",
  ink2: "#2c313a",
  muted: "#5f6672",
  faint: "#8b919c",
  grid: "rgba(15, 20, 30, 0.07)",
  bandSoft: "rgba(47, 138, 85, 0.08)",
  bandXsoft: "rgba(47, 138, 85, 0.14)",
  bandMid: "rgba(15, 20, 30, 0.025)",
  bandCrowded: "rgba(233, 30, 140, 0.07)",
};

export const OVERLAY_COLORS = ["#4a6cf7", "#d97706", "#0e9384", "#7c3aed", "#64748b"];

export function svg(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Mounts a responsive plot. `draw(root, spec, width, height)` paints the
 * current spec and may return pointer hooks ({ move, leave, click }).
 * Returns an update function that takes the next spec.
 */
export function mountPlot(host, draw) {
  const root = svg("svg", { class: "pc-svg", role: "img" });
  host.replaceChildren(root);
  let spec = null;
  let hooks = {};

  const paint = () => {
    const width = Math.round(host.clientWidth);
    const height = Math.round(host.clientHeight);
    if (!spec || width < 160 || height < 60) return;
    root.setAttribute("viewBox", `0 0 ${width} ${height}`);
    root.setAttribute("width", width);
    root.setAttribute("height", height);
    root.replaceChildren();
    hooks = draw(root, spec, width, height) ?? {};
  };

  const local = (event) => {
    const box = root.getBoundingClientRect();
    return [event.clientX - box.left, event.clientY - box.top];
  };
  root.addEventListener("pointermove", (event) => hooks.move?.(...local(event)));
  root.addEventListener("pointerleave", () => hooks.leave?.());
  root.addEventListener("click", (event) => hooks.click?.(...local(event)));
  new ResizeObserver(paint).observe(host);

  return (next) => {
    spec = next;
    if (spec.label) root.setAttribute("aria-label", spec.label);
    paint();
  };
}

function tooltip(root, bounds) {
  const layer = svg("g", { class: "pc-tip", visibility: "hidden", "pointer-events": "none" });
  const rule = svg("line", { y1: bounds.top, y2: bounds.bottom, stroke: TONE.faint, "stroke-dasharray": "2 3" });
  const box = svg("rect", { rx: 8, fill: TONE.ink, opacity: 0.94 });
  const text = svg("text", { class: "pc-tip-text", fill: "#fff" });
  layer.append(rule, box, text);
  root.append(layer);

  return {
    show(x, lines, { ruleOn = true } = {}) {
      rule.setAttribute("x1", x);
      rule.setAttribute("x2", x);
      rule.setAttribute("visibility", ruleOn ? "visible" : "hidden");
      text.replaceChildren(
        ...lines.map((line, index) =>
          svg("tspan", { x: 0, dy: index ? 15 : 0, "font-weight": index ? 500 : 700 }, line),
        ),
      );
      const width = Math.max(...lines.map((line) => line.length)) * 6.9 + 24;
      const height = lines.length * 15 + 12;
      const left = Math.min(Math.max(x - width / 2, bounds.left), bounds.right - width);
      box.setAttribute("x", left);
      box.setAttribute("y", bounds.top);
      box.setAttribute("width", width);
      box.setAttribute("height", height);
      text.setAttribute("transform", `translate(${left + 10} ${bounds.top + 18})`);
      for (const span of text.children) span.setAttribute("x", 0);
      layer.setAttribute("visibility", "visible");
    },
    hide() {
      layer.setAttribute("visibility", "hidden");
    },
  };
}

function weekAxis(root, labels, x, y0, plotW) {
  const every = plotW / labels.length < 46 ? 2 : 1;
  labels.forEach((label, index) => {
    const last = index === labels.length - 1;
    if (index % every && !last) return;
    if (every === 2 && !last && index === labels.length - 2) return;
    root.append(svg("text", { x: x(index), y: y0, "text-anchor": "middle", class: "pc-axis" }, label));
  });
}

/**
 * Weekly lines. spec: { labels, series: [{ values, color, label, area, dots, dash, width }],
 * week, domain, yFormat, bands: [{ from, to, fill, label }], guides: [{ value, label }],
 * tip(index) → lines, onPick(index), endLabels }
 */
export function drawLines(root, spec, width, height) {
  const { labels, series, week } = spec;
  const pad = { top: 12, right: spec.endLabels && width >= 360 ? 92 : 18, bottom: 26, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const all = series.flatMap((line) => line.values).concat((spec.guides ?? []).map((guide) => guide.value));
  let [lo, hi] = spec.domain ?? [Math.min(...all), Math.max(...all)];
  if (!spec.domain) {
    const margin = (hi - lo) * 0.14 || Math.abs(hi) * 0.1 || 1;
    lo -= margin;
    hi += margin;
  }
  const n = labels.length;
  const x = (index) => pad.left + (n === 1 ? plotW / 2 : (index / (n - 1)) * plotW);
  const y = (value) => pad.top + (1 - (value - lo) / (hi - lo)) * plotH;
  const right = pad.left + plotW;
  const bottom = pad.top + plotH;
  const fmt = spec.yFormat ?? ((value) => String(value));

  for (const band of spec.bands ?? []) {
    const top = y(Math.min(hi, band.to));
    const low = y(Math.max(lo, band.from));
    if (low <= top) continue;
    root.append(svg("rect", { x: pad.left, y: top, width: plotW, height: low - top, fill: band.fill }));
    if (band.label && low - top > 14) {
      root.append(svg("text", { x: pad.left + 6, y: top + 12, class: "pc-band", fill: band.ink ?? TONE.muted }, band.label));
    }
  }

  const ticks = spec.ticks ?? niceTicks(lo, hi, Math.max(3, Math.round(plotH / 46)));
  for (const tick of ticks) {
    if (tick < lo - 1e-9 || tick > hi + 1e-9) continue;
    const ty = y(tick);
    root.append(
      svg("line", { x1: pad.left, x2: right, y1: ty, y2: ty, stroke: TONE.grid }),
      svg("text", { x: pad.left - 8, y: ty + 3.5, "text-anchor": "end", class: "pc-axis" }, fmt(tick)),
    );
  }

  for (const guide of spec.guides ?? []) {
    if (guide.value < lo || guide.value > hi) continue;
    const gy = y(guide.value);
    root.append(
      svg("line", { x1: pad.left, x2: right, y1: gy, y2: gy, stroke: TONE.ink2, "stroke-width": 1.2, "stroke-dasharray": "5 4" }),
      svg("text", { x: right - 4, y: gy - 5, "text-anchor": "end", class: "pc-guide" }, guide.label),
    );
  }

  if (Number.isInteger(week)) {
    const from = Math.max(pad.left, x(week) - 14);
    const to = Math.min(right, x(week) + 14);
    root.append(svg("rect", { x: from, y: pad.top, width: to - from, height: plotH, rx: 6, fill: "rgba(74, 108, 247, 0.08)" }));
  }

  weekAxis(root, labels, x, height - 8, plotW);

  const endTags = [];
  for (const line of series) {
    const points = line.values.map((value, index) => [x(index), y(value)]);
    const path = points.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
    if (line.area) {
      const base = y(Math.max(lo, Math.min(hi, line.areaBase ?? lo)));
      root.append(
        svg("polygon", {
          points: `${points[0][0].toFixed(1)},${base} ${path} ${points[points.length - 1][0].toFixed(1)},${base}`,
          fill: line.color,
          opacity: 0.1,
        }),
      );
    }
    root.append(
      svg("polyline", {
        points: path,
        fill: "none",
        stroke: line.color,
        "stroke-width": line.width ?? 2.2,
        "stroke-dasharray": line.dash ?? null,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      }),
    );
    if (line.dots !== false) {
      points.forEach(([px, py], index) => {
        const on = index === week;
        root.append(
          svg("circle", {
            cx: px,
            cy: py,
            r: on ? 5.5 : 3,
            fill: on ? (line.pointColor?.(index) ?? line.color) : "#fff",
            stroke: line.pointColor?.(index) ?? line.color,
            "stroke-width": on ? 2.5 : 1.6,
          }),
        );
      });
    }
    if (pad.right > 18 && line.label) {
      endTags.push({ y: points[points.length - 1][1], text: line.label, color: line.color });
    }
  }

  endTags.sort((a, b) => a.y - b.y);
  let lastY = -Infinity;
  for (const tag of endTags) {
    const ty = Math.max(tag.y + 4, lastY + 13);
    lastY = ty;
    root.append(svg("text", { x: right + 8, y: ty, class: "pc-end", fill: tag.color }, tag.text));
  }

  const tip = tooltip(root, { top: pad.top, bottom, left: pad.left, right });
  const nearest = (px) => Math.round(Math.min(n - 1, Math.max(0, ((px - pad.left) / plotW) * (n - 1))));
  const inside = (px, py) => px >= pad.left - 12 && px <= right + 12 && py >= pad.top && py <= bottom;
  return {
    move(px, py) {
      if (!inside(px, py)) return tip.hide();
      const index = nearest(px);
      tip.show(x(index), spec.tip ? spec.tip(index) : [labels[index]]);
    },
    leave: () => tip.hide(),
    click(px, py) {
      if (inside(px, py) && spec.onPick) spec.onPick(nearest(px));
    },
  };
}

/**
 * Daily line with a second series on its own scale, drawn behind the first.
 * spec: { labels, primary, overlay, signal, axisLabel, overlayLabel, endLabel,
 * primaryColor, signalColor, overlayColor, grid, tip(index), label }
 * The ≥ signal level is a dashed line plus a short hatched chip on those dates.
 * Hover uses the same crosshair tooltip as the weekly lines.
 */
export function drawDualLine(root, spec, width, height) {
  const { labels, primary, overlay } = spec;
  const n = labels.length;
  const narrow = width < 360;
  const pad = { top: 22, right: narrow ? 16 : 62, bottom: 36, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const signal = spec.signal ?? 2;
  const pMin = Math.min(...primary);
  const pMax = Math.max(...primary);
  const span = Math.max(pMax - pMin, 0.8);
  const lo = Math.min(pMin, signal) - span * 0.14;
  const hi = Math.max(pMax, signal) + span * 0.16;
  const oMin = Math.min(...overlay);
  const oMax = Math.max(...overlay);
  const oSpan = Math.max(oMax - oMin, 1);
  const oLo = oMin - oSpan * 0.12;
  const oHi = oMax + oSpan * 0.12;
  const x = (index) => pad.left + (n === 1 ? plotW / 2 : (index / (n - 1)) * plotW);
  const y = (value) => pad.top + (1 - (value - lo) / (hi - lo)) * plotH;
  const yOverlay = (value) => pad.top + (1 - (value - oLo) / (oHi - oLo)) * plotH;
  const right = pad.left + plotW;
  const bottom = pad.top + plotH;
  const primaryColor = spec.primaryColor ?? TONE.ink;
  const signalColor = spec.signalColor ?? "#9a6b12";
  const overlayColor = spec.overlayColor ?? OVERLAY_COLORS[0];
  const hatchId = `svb-hatch-${Math.round(width)}-${Math.round(height)}`;

  root.append(
    svg("text", { x: pad.left, y: 13, class: "pc-axis svb-axis-name" }, spec.axisLabel ?? "Vol Stress"),
    svg("text", { x: right, y: 13, "text-anchor": "end", class: "pc-axis svb-axis-name", fill: overlayColor }, spec.overlayLabel ?? "SPX"),
  );

  const defs = svg("defs");
  const pattern = svg("pattern", { id: hatchId, width: 4, height: 4, patternUnits: "userSpaceOnUse" });
  pattern.append(svg("path", { d: "M-1 5 L5 -1 M-1 1 L1 -1", stroke: signalColor, "stroke-width": 1 }));
  defs.append(pattern);
  root.append(defs);

  const overlayPts = overlay.map((value, index) => [x(index), yOverlay(value)]);
  const overlayPath = overlayPts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  root.append(
    svg("polygon", {
      points: `${overlayPts[0][0].toFixed(1)},${bottom} ${overlayPath} ${overlayPts[overlayPts.length - 1][0].toFixed(1)},${bottom}`,
      fill: overlayColor,
      opacity: 0.06,
    }),
    svg("polyline", {
      points: overlayPath,
      fill: "none",
      stroke: overlayColor,
      "stroke-width": 1.35,
      opacity: 0.55,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    }),
  );

  const ticks = niceTicks(lo, hi, Math.max(3, Math.round(plotH / 52)));
  for (const tick of ticks) {
    if (tick < lo - 1e-9 || tick > hi + 1e-9) continue;
    const ty = y(tick);
    root.append(
      svg("line", { x1: pad.left, x2: right, y1: ty, y2: ty, stroke: spec.grid ?? TONE.grid }),
      svg("text", { x: pad.left - 8, y: ty + 3.5, "text-anchor": "end", class: "pc-axis" }, Number.isInteger(tick) ? String(tick) : tick.toFixed(1)),
    );
  }
  if (!narrow) {
    for (const tick of niceTicks(oLo, oHi, 4)) {
      if (tick < oLo - 1e-6 || tick > oHi + 1e-6) continue;
      root.append(
        svg("text", {
          x: right + 8,
          y: yOverlay(tick) + 3.5,
          "text-anchor": "start",
          class: "pc-axis",
        }, Math.round(tick).toLocaleString("en-US")),
      );
    }
  }

  const gy = y(signal);
  root.append(svg("line", { x1: pad.left, x2: right, y1: gy, y2: gy, stroke: signalColor, "stroke-width": 1.15, "stroke-dasharray": "5 4" }));

  primary.forEach((value, index) => {
    if (value < signal) return;
    const cx = x(index);
    const cy = y(value);
    const chip = 26;
    const top = Math.max(pad.top, Math.min(cy, gy) - 2);
    const chipH = Math.max(10, Math.min(chip, Math.abs(cy - gy) + 8));
    root.append(
      svg("rect", {
        x: cx - 3,
        y: top,
        width: 6,
        height: chipH,
        fill: `url(#${hatchId})`,
        stroke: signalColor,
        "stroke-width": 0.6,
        rx: 1,
      }),
    );
  });

  const linePts = primary.map((value, index) => [x(index), y(value)]);
  root.append(
    svg("polyline", {
      points: linePts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" "),
      fill: "none",
      stroke: primaryColor,
      "stroke-width": 2.6,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    }),
  );

  const runs = [];
  let run = [];
  const flush = () => {
    if (run.length >= 2) runs.push(run);
    run = [];
  };
  const push = (px, py) => {
    const last = run[run.length - 1];
    if (last && Math.abs(last[0] - px) < 0.2 && Math.abs(last[1] - py) < 0.2) return;
    run.push([px, py]);
  };
  for (let index = 0; index < n - 1; index += 1) {
    const a = primary[index];
    const b = primary[index + 1];
    const aOn = a >= signal;
    const bOn = b >= signal;
    const ax = x(index);
    const bx = x(index + 1);
    if (aOn && bOn) {
      if (!run.length) push(ax, y(a));
      push(bx, y(b));
      continue;
    }
    if (aOn === bOn || a === b) {
      flush();
      continue;
    }
    const t = (signal - a) / (b - a);
    const cx = ax + (bx - ax) * t;
    const cy = y(signal);
    if (aOn) {
      if (!run.length) push(ax, y(a));
      push(cx, cy);
      flush();
    } else {
      flush();
      push(cx, cy);
      push(bx, y(b));
    }
  }
  flush();
  for (const path of runs) {
    root.append(
      svg("polyline", {
        points: path.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" "),
        fill: "none",
        stroke: signalColor,
        "stroke-width": 2.7,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      }),
    );
  }

  const diamond = (cx, cy) => {
    const r = 5.2;
    return `${cx},${(cy - r).toFixed(1)} ${(cx + r).toFixed(1)},${cy} ${cx},${(cy + r).toFixed(1)} ${(cx - r).toFixed(1)},${cy}`;
  };
  primary.forEach((value, index) => {
    if (value < signal) return;
    root.append(
      svg("polygon", {
        points: diamond(x(index), y(value)),
        fill: "#f5c451",
        stroke: "#3d2e08",
        "stroke-width": 1.2,
      }),
    );
  });
  const lastIndex = n - 1;
  const lastX = x(lastIndex);
  const lastY = y(primary[lastIndex]);
  root.append(
    svg("circle", {
      cx: lastX,
      cy: lastY,
      r: 7.2,
      fill: "none",
      stroke: primaryColor,
      "stroke-width": 2.4,
    }),
  );
  if (spec.endLabel) {
    const labelW = spec.endLabel.length * 6.4 + 10;
    const lx = Math.max(pad.left + 4, Math.min(lastX - 8, right - labelW));
    const ly = Math.min(bottom - 6, lastY + 20);
    root.append(
      svg("rect", { x: lx - labelW, y: ly - 12, width: labelW, height: 16, rx: 4, fill: "#ffffff", stroke: "rgba(11,13,18,0.12)" }),
      svg("text", { x: lx - 5, y: ly, "text-anchor": "end", class: "pc-axis svb-end-label" }, spec.endLabel),
    );
  }

  const marks = labels.map((label, index) => ({ label, index })).filter((item) => item.label);
  const kept = [];
  for (const item of marks) {
    const last = item.index === n - 1;
    const px = x(item.index);
    if (!last && kept.length && px - x(kept[kept.length - 1].index) < 64) continue;
    if (last && kept.length && px - x(kept[kept.length - 1].index) < 56) kept.pop();
    kept.push(item);
  }
  for (const item of kept) {
    const last = item.index === n - 1;
    const first = item.index === kept[0].index;
    root.append(
      svg("text", {
        x: x(item.index),
        y: height - 8,
        "text-anchor": last ? "end" : first ? "start" : "middle",
        class: "pc-axis",
      }, item.label),
    );
  }

  const marker = svg("circle", { r: 5.5, fill: "#fff", stroke: primaryColor, "stroke-width": 2, visibility: "hidden", "pointer-events": "none" });
  root.append(marker);
  const tip = tooltip(root, { top: pad.top, bottom, left: pad.left, right });
  const nearest = (px) => Math.round(Math.min(n - 1, Math.max(0, ((px - pad.left) / plotW) * (n - 1))));
  const inside = (px, py) => px >= pad.left - 8 && px <= right + 8 && py >= pad.top - 8 && py <= bottom + 8;
  return {
    move(px, py) {
      if (!inside(px, py)) {
        marker.setAttribute("visibility", "hidden");
        tip.hide();
        return;
      }
      const index = nearest(px);
      const on = primary[index] >= signal;
      marker.setAttribute("cx", x(index));
      marker.setAttribute("cy", y(primary[index]));
      marker.setAttribute("fill", on ? "#f5c451" : "#fff");
      marker.setAttribute("stroke", on ? signalColor : primaryColor);
      marker.setAttribute("visibility", "visible");
      tip.show(x(index), spec.tip ? spec.tip(index) : [labels[index]]);
    },
    leave() {
      marker.setAttribute("visibility", "hidden");
      tip.hide();
    },
  };
}

/** Diverging weekly columns around zero, for the Soft Vol residual. spec: { labels, values, week, tone(v), ghosts, tip, onPick } */
export function drawResidual(root, spec, width, height) {
  const { labels, values, week } = spec;
  const pad = { top: 14, right: spec.ghosts?.length ? 48 : 16, bottom: 26, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const ghostValues = (spec.ghosts ?? []).flatMap((ghost) => ghost.values);
  const reach = Math.max(1, ...values.map(Math.abs), ...ghostValues.map(Math.abs));
  const top = Math.ceil(reach * 1.25 * 2) / 2;
  const lo = -top;
  const hi = top;
  const n = values.length;
  const slot = plotW / n;
  const cx = (index) => pad.left + slot * (index + 0.5);
  const y = (value) => pad.top + (1 - (value - lo) / (hi - lo)) * plotH;
  const right = pad.left + plotW;
  const bottom = pad.top + plotH;

  root.append(
    svg("rect", { x: pad.left, y: y(hi), width: plotW, height: y(0.4) - y(hi), fill: TONE.bandCrowded }),
    svg("rect", { x: pad.left, y: y(0.4), width: plotW, height: y(-0.4) - y(0.4), fill: TONE.bandMid }),
    svg("rect", { x: pad.left, y: y(-0.4), width: plotW, height: y(lo) - y(-0.4), fill: TONE.bandSoft }),
    svg("text", { x: pad.left + 6, y: y(hi) + 12, class: "pc-band", fill: TONE.crowded }, "Stretched"),
    svg("text", { x: pad.left + 6, y: y(lo) - 6, class: "pc-band", fill: "#1f7a45" }, "Soft vol"),
  );

  for (const tick of niceTicks(lo, hi, 4)) {
    const ty = y(tick);
    root.append(
      svg("line", { x1: pad.left, x2: right, y1: ty, y2: ty, stroke: tick === 0 ? TONE.ink : TONE.grid, "stroke-width": tick === 0 ? 1.4 : 1 }),
      svg("text", { x: pad.left - 8, y: ty + 3.5, "text-anchor": "end", class: "pc-axis" }, tick === 0 ? "0" : `${tick > 0 ? "+" : "−"}${Math.abs(tick).toFixed(1)}`),
    );
  }

  const ghostTags = [];
  for (const ghost of spec.ghosts ?? []) {
    const path = ghost.values.map((value, index) => `${cx(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
    root.append(svg("polyline", { points: path, fill: "none", stroke: ghost.color, "stroke-width": 1.6, "stroke-dasharray": "4 3", opacity: 0.9 }));
    ghostTags.push({ y: y(ghost.values[n - 1]), text: ghost.label, color: ghost.color });
  }
  ghostTags.sort((a, b) => a.y - b.y);
  let lastTag = -Infinity;
  for (const tag of ghostTags) {
    const ty = Math.max(tag.y + 4, lastTag + 13);
    lastTag = ty;
    root.append(svg("text", { x: right + 6, y: ty, class: "pc-end", fill: tag.color }, tag.text));
  }

  const barW = Math.min(34, slot * 0.56);
  values.forEach((value, index) => {
    const on = index === week;
    const y0 = y(0);
    const y1 = y(value);
    const color = TONE[spec.tone(value) === "crowded" ? "crowded" : spec.tone(value) === "soft" ? "soft" : "mid"];
    root.append(
      svg("rect", {
        x: cx(index) - barW / 2,
        y: Math.min(y0, y1),
        width: barW,
        height: Math.max(1.5, Math.abs(y1 - y0)),
        rx: 4,
        fill: color,
        opacity: on ? 1 : 0.55,
        stroke: on ? TONE.ink : "none",
        "stroke-width": on ? 2 : 0,
      }),
    );
    const label = Math.abs(value) < 0.05 ? "0.0" : `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}`;
    const below = value < 0;
    root.append(
      svg("text", { x: cx(index), y: below ? y1 + 14 : y1 - 6, "text-anchor": "middle", class: on ? "pc-val is-on" : "pc-val" }, label),
    );
  });

  weekAxis(root, labels, cx, height - 8, plotW);

  const tip = tooltip(root, { top: pad.top, bottom, left: pad.left, right });
  const nearest = (px) => Math.min(n - 1, Math.max(0, Math.floor((px - pad.left) / slot)));
  const inside = (px, py) => px >= pad.left && px <= right && py >= pad.top && py <= bottom;
  return {
    move(px, py) {
      if (!inside(px, py)) return tip.hide();
      const index = nearest(px);
      tip.show(cx(index), spec.tip(index), { ruleOn: false });
    },
    leave: () => tip.hide(),
    click(px, py) {
      if (inside(px, py)) spec.onPick?.(nearest(px));
    },
  };
}

/**
 * Sector columns on a 0 to 1 percentile axis with the four Soft ↔ Crowded buckets
 * as bands. spec: { bars, buckets, selected, focus, tip(bar), onPick(ticker) }
 */
export function drawSectors(root, spec, width, height) {
  const { bars, buckets } = spec;
  const labelled = width >= 560;
  const tight = (width - 50) / bars.length < 38;
  const pad = { top: 26, right: labelled ? 88 : 10, bottom: tight ? 44 : 30, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const y = (pct) => pad.top + (1 - pct / 100) * plotH;
  const slot = plotW / bars.length;
  const cx = (index) => pad.left + slot * (index + 0.5);
  const right = pad.left + plotW;
  const bottom = pad.top + plotH;
  const fills = { xsoft: TONE.bandXsoft, soft: TONE.bandSoft, mid: TONE.bandMid, crowded: TONE.bandCrowded };
  const inks = { xsoft: "#155f35", soft: "#1f7a45", mid: TONE.muted, crowded: TONE.crowded };

  for (const bucket of buckets) {
    const top = y(bucket.to);
    root.append(svg("rect", { x: pad.left, y: top, width: plotW, height: y(bucket.from) - top, fill: fills[bucket.tone] }));
    if (bucket.from > 0) {
      root.append(
        svg("line", { x1: pad.left, x2: right, y1: y(bucket.from), y2: y(bucket.from), stroke: TONE.grid, "stroke-dasharray": "3 3" }),
      );
    }
    root.append(
      svg("text", { x: pad.left - 8, y: y(bucket.from) + 3.5, "text-anchor": "end", class: "pc-axis" }, (bucket.from / 100).toFixed(2)),
    );
  }
  root.append(svg("text", { x: pad.left - 8, y: y(100) + 3.5, "text-anchor": "end", class: "pc-axis" }, "1.00"));
  root.append(svg("line", { x1: pad.left, x2: right, y1: bottom, y2: bottom, stroke: TONE.ink2, "stroke-width": 1 }));

  const barW = Math.min(44, slot * 0.6);
  bars.forEach((bar, index) => {
    const x = cx(index);
    const on = bar.ticker === spec.selected;
    const dim = spec.focus && bar.bucket !== spec.focus;
    const group = svg("g", { opacity: dim ? 0.22 : 1 });
    if (!bar.available) {
      group.append(
        svg("rect", { x: x - barW / 2, y: y(50), width: barW, height: bottom - y(50), rx: 6, fill: "none", stroke: TONE.faint, "stroke-dasharray": "4 3" }),
        svg("text", { x, y: y(50) - 8, "text-anchor": "middle", class: "pc-val" }, "—"),
      );
    } else {
      const top = y(bar.points);
      const color = TONE[bar.tone];
      group.append(
        svg("rect", {
          x: x - barW / 2,
          y: top,
          width: barW,
          height: Math.max(2, bottom - top),
          rx: 6,
          fill: color,
          stroke: on ? TONE.ink : "none",
          "stroke-width": on ? 2.5 : 0,
        }),
        svg("path", {
          d: `M ${x - 6} ${top - 13} L ${x + 6} ${top - 13} L ${x} ${top - 5} Z`,
          fill: bar.tone === "crowded" ? TONE.crowded : TONE.ink,
        }),
      );
      if (!tight || on) {
        group.append(
          svg("text", { x, y: top - 17, "text-anchor": "middle", class: on ? "pc-val is-on" : "pc-val", fill: bar.tone === "crowded" ? TONE.crowded : null }, bar.display),
        );
      }
    }
    group.append(
      tight
        ? svg("text", { x: x + 4, y: bottom + 12, "text-anchor": "end", transform: `rotate(-50 ${x + 4} ${bottom + 12})`, class: on ? "pc-tick is-on" : "pc-tick" }, bar.ticker)
        : svg("text", { x, y: height - 10, "text-anchor": "middle", class: on ? "pc-tick is-on" : "pc-tick" }, bar.ticker),
    );
    root.append(group);
  });

  if (labelled) {
    for (const bucket of buckets) {
      const mid = (y(bucket.from) + y(bucket.to)) / 2;
      root.append(svg("text", { x: right + 8, y: mid + 4, class: "pc-band", fill: inks[bucket.tone] }, bucket.title));
    }
  }

  const tip = tooltip(root, { top: 0, bottom, left: pad.left, right });
  const pick = (px) => Math.min(bars.length - 1, Math.max(0, Math.floor((px - pad.left) / slot)));
  const inside = (px, py) => px >= pad.left && px <= right && py >= 0 && py <= height;
  return {
    move(px, py) {
      if (!inside(px, py)) return tip.hide();
      const index = pick(px);
      tip.show(cx(index), spec.tip(bars[index]), { ruleOn: false });
    },
    leave: () => tip.hide(),
    click(px, py) {
      if (inside(px, py)) spec.onPick(bars[pick(px)].ticker);
    },
  };
}

function polar(cx, cy, r, angle) {
  const rad = (angle * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
}

function arc(cx, cy, r, from, to) {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/**
 * Semicircle Soft Vol ↔ Stretched gauge. `cuts` are the zone edges as 0–1
 * positions along the arc; `position` is the needle, 0 (left) to 1 (right).
 */
export function gaugeSvg({ position, cuts, ticks = ["−3", "0", "+3"], compact = false }) {
  const cx = 120;
  const cy = 118;
  const r = 92;
  const angle = (pos) => 180 - pos * 180;
  const root = svg("svg", { viewBox: compact ? "14 14 212 116" : "0 0 240 142", class: "pc-gauge", "aria-hidden": "true" });
  const zones = [
    [0, cuts[0], TONE.soft],
    [cuts[0], cuts[1], TONE.mid],
    [cuts[1], 1, TONE.crowded],
  ];
  const gap = 1.6;
  for (const [from, to, color] of zones) {
    root.append(
      svg("path", {
        d: arc(cx, cy, r, angle(from) - (from ? gap : 0), angle(to) + (to < 1 ? gap : 0)),
        fill: "none",
        stroke: color,
        "stroke-width": compact ? 20 : 16,
        "stroke-linecap": "butt",
      }),
    );
  }
  if (!compact) {
    for (let step = 0; step <= 12; step += 1) {
      const a = 180 - step * 15;
      const [x1, y1] = polar(cx, cy, r - 14, a);
      const [x2, y2] = polar(cx, cy, r - (step % 6 ? 18 : 22), a);
      root.append(svg("line", { x1, y1, x2, y2, stroke: TONE.faint, "stroke-width": step % 6 ? 1 : 1.6 }));
    }
    root.append(
      svg("text", { x: cx - r, y: cy + 18, "text-anchor": "middle", class: "pc-axis" }, ticks[0]),
      svg("text", { x: cx, y: cy - r + 40, "text-anchor": "middle", class: "pc-axis" }, ticks[1]),
      svg("text", { x: cx + r, y: cy + 18, "text-anchor": "middle", class: "pc-axis" }, ticks[2]),
    );
  }
  const needle = svg("g", { class: "pc-needle" });
  needle.style.transformOrigin = `${cx}px ${cy}px`;
  needle.style.transform = `rotate(${(position - 0.5) * 180}deg)`;
  needle.append(
    svg("path", { d: `M ${cx - 4.5} ${cy} L ${cx} ${cy - r + (compact ? 8 : 12)} L ${cx + 4.5} ${cy} Z`, fill: TONE.ink }),
  );
  root.append(needle, svg("circle", { cx, cy, r: compact ? 9 : 8, fill: TONE.ink }), svg("circle", { cx, cy, r: 3, fill: "#fff" }));
  return root;
}

export function setNeedle(gauge, position) {
  const needle = gauge.querySelector(".pc-needle");
  if (needle) needle.style.transform = `rotate(${(position - 0.5) * 180}deg)`;
}

/* Hub previews: fixed-size marks drawn from the same data as the full charts. */

function previewFrame() {
  return svg("svg", { viewBox: "0 0 240 84", class: "pc-mini", "aria-hidden": "true" });
}

export function miniColumns(bars) {
  const root = previewFrame();
  const slot = 240 / bars.length;
  const y = (pct) => 80 - (pct / 100) * 72;
  root.append(
    svg("rect", { x: 0, y: y(100), width: 240, height: y(67) - y(100), fill: TONE.bandCrowded }),
    svg("rect", { x: 0, y: y(40), width: 240, height: y(0) - y(40), fill: TONE.bandSoft }),
  );
  bars.forEach((bar, index) => {
    const x = slot * index + slot * 0.2;
    if (!bar.available) {
      root.append(svg("rect", { x, y: y(50), width: slot * 0.6, height: y(0) - y(50), rx: 3, fill: "none", stroke: TONE.faint, "stroke-dasharray": "3 2" }));
      return;
    }
    root.append(svg("rect", { x, y: y(bar.points), width: slot * 0.6, height: y(0) - y(bar.points), rx: 3, fill: TONE[bar.tone] }));
  });
  return root;
}

export function miniLines(lines, { domain, bands = [] } = {}) {
  const root = previewFrame();
  const all = lines.flatMap((line) => line.values);
  const [lo, hi] = domain ?? [Math.min(...all), Math.max(...all)];
  const span = hi - lo || 1;
  const n = lines[0].values.length;
  const x = (index) => 6 + (index / (n - 1)) * 228;
  const y = (value) => 8 + (1 - (value - lo) / span) * 68;
  for (const band of bands) {
    const top = y(Math.min(hi, band.to));
    root.append(svg("rect", { x: 0, y: top, width: 240, height: y(Math.max(lo, band.from)) - top, fill: band.fill }));
  }
  for (const line of lines) {
    const points = line.values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
    root.append(svg("polyline", { points, fill: "none", stroke: line.color, "stroke-width": 2.4, "stroke-linejoin": "round", "stroke-linecap": "round" }));
    const last = line.values[n - 1];
    root.append(svg("circle", { cx: x(n - 1), cy: y(last), r: 3.6, fill: line.color }));
  }
  return root;
}

export function miniBars(items, max) {
  const root = previewFrame();
  const rowH = 84 / items.length;
  items.forEach((item, index) => {
    const yy = rowH * index + rowH * 0.28;
    const h = rowH * 0.44;
    root.append(
      svg("rect", { x: 0, y: yy, width: 240, height: h, rx: h / 2, fill: "#eef0f3" }),
      svg("rect", { x: 0, y: yy, width: Math.max(h, (item.value / max) * 240), height: h, rx: h / 2, fill: index ? TONE.mid : TONE.crowded }),
    );
  });
  return root;
}

export function miniTracks(pcts) {
  const root = previewFrame();
  const rowH = 84 / pcts.length;
  pcts.forEach((pct, index) => {
    const yy = rowH * index + rowH * 0.5;
    const third = (240 - 6) / 3;
    root.append(
      svg("rect", { x: 0, y: yy, width: third, height: 6, rx: 3, fill: TONE.soft }),
      svg("rect", { x: third + 3, y: yy, width: third, height: 6, rx: 1.5, fill: "#cdd1d8" }),
      svg("rect", { x: 2 * third + 6, y: yy, width: third, height: 6, rx: 3, fill: TONE.crowded }),
    );
    const px = Math.min(234, Math.max(6, (pct / 100) * 240));
    root.append(svg("path", { d: `M ${px - 5} ${yy - 8} L ${px + 5} ${yy - 8} L ${px} ${yy - 1} Z`, fill: pct >= 60 ? TONE.crowded : TONE.ink }));
  });
  return root;
}
