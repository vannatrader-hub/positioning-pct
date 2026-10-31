import { WEEKS, formatWeek, ordinal } from "./readings.js";
import { HOUSES } from "./desk.js";
import {
  CHARTS,
  SECTOR_BUCKETS,
  VOL_RANGE,
  WEEK_LABELS,
  broadEquityChart,
  creditChart,
  fundManagerChart,
  riskChart,
  sectorChart,
  signed,
  softVolChart,
  volTone,
} from "./pct-charts.js";
import { OVERLAY_COLORS, TONE, drawLines, drawResidual, drawSectors, gaugeSvg, mountPlot, setNeedle } from "./chart-svg.js";

const STORAGE_KEY = "positioning-pct-source";
const LATEST = WEEKS.length - 1;
const HOUSE_COLORS = { jpm: "var(--house-jpm, #2c3f9e)", ms: "var(--house-ms, #4d3a8f)", gs: "var(--house-gs, #1d5f86)", boa: "var(--house-boa, #a32a26)", desk: TONE.ink };
const PCT_BANDS = [
  { from: 0, to: 40, fill: TONE.bandSoft, label: "Soft", ink: TONE.softInk },
  { from: 67, to: 100, fill: TONE.bandCrowded, label: "Crowded", ink: TONE.crowded },
];

const state = {
  week: LATEST,
  vol: { source: "desk", compare: false },
  sectors: { source: "jpm", order: "fund", selected: "XLF", focus: null },
  broad: { overlays: [] },
  credit: { mode: "level" },
  fms: { view: "crowded" },
  risk: { id: "gs-risk-appetite" },
};

const painters = [];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function readState() {
  const params = new URLSearchParams(location.search);
  const week = WEEKS.indexOf(params.get("week") || "");
  state.week = week >= 0 ? week : LATEST;
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* Storage can be blocked; the default house stands. */
  }
  if (["jpm", "ms", "gs", "boa", "desk"].includes(stored)) state.sectors.source = stored;
}

function setWeek(week) {
  state.week = Math.min(LATEST, Math.max(0, week));
  const url = new URL(location.href);
  if (state.week === LATEST) url.searchParams.delete("week");
  else url.searchParams.set("week", WEEKS[state.week]);
  history.replaceState(null, "", url);
  paint();
}

function statusPill(text, tone) {
  const status = el("p", `status lv-${tone === "xsoft" ? "soft" : tone}`);
  const dot = el("i");
  dot.setAttribute("aria-hidden", "true");
  status.append(dot, document.createTextNode(text));
  return status;
}

/** The desk's Soft ↔ Crowded bar: zoned track, a marker at the percentile, labelled ends, caption below. */
function scBar({ pct, caption, ends = ["Soft", "Crowded"], label }) {
  const root = el("div", "sc");
  if (pct >= 67) root.classList.add("is-crowded");
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", label ?? `${caption}. ${ends[0]} on the left, ${ends[1]} on the right.`);
  const line = el("div", "sc-line");
  const wrap = el("div", "sc-track-wrap");
  const pin = el("i", "sc-pin");
  pin.style.left = `${Math.min(98, Math.max(2, pct))}%`;
  pin.setAttribute("aria-hidden", "true");
  const track = el("div", "sc-track");
  for (const zone of ["z-soft", "z-mid", "z-crowd"]) track.append(el("i", `z ${zone}`));
  wrap.append(pin, track, el("div", "sc-caption", caption));
  line.append(el("span", "sc-end", ends[0]), wrap, el("span", "sc-end", ends[1]));
  root.append(line);
  return root;
}

function miniTrack(pct) {
  const track = el("span", "map-track");
  const lane = el("span", "map-zones");
  for (const zone of ["z-soft", "z-mid", "z-crowd"]) lane.append(el("i", `z ${zone}`));
  const pin = el("i", "sc-pin");
  pin.style.left = `${Math.min(98, Math.max(2, pct))}%`;
  pin.setAttribute("aria-hidden", "true");
  track.append(lane, pin);
  return track;
}

function figure(value, unit, pill, tone) {
  const box = el("div", "icard-figure");
  const big = el("p", "ivalue", value);
  if (unit) big.append(el("span", "iunit", unit));
  box.append(big, statusPill(pill, tone));
  return box;
}

