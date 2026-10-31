import { chartLevels, mountLevels, shortDate, usd } from "./flow-chart.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

export function dateLabel(iso, withYear = true) {
  const [year, month, day] = iso.split("-").map(Number);
  const short = `${MONTHS[month - 1]} ${day}`;
  return withYear ? `${short}, ${year}` : short;
}

export function money(value) {
  return `$${value.toFixed(2)}`;
}

export function change(quote) {
  const pct = ((quote.last - quote.prev) / quote.prev) * 100;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return { pct, text: `${sign}${Math.abs(pct).toFixed(2)}%` };
}

/** "2026-10-25 12:23 PM CT" → "2026-10-25 12:23", so same-day alerts sort by time. */
export function alertKey(stamp) {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{1,2}):(\d{2}) (AM|PM)/.exec(stamp);
  if (!match) return stamp;
  const hour = (Number(match[2]) % 12) + (match[4] === "PM" ? 12 : 0);
  return `${match[1]} ${String(hour).padStart(2, "0")}:${match[3]}`;
}

export function sortPlays(plays) {
  return [...plays].sort((a, b) => alertKey(b.alertedAtCt).localeCompare(alertKey(a.alertedAtCt)));
}

/** "2026-10-27 05:15 PM CT" → "5:15 PM CT". Alert stamps are America/Chicago. */
export function alertTime(stamp) {
  const match = /(\d{1,2}):(\d{2}) (AM|PM) CT$/.exec(stamp);
  return match ? `${Number(match[1])}:${match[2]} ${match[3]} CT` : "";
}

/** "2026-10-27 05:15 PM CT" → "Alerted Oct 27, 5:15 PM CT". */
export function alertLabel(stamp, withYear = false) {
  const day = dateLabel(stamp.slice(0, 10), withYear);
  return `Alerted ${day}, ${alertTime(stamp)}`;
}

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

function row(play, isLatest) {
  const item = el("li");
  const button = el("button", "flow-row");
  button.type = "button";
  button.dataset.ticker = play.ticker;
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute(
    "aria-label",
    `${play.ticker}, ${play.name}${play.industry ? `, ${play.industry.broad}, ${play.industry.focus}` : ""}. ${alertLabel(play.alertedAtCt)}. ${play.title}. Open calling card`,
  );

  const ident = el("span", "fr-id");
  const top = el("span", "fr-ticker-line");
  top.append(el("strong", "fr-ticker", play.ticker));
  if (isLatest) top.append(el("span", "badge is-live fr-new", "Latest"));
  ident.append(top, el("span", "fr-name", play.name));

  const industry = el("span", "fr-ind");
  industry.append(el("strong", "fr-ind-broad", play.industry?.broad ?? "—"));
  if (play.industry?.focus) industry.append(el("span", "fr-ind-focus", play.industry.focus));

  const flow = el("span", "fr-flow");
  flow.append(el("span", "conf", play.confidence), el("span", "fr-title", play.title));

  const date = el("time", "fr-date");
  date.dateTime = play.alertedAtCt.slice(0, 10);
  date.title = alertLabel(play.alertedAtCt, true);
  date.append(el("strong", "", dateLabel(play.date, false)), el("span", "", alertTime(play.alertedAtCt)));

  const px = el("span", "fr-px");
  const delta = change(play.quote);
  px.append(
    el("strong", "", money(play.quote.last)),
    el("span", `chg ${delta.pct >= 0 ? "is-up" : "is-down"}`, `${delta.text} · ${dateLabel(play.quote.date, false)}`),
  );

  const arrow = el("span", "fr-arrow", "→");
  arrow.setAttribute("aria-hidden", "true");

  button.append(ident, industry, flow, date, px, arrow);
  item.append(button);
  return item;
}

function isSpread(lead) {
  return typeof lead.shortStrike === "number";
}

function contractLabel(play, expiry) {
  const { lead } = play;
  const when = expiry ? shortDate(expiry, true) : lead.expiry;
  const kind = lead.type === "put" ? "Put" : "Call";
  if (isSpread(lead)) return `${play.ticker} ${when} $${lead.strike}/$${lead.shortStrike} ${kind} Spread`;
  return `${play.ticker} ${when} $${lead.strike} ${kind}`;
}

