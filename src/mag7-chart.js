/**
 * MAG7 Oscillator pane: per-bar regime bands, a line coloured by regime, a
 * right-hand value scale, a month scale, the ±threshold, zero, caution, and
 * stretched horizontals, and a crosshair. Dark pane, drawn with chart-svg.
 */

import { svg } from "./chart-svg.js";
import { niceTicks } from "./flow-chart.js";
import { COLORS, fmtAxis } from "./mag7-osc.js";

export const PANE = {
  bg: "#050608",
  axis: "#b2b5be",
  axisLine: "rgba(255, 255, 255, 0.12)",
  grid: "rgba(255, 255, 255, 0.035)",
  zero: "rgba(120, 123, 134, 0.7)",
  cross: "#9598a1",
  caution: "#ffb74d",
  stretched: "#26c6da",
  band: {
    bull: "rgba(76, 175, 80, 0.15)",
    bear: "rgba(255, 82, 82, 0.15)",
    neutral: "rgba(33, 150, 243, 0.1)",
  },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthTicks(dates, from, to) {
  const ticks = [];
  for (let index = from; index <= to; index += 1) {
    const month = dates[index].slice(0, 7);
    if (index === from || month !== dates[index - 1].slice(0, 7)) {
      const [year, mm] = dates[index].split("-");
      ticks.push({ index, label: mm === "01" ? year : MONTHS[Number(mm) - 1], year: mm === "01" });
    }
  }
  return ticks;
}

function axisTag(root, { x, y, text, fill, ink = "#fff", width }) {
  const h = 18;
  root.append(
    svg("rect", { x, y: y - h / 2, width, height: h, rx: 2, fill }),
    svg("text", { x: x + 6, y: y + 4, class: "mo-tag", fill: ink }, text),
  );
}

/**
 * spec: { result, from, to, cursor, onHover(index|null), label }
 * `result` comes from buildOscillator; [from, to] is the visible bar window.
 */
export function drawOscillator(root, spec, width, height) {
  const { result, from, to } = spec;
  const axisW = width < 520 ? 52 : 62;
  const pad = { top: 10, right: axisW, bottom: 26, left: 0 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const right = pad.left + plotW;
  const bottom = pad.top + plotH;
  const count = to - from + 1;
  const step = plotW / count;
  const x = (index) => pad.left + (index - from + 0.5) * step;

  const visible = result.values.slice(from, to + 1).filter((value) => value !== null);
  const marks = [0, result.thresholds.upper, result.thresholds.lower];
  if (result.pivots) marks.push(result.pivots.caution, result.pivots.stretched);
  let lo = Math.min(...visible, ...marks);
  let hi = Math.max(...visible, ...marks);
  const margin = (hi - lo) * 0.08 || 1;
  lo -= margin;
  hi += margin;
  const y = (value) => pad.top + (1 - (value - lo) / (hi - lo)) * plotH;

  root.append(svg("rect", { x: 0, y: 0, width, height, fill: PANE.bg }));

  let runStart = from;
  for (let index = from; index <= to + 1; index += 1) {
    const here = index <= to ? result.regime[index] : undefined;
    if (index <= to && here === result.regime[runStart]) continue;
    const tone = result.regime[runStart];
    if (tone) {
      const left = Math.max(pad.left, x(runStart) - step / 2);
      const end = Math.min(right, x(index - 1) + step / 2);
      root.append(svg("rect", { x: left, y: pad.top, width: Math.max(0.5, end - left), height: plotH, fill: PANE.band[tone] }));
    }
    runStart = index;
  }

  const ticks = niceTicks(lo, hi, Math.max(4, Math.round(plotH / 34)));
  for (const tick of ticks) {
    if (tick < lo || tick > hi) continue;
    const ty = y(tick);
    root.append(
      svg("line", { x1: pad.left, x2: right, y1: ty, y2: ty, stroke: PANE.grid }),
      svg("text", { x: right + 8, y: ty + 4, class: "mo-axis" }, fmtAxis(tick)),
    );
  }

  /* Month labels on a fixed stride so January (the year label) always lands on the scale. */
  const months = monthTicks(result.dates, from, to).filter((tick) => tick.index > from || result.dates[from].slice(8) === "01");
  const minGap = width < 520 ? 40 : 54;
  const perMonth = months.length > 1 ? (x(months[months.length - 1].index) - x(months[0].index)) / (months.length - 1) : plotW;
  const stride = [1, 2, 3, 6, 12].find((size) => perMonth * size >= minGap) ?? 12;
  for (const tick of months) {
    const month = Number(result.dates[tick.index].slice(5, 7)) - 1;
    const tx = x(tick.index);
    if (month % stride || tx < 14 || tx > right - 14) continue;
    root.append(svg("text", { x: tx, y: height - 8, "text-anchor": "middle", class: tick.year ? "mo-axis is-year" : "mo-axis" }, tick.label));
  }

  root.append(
    svg("line", { x1: right + 0.5, x2: right + 0.5, y1: 0, y2: height, stroke: PANE.axisLine }),
    svg("line", { x1: 0, x2: width, y1: bottom + 0.5, y2: bottom + 0.5, stroke: PANE.axisLine }),
  );

  const zy = y(0);
  root.append(svg("line", { x1: pad.left, x2: right, y1: zy, y2: zy, stroke: PANE.zero, "stroke-width": 1 }));
  const { upper, lower } = result.thresholds;
  root.append(
    svg("line", { x1: pad.left, x2: right, y1: y(upper), y2: y(upper), stroke: COLORS.bull, "stroke-opacity": 0.6, "stroke-width": 1, class: "mo-threshold" }),
    svg("line", { x1: pad.left, x2: right, y1: y(lower), y2: y(lower), stroke: COLORS.bear, "stroke-opacity": 0.6, "stroke-width": 1, class: "mo-threshold" }),
  );

  const pivotLines = [];
  if (result.pivots) {
    for (const [key, label] of [
      ["caution", "Caution"],
      ["stretched", "Stretched"],
    ]) {
      const level = result.pivots[key];
      const py = y(level);
      const color = PANE[key];
      root.append(
        svg("line", { x1: pad.left, x2: right, y1: py, y2: py, stroke: color, "stroke-width": 1.2, "stroke-dasharray": "6 4", class: `mo-pivot is-${key}` }),
        svg("text", { x: pad.left + 8, y: key === "caution" ? py - 6 : py + 14, class: "mo-pivot-label", fill: color }, `${label} ${level > 0 ? "+" : "−"}${Math.abs(level)}`),
      );
      pivotLines.push({ y: py, text: fmtAxis(level), color });
    }
  }

  /* The segment into bar k takes bar k's colour. */
  const colorAt = (index) => COLORS[result.regime[index]] ?? COLORS.neutral;
  for (let k = from + 1; k <= to; ) {
    const color = colorAt(k);
    let end = k;
    while (end < to && colorAt(end + 1) === color) end += 1;
    const points = [];
    for (let index = k - 1; index <= end; index += 1) {
      if (result.values[index] !== null) points.push(`${x(index).toFixed(2)},${y(result.values[index]).toFixed(2)}`);
    }
    if (points.length > 1) {
      root.append(
        svg("polyline", {
          points: points.join(" "),
          fill: "none",
          stroke: color,
          "stroke-width": 2,
          "stroke-linejoin": "round",
          "stroke-linecap": "round",
          class: "mo-line",
        }),
      );
    }
    k = end + 1;
  }

  const lastValue = result.values[to];
  const tagW = axisW - 4;
  const tags = [...pivotLines.map((line) => ({ ...line, ink: "#0b0d12" }))];
  if (lastValue !== null) tags.push({ y: y(lastValue), text: fmtAxis(lastValue), color: colorAt(to), ink: "#fff", last: true });
  tags.sort((a, b) => a.y - b.y);
  for (let index = 1; index < tags.length; index += 1) {
    if (tags[index].y - tags[index - 1].y < 19) {
      if (tags[index].last) tags[index - 1].y = tags[index].y - 19;
      else tags[index].y = tags[index - 1].y + 19;
    }
  }
  for (const tag of tags) axisTag(root, { x: right + 2, y: tag.y, text: tag.text, fill: tag.color, ink: tag.ink, width: tagW });

  const cross = svg("g", { class: "mo-cross", visibility: "hidden", "pointer-events": "none" });
  const vLine = svg("line", { y1: pad.top, y2: bottom, stroke: PANE.cross, "stroke-dasharray": "4 4", "stroke-width": 1 });
  const hLine = svg("line", { x1: pad.left, x2: right, stroke: PANE.cross, "stroke-dasharray": "4 4", "stroke-width": 1 });
  const dot = svg("circle", { r: 3.5, stroke: PANE.bg, "stroke-width": 1.5 });
  const dateBox = svg("rect", { height: 20, rx: 2, fill: "#2a2e39" });
  const dateText = svg("text", { class: "mo-tag", fill: "#fff", "text-anchor": "middle" });
  const valBox = svg("rect", { x: right + 2, width: tagW, height: 18, rx: 2, fill: "#2a2e39" });
  const valText = svg("text", { x: right + 8, class: "mo-tag", fill: "#fff" });
  cross.append(vLine, hLine, dot, dateBox, dateText, valBox, valText);
  root.append(cross);

  const showCross = (index) => {
    const value = result.values[index];
    if (value === null) return;
    const cx = x(index);
    const cy = y(value);
    vLine.setAttribute("x1", cx);
    vLine.setAttribute("x2", cx);
    hLine.setAttribute("y1", cy);
    hLine.setAttribute("y2", cy);
    dot.setAttribute("cx", cx);
    dot.setAttribute("cy", cy);
    dot.setAttribute("fill", colorAt(index));
    const [yy, mm, dd] = result.dates[index].split("-");
    const label = `${MONTHS[Number(mm) - 1]} ${Number(dd)}, ${yy}`;
    const boxW = label.length * 6.4 + 16;
    const left = Math.min(Math.max(cx - boxW / 2, 0), right - boxW);
    dateBox.setAttribute("x", left);
    dateBox.setAttribute("y", bottom + 3);
    dateBox.setAttribute("width", boxW);
    dateText.setAttribute("x", left + boxW / 2);
    dateText.setAttribute("y", bottom + 17);
    dateText.textContent = label;
    valBox.setAttribute("y", cy - 9);
    valText.setAttribute("y", cy + 4);
    valText.textContent = fmtAxis(value);
    cross.setAttribute("visibility", "visible");
  };

  if (Number.isInteger(spec.cursor) && spec.cursor >= from && spec.cursor <= to) showCross(spec.cursor);

  const nearest = (px) => Math.min(to, Math.max(from, from + Math.floor((px - pad.left) / step)));
  const inside = (px, py) => px >= pad.left && px <= right && py >= 0 && py <= height;
  return {
    move(px, py) {
      if (!inside(px, py)) {
        cross.setAttribute("visibility", "hidden");
        spec.onHover?.(null);
        return;
      }
      const index = nearest(px);
      showCross(index);
      spec.onHover?.(index);
    },
    leave() {
      if (Number.isInteger(spec.cursor)) return;
      cross.setAttribute("visibility", "hidden");
      spec.onHover?.(null);
    },
  };
}