/** A radio group of small chips. Arrow keys move the choice like the desk's source chips. */
function chipGroup(label, options, current, onPick) {
  const group = el("div", "chips is-sm");
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", label);
  const buttons = options.map((option) => {
    const button = el("button", "chip", option.label);
    button.type = "button";
    button.setAttribute("role", "radio");
    button.dataset.value = option.id;
    button.addEventListener("click", () => onPick(option.id));
    return button;
  });
  group.append(...buttons);
  group.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const ids = options.map((option) => option.id);
    const next = ids[(ids.indexOf(current()) + (event.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length];
    onPick(next);
    group.querySelector(`[data-value="${next}"]`)?.focus();
  });
  const sync = () => {
    for (const button of buttons) {
      const on = button.dataset.value === current();
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-checked", on ? "true" : "false");
      button.tabIndex = on ? 0 : -1;
    }
  };
  return { node: group, sync };
}

function segmented(label, options, current, onPick) {
  const group = el("div", "seg");
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", label);
  const buttons = options.map((option) => {
    const button = el("button", "", option.label);
    button.type = "button";
    button.dataset.value = option.id;
    button.addEventListener("click", () => onPick(option.id));
    return button;
  });
  group.append(...buttons);
  const sync = () => {
    for (const button of buttons) {
      const on = button.dataset.value === current();
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    }
  };
  return { node: group, sync };
}

function controlRow(...items) {
  const row = el("div", "pchart-controls");
  for (const [label, node] of items) {
    const field = el("div", "pchart-control");
    field.append(el("span", "pchart-control-label", label), node);
    row.append(field);
  }
  return row;
}

function deskLink(chart, href = `../desk/#${chart.deskSection}`) {
  const link = el("a", "pchart-link");
  link.href = href;
  const arrow = el("span", "arrow", "→");
  arrow.setAttribute("aria-hidden", "true");
  link.append(document.createTextNode("Open on the desk "), arrow);
  return link;
}

function shell(id) {
  const card = document.getElementById(id);
  const chart = CHARTS.find((item) => item.id === id);
  return { card, chart, body: card.querySelector(".pchart-body"), basis: card.querySelector(".basis") };
}

const weekTip = (index) => formatWeek(WEEKS[index]);
const housesOf = (sources) => sources.map((id) => ({ id, label: HOUSES[id] }));

/* 01 · Soft Vol ↔ Stretched */
function buildSoftVol() {
  const { chart, body, basis, card } = shell("soft-vol");
  const pick = chipGroup("House", housesOf(chart.sources), () => state.vol.source, (id) => {
    state.vol.source = id;
    paint();
  });
  const compare = el("button", "toggle", "Compare houses");
  compare.type = "button";
  compare.addEventListener("click", () => {
    state.vol.compare = !state.vol.compare;
    paint();
  });

  const cut = (points) => (points + VOL_RANGE) / (2 * VOL_RANGE);
  const gauge = gaugeSvg({ position: 0.5, cuts: [cut(-0.4), cut(0.4)] });
  const gaugeCol = el("div", "vol-gauge");
  const legend = el("div", "g-labels");
  legend.append(el("span", "", "Soft vol"), el("span", "", "Fair"), el("span", "", "Stretched"));
  const readout = el("div", "vol-readout");
  gaugeCol.append(gauge, legend, readout);

  const plotCol = el("div", "vol-plot");
  const host = el("div", "pc-plot is-tall");
  plotCol.append(el("p", "pc-plot-label", "Residual by week, in vol points"), host);
  const draw = mountPlot(host, drawResidual);

  const layout = el("div", "vol-layout");
  layout.append(gaugeCol, plotCol);

  const copy = el("div", "gauge-copy");
  copy.append(
    el("p", "", "Soft Vol means the VIX is cheaper than the S&P 500 usually implies. Stretched means the VIX is richer than fair."),
    el("p", "", "Within 0.4 points of zero reads Fair. The gauge runs −3 to +3, the same scale as the desk gauge."),
    el("p", "", "Each house shifts the same residual by its own read. Desk is the blend of JPM, MS, GS, and BoA."),
  );
  const foot = el("div", "pchart-foot");
  const change = el("p", "icard-change");
  foot.append(change, deskLink(chart));

  body.append(controlRow(["House", pick.node], ["View", compare]), layout, copy, foot);

  painters.push(() => {
    const read = softVolChart(state.vol.source, state.week);
    pick.sync();
    compare.setAttribute("aria-pressed", state.vol.compare ? "true" : "false");
    compare.classList.toggle("is-on", state.vol.compare);
    basis.textContent = read.source === "desk" ? "Desk composite of JPM, MS, GS, BoA" : `${read.houseLabel} house view`;
    card.querySelector(".house").className = `house h-${read.source}`;
    card.querySelector(".house").textContent = read.houseLabel;
    setNeedle(gauge, read.position);
    gauge.setAttribute("aria-label", `${read.name}, ${read.display} points`);
    const big = el("p", "ivalue", read.display);
    big.append(el("span", "iunit", "pts"));
    readout.replaceChildren(big, statusPill(read.name, read.tone));
    change.textContent = `${read.change} · week of ${formatWeek(WEEKS[read.week])}`;
    draw({
      label: `${read.houseLabel} Soft Vol residual by week. This week ${read.display} points, ${read.name}.`,
      labels: WEEK_LABELS,
      values: read.points,
      week: read.week,
      tone: volTone,
      ghosts: state.vol.compare
        ? chart.sources.filter((id) => id !== read.source).map((id) => ({ label: HOUSES[id], values: read.houses[id], color: HOUSE_COLORS[id] }))
        : [],
      tip: (index) => {
        const value = read.points[index];
        const lines = [weekTip(index), `${read.houseLabel} ${signed(value)} pts · ${softVolChart(read.source, index).name}`];
        if (state.vol.compare) {
          for (const id of chart.sources) if (id !== read.source) lines.push(`${HOUSES[id]} ${signed(read.houses[id][index])}`);
        }
        return lines;
      },
      onPick: setWeek,
    });
  });
}

