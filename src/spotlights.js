import { drawLevelsChart, resolveExpiry, shortDate, sixMonths, usd } from "./flow-chart.js";

const DAY = 86400000;
const EXPIRY_REACH_DAYS = 80;

function dateLabel(iso, withYear = true) {
  const label = shortDate(iso);
  return withYear ? `${label}, ${iso.slice(0, 4)}` : label;
}

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

const CHART_KIND = { stop: "stop", target: "target", be: "breakeven", strike: "strike" };

/** Horizontal chart lines from the levels a ticket names, highest first. Spot at post is marked on the price path instead. */
export function spotlightLines(play) {
  return (play.levels ?? [])
    .map((level) => ({ kind: CHART_KIND[levelKind(level.label)], value: level.price, label: `${level.label} ${usd(level.price)}` }))
    .filter((line) => line.kind && typeof line.value === "number")
    .sort((a, b) => b.value - a.value);
}

function days(isoDate) {
  return Date.parse(`${isoDate}T00:00:00Z`) / DAY;
}

function barOnOrBefore(bars, isoDate) {
  let found = null;
  for (const bar of bars) {
    if (bar.t > isoDate) break;
    found = bar;
  }
  return found;
}

/** "January OpEx" on a ticket posted Oct 20, 2026 → the Jan 15, 2027 monthly. */
export function spotlightExpiry(play) {
  return resolveExpiry((play.expiryNote ?? "").split(" ")[0], play.published);
}

/** Everything the shared trade-levels chart draws for one Spotlight ticket. */
export function spotlightLevels(play, bars) {
  const window = sixMonths(bars);
  const last = window[window.length - 1];
  const expiry = spotlightExpiry(play);
  const expiryInView = Boolean(expiry) && expiry >= window[0].t && days(expiry) - days(last.t) <= EXPIRY_REACH_DAYS;
  const posted = barOnOrBefore(bars, play.published);
  const closeBar = play.closedAt ? barOnOrBefore(bars, play.closedAt) : null;
  const markers = [];
  if (posted && posted.t >= window[0].t) {
    markers.push({ t: posted.t, value: posted.c, label: `Posted ${shortDate(play.published)}`, side: closeBar ? "left" : "right" });
  }
  if (closeBar && closeBar.t >= window[0].t) {
    const expired = play.outcome === "expired";
    const stopped = play.outcome === "stopped";
    markers.push({
      t: closeBar.t,
      value: closeBar.c,
      label: expired
        ? `Expired ${shortDate(play.closedAt)}`
        : `${stopped ? "Stopped" : "Closed"} ${shortDate(play.closedAt)} ${play.result ?? ""}`.trim(),
      line: !(expiryInView && closeBar.t === expiry),
    });
  }
  return { window, lines: spotlightLines(play), expiry, expiryInView, spot: last.c, spotDate: last.t, markers, posted, closeBar };
}

const OUTCOME = {
  banked: { chip: "Banked", badge: "Closed", row: "", tone: "banked" },
  expired: { chip: "Expired worthless", badge: "Expired", row: "expired", tone: "expired" },
  stopped: { chip: "Stopped", badge: "Stopped", row: "stopped", tone: "stopped" },
};

function outcome(play) {
  return OUTCOME[play.outcome] ?? OUTCOME.banked;
}

