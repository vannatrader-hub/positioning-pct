import { niceTicks, shortDate, usd } from "./flow-chart.js";

const NS = "http://www.w3.org/2000/svg";

function dateLabel(iso, withYear = true) {
  const label = shortDate(iso);
  return withYear ? `${label}, ${iso.slice(0, 4)}` : label;
}

const LEVELS = {
  target: { label: "Target", color: "#4ade80", dash: "none" },
  be: { label: "Break-even", color: "#60a5fa", dash: "6 4" },
  strike: { label: "Strike", color: "#f59e0b", dash: "6 5" },
  spot: { label: "Spot at post", color: "#e5e7eb", dash: "2 4" },
  stop: { label: "Stop", color: "#f87171", dash: "6 5" },
};

export const STATUS = { active: "Active", open: "Open", closed: "Closed" };
export const SECTION_ORDER = ["active", "open", "closed"];

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

function pct(from, to) {
  const move = ((to - from) / from) * 100;
  return `${move >= 0 ? "+" : "−"}${Math.abs(move).toFixed(1)}%`;
}

export function sortCards(plays) {
  return [...plays].sort((a, b) => b.published.localeCompare(a.published));
}

export function allPlays(seed) {
  return seed.sections.flatMap((section) => section.plays);
}

/** Level kind from the label the Spotlight uses ("Short / target" is the target, "Long strike" the strike). */
export function levelKind(label) {
  const text = label.toLowerCase();
  if (text.startsWith("stop")) return "stop";
  if (text.includes("target")) return "target";
  if (text.startsWith("b/e")) return "be";
  if (text.includes("strike")) return "strike";
  if (text.startsWith("spot")) return "spot";
  return null;
}

/** Only the levels a Spotlight names, highest first. A Spotlight without levels draws nothing. */
export function ladderLevels(play) {
  return (play.levels ?? [])
    .map((level) => ({ kind: levelKind(level.label), value: level.price, label: `${level.label} ${usd(level.price)}` }))
    .filter((line) => line.kind && typeof line.value === "number")
    .sort((a, b) => b.value - a.value);
}

function statusPill(play) {
  return el("span", `spot-status is-${play.status}`, STATUS[play.status]);
}

function cardItem(play) {
  const item = el("li");
  const button = el("button", `spot-card is-${play.status}`);
  button.type = "button";
  button.dataset.ticker = play.ticker;
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-label", `${play.ticker}, ${play.name}. ${play.title}. ${STATUS[play.status]}${play.result ? ` ${play.result}` : ""}. Open Spotlight card`);

  const top = el("span", "spot-top");
  top.append(el("strong", "spot-ticker", play.ticker), statusPill(play));
  const name = el("span", "spot-name", play.name);
  const title = el("span", "spot-title", play.title);
  const meta = el("span", "spot-meta");
  meta.append(el("span", `spot-chip is-${play.side}`, play.entry));
  if (play.result) meta.append(el("span", "spot-chip is-banked", `Banked ${play.result}`));
  const levels = el("span", "spot-levels");
  levels.append(
    ...[
      ["Stop", play.stop],
      ["Target", play.target],
      ["B/E", play.breakeven],
    ]
      .filter(([, value]) => typeof value === "number")
      .map(([label, value]) => {
        const part = el("span", "spot-lv");
        part.append(`${label} `, el("b", "", usd(value)));
        return part;
      }),
  );
  const foot = el("span", "spot-foot");
  const stamp = play.closedAt ?? play.published;
  const when = el("time", "", `${play.closedAt ? "Closed" : "Posted"} ${dateLabel(stamp)}`);
  when.dateTime = stamp;
  const arrow = el("span", "fr-arrow", "→");
  arrow.setAttribute("aria-hidden", "true");
  foot.append(when, arrow);

  button.append(top, name, title, meta, levels, foot);
  item.append(button);
  return item;
}

function sectionBadge(section) {
  if (section.id === "active") {
    const badge = el("span", "badge is-live");
    const dot = el("i");
    dot.setAttribute("aria-hidden", "true");
    badge.append(dot, "Live");
    return badge;
  }
  const banked = section.plays.filter((play) => play.result);
  if (section.id === "closed" && banked.length) {
    return el("span", "badge is-banked", banked.map((play) => `${play.ticker} ${play.result}`).join(" · "));
  }
  return el("span", "badge", section.title);
}