/* 02 · Sector Soft ↔ Crowded */
function buildSectors() {
  const { chart, body, basis, card } = shell("sectors");
  const pick = chipGroup("House", housesOf(chart.sources), () => state.sectors.source, (id) => {
    state.sectors.source = id;
    paint();
  });
  const order = segmented("Order", [
    { id: "fund", label: "XLF → XLC" },
    { id: "softest", label: "Softest first" },
  ], () => state.sectors.order, (id) => {
    state.sectors.order = id;
    paint();
  });

  const host = el("div", "pc-plot is-sectors");
  const draw = mountPlot(host, drawSectors);
  const key = el("div", "bucket-key");
  key.setAttribute("role", "group");
  key.setAttribute("aria-label", "Highlight a Soft ↔ Crowded column");
  const keyButtons = SECTOR_BUCKETS.map((bucket) => {
    const button = el("button", `bucket-key-item is-${bucket.tone}`);
    button.type = "button";
    button.dataset.level = bucket.level;
    button.addEventListener("click", () => {
      state.sectors.focus = state.sectors.focus === bucket.level ? null : bucket.level;
      paint();
    });
    key.append(button);
    return { button, bucket };
  });

  const detail = el("div", "sector-detail");
  const detailInfo = el("div", "sector-detail-info");
  const pathHost = el("div", "pc-plot is-short");
  const pathCol = el("div", "sector-detail-path");
  pathCol.append(el("p", "pc-plot-label", "Eight-week path"), pathHost);
  const drawPath = mountPlot(pathHost, drawLines);
  detail.append(detailInfo, pathCol);

  const foot = el("div", "pchart-foot");
  const note = el("p", "icard-change");
  const link = deskLink(chart);
  foot.append(note, link);

  body.append(controlRow(["House", pick.node], ["Order", order.node]), host, key, detail, foot);

  painters.push(() => {
    const data = sectorChart(state.sectors.source, state.week, state.sectors.order);
    pick.sync();
    order.sync();
    basis.textContent = data.basis;
    card.querySelector(".house").className = `house h-${data.source}`;
    card.querySelector(".house").textContent = data.houseLabel;
    let selected = data.bars.find((bar) => bar.ticker === state.sectors.selected);
    if (!selected?.available) selected = data.bars.find((bar) => bar.ticker === "XLF");

    draw({
      label: `${data.houseLabel} sector positioning percentiles: ${data.bars.map((bar) => `${bar.ticker} ${bar.available ? bar.display : "no print"}`).join(", ")}.`,
      bars: data.bars,
      buckets: SECTOR_BUCKETS,
      selected: selected.ticker,
      focus: state.sectors.focus,
      tip: (bar) =>
        bar.available
          ? [`${bar.ticker} · ${bar.short}`, `${bar.ile} · ${bar.pill}`, bar.wowText]
          : [`${bar.ticker} · ${bar.short}`, `${bar.note}. Switch the house for a read.`],
      onPick: (ticker) => {
        const bar = data.bars.find((item) => item.ticker === ticker);
        if (!bar?.available) return;
        state.sectors.selected = ticker;
        paint();
      },
    });

    for (const { button, bucket } of keyButtons) {
      const on = state.sectors.focus === bucket.level;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
      const title = el("span", "bucket-key-title");
      title.append(el("strong", "", bucket.title), el("span", "", bucket.range));
      button.replaceChildren(title, el("span", "bucket-count", String(data.counts[bucket.level])));
    }

    const head = el("div", "sector-detail-head");
    const names = el("div");
    names.append(el("p", "sector-detail-ticker", selected.ticker), el("p", "sector-detail-name", selected.name));
    head.append(names, statusPill(selected.pill, selected.tone));
    const big = el("p", "pct", selected.display);
    if (selected.tone === "crowded") big.classList.add("is-crowded");
    detailInfo.replaceChildren(
      head,
      big,
      el("p", "pct-kicker", `positioning percentile · ${selected.wowText}`),
      scBar({ pct: selected.points, caption: selected.ile }),
    );
    drawPath({
      label: `${selected.ticker} positioning percentile over eight weeks.`,
      labels: WEEK_LABELS,
      series: [{ values: selected.series, color: selected.tone === "crowded" ? TONE.crowded : TONE.ink, area: true, label: selected.ticker }],
      week: state.week,
      domain: [0, 100],
      ticks: [0, 25, 40, 67, 100],
      yFormat: (value) => (value / 100).toFixed(2),
      bands: [
        { from: 0, to: 25, fill: TONE.bandXsoft },
        { from: 25, to: 40, fill: TONE.bandSoft },
        { from: 67, to: 100, fill: TONE.bandCrowded },
      ],
      tip: (index) => [weekTip(index), `${selected.ticker} ${(selected.series[index] / 100).toFixed(2)} · ${ordinal(selected.series[index])} %ile`],
      onPick: setWeek,
    });

    const printed = data.bars.filter((bar) => bar.available).length;
    note.textContent = `${printed} of 11 funds printed · tap a column to open its path`;
    link.href = `../desk/?source=${data.source}&sector=${selected.ticker}#sectors`;
  });
}