function actionLabel(lead) {
  const verb = { bought: "Bought", sold: "Sold", long: "Long" }[lead.action] ?? "Opened";
  return lead.qty ? `${verb} ${lead.qty.toLocaleString("en-US")}` : `${verb} · in OI`;
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

function fillLevels(dialog, play, levels) {
  const { lead } = levels;
  const tiles = dialog.querySelector("#tl-tiles");
  const spotTile = tile("Spot", usd(levels.spot), `${shortDate(levels.spotDate)} close`);
  const legend = dialog.querySelector("#tl-legend");
  const move = dialog.querySelector("#tl-move");
  const note = `Daily closes through ${dateLabel(levels.spotDate)}.`;
  move.replaceChildren();

  if (!lead) {
    dialog.querySelector("#tl-contract").textContent = "No recent customer trade";
    tiles.classList.add("is-spot-only");
    tiles.replaceChildren(spotTile);
    dialog.querySelector("#tl-chart-head").textContent = `${play.ticker} — 6-month price`;
    legend.replaceChildren(swatch("price", "Close"));
    dialog.querySelector("#cc-chart-note").textContent =
      `${note} No strike or break-even is drawn because the alert names no recent customer trade.`;
    return;
  }

  const isPut = lead.type === "put";
  const spread = isSpread(lead);
  const kind = spread ? `${isPut ? "put" : "call"} spread` : isPut ? "puts" : "calls";
  dialog.querySelector("#tl-contract").textContent = contractLabel(play, levels.expiry);
  tiles.classList.remove("is-spot-only");
  tiles.replaceChildren(
    tile("Lead", actionLabel(lead), `${lead.expiry || "Expiry n/a"} · ${kind}`),
    tile(
      spread ? "Net debit" : "Premium",
      lead.price === null ? "—" : usd(lead.price),
      lead.price === null ? "Not in the flow note" : (lead.priceNote ?? "per share"),
    ),
    tile(
      "Break-even",
      levels.breakeven === null ? "—" : usd(levels.breakeven),
      levels.breakeven === null
        ? "Needs a premium"
        : spread
          ? `Long strike ${isPut ? "−" : "+"} debit`
          : isPut
            ? "Strike − premium"
            : "Strike + premium",
      levels.breakeven === null ? "" : "be",
    ),
    spotTile,
  );

  const head = [`${play.ticker} — 6-month price`];
  head.push(spread ? `Strikes ${usd(lead.strike)} / ${usd(lead.shortStrike)}` : `Strike ${usd(lead.strike)}`);
  if (levels.breakeven !== null) head.push(`B/E ${usd(levels.breakeven)}`);
  dialog.querySelector("#tl-chart-head").textContent = head.join(" · ");

  legend.replaceChildren(swatch("price", "Close"), swatch("strike", spread ? "Long" : "Strike"));
  if (spread) legend.append(swatch("short", "Short"));
  if (levels.breakeven !== null) legend.append(swatch("be", "B/E"));
  if (levels.expiryInView) legend.append(swatch("expiry", "Expiry"));

  const target = levels.breakeven ?? lead.strike;
  const pct = ((target - levels.spot) / levels.spot) * 100;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  const label =
    levels.breakeven === null ? "Spot to strike" : isPut && lead.action === "sold" ? "Cushion to B/E" : "Req. move to B/E";
  move.append(`${label}: `, el("strong", "", `${sign}${Math.abs(pct).toFixed(1)}%`));

  const expiryNote = levels.expiry ? ` Expiry read as the ${shortDate(levels.expiry, true)} monthly.` : "";
  dialog.querySelector("#cc-chart-note").textContent = `${note}${expiryNote}`;
}

export const SIDES = {
  calls_bought: "Calls bought",
  calls_sold: "Calls sold",
  puts_bought: "Puts bought",
  puts_sold: "Puts sold",
};

function fillRows(dialog, listId, blockId, lines = []) {
  const list = dialog.querySelector(listId);
  list.replaceChildren();
  for (const line of lines) {
    const pair = el("div", line.side ? `cc-oi-row side-${line.side}` : "cc-oi-row");
    const contract = el("dt", "", line.contract);
    if (line.side) {
      contract.prepend(el("i", "cc-side-dot"));
      contract.append(el("span", "visually-hidden", ` (${SIDES[line.side]})`));
    }
    pair.append(contract, el("dd", "", line.detail));
    list.append(pair);
  }
  dialog.querySelector(blockId).hidden = !lines.length;
}

function fillCustomer(dialog, lines = []) {
  fillRows(dialog, "#cc-buy", "#cc-buy-block", lines);
  const block = dialog.querySelector("#cc-buy-block");
  const lead = lines[0]?.side;
  for (const side of Object.keys(SIDES)) block.classList.toggle(`side-${side}`, side === lead);
  const sides = [...new Set(lines.map((line) => line.side).filter(Boolean))];
  dialog.querySelector("#cc-buy-side").textContent = sides.map((side) => SIDES[side]).join(" · ");
}

function setupCard(dialog, plays) {
  const chartHost = dialog.querySelector("#cc-chart");
  let trigger = null;
  let unmount = null;
  let mountId = 0;

  const clearChart = () => {
    mountId += 1;
    unmount?.();
    unmount = null;
  };

  const showLevels = async (play) => {
    clearChart();
    const id = mountId;
    chartHost.replaceChildren(el("p", "cc-chart-loading", "Loading daily closes…"));
    try {
      const bars = await loadBars(play.ticker);
      if (id !== mountId) return;
      fillLevels(dialog, play, chartLevels(play, bars));
      unmount = mountLevels(chartHost, play, bars);
    } catch {
      if (id !== mountId) return;
      chartHost.replaceChildren(el("p", "cc-chart-loading", "The price chart could not load."));
    }
  };

  const fill = (play) => {
    dialog.querySelector("#cc-ticker").textContent = play.ticker;
    dialog.querySelector("#cc-conf").textContent = play.confidence;
    dialog.querySelector("#cc-name").textContent = play.industry ? `${play.name} · ${play.industry.broad} · ${play.industry.focus}` : play.name;
    dialog.querySelector("#cc-title").textContent = play.title;

    dialog.querySelector("#cc-alert").textContent = alertLabel(play.alertedAtCt, true);
    dialog.querySelector("#cc-alert").dateTime = play.alertedAtCt.slice(0, 10);
    const meta = [];
    if (play.refPrice) meta.push(`Ref ${money(play.refPrice)}`);
    meta.push(`Last ${money(play.quote.last)} (${dateLabel(play.quote.date, false)})`);
    dialog.querySelector("#cc-meta").textContent = meta.join(" · ");

    dialog.querySelector("#cc-flow").replaceChildren(...play.flow.slice(0, 3).map((text) => el("p", "", text)));

    fillCustomer(dialog, play.customerPurchased);
    fillRows(dialog, "#cc-oi", "#cc-oi-block", play.oi);
    dialog.querySelector("#cc-rec").textContent = play.recommendation;

    for (const id of ["#tl-contract", "#tl-chart-head", "#tl-move", "#cc-chart-note"]) {
      dialog.querySelector(id).textContent = "";
    }
    dialog.querySelector("#tl-tiles").replaceChildren();
    dialog.querySelector("#tl-legend").replaceChildren();
  };

  const open = (play, from) => {
    trigger = from ?? null;
    fill(play);
    if (!dialog.open) dialog.showModal();
    dialog.querySelector(".cc-left").scrollTop = 0;
    dialog.querySelector(".cc-body").scrollTop = 0;
    dialog.querySelector("#cc-close").focus();
    history.replaceState(null, "", `#${play.ticker}`);
    showLevels(play);
  };

  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll("button, [href], [tabindex]:not([tabindex='-1'])")].filter(
      (item) => !item.disabled && item.offsetParent !== null,
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  dialog.querySelector("#cc-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    clearChart();
    chartHost.replaceChildren();
    history.replaceState(null, "", window.location.pathname + window.location.search);
    trigger?.focus();
    trigger = null;
  });

  return { open, byTicker: new Map(plays.map((play) => [play.ticker, play])) };
}