function sectionRow(section) {
  const plays = sortCards(section.plays);
  const details = el("details", `spot-row is-${section.id}`);
  details.dataset.section = section.id;
  details.open = Boolean(section.defaultOpen);

  const summary = el("summary", "spot-sum");
  const head = el("span", "spot-sum-head");
  const count = `${plays.length} Spotlight${plays.length === 1 ? "" : "s"}`;
  head.append(el("span", "spot-sum-title", section.title), sectionBadge(section), el("span", "spot-sum-count", count));
  const tickers = el("span", "spot-sum-tickers", plays.map((play) => play.ticker).join(" · "));
  const chev = el("span", "spot-chev");
  chev.setAttribute("aria-hidden", "true");
  summary.append(head, el("span", "spot-sum-hint", section.hint), tickers, chev);

  const body = el("div", "spot-row-body");
  const list = el("ul", "spot-grid");
  if (plays.length) list.append(...plays.map(cardItem));
  else list.append(el("li", "spot-empty", `No ${section.title.toLowerCase()} Spotlights right now.`));
  body.append(list);

  details.append(summary, body);
  return details;
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
function mountLadder(host, play) {
  const lines = ladderLevels(play);
  const svg = svgNode("svg", { class: "tl-svg", role: "img" });
  svg.setAttribute("aria-label", `${play.ticker} trade levels. ${lines.map((line) => line.label).join(". ")}.`);
  host.replaceChildren(svg);

  const draw = () => {
    const width = Math.round(host.clientWidth);
    const height = Math.round(host.clientHeight);
    if (!width || !height) return;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.replaceChildren();

    const pad = { top: 22, right: 18, bottom: 18, left: 56 };
    const values = lines.map((line) => line.value);
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    const margin = (hi - lo) * 0.14 || hi * 0.05 || 1;
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

    if (typeof play.stop === "number" && typeof play.target === "number") {
      const top = y(Math.max(play.stop, play.target));
      const bottom = y(Math.min(play.stop, play.target));
      const up = play.target > play.stop;
      const gradient = svgNode("linearGradient", { id: "spot-band", x1: 0, x2: 0, y1: up ? 1 : 0, y2: up ? 0 : 1 });
      gradient.append(
        svgNode("stop", { offset: "0%", "stop-color": "#f87171", "stop-opacity": 0.16 }),
        svgNode("stop", { offset: "100%", "stop-color": "#4ade80", "stop-opacity": 0.16 }),
      );
      const defs = svgNode("defs");
      defs.append(gradient);
      svg.append(defs, svgNode("rect", { x: pad.left, y: top, width: right - pad.left, height: bottom - top, fill: "url(#spot-band)", rx: 6 }));
    }

    // Lines closer than a label's height alternate sides so their tags never overprint.
    let lastY = -Infinity;
    let side = "right";
    for (const line of lines) {
      const { color, dash } = LEVELS[line.kind];
      const ly = y(line.value);
      side = ly - lastY < 16 ? (side === "right" ? "left" : "right") : "right";
      lastY = ly;
      const tag = side === "right"
        ? { x: right - 4, "text-anchor": "end" }
        : { x: pad.left + 6, "text-anchor": "start" };
      svg.append(
        svgNode("line", { x1: pad.left, x2: right, y1: ly, y2: ly, stroke: color, "stroke-width": 1.6, "stroke-dasharray": dash }),
        svgNode("text", { ...tag, y: ly - 7, fill: color, class: "tl-tag" }, line.label),
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

function fillLevels(dialog, play) {
  const lines = ladderLevels(play);
  const tiles = dialog.querySelector("#sl-tiles");
  const ladder = dialog.querySelector("#sl-ladder");
  const legend = dialog.querySelector("#sl-legend");
  const move = dialog.querySelector("#sl-move");
  const note = dialog.querySelector("#sl-note");
  const contract = play.result ? `${play.entry} · Closed ${play.result}` : play.entry;
  dialog.querySelector("#sl-contract").textContent = `${play.ticker} · ${contract}`;
  move.replaceChildren();
  legend.replaceChildren();

  if (!lines.length) {
    tiles.classList.add("is-spot-only");
    tiles.replaceChildren(tile("Status", STATUS[play.status], `Posted ${dateLabel(play.published, false)}`));
    dialog.querySelector("#sl-head").textContent = `${play.ticker} — trade levels`;
    ladder.replaceChildren(el("p", "cc-chart-loading", "This Spotlight names no stop, strike, or target."));
    note.textContent = "Nothing is drawn because the Spotlight carries no trade levels. Levels are never filled in from elsewhere.";
    return null;
  }

  const has = (value) => typeof value === "number";
  tiles.classList.remove("is-spot-only");
  tiles.replaceChildren(
    tile("Entry", has(play.debit) ? usd(play.debit) : "—", play.entry.includes("or better") ? "Debit, or better" : "Debit"),
    tile("Stop", has(play.stop) ? usd(play.stop) : "—", has(play.stop) ? "Stock level" : "Not on the card"),
    tile("Target", has(play.target) ? usd(play.target) : "—", has(play.target) ? "Stock level" : "Not on the card", has(play.target) ? "be" : ""),
    tile("B/E", has(play.breakeven) ? usd(play.breakeven) : "—", play.expiryNote ? `At ${play.expiryNote}` : "Not on the card"),
  );
  dialog.querySelector("#sl-head").textContent = [`${play.ticker} — trade levels`, ...lines.map((line) => line.label)].join(" · ");
  const kinds = [...new Set(lines.map((line) => line.kind))];
  legend.append(...Object.keys(LEVELS).filter((kind) => kinds.includes(kind)).map(swatch));
  if (has(play.spotAtPost) && has(play.target) && has(play.stop)) {
    move.append(
      "Spot to target ",
      el("strong", "", pct(play.spotAtPost, play.target)),
      " · to stop ",
      el("strong", "is-down", pct(play.spotAtPost, play.stop)),
    );
  }
  note.textContent = play.closedAt
    ? `Closed ${dateLabel(play.closedAt)}. Stock levels as named on the Spotlight; spot is the stock price when it posted.`
    : "Stock levels as named on the Spotlight; spot is the stock price when it posted. No price history is drawn here.";
  return mountLadder(ladder, play);
}

function headBadge(play) {
  if (play.status === "active") {
    const badge = el("span", "badge is-live");
    const dot = el("i");
    dot.setAttribute("aria-hidden", "true");
    badge.append(dot, "Live");
    return badge;
  }
  if (play.status === "closed") return el("span", "badge is-banked", play.result ? `Closed ${play.result}` : "Closed");
  return el("span", "badge", "Open");
}

function closeBlock(play) {
  const block = el("div", "cc-block spot-close");
  block.append(el("h4", "cc-label", "Close note"));
  const line = el("p", "spot-close-line");
  line.append(el("strong", "", play.result ? `Banked ${play.result}` : "Closed"), ` · ${dateLabel(play.closedAt)}`);
  block.append(line);
  if (play.closeQuote) block.append(el("blockquote", "spot-close-quote", `“${play.closeQuote}”`));
  if (play.closeEvidenceUrl) {
    const link = el("a", "spot-close-link", "Public close note on X ↗");
    link.href = play.closeEvidenceUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    block.append(link);
  }
  return block;
}

function setupCard(dialog, plays) {
  let trigger = null;
  let unmount = null;

  const open = (play, from) => {
    trigger = from ?? null;
    unmount?.();
    dialog.querySelector("#sc-ticker").textContent = play.ticker;
    dialog.querySelector("#sc-badge").replaceChildren(headBadge(play));
    dialog.querySelector("#sc-name").textContent = play.name;
    dialog.querySelector("#sc-title").textContent = play.title;
    const date = dialog.querySelector("#sc-date");
    date.textContent = `Spotlight ${dateLabel(play.published)}`;
    date.dateTime = play.published;
    const status = dialog.querySelector("#sc-status");
    status.textContent = STATUS[play.status];
    status.className = `spot-status is-${play.status}`;
    dialog.querySelector("#sc-idea").replaceChildren(...play.idea.map((text) => el("p", "", text)));
    const structure = dialog.querySelector("#sc-structure");
    structure.replaceChildren();
    const rows = [
      ["Structure", play.structure],
      ["Entry", play.entry],
      ["Expiry", play.expiryNote],
      ["Timeframe", play.timeframe],
      ["Status", play.closedAt ? `Closed ${dateLabel(play.closedAt, false)}` : STATUS[play.status]],
    ];
    for (const [label, value] of rows) {
      if (!value) continue;
      const pair = el("div", "cc-oi-row");
      pair.append(el("dt", "", label), el("dd", "", value));
      structure.append(pair);
    }
    dialog.querySelector("#sc-close-note").replaceChildren(...(play.closedAt ? [closeBlock(play)] : []));
    dialog.querySelector("#sc-rec").textContent = play.recommendation;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector(".cc-left").scrollTop = 0;
    dialog.querySelector("#sc-close").focus();
    history.replaceState(null, "", `#${play.ticker}`);
    unmount = fillLevels(dialog, play);
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

  return { open, byTicker: new Map(plays.map((play) => [play.ticker, play])) };
}

async function main() {
  const rows = document.querySelector("#spot-rows");
  const asOf = document.querySelector("#spot-asof");
  const count = document.querySelector("#spot-count");

  let seed;
  try {
    const response = await fetch(dataUrl("spotlights.json"), { cache: "no-cache" });
    if (!response.ok) throw new Error(`spotlights ${response.status}`);
    seed = await response.json();
  } catch {
    asOf.textContent = "The Spotlight trades could not load.";
    return;
  }

  const sections = SECTION_ORDER.map((id) => seed.sections.find((section) => section.id === id)).filter(Boolean);
  const plays = allPlays(seed);
  const { start, end } = seed.activeWindow;
  asOf.textContent = `Live · as of ${dateLabel(seed.asOf)} · Active window ${shortDate(start)} – ${shortDate(end)}`;
  count.textContent = sections.map((section) => `${section.plays.length} ${section.title.toLowerCase()}`).join(" · ");
  rows.replaceChildren(...sections.map(sectionRow));

  const card = setupCard(document.querySelector("#spot-card"), plays);
  rows.addEventListener("click", (event) => {
    const button = event.target.closest(".spot-card");
    const picked = button && card.byTicker.get(button.dataset.ticker);
    if (picked) card.open(picked, button);
  });
  const openFromHash = () => {
    const picked = card.byTicker.get(decodeURIComponent(window.location.hash.slice(1)).toUpperCase());
    if (!picked) return;
    const button = rows.querySelector(`.spot-card[data-ticker="${picked.ticker}"]`);
    const row = button?.closest("details");
    if (row) row.open = true;
    card.open(picked, button);
  };
  window.addEventListener("hashchange", openFromHash);
  openFromHash();
}

if (typeof document !== "undefined") main();