/* 03 · Broad equity positioning */
function buildBroad() {
  const { chart, body } = shell("broad-equity");
  const first = broadEquityChart(state.week);
  const overlays = el("div", "chips is-sm");
  overlays.setAttribute("role", "group");
  overlays.setAttribute("aria-label", "Compare with other monitor lines");
  const overlayButtons = first.overlays.map((label) => {
    const button = el("button", "chip", label);
    button.type = "button";
    button.addEventListener("click", () => {
      const list = state.broad.overlays;
      const at = list.indexOf(label);
      if (at >= 0) list.splice(at, 1);
      else {
        list.push(label);
        if (list.length > 3) list.shift();
      }
      paint();
    });
    return { button, label };
  });
  overlays.append(...overlayButtons.map((item) => item.button));

  const top = el("div", "pchart-figure");
  const host = el("div", "pc-plot");
  const draw = mountPlot(host, drawLines);
  const foot = el("div", "pchart-foot");
  const change = el("div", "pchart-notes");
  foot.append(change, deskLink(chart));
  body.append(top, host, controlRow(["Compare with, up to three", overlays]), foot);

  painters.push(() => {
    const data = broadEquityChart(state.week);
    const { read } = data;
    top.replaceChildren(figure(read.value, "", read.pill, read.tone), scBar({ pct: read.pct, caption: read.caption }));
    const colorOf = (label) => OVERLAY_COLORS[state.broad.overlays.indexOf(label) % OVERLAY_COLORS.length];
    for (const { button, label } of overlayButtons) {
      const on = state.broad.overlays.includes(label);
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
      button.style.setProperty("--chip-dot", on ? colorOf(label) : "transparent");
    }
    const picked = data.lines.filter((line) => state.broad.overlays.includes(line.label));
    draw({
      label: `JPM broad equity positioning percentile by week, now ${read.value}.`,
      labels: WEEK_LABELS,
      week: state.week,
      domain: [0, 100],
      ticks: [0, 40, 67, 100],
      yFormat: (value) => (value / 100).toFixed(2),
      bands: PCT_BANDS,
      endLabels: picked.length > 0,
      series: [
        ...picked.map((line) => ({ values: line.path, color: colorOf(line.label), label: line.label, width: 1.8, dots: false })),
        { values: read.pctPath, color: TONE.ink, area: true, label: "Equities", pointColor: (index) => (read.pctPath[index] >= 67 ? TONE.crowded : TONE.ink) },
      ],
      tip: (index) => [
        weekTip(index),
        `Equities ${(read.pctPath[index] / 100).toFixed(2)}`,
        ...picked.map((line) => `${line.label} ${(line.path[index] / 100).toFixed(2)}`),
      ],
      onPick: setWeek,
    });
    change.replaceChildren(el("p", "icard-change", read.change));
    if (read.latestNote) change.append(el("p", "icard-latest", read.latestNote));
  });
}