async function main() {
  const list = document.querySelector("#flow-list");
  const asOf = document.querySelector("#flow-asof");
  const count = document.querySelector("#flow-count");
  const dialog = document.querySelector("#calling-card");

  let seed;
  try {
    const response = await fetch(dataUrl("plays.json"), { cache: "no-cache" });
    if (!response.ok) throw new Error(`plays ${response.status}`);
    seed = await response.json();
  } catch {
    asOf.textContent = "The Shopping List could not load.";
    return;
  }

  const plays = sortPlays(seed.plays);
  const latest = plays[0]?.date;
  asOf.textContent = `${seed.window} · alert times CT`;
  count.textContent = `${plays.length} names · last 3 weeks`;
  list.replaceChildren(...plays.map((play) => row(play, play.date === latest)));

  const card = setupCard(dialog, plays);
  list.addEventListener("click", (event) => {
    const button = event.target.closest(".flow-row");
    if (!button) return;
    const play = card.byTicker.get(button.dataset.ticker);
    if (play) card.open(play, button);
  });

  const openFromHash = () => {
    const ticker = decodeURIComponent(window.location.hash.slice(1)).toUpperCase();
    const play = card.byTicker.get(ticker);
    if (!play) return;
    card.open(play, list.querySelector(`.flow-row[data-ticker="${play.ticker}"]`));
  };
  window.addEventListener("hashchange", openFromHash);
  openFromHash();
}

function bootFlow() {
  if (!document.body || document.body.dataset.flowBoot === "1" || !document.querySelector("#flow-list")) return;
  document.body.dataset.flowBoot = "1";
  main();
}

if (typeof document !== "undefined") {
  document.addEventListener("vault-open", bootFlow);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootFlow);
  else bootFlow();
}