/** "Banked +107%", "Stopped", or "Expired worthless" — the card's one-line close result. */
export function outcomeLabel(play) {
  if (play.outcome === "expired" || play.outcome === "stopped") return outcome(play).chip;
  return `${outcome(play).chip} ${play.result ?? ""}`.trim();
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
  button.setAttribute("aria-label", `${play.ticker}, ${play.name}. ${play.title}. ${STATUS[play.status]}${play.closedAt ? `, ${outcomeLabel(play)}` : ""}. Open Spotlight card`);

  const top = el("span", "spot-top");
  top.append(el("strong", "spot-ticker", play.ticker), statusPill(play));
  const name = el("span", "spot-name", play.name);
  const title = el("span", "spot-title", play.title);
  const meta = el("span", "spot-meta");
  meta.append(el("span", `spot-chip is-${play.side}`, play.entry));
  if (play.closedAt) meta.append(el("span", `spot-chip is-${outcome(play).tone}`, outcomeLabel(play)));
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
  const closed = sortCards(section.plays).filter((play) => play.closedAt);
  if (section.id === "closed" && closed.length) {
    const badges = el("span", "spot-sum-badges");
    badges.append(
      ...closed.map((play) => {
        const text =
          play.outcome === "expired" || play.outcome === "stopped"
            ? `${play.ticker} ${outcome(play).row}`
            : `${play.ticker} ${play.result ?? "closed"}`;
        return el("span", `badge is-${outcome(play).tone}`, text);
      }),
    );
    return badges;
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
  else list.append(el("li", "spot-empty", "None"));
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

function swatch(kind, label) {
  const item = el("span", "tl-key");
  item.append(el("i", `tl-sw is-${kind}`), label);
  return item;
}

const LEGEND = { strike: "Strike", short: "Short", breakeven: "B/E", stop: "Stop", target: "Target" };

const barsCache = new Map();

function loadBars(ticker) {
  if (!barsCache.has(ticker)) {
    const request = fetch(dataUrl(`bars/${ticker}.json`), { cache: "no-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`bars ${response.status}`);
        return response.json();
      })
      .then((file) => file.bars);
    request.catch(() => barsCache.delete(ticker));
    barsCache.set(ticker, request);
  }
  return barsCache.get(ticker);
}

function fillChart(dialog, play, levels) {
  const has = (value) => typeof value === "number";
  const tiles = dialog.querySelector("#sl-tiles");
  const legend = dialog.querySelector("#sl-legend");
  const move = dialog.querySelector("#sl-move");
  const contract = play.closedAt ? `${play.entry} · ${outcomeLabel(play)}` : play.entry;
  dialog.querySelector("#sl-contract").textContent = `${play.ticker} · ${contract}`;

  tiles.replaceChildren(
    tile("Entry", has(play.debit) ? usd(play.debit) : "—", play.entry.includes("or better") ? "Debit, or better" : "Debit"),
    tile("Stop", has(play.stop) ? usd(play.stop) : "—", has(play.stop) ? "Stock level" : "Not on the ticket"),
    tile("Target", has(play.target) ? usd(play.target) : "—", has(play.target) ? "Stock level" : "Not on the ticket"),
    tile("B/E", has(play.breakeven) ? usd(play.breakeven) : "—", play.expiryNote ? `At ${play.expiryNote}` : "Not on the ticket", has(play.breakeven) ? "be" : ""),
  );

  const named = [has(play.stop) && `Stop ${usd(play.stop)}`, has(play.target) && `Target ${usd(play.target)}`, has(play.breakeven) && `B/E ${usd(play.breakeven)}`];
  dialog.querySelector("#sl-head").textContent = [`${play.ticker} — 6-month price`, ...named.filter(Boolean)].join(" · ");

  const kinds = new Set(levels.lines.map((line) => line.kind));
  legend.replaceChildren(swatch("price", "Close"), ...Object.keys(LEGEND).filter((kind) => kinds.has(kind)).map((kind) => swatch(kind, LEGEND[kind])));
  if (levels.expiryInView) legend.append(swatch("expiry", "Expiry"));
  if (levels.markers.length) legend.append(swatch("posted", play.closedAt ? "Posted / closed" : "Posted"));

  move.replaceChildren();
  if (play.closedAt && levels.closeBar) {
    const expired = play.outcome === "expired";
    move.append(`${expired ? "Expiry close" : "Close"} ${shortDate(levels.closeBar.t)}: `, el("strong", expired ? "is-down" : "", usd(levels.closeBar.c)));
    const strike = levels.lines.find((line) => line.kind === "strike");
    if (expired && strike) move.append(` vs ${usd(strike.value)} strike`);
  } else if (has(play.stop) && has(play.target)) {
    const pastStop = play.side === "puts" ? levels.spot > play.stop : levels.spot < play.stop;
    move.append(`Last ${usd(levels.spot)}: `);
    if (pastStop) move.append(el("strong", "is-down", `${play.side === "puts" ? "Above" : "Below"} stop ${usd(play.stop)}`));
    else move.append("to target ", el("strong", "", pct(levels.spot, play.target)), " · to stop ", el("strong", "is-down", pct(levels.spot, play.stop)));
  }

  const expiryNote = levels.expiry ? ` Expiry read as the ${shortDate(levels.expiry, true)} monthly.` : "";
  dialog.querySelector("#sl-note").textContent =
    `Daily closes through ${dateLabel(levels.spotDate)}. Levels come from the Spotlight ticket.${expiryNote}`;
}

function headBadge(play) {
  if (play.status === "active") {
    const badge = el("span", "badge is-live");
    const dot = el("i");
    dot.setAttribute("aria-hidden", "true");
    badge.append(dot, "Live");
    return badge;
  }
  if (play.status === "closed") {
    const { badge, tone } = outcome(play);
    const bare = play.outcome === "expired" || play.outcome === "stopped";
    return el("span", `badge is-${tone}`, bare ? badge : `${badge} ${play.result ?? ""}`.trim());
  }
  return el("span", "badge", "Open");
}

function closeBlock(play) {
  const block = el("div", "cc-block spot-close");
  block.append(el("h4", "cc-label", "Close note"));
  const line = el("p", "spot-close-line");
  line.append(el("strong", `is-${outcome(play).tone}`, outcomeLabel(play)), ` · ${dateLabel(play.closedAt)}`);
  block.append(line);
  if (play.closeQuote) block.append(el("blockquote", "spot-close-quote", `“${play.closeQuote}”`));
  else if (play.closeNote) block.append(el("p", "spot-close-text", play.closeNote));
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
  const chartHost = dialog.querySelector("#sl-chart");
  let trigger = null;
  let unmount = null;
  let mountId = 0;

  const clearChart = () => {
    mountId += 1;
    unmount?.();
    unmount = null;
  };

  const showChart = async (play) => {
    clearChart();
    const id = mountId;
    for (const selector of ["#sl-tiles", "#sl-legend", "#sl-move", "#sl-head", "#sl-note"]) dialog.querySelector(selector).replaceChildren();
    dialog.querySelector("#sl-contract").textContent = `${play.ticker} · ${play.entry}`;
    chartHost.replaceChildren(el("p", "cc-chart-loading", "Loading daily closes…"));
    try {
      const bars = await loadBars(play.ticker);
      if (id !== mountId) return;
      const levels = spotlightLevels(play, bars);
      fillChart(dialog, play, levels);
      unmount = drawLevelsChart(chartHost, play.ticker, levels);
    } catch {
      if (id !== mountId) return;
      chartHost.replaceChildren(el("p", "cc-chart-loading", "The price chart could not load."));
    }
  };

  const open = (play, from) => {
    trigger = from ?? null;
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
    showChart(play);
  };

  dialog.querySelector("#sc-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    clearChart();
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

function bootSpotlights() {
  if (!document.body || document.body.dataset.spotBoot === "1" || !document.querySelector("#spot-rows")) return;
  document.body.dataset.spotBoot = "1";
  main();
}

if (typeof document !== "undefined") {
  document.addEventListener("vault-open", bootSpotlights);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootSpotlights);
  else bootSpotlights();
}