/* 04 · Credit stress */
function buildCredit() {
  const { chart, body } = shell("credit-stress");
  const mode = segmented("Scale", [
    { id: "level", label: "Levels" },
    { id: "pct", label: "Percentiles" },
  ], () => state.credit.mode, (id) => {
    state.credit.mode = id;
    paint();
  });
  const summary = el("div", "credit-sum");
  const levels = el("div", "credit-panels");
  const cdxHost = el("div", "pc-plot is-short");
  const bbbHost = el("div", "pc-plot is-short");
  const cdxLabel = el("p", "pc-plot-label");
  const bbbLabel = el("p", "pc-plot-label");
  levels.append(cdxLabel, cdxHost, bbbLabel, bbbHost);
  const pctHost = el("div", "pc-plot");
  const drawCdx = mountPlot(cdxHost, drawLines);
  const drawBbb = mountPlot(bbbHost, drawLines);
  const drawPct = mountPlot(pctHost, drawLines);
  const bar = el("div");
  const gapRows = el("div", "rows rows-text");
  const foot = el("div", "pchart-foot");
  const change = el("div", "pchart-notes");
  foot.append(change, deskLink(chart));
  body.append(controlRow(["Scale", mode.node]), summary, levels, pctHost, bar, gapRows, foot);

  painters.push(() => {
    const data = creditChart(state.week);
    mode.sync();
    const levelMode = state.credit.mode === "level";
    levels.hidden = !levelMode;
    pctHost.hidden = levelMode;

    summary.replaceChildren(
      ...[data.cdx, data.bbb].map((read) => {
        const box = el("div", "credit-read");
        box.append(el("p", "credit-read-title", read.title), figure(read.value, read.unit, read.pill, read.tone));
        return box;
      }),
    );
    cdxLabel.textContent = `CDX, bp · ${data.cdx.basis}`;
    bbbLabel.textContent = `BBB minus AAA, pts · ${data.bbb.basis}`;
    const common = { labels: WEEK_LABELS, week: state.week, onPick: setWeek };
    drawCdx({
      ...common,
      label: `CDX credit default swaps by week, now ${data.cdx.value} bp.`,
      series: [{ values: data.cdx.path, color: TONE.ink, area: true }],
      yFormat: (value) => String(Math.round(value)),
      tip: (index) => [weekTip(index), `CDX ${data.cdx.shown[index]} bp · ${ordinal(data.cdx.pctPath[index])} %ile`],
    });
    drawBbb({
      ...common,
      label: `BBB minus AAA spread by week, now ${data.bbb.value} points.`,
      series: [{ values: data.bbb.path, color: "#4a6cf7", area: true }],
      yFormat: (value) => value.toFixed(2),
      tip: (index) => [weekTip(index), `BBB−AAA ${data.bbb.shown[index]} pts · ${ordinal(data.bbb.pctPath[index])} %ile`],
    });
    drawPct({
      ...common,
      label: `CDX and BBB minus AAA as Soft ↔ Crowded percentiles by week.`,
      domain: [0, 100],
      ticks: [0, 40, 67, 100],
      yFormat: (value) => (value / 100).toFixed(2),
      bands: PCT_BANDS,
      endLabels: true,
      series: [
        { values: data.cdx.pctPath, color: TONE.ink, label: "CDX" },
        { values: data.bbb.pctPath, color: "#4a6cf7", label: "BBB−AAA" },
      ],
      tip: (index) => [weekTip(index), `CDX ${ordinal(data.cdx.pctPath[index])} %ile`, `BBB−AAA ${ordinal(data.bbb.pctPath[index])} %ile`],
    });
    bar.replaceChildren(
      scBar({ pct: data.pct, caption: data.caption, label: `Credit, both panels: ${data.caption}. Soft is wide spreads, crowded is tight.` }),
    );
    gapRows.replaceChildren(
      ...data.gap.rows.items.map((item) => {
        const row = el("div", "row");
        row.append(el("span", "row-label", item.label), el("span", "row-value", item.text));
        return row;
      }),
    );
    change.replaceChildren(el("p", "icard-change", data.change));
    if (data.cdx.latestNote) change.append(el("p", "icard-latest", data.cdx.latestNote));
  });
}

