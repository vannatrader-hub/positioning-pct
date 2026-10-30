/**
 * Credit Spread Regime card on the Vol · Credit · Momentum wall. Renders
 * after the Vault gate opens the page and reads the committed FRED series in
 * public/data/vault/credit-spread-regime/csr.json.
 */
import { CSR_COLORS, csrPanel, csrSeries, panelText, panelTones, zColor } from "./csr.js";
import { createCsrChart } from "./csr-chart.js";

const DATA = `${import.meta.env.BASE_URL}data/vault/credit-spread-regime/`;
const RANGES = { "3m": 63, "6m": 126, "1y": 252, all: 0 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PANEL_ROWS = [
  ["hy", "HY OAS"],
  ["ig", "IG OAS"],
  ["excess", "HY-IG Excess"],
  ["z", "Spread Z"],
  ["regime", "Regime"],
  ["percentile", "Percentile"],
  ["momentum", "Momentum"],
  ["vix", "VIX"],
  ["status", "Status"],
  ["cycle", "Credit Cycle"],
  ["bias", "Bias"],
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function rgb(color, alpha = 1) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

function dayLabel(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function toneColor(tone) {
  if (tone === "bear") return rgb(CSR_COLORS.bear);
  if (tone === "bear-soft") return rgb(CSR_COLORS.bear, 0.6);
  if (tone === "bull") return rgb(CSR_COLORS.bull);
  return rgb(CSR_COLORS.neutral);
}

function renderPanel(table, panel) {
  const text = panelText(panel);
  const tones = panelTones(panel);
  const head = el("tr", "csr-panel-head");
  head.append(el("th", "", "Credit Spread Regime"), el("th", ""));
  head.firstChild.scope = "col";
  const body = el("tbody");
  for (const [key, label] of PANEL_ROWS) {
    const row = el("tr");
    const name = el("th", "", label);
    name.scope = "row";
    const value = el("td", "", text[key]);
    value.dataset.key = key;
    value.style.color = key === "z" ? rgb(zColor(panel.z)) : toneColor(tones[key]);
    row.append(name, value);
    body.append(row);
  }
  const thead = el("thead");
  thead.append(head);
  table.replaceChildren(thead, body);
}

function renderLegend(legend, series, at, hovering) {
  const panel = csrPanel(series, at);
  const text = panelText(panel);
  const name = el("span", "csr-legend-name", "CSR");
  const value = el("span", "csr-legend-val", text.z);
  value.style.color = rgb(zColor(panel.z));
  const regime = el("span", "csr-legend-regime", panel.regime ?? "");
  regime.style.color = toneColor(panelTones(panel).regime);
  const parts = [name, value, regime];
  if (hovering) {
    parts.push(el("span", "csr-legend-meta", `${dayLabel(panel.date)} · HY ${text.hy} · IG ${text.ig} · excess ${text.excess}`));
  }
  const spx = el("span", "csr-legend-spx");
  spx.append(el("i", "", ""), document.createTextNode(`SPX ${panel.spx.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`));
  parts.push(spx);
  legend.replaceChildren(...parts);
}

function summary(series, doc) {
  const panel = csrPanel(series);
  const text = panelText(panel);
  const metric = series.metric === "hy" ? "HY OAS" : "HY−IG excess";
  return `Credit Spread Regime, ${metric} Z-score, through ${dayLabel(doc.asOf)}: Z ${text.z}, ${panel.regime}, ${text.percentile} percentile, momentum ${text.momentum}, bias ${panel.bias}. HY ${text.hy}, IG ${text.ig}, excess ${text.excess}.`;
}

function mountCsr(card, doc) {
  const frame = card.querySelector("#csr-frame");
  const legend = card.querySelector("#csr-legend");
  const table = card.querySelector("#csr-panel");
  const asof = card.querySelector("#csr-asof");
  const live = card.querySelector("#csr-live");
  let series = csrSeries(doc);

  const chart = createCsrChart(frame, {
    onHover(at) {
      renderLegend(legend, series, at ?? series.t.length - 1, at !== null);
    },
  });

  function paint() {
    renderPanel(table, csrPanel(series));
    renderLegend(legend, series, series.t.length - 1, false);
    const label = summary(series, doc);
    frame.querySelector("canvas").setAttribute("aria-label", label);
    live.textContent = label;
  }

  chart.setSeries(series);
  paint();

  /* The panel floats in the pane's right margin, so the last session stays clear of it. */
  const stage = card.querySelector(".csr-stage");
  const fitGutter = () => {
    if (getComputedStyle(table).position !== "absolute") return chart.setGutter(null);
    const right = stage.getBoundingClientRect().right - table.getBoundingClientRect().right;
    chart.setGutter(table.offsetWidth + right - 66 + 16);
  };
  new ResizeObserver(fitGutter).observe(stage);
  fitGutter();
  asof.textContent = `Through ${dayLabel(doc.asOf)} · ${doc.series.t.length - series.first} sessions of Z`;

  for (const group of card.querySelectorAll("[data-seg]")) {
    group.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      for (const other of group.querySelectorAll("button")) {
        const on = other === button;
        other.classList.toggle("is-on", on);
        other.setAttribute("aria-pressed", String(on));
      }
      if (group.dataset.seg === "range") chart.setRange(RANGES[button.dataset.range] ?? 0);
      if (group.dataset.seg === "metric") {
        series = csrSeries(doc, { metric: button.dataset.metric });
        chart.setSeries(series, { keepView: true });
        paint();
      }
    });
  }

  const spx = card.querySelector("#csr-spx");
  spx.addEventListener("click", () => {
    const on = spx.getAttribute("aria-pressed") !== "true";
    spx.setAttribute("aria-pressed", String(on));
    frame.classList.toggle("no-spx", !on);
    chart.setSpx(on);
  });
}

async function load(card) {
  const res = await fetch(`${DATA}csr.json`);
  if (!res.ok) throw new Error(`csr ${res.status}`);
  const doc = await res.json();
  const { t, hy, ig, spx } = doc.series ?? {};
  if (!t?.length || hy?.length !== t.length || ig?.length !== t.length || spx?.length !== t.length) {
    throw new Error("csr series is missing columns");
  }
  card.querySelector("#csr-status")?.remove();
  mountCsr(card, doc);
}

document.addEventListener("vault-open", () => {
  const card = document.getElementById("credit-spread-regime");
  if (!card || card.dataset.ready === "1") return;
  card.dataset.ready = "1";
  load(card).catch((error) => {
    console.error(error);
    const status = card.querySelector("#csr-status");
    if (status) status.textContent = "The credit series did not load. Refresh to try again.";
  });
});
