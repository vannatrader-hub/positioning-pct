/**
 * Vol · Credit · Momentum wall. Renders only after the Vault gate opens the
 * page. The MAG7 card reads the committed closes in public/data/vault/mag7/
 * and computes the oscillator in the browser with src/mag7-osc.js. Spot Vol
 * Beta mounts from src/vault-svb.js and Credit Spread Regime from
 * src/vault-csr.js.
 */

import "./vault-svb.js";
import "./vault-csr.js";
import "./vault-wall-status.js";
import { mountPlot } from "./chart-svg.js";
import { drawOscillator } from "./mag7-chart.js";
import { MODES, RANGES, TYPES, buildOscillator, fmtAxis, fmtPct, panelAt, rangeStart } from "./mag7-osc.js";

const DATA = `${import.meta.env.BASE_URL}data/vault/mag7/oscillator.json`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function longDate(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function asOfLabel(doc) {
  const day = longDate(doc.asOf.slice(0, 10));
  if (doc.lastBar !== "intraday") return `${day} close`;
  const time = new Date(doc.asOf).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
  return `${day} · ${time} CT intraday`;
}

function seg(label, items, current, onPick) {
  const control = el("div", "pchart-control");
  const id = `mo-${label.toLowerCase()}`;
  const name = el("span", "pchart-control-label", label);
  name.id = id;
  const group = el("div", "seg");
  group.setAttribute("role", "group");
  group.setAttribute("aria-labelledby", id);
  for (const item of items) {
    const button = el("button", item.id === current ? "is-on" : "", item.label);
    button.type = "button";
    button.setAttribute("aria-pressed", String(item.id === current));
    button.addEventListener("click", () => {
      for (const other of group.children) {
        const on = other === button;
        other.classList.toggle("is-on", on);
        other.setAttribute("aria-pressed", String(on));
      }
      onPick(item.id);
    });
    group.append(button);
  }
  control.append(name, group);
  return control;
}

function row(label, text, tone, extra) {
  const tr = el("tr");
  const value = el("td", tone ? `is-${tone}` : "", text);
  if (extra) value.classList.add(extra);
  tr.append(el("th", "", label), value);
  tr.firstChild.scope = "row";
  return tr;
}

function renderTable(table, panel) {
  const head = el("thead");
  const top = el("tr");
  for (const text of ["MAG7 Oscillator", "Values"]) {
    const th = el("th", "", text);
    th.scope = "col";
    top.append(th);
  }
  head.append(top);
  const body = el("tbody");
  body.append(
    row("Value", panel.valueText, panel.tone),
    row("Mode", panel.mode, "neutral"),
    row("Signal", panel.signal, panel.tone, "is-signal"),
    row("Type", panel.type),
    ...panel.legs.map((leg) => row(leg.label, leg.text, leg.tone)),
    row("Breadth", `${panel.breadth}%`, panel.breadthTone),
    row("Threshold", panel.threshold),
  );
  table.replaceChildren(head, body);
}

function renderLegend(legend, result, index) {
  const panel = panelAt(result, index);
  const parts = [el("span", "mo-legend-name", panel.mode), el("span", "mo-legend-args", `${result.type} ${result.params.momentumLength} ${result.params.smoothingLength}`)];
  const value = el("span", `mo-legend-value is-${panel.tone}`, fmtAxis(panel.value));
  parts.push(value);
  if (index !== result.values.length - 1) parts.push(el("span", "mo-legend-date", longDate(panel.date)));
  legend.replaceChildren(...parts);
}

function nowLine(result) {
  const last = result.values.length - 1;
  const panel = panelAt(result, last);
  const lead = `Now ${panel.signal} at ${panel.valueText} with ${panel.breadthUp} of ${result.names.length} names up over ${result.params.momentumLength} sessions.`;
  if (!result.pivots) return lead;
  const { caution, stretched } = result.pivots;
  if (panel.value <= stretched) return `${lead} Through the stretched line at ${fmtPct(stretched)}.`;
  if (panel.value >= caution) return `${lead} Through the caution line at +${fmtPct(caution)}.`;
  const gap = panel.value < 0 ? panel.value - stretched : caution - panel.value;
  const line = panel.value < 0 ? `stretched line at ${fmtPct(stretched)}` : `caution line at +${fmtPct(caution)}`;
  return `${lead} ${fmtPct(Math.abs(gap))} from the ${line}.`;
}

function renderKey(key, result) {
  const { upper, lower } = result.thresholds;
  const relative = result.mode === "relative";
  key.querySelector('[data-key="bull"]').textContent = `${relative ? "Outperform" : "Bullish"} above +${fmtPct(upper)}`;
  key.querySelector('[data-key="bear"]').textContent = `${relative ? "Underperform" : "Bearish"} below ${fmtPct(lower)}`;
  for (const name of ["caution", "stretched"]) key.querySelector(`[data-key="${name}"]`).hidden = !result.pivots;
}

function mountCard(doc) {
  const state = { mode: "mag7", type: "Momentum", range: "desk", cursor: null };
  const controls = document.getElementById("mo-controls");
  const plot = document.getElementById("mo-plot");
  const legend = document.getElementById("mo-legend");
  const table = document.getElementById("mo-table");
  const now = document.getElementById("mo-now");
  const basis = document.getElementById("mo-basis");
  const key = document.getElementById("mo-key");
  const status = document.getElementById("mo-status");
  status.remove();

  const update = mountPlot(plot, drawOscillator);
  const svgRoot = plot.querySelector("svg");
  svgRoot.setAttribute("tabindex", "0");
  let result;
  let from;

  const paint = () => {
    const to = result.values.length - 1;
    const last = to;
    update({
      result,
      from,
      to,
      cursor: state.cursor,
      label: `MAG7 Oscillator, ${result.type}, ${longDate(result.dates[from])} to ${longDate(result.dates[to])}. ${nowLine(result)}`,
      onHover: (index) => renderLegend(legend, result, index ?? state.cursor ?? last),
    });
    renderLegend(legend, result, state.cursor ?? last);
  };

  const rebuild = () => {
    result = buildOscillator(doc, { mode: state.mode, type: state.type });
    from = rangeStart(result, state.range, doc.defaultFrom);
    state.cursor = null;
    renderTable(table, panelAt(result, result.values.length - 1));
    renderKey(key, result);
    now.textContent = nowLine(result);
    paint();
  };

  controls.append(
    seg("Mode", MODES, state.mode, (id) => {
      state.mode = id;
      rebuild();
    }),
    seg("Type", TYPES.map((type) => ({ id: type, label: type })), state.type, (id) => {
      state.type = id;
      rebuild();
    }),
    seg("Range", RANGES, state.range, (id) => {
      state.range = id;
      from = rangeStart(result, state.range, doc.defaultFrom);
      state.cursor = null;
      paint();
    }),
  );

  svgRoot.addEventListener("keydown", (event) => {
    const to = result.values.length - 1;
    const at = state.cursor ?? to;
    let next = null;
    if (event.key === "ArrowLeft") next = Math.max(from, at - 1);
    else if (event.key === "ArrowRight") next = Math.min(to, at + 1);
    else if (event.key === "Home") next = from;
    else if (event.key === "End") next = to;
    else if (event.key === "Escape") next = null;
    else return;
    event.preventDefault();
    state.cursor = next;
    paint();
  });
  svgRoot.addEventListener("blur", () => {
    if (state.cursor === null) return;
    state.cursor = null;
    paint();
  });

  basis.textContent = `Desk · ${asOfLabel(doc)} · ${doc.basis} S&P EW leg reads the equal-weight S&P 500 fund.`;
  rebuild();
}

async function load() {
  const res = await fetch(DATA);
  if (!res.ok) throw new Error(`oscillator ${res.status}`);
  const doc = await res.json();
  if (doc.sku !== "mag7-oscillator" || !Array.isArray(doc.dates) || !doc.names?.every((ticker) => doc.closes?.[ticker]?.length === doc.dates.length)) {
    throw new Error("oscillator document is missing fields");
  }
  mountCard(doc);
}

document.addEventListener("vault-open", () => {
  const card = document.getElementById("mag7");
  if (!card || card.dataset.ready === "1") return;
  card.dataset.ready = "1";
  load().catch((error) => {
    console.error(error);
    const status = document.getElementById("mo-status");
    if (status) status.textContent = "The oscillator did not load. Refresh to try again.";
  });
});