/* 05 · Fund manager survey */
function buildFundManagers() {
  const { chart, body } = shell("fund-managers");
  const view = segmented("Series", [
    { id: "crowded", label: "Crowded share" },
    { id: "cash", label: "Cash level" },
  ], () => state.fms.view, (id) => {
    state.fms.view = id;
    paint();
  });
  const top = el("div", "pchart-figure");
  const layout = el("div", "fms-layout");
  const trades = el("div", "fms-trades");
  const plotCol = el("div", "fms-plot");
  const host = el("div", "pc-plot");
  const plotLabel = el("p", "pc-plot-label");
  plotCol.append(controlRow(["Series", view.node]), plotLabel, host);
  layout.append(trades, plotCol);
  const draw = mountPlot(host, drawLines);
  const foot = el("div", "pchart-foot");
  const change = el("div", "pchart-notes");
  foot.append(change, deskLink(chart));
  body.append(top, layout, foot);

  painters.push(() => {
    const data = fundManagerChart(state.week);
    view.sync();
    const read = state.fms.view === "cash" ? data.cash : data.crowded;
    top.replaceChildren(
      figure(read.value, read.unit, read.pill, read.tone),
      scBar({ pct: read.pct, caption: read.caption, label: `${read.title}: ${read.value}${read.unit}, ${read.caption}.` }),
    );

    const rows = el("div", "rows rows-fill");
    const max = Math.max(...data.trades.map((item) => item.value)) * 1.1;
    data.trades.forEach((item, index) => {
      const row = el("div", index ? "row" : "row is-lead");
      const track = el("span", "row-track");
      const fill = el("i", "row-fill");
      fill.style.width = `${Math.min(100, (item.value / max) * 100)}%`;
      track.append(fill);
      row.append(el("span", "row-label", item.label), track, el("span", "row-value", item.text));
      rows.append(row);
    });
    trades.replaceChildren(
      el("h3", "pchart-subtitle", "Most crowded trade"),
      el("p", "pc-plot-label", `Share of fund managers naming it · ${data.survey}`),
      rows,
    );

    plotLabel.textContent = `${read.title} by week · ${read.basis}`;
    const cash = state.fms.view === "cash";
    draw({
      label: `${read.title} by week, now ${read.value}${read.unit}.`,
      labels: WEEK_LABELS,
      week: state.week,
      series: [{ values: read.path, color: cash ? TONE.ink : TONE.crowded, area: true }],
      guides: cash ? [{ value: 4, label: "4% line" }] : [],
      yFormat: (value) => (cash ? `${value.toFixed(1)}%` : `${Math.round(value)}%`),
      tip: (index) => [weekTip(index), `${read.title} ${read.shown[index]}% · ${ordinal(read.pctPath[index])} %ile`],
      onPick: setWeek,
    });
    change.replaceChildren(el("p", "icard-change", read.change));
    if (read.latestNote) change.append(el("p", "icard-latest", read.latestNote));
  });
}

