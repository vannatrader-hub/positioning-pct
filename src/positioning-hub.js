import { CANON, WEEKS, buildReading, ordinal } from "./readings.js";
import { INDICATORS, SECTIONS, leanOf, median, readIndicator } from "./desk.js";
import { VOL_RANGE, broadEquityChart, chartFacts, creditChart, fundManagerChart, riskChart, sectorChart, softVolChart } from "./pct-charts.js";
import { TONE, gaugeSvg, miniBars, miniColumns, miniLines, miniTracks } from "./chart-svg.js";

const base = import.meta.env ? import.meta.env.BASE_URL : "/";

/** The desk used to live at /positioning/ with ?source=…&week=… and #section links. */
const params = new URLSearchParams(window.location.search);
const deskIds = new Set(["overview", "study", ...SECTIONS.map((section) => section.id)]);
const legacyHash = deskIds.has(window.location.hash.slice(1));
const legacyQuery = ["source", "week", "window", "sector", "study"].some((key) => params.has(key));
if (legacyHash || legacyQuery) {
  window.location.replace(`${base}positioning/desk/${window.location.search}${window.location.hash}`);
}

function fact(key, text) {
  const item = document.querySelector(`[data-hub="${key}"]`);
  if (item) item.textContent = text;
}

const latest = WEEKS.length - 1;

const jpm = buildReading("jpm", latest, 4);
const printed = CANON.map((ticker) => jpm.sectors[ticker]).filter((sector) => sector.available);
const soft = printed.filter((sector) => sector.regime === "Soft").length;
const crowded = printed.filter((sector) => sector.regime === "Crowded").length;
fact("sectors", `JPM · week of ${jpm.weekLabel} · ${soft} soft · ${crowded} crowded`);

const credit = INDICATORS.filter((indicator) => indicator.section === "credit").map((indicator) => readIndicator(indicator, latest));
if (credit.length) {
  const mid = median(credit.map((read) => read.pct));
  fact("credit", `${credit.length} reads · median ${ordinal(mid)} · leans ${leanOf(mid).word.toLowerCase()}`);
}

const desk = buildReading("all", latest, 4);
fact("vol", `${desk.volName} ${desk.volDisplay} pts · week of ${desk.weekLabel}`);

for (const [id, text] of Object.entries(chartFacts(latest))) fact(`chart-${id}`, text);

const vol = softVolChart("desk", latest);
const cut = (points) => (points + VOL_RANGE) / (2 * VOL_RANGE);
const broad = broadEquityChart(latest).read;
const creditCharts = creditChart(latest);
const fms = fundManagerChart(latest);
const previews = {
  "soft-vol": () => gaugeSvg({ position: vol.position, cuts: [cut(-0.4), cut(0.4)], compact: true }),
  sectors: () => miniColumns(sectorChart("jpm", latest).bars),
  "broad-equity": () =>
    miniLines([{ values: broad.pctPath, color: TONE.ink }], {
      domain: [0, 100],
      bands: [
        { from: 0, to: 40, fill: TONE.bandSoft },
        { from: 67, to: 100, fill: TONE.bandCrowded },
      ],
    }),
  "credit-stress": () =>
    miniLines([
      { values: creditCharts.cdx.pctPath, color: TONE.ink },
      { values: creditCharts.bbb.pctPath, color: "#4a6cf7" },
    ], { domain: [60, 100] }),
  "fund-managers": () => miniBars(fms.trades, Math.max(...fms.trades.map((item) => item.value)) * 1.1),
  "risk-appetite": () => miniTracks(riskChart(latest).reads.map((read) => read.pct)),
};
for (const host of document.querySelectorAll("[data-preview]")) {
  const make = previews[host.dataset.preview];
  if (make) host.replaceChildren(make());
}
