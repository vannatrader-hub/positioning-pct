import { niceTicks, shortDate, usd } from "./flow-chart.js";

const NS = "http://www.w3.org/2000/svg";

function dateLabel(iso, withYear = true) {
  const label = shortDate(iso);
  return withYear ? `${label}, ${iso.slice(0, 4)}` : label;
}

const LEVELS = {
  target: { label: "Target", color: "#4ade80", dash: "none" },
  strike: { label: "Strike", color: "#f59e0b", dash: "6 5" },
  entry: { label: "Entry", color: "#e5e7eb", dash: "2 4" },
  stop: { label: "Stop", color: "#f87171", dash: "6 5" },
};

export const STATUS = { open: "Open", filled: "Filled" };

function dataUrl(path) {
  const base = import.meta.env ? import.meta.env.BASE_URL : "/";
  return `${base}data/flow/${path}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgNode(tag, attrs = {}, text) {
  const item = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) item.setAttribute(key, String(value));
  if (text !== undefined) item.textContent = text;
  return item;
}

export function sortCards(cards) {
  return [...cards].sort((a, b) => b.date.localeCompare(a.date));
}

/** Only the levels a card names, highest first. A card without levels draws nothing. */
export function ladderLevels(card) {
  const levels = card.levels ?? {};
  return Object.keys(LEVELS)
    .filter((kind) => typeof levels[kind] === "number")
    .map((kind) => ({ kind, value: levels[kind], label: `${LEVELS[kind].label} ${usd(levels[kind])}` }))
    .sort((a, b) => b.value - a.value);
}

function cardItem(card) {
  const item = el("li");
  const button = el("button", "spot-card");
  button.type = "button";
  button.dataset.ticker = card.ticker;
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-label", `${card.ticker}, ${card.name}. ${card.title}. ${STATUS[card.status]}. Open Spotlight card`);

  const top = el("span", "spot-top");
  top.append(el("strong", "spot-ticker", card.ticker), el("span", `spot-status is-${card.status}`, STATUS[card.status]));
  const name = el("span", "spot-name", card.name);
  const title = el("span", "spot-title", card.title);
  const meta = el("span", "spot-meta");
  const levels = ladderLevels(card);
  meta.append(
    el("span", `spot-chip is-${card.bias}`, card.structure),
    el("span", "spot-levels", levels.length ? levels.map((line) => line.label).join(" · ") : "No levels on card"),
  );
  const foot = el("span", "spot-foot");
  const when = el("time", "", dateLabel(card.date));
  when.dateTime = card.date;
  const arrow = el("span", "fr-arrow", "→");
  arrow.setAttribute("aria-hidden", "true");
  foot.append(when, arrow);

  button.append(top, name, title, meta, foot);
  item.append(button);
  return item;
}

function tile(label, value, sub, accent) {
  const box = el("div", `tl-tile${accent ? ` is-${accent}` : ""}`);
  box.append(el("dt", "", label), el("dd", "", value));
  if (sub) box.append(el("dd", "tl-sub", sub));
  return box;
}

function swatch(kind) {
  const item = el("span", "tl-key");
  const sw = el("i", "tl-sw");
  sw.style.borderTopColor = LEVELS[kind].color;
  sw.style.borderTopStyle = LEVELS[kind].dash === "none" ? "solid" : "dashed";
  item.append(sw, LEVELS[kind].label);
  return item;
}

/** Draws the level ladder into `host`, sized to the host. Returns an unmount function. */
function mountLadder(host, card) {
  const lines = ladderLevels(card);
  const svg = svgNode("svg", { class: "tl-svg", role: "img" });
  svg.setAttribute("aria-label", `${card.ticker} trade levels. ${lines.map((line) => line.label).join(". ")}.`);
  host.replaceChildren(svg);

  const draw = () => {
    const width = Math.round(host.clientWidth);
    const height = Math.round(host.clientHeight);
    if (!width || !height) return;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.replaceChildren();

    const pad = { top: 18, right: 18, bottom: 18, left: 56 };
    const values = lines.map((line) => line.value);
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    const margin = (hi - lo) * 0.18 || hi * 0.05 || 1;
    lo -= margin;
    hi += margin;
    const right = width - pad.right;
    const y = (value) => pad.top + (1 - (value - lo) / (hi - lo)) * (height - pad.top - pad.bottom);

    for (const tick of niceTicks(lo, hi, Math.max(3, Math.round(height / 70)))) {
      const ty = y(tick);
      svg.append(
        svgNode("line", { x1: pad.left, x2: right, y1: ty, y2: ty, stroke: "rgba(255, 255, 255, 0.055)" }),
        svgNode("text", { x: pad.left - 8, y: ty + 3.5, "text-anchor": "end", fill: "#6b7280", class: "tl-axis" }, `$${tick % 1 ? tick.toFixed(1) : tick}`),
      );
    }

    const by = Object.fromEntries(lines.map((line) => [line.kind, line.value]));
    if (by.stop !== undefined && by.target !== undefined) {
      const top = y(Math.max(by.stop, by.target));
      const bottom = y(Math.min(by.stop, by.target));
      const gradient = svgNode("linearGradient", { id: "spot-band", x1: 0, x2: 0, y1: by.target > by.stop ? 1 : 0, y2: by.target > by.stop ? 0 : 1 });
      gradient.append(
        svgNode("stop", { offset: "0%", "stop-color": "#f87171", "stop-opacity": 0.16 }),
        svgNode("stop", { offset: "100%", "stop-color": "#4ade80", "stop-opacity": 0.16 }),
      );
      const defs = svgNode("defs");
      defs.append(gradient);
      svg.append(defs, svgNode("rect", { x: pad.left, y: top, width: right - pad.left, height: bottom - top, fill: "url(#spot-band)", rx: 6 }));
    }

    for (const line of lines) {
      const { color, dash } = LEVELS[line.kind];
      const ly = y(line.value);
      svg.append(
        svgNode("line", { x1: pad.left, x2: right, y1: ly, y2: ly, stroke: color, "stroke-width": 1.6, "stroke-dasharray": dash }),
        svgNode("text", { x: right - 4, y: ly - 7, "text-anchor": "end", fill: color, class: "tl-tag" }, line.label),
      );
    }
  };

  const observer = new ResizeObserver(draw);
  observer.observe(host);
  draw();
  return () => {
    observer.disconnect();
    host.replaceChildren();
  };
}

function fillLevels(dialog, card) {
  const lines = ladderLevels(card);
  const tiles = dialog.querySelector("#sl-tiles");
  const ladder = dialog.querySelector("#sl-ladder");
  const legend = dialog.querySelector("#sl-legend");
  const move = dialog.querySelector("#sl-move");
  const note = dialog.querySelector("#sl-note");
  const statusTile = tile("Status", STATUS[card.status], `Card ${dateLabel(card.date, false)}`);
  dialog.querySelector("#sl-contract").textContent = `${card.ticker} · ${card.structure}`;
  move.replaceChildren();
  legend.replaceChildren();

  if (!lines.length) {
    tiles.classList.add("is-spot-only");
    tiles.replaceChildren(statusTile);
    dialog.querySelector("#sl-head").textContent = `${card.ticker} — trade levels`;
    ladder.replaceChildren(el("p", "cc-chart-loading", "This card names no stop, strike, or target."));
    note.textContent = "Nothing is drawn because the card carries no trade levels. Levels are never filled in from elsewhere.";
    return null;
  }

  const by = Object.fromEntries(lines.map((line) => [line.kind, line.value]));
  tiles.classList.remove("is-spot-only");
  tiles.replaceChildren(
    tile("Structure", card.structure, "From the card"),
    tile("Stop", by.stop === undefined ? "—" : usd(by.stop), by.stop === undefined ? "Not on the card" : "Stock level"),
    tile("Target", by.target === undefined ? "—" : usd(by.target), by.target === undefined ? "Not on the card" : "Stock level", by.target === undefined ? "" : "be"),
    statusTile,
  );
  dialog.querySelector("#sl-head").textContent = [`${card.ticker} — trade levels`, ...lines.map((line) => line.label)].join(" · ");
  legend.append(...lines.map((line) => swatch(line.kind)));
  if (by.stop !== undefined && by.target !== undefined) {
    move.append("Stop to target: ", el("strong", "", usd(Math.abs(by.target - by.stop))));
  }
  note.textContent = "Stock levels as named on the sample card. No price history is drawn for Spotlight samples in this phase.";
  return mountLadder(ladder, card);
}

function setupCard(dialog, cards) {
  let trigger = null;
  let unmount = null;

  const open = (card, from) => {
    trigger = from ?? null;
    unmount?.();
    dialog.querySelector("#sc-ticker").textContent = card.ticker;
    dialog.querySelector("#sc-name").textContent = card.name;
    dialog.querySelector("#sc-title").textContent = card.title;
    const date = dialog.querySelector("#sc-date");
    date.textContent = `Spotlight ${dateLabel(card.date)}`;
    date.dateTime = card.date;
    const status = dialog.querySelector("#sc-status");
    status.textContent = STATUS[card.status];
    status.className = `spot-status is-${card.status}`;
    dialog.querySelector("#sc-idea").replaceChildren(...card.idea.map((text) => el("p", "", text)));
    const structure = dialog.querySelector("#sc-structure");
    structure.replaceChildren();
    for (const [label, value] of [["Structure", card.structure], ["Bias", card.bias === "puts" ? "Puts" : "Calls"], ["Status", STATUS[card.status]]]) {
      const pair = el("div", "cc-oi-row");
      pair.append(el("dt", "", label), el("dd", "", value));
      structure.append(pair);
    }
    dialog.querySelector("#sc-rec").textContent = card.recommendation;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector(".cc-left").scrollTop = 0;
    dialog.querySelector("#sc-close").focus();
    history.replaceState(null, "", `#${card.ticker}`);
    unmount = fillLevels(dialog, card);
  };

  dialog.querySelector("#sc-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    unmount?.();
    unmount = null;
    history.replaceState(null, "", window.location.pathname + window.location.search);
    trigger?.focus();
    trigger = null;
  });

  return { open, byTicker: new Map(cards.map((card) => [card.ticker, card])) };
}