/* 06 · GS risk appetite */
function buildRisk() {
  const { chart, body, basis } = shell("risk-appetite");
  const strip = el("div", "risk-strip");
  strip.setAttribute("role", "tablist");
  strip.setAttribute("aria-label", "Risk appetite reads");
  const top = el("div", "pchart-figure");
  const plotLabel = el("p", "pc-plot-label");
  const host = el("div", "pc-plot");
  const draw = mountPlot(host, drawLines);
  const foot = el("div", "pchart-foot");
  const change = el("div", "pchart-notes");
  foot.append(change, deskLink(chart));
  body.append(strip, top, plotLabel, host, foot);

  painters.push(() => {
    const { reads } = riskChart(state.week);
    const read = reads.find((item) => item.id === state.risk.id) ?? reads[0];
    strip.replaceChildren(
      ...reads.map((item) => {
        const on = item.id === read.id;
        const tab = el("button", on ? "risk-item is-on" : "risk-item");
        if (item.tone === "crowded") tab.classList.add("is-crowded");
        tab.type = "button";
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.tabIndex = on ? 0 : -1;
        const head = el("span", "risk-item-head");
        head.append(el("span", `house h-${item.house}`, item.houseLabel), el("strong", "risk-item-value", `${item.value}${item.unit && item.unit !== "%ile" ? ` ${item.unit}` : ""}`));
        tab.append(head, el("span", "risk-item-title", item.title), miniTrack(item.pct), el("span", "risk-item-cap", item.caption));
        tab.addEventListener("click", () => {
          state.risk.id = item.id;
          paint();
          strip.querySelector(`[aria-selected="true"]`)?.focus();
        });
        tab.addEventListener("keydown", (event) => {
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
          event.preventDefault();
          const ids = reads.map((entry) => entry.id);
          state.risk.id = ids[(ids.indexOf(item.id) + (event.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length];
          paint();
          strip.querySelector(`[aria-selected="true"]`)?.focus();
        });
        return tab;
      }),
    );
    basis.textContent = read.house === "desk" ? `Desk read · ${read.basis}` : read.basis;
    const sub = el("p", "icard-sub", read.sub);
    const fig = figure(read.value, read.unit, read.pill, read.tone);
    top.replaceChildren(sub, fig, scBar({ pct: read.pct, caption: read.caption, ends: read.ends }));
    plotLabel.textContent = `${read.title} by week · ${read.houseLabel}`;
    draw({
      label: `${read.title} by week, now ${read.value}.`,
      labels: WEEK_LABELS,
      week: state.week,
      series: [{ values: read.path, color: TONE.ink, area: true, areaBase: read.guides[0]?.value, pointColor: (index) => (read.pctPath[index] >= 67 ? TONE.crowded : TONE.ink) }],
      guides: read.guides,
      yFormat: (value) => (read.unit === "z" ? signed(value) : String(Math.round(value * 10) / 10)),
      tip: (index) => [weekTip(index), `${read.title} ${read.shown[index]} · ${ordinal(read.pctPath[index])} %ile`],
      onPick: setWeek,
    });
    change.replaceChildren(el("p", "icard-change", read.change));
    if (read.latestNote) change.append(el("p", "icard-latest", read.latestNote));
  });
}

function paint() {
  const range = document.getElementById("week");
  range.value = String(state.week);
  const label = formatWeek(WEEKS[state.week]);
  range.setAttribute("aria-valuetext", label);
  document.getElementById("history-date").textContent = label;
  document.getElementById("asof-line").textContent = `Week of ${label} · JPM · MS · GS · BoA · Desk`;
  for (const painter of painters) painter();
}

function watchSections() {
  const links = [...document.querySelectorAll("#chart-nav a")];
  const targets = links.map((link) => document.getElementById(link.dataset.target)).filter(Boolean);
  const header = document.querySelector(".topbar");
  let currentId = "";
  let queued = false;
  const update = () => {
    queued = false;
    const line = header.getBoundingClientRect().bottom + 24;
    let current = targets[0];
    for (const target of targets) if (target.getBoundingClientRect().top <= line) current = target;
    if (current.id === currentId) return;
    currentId = current.id;
    for (const link of links) {
      const on = link.dataset.target === currentId;
      link.classList.toggle("is-current", on);
      if (on) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
    const active = links.find((link) => link.dataset.target === currentId);
    const strip = active.parentElement;
    strip.scrollTo({ left: active.offsetLeft - strip.clientWidth / 2 + active.clientWidth / 2, behavior: "smooth" });
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
  update();
}

readState();
const range = document.getElementById("week");
range.min = "0";
range.max = String(LATEST);
range.addEventListener("input", (event) => setWeek(Number(event.target.value)));

buildSoftVol();
buildSectors();
buildBroad();
buildCredit();
buildFundManagers();
buildRisk();
paint();

const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
if (target) target.scrollIntoView({ behavior: "instant", block: "start" });
watchSections();