async function main() {
  const list = document.querySelector("#spot-list");
  const asOf = document.querySelector("#spot-asof");
  const count = document.querySelector("#spot-count");

  let seed;
  try {
    const response = await fetch(dataUrl("spotlights.json"), { cache: "no-cache" });
    if (!response.ok) throw new Error(`spotlights ${response.status}`);
    seed = await response.json();
  } catch {
    asOf.textContent = "The sample cards could not load.";
    return;
  }

  const cards = sortCards(seed.cards);
  asOf.textContent = `Sample · ${seed.window}`;
  count.textContent = `${cards.length} sample cards`;
  if (!cards.length) {
    list.replaceChildren(el("li", "spot-empty", "No sample Spotlight cards yet. Cards appear here once a sample is committed."));
    return;
  }
  list.replaceChildren(...cards.map(cardItem));

  const card = setupCard(document.querySelector("#spot-card"), cards);
  list.addEventListener("click", (event) => {
    const button = event.target.closest(".spot-card");
    const picked = button && card.byTicker.get(button.dataset.ticker);
    if (picked) card.open(picked, button);
  });
  const openFromHash = () => {
    const picked = card.byTicker.get(decodeURIComponent(window.location.hash.slice(1)).toUpperCase());
    if (picked) card.open(picked, list.querySelector(`.spot-card[data-ticker="${picked.ticker}"]`));
  };
  window.addEventListener("hashchange", openFromHash);
  openFromHash();
}

if (typeof document !== "undefined") main();
