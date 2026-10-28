import { drawLevelsChart, shortDate, usd } from "./flow-chart.js";

const $ = (sel, root = document) => root.querySelector(sel);

function dataUrl(path) {
  const base = import.meta.env ? import.meta.env.BASE_URL : "/";
  return `${base}data/flow/${path}`;
}

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function md(s) {
  return esc(String(s ?? ""))
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:]|$)/g, "$1<em>$2</em>")
    .replace(/\*+/g, "")
    .replace(/\s*(→|->)\s*/g, " → ");
}

export function fmtUsd(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  const v = Number(n);
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtPx(n, digits = 2) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `$${Number(n).toFixed(digits)}`;
}

function isoLabel(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso ?? "") ? `${shortDate(iso)}, ${iso.slice(0, 4)}` : iso ?? "";
}

function chipClass(c) {
  const raw = String(c || "").toUpperCase();
  if (raw.includes("PUT-SALE")) return "put-sale";
  return raw.replace(/\s+/g, "-").toLowerCase();
}

function renderChips(chips) {
  return (chips || []).map((c) => `<span class="sb-chip is-${esc(chipClass(c))}">${esc(c)}</span>`).join("");
}

const STAR = `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 1.6 L12.6 7 L18.5 7.7 L14.1 11.7 L15.3 17.6 L10 14.6 L4.7 17.6 L5.9 11.7 L1.5 7.7 L7.4 7 Z" fill="#f5c451" stroke="#c99212" stroke-width="1.1" stroke-linejoin="round" /></svg>`;

/** Yellow filled star for a name that has an Active Spotlight. */
export function spotlightStar(ticker, active) {
  if (!active.has(ticker)) return "";
  return `<span class="sb-star" title="Active Spotlight" role="img" aria-label="Active Spotlight">${STAR}</span>`;
}

/** Tickers in the Active row of spotlights.json. */
export function activeSpotlights(seed) {
  const active = (seed?.sections || []).find((section) => section.id === "active");
  return new Set((active?.plays || []).map((play) => play.ticker));
}

/** Unique trade dates for a name, newest first. */
export function tradeDates(name) {
  return [...new Set((name.trades || []).map((trade) => trade.date))].sort((a, b) => b.localeCompare(a));
}

/** Scorecard trade lines on the shared levels chart: call strikes amber, put strikes red, targets blue. */
const LINE_KIND = { call: "strike", put: "stop", target: "target", longput: "short" };
const SWATCH = { strike: "strike", stop: "stop", target: "target", short: "short" };

export function boardLines(name) {
  return (name.trade_lines || [])
    .filter((line) => typeof line.value === "number")
    .map((line) => ({ kind: LINE_KIND[line.kind] ?? "strike", value: line.value, label: `${line.label} ${usd(line.value)}`, note: line.note }))
    .sort((a, b) => b.value - a.value);
}

/** Everything the shared trade-levels chart draws for one board name. */
export function boardLevels(name) {
  const window = (name.chart || name.candles || []).map((bar) => ({ t: bar.date, c: Number(bar.c) }));
  const last = window[window.length - 1];
  return {
    window,
    lines: boardLines(name),
    expiry: null,
    expiryInView: false,
    markers: [],
    spot: last?.c ?? null,
    spotDate: last?.t ?? null,
  };
}

function renderSpark(candles) {
  if (!candles || !candles.length) {
    return `<span class="spark is-empty" title="No daily bars">—</span>`;
  }
  const W = 120;
  const H = 40;
  const pad = 3;
  const n = candles.length;
  const lo = Math.min(...candles.map((b) => Number(b.l)));
  let hi = Math.max(...candles.map((b) => Number(b.h)));
  if (!(hi > lo)) hi = lo + 1;
  const plotH = H - pad * 2;
  const slot = (W - 4) / n;
  const bodyW = Math.max(1.2, Math.min(3.5, slot * 0.55));
  const yOf = (v) => pad + ((hi - v) / (hi - lo)) * plotH;
  const sticks = candles
    .map((b, i) => {
      const x = 2 + slot * i + slot / 2;
      const cls = Number(b.c) >= Number(b.o) ? "up" : "dn";
      const yO = yOf(Number(b.o));
      const yC = yOf(Number(b.c));
      const top = Math.min(yO, yC);
      const bh = Math.max(1, Math.max(yO, yC) - top);
      return (
        `<line class="wick ${cls}" x1="${x.toFixed(2)}" y1="${yOf(Number(b.h)).toFixed(2)}" x2="${x.toFixed(2)}" y2="${yOf(Number(b.l)).toFixed(2)}" />` +
        `<rect class="body ${cls}" x="${(x - bodyW / 2).toFixed(2)}" y="${top.toFixed(2)}" width="${bodyW.toFixed(2)}" height="${bh.toFixed(2)}" />`
      );
    })
    .join("");
  const pts = candles
    .map((b, i) => (b.ema8 == null ? null : `${(2 + slot * i + slot / 2).toFixed(2)},${yOf(Number(b.ema8)).toFixed(2)}`))
    .filter(Boolean);
  const ema = pts.length >= 2 ? `<polyline class="ema8" points="${pts.join(" ")}" />` : "";
  return `<span class="spark" title="Last ${n} sessions · EMA8 in amber"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">${sticks}${ema}</svg></span>`;
}

function renderStamps(name) {
  const dates = tradeDates(name);
  if (!dates.length) return "";
  return `<span class="sb-times">${dates
    .map((date) => `<time datetime="${esc(date)}">${esc(shortDate(date))}</time>`)
    .join("")}</span>`;
}

function boardRow(name, active) {
  const comp = Math.max(0, Math.min(100, Number(name.composite) || 0));
  const star = active.has(name.ticker) ? ", Active Spotlight" : "";
  return `<li><button type="button" class="sb-row" data-ticker="${esc(name.ticker)}" aria-haspopup="dialog"
      aria-label="${esc(name.ticker)}${star}, rank ${esc(name.rank)}, composite ${esc(name.composite)}, flow ${esc(name.flow)}, tech ${esc(name.tech)}. Open trade card">
    <span class="sb-rank">#${esc(name.rank)}</span>
    <span class="sb-id"><span class="sb-name"><strong class="sb-ticker">${esc(name.ticker)}</strong>${spotlightStar(name.ticker, active)}</span><span class="sb-struct">${esc(name.structure_bias || "—")}</span></span>
    <span class="sb-mid"><span class="sb-chips">${renderChips(name.chips)}${renderStamps(name)}</span><span class="sb-why">${md(name.why || "—")}</span></span>
    <span class="sb-scores">
      <span class="sb-comp-line"><strong class="sb-comp">${esc(name.composite)}</strong><span class="sb-ft">F <b>${esc(name.flow)}</b> · T <b>${esc(name.tech)}</b></span></span>
      <span class="sb-bar" aria-hidden="true"><i style="width:${comp}%"></i></span>
    </span>
    <span class="sb-spark">${renderSpark(name.candles)}</span>
    <span class="fr-arrow" aria-hidden="true">→</span>
  </button></li>`;
}

function emptyState(text) {
  return `<p class="fi-empty">${esc(text)}</p>`;
}

function renderStrikeBars(items, tone) {
  if (!items || !items.length) return `<div class="oi-empty-levels">—</div>`;
  const max = Math.max(...items.map((x) => Number(x.usd) || 0), 1);
  return `<div class="oi-bars">${items
    .slice(0, 6)
    .map((it) => {
      const pct = Math.max(6, Math.round((Number(it.usd) / max) * 100));
      const strike = Number(it.strike);
      const label = Number.isInteger(strike) ? strike.toFixed(0) : String(strike);
      return `<div class="oi-bar-row is-${tone}">
        <span class="oi-strike">${esc(label)}</span>
        <span class="oi-bar-track"><span class="oi-bar-fill" style="width:${pct}%"></span></span>
        <span class="oi-bar-val">${esc(it.display || fmtUsd(it.usd) || "")}</span>
      </div>`;
    })
    .join("")}</div>`;
}

function coordChip(label, value) {
  return `<div class="oi-chip${value ? "" : " is-open"}"><span class="oi-chip-k">${esc(label)}</span><span class="oi-chip-v">${esc(value || "—")}</span></div>`;
}

function renderOiHorizon(h) {
  const expiry = /^\d{4}-\d{2}-\d{2}$/.test(h.expiry || "") ? `Expiry ${isoLabel(h.expiry)}` : h.expiry;
  return `<div class="oi-card">
    <div class="oi-card-title"><span>${esc(h.label)}</span>${expiry ? `<span class="oi-expiry">${esc(expiry)}</span>` : ""}</div>
    <div class="oi-card-body">
      <div class="oi-chips">
        ${coordChip("Call wall", h.walls)}
        ${coordChip("Put floor", h.floors)}
        ${coordChip("Pin", h.pins)}
      </div>
      ${h.dealer_positioning ? `<p class="oi-dealer"><span class="oi-chip-k">Dealer</span> ${esc(h.dealer_positioning)}</p>` : ""}
      <div class="oi-greek-grid">
        <div class="oi-greek"><div class="oi-greek-title is-pos">+ Gamma</div>${renderStrikeBars(h.gamma_pos, "pos")}</div>
        <div class="oi-greek"><div class="oi-greek-title is-neg">− Gamma</div>${renderStrikeBars(h.gamma_neg, "neg")}</div>
        <div class="oi-greek"><div class="oi-greek-title is-pos">+ Vanna</div>${renderStrikeBars(h.vanna_pos, "pos")}</div>
        <div class="oi-greek"><div class="oi-greek-title is-neg">− Vanna</div>${renderStrikeBars(h.vanna_neg, "neg")}</div>
      </div>
    </div>
  </div>`;
}

function stampLabel(raw) {
  const m = /^(\d{4}-\d{2}-\d{2})(?:\s+(.+))?$/.exec(raw || "");
  if (!m) return raw || "";
  return `${isoLabel(m[1])}${m[2] ? ` · ${m[2]}` : ""}`;
}

function fiSection(title, body, aside = "") {
  return `<section class="fi-card">
    <h4 class="fi-card-title"><span>${esc(title)}</span>${aside ? `<span class="fi-aside">${aside}</span>` : ""}</h4>
    <div class="fi-body">${body}</div>
  </section>`;
}

function techLine(label, value, read, tone = "") {
  return `<div class="fi-line${tone ? ` is-${tone}` : ""}"><dt>${esc(label)}</dt><dd><b>${esc(value)}</b>${read ? `<span>${esc(read)}</span>` : ""}</dd></div>`;
}

function readTone(read) {
  const r = String(read || "").toLowerCase();
  if (r.startsWith("above") || r.startsWith("well above")) return "up";
  if (r.startsWith("below")) return "down";
  return "";
}

/** Earnings boxes: the three most recent reports, oldest first, then the next one. Blank boxes stay blank. */
export function earningsBoxes(earnings = {}) {
  const past = [...(earnings.past || [])].sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-3);
  const slots = [null, null, null];
  past.forEach((report, index) => {
    slots[3 - past.length + index] = report;
  });
  return [
    ...slots.map((report, index) => ({ kind: "past", label: `Past ER ${index + 1}`, report })),
    { kind: "next", label: "Upcoming ER", report: earnings.next || null },
  ];
}

function erBox({ kind, label, report }) {
  const when = report ? (report.date ? isoLabel(report.date) : report.label || "") : "";
  return `<div class="fi-er${report ? "" : " is-empty"}${kind === "next" ? " is-next" : ""}">
    <span class="fi-er-k">${esc(label)}</span>
    <strong class="fi-er-v">${esc(when || "None")}</strong>
    ${report?.note ? `<span class="fi-er-note">${esc(report.note)}</span>` : ""}
  </div>`;
}

function renderFlowIntel(name, active) {
  const trades = (name.trades || [])
    .map((trade) => `<li><time datetime="${esc(trade.date)}">${esc(shortDate(trade.date))}</time><span>${md(trade.text)}</span></li>`)
    .join("");
  const prem = name.net_premium;
  const tradeBody = `<p>${md(name.why || "—")}</p>
    ${trades ? `<ul class="fi-trades">${trades}</ul>` : ""}
    ${prem ? `<p class="fi-note">Largest print ${esc(fmtUsd(prem.usd) || prem.raw)} · ${esc(prem.side || "")}</p>` : ""}`;

  const iv = name.iv;
  const next = name.earnings?.next;
  const ivBody = `<dl class="fi-lines">
      ${iv ? techLine("IV30", iv.iv30, `as of ${isoLabel(iv.as_of)}`) : ""}
      ${iv?.skew ? techLine("Skew", iv.skew, "") : ""}
    </dl>
    ${iv ? "" : emptyState("No live IV pull yet.")}
    <div class="fi-sub">
      <span class="fi-sub-k">Open catalyst</span>
      ${next ? `<p><strong>Earnings ${esc(next.date ? isoLabel(next.date) : next.label)}</strong>${next.note ? ` · ${esc(next.note)}` : ""}</p>` : emptyState("No catalyst on file.")}
    </div>`;

  const oi = name.oi_levels;
  const oiBody = oi
    ? `${oi.as_of ? `<p class="fi-note is-top">As of ${esc(stampLabel(oi.as_of))}</p>` : ""}
       <div class="oi-cards">${renderOiHorizon(oi.monthly_opex)}${renderOiHorizon(oi.all_expiry)}</div>`
    : emptyState("No live OI pull yet. Walls, floors, pins, and dealer gamma show here once a read lands.");

  const t = name.technicals || {};
  const lv = name.levels || {};
  const techBody = `<dl class="fi-lines">
      ${techLine("Spot", fmtPx(lv.spot), lv.as_of ? `${shortDate(lv.as_of)} close` : "")}
      ${t.ema8 ? techLine("EMA8", fmtPx(t.ema8.value), t.ema8.read, readTone(t.ema8.read)) : ""}
      ${t.ema21 ? techLine("EMA21", fmtPx(t.ema21.value), t.ema21.read, readTone(t.ema21.read)) : ""}
      ${t.sma200 ? techLine("200-MA", fmtPx(t.sma200.value), t.sma200.read, readTone(t.sma200.read)) : ""}
      ${t.rsi_weekly ? techLine("Weekly RSI", t.rsi_weekly, "") : ""}
      ${techLine("Tech score", `${name.tech}/100`, t.grade || "")}
    </dl>`;

  const fundBody = `${name.thesis ? `<p><span class="fi-sub-k">Thesis</span> ${esc(name.thesis)}</p>` : ""}
    ${name.fundamental ? `<p>${esc(name.fundamental)}</p>` : ""}
    ${!name.thesis && !name.fundamental ? emptyState("No fundamental profile yet.") : ""}
    <div class="fi-ers">${earningsBoxes(name.earnings).map(erBox).join("")}</div>`;

  const spotBody = active.has(name.ticker)
    ? `<a class="fi-spot-link" href="../spotlights/#${esc(name.ticker)}">${spotlightStar(name.ticker, active)}Active Spotlight · open the card <span aria-hidden="true">→</span></a>`
    : `<p class="fi-none">None</p>`;

  return [
    fiSection("Trade summary", tradeBody, `${(name.trades || []).length} trades`),
    fiSection("IV & catalyst", ivBody),
    fiSection("OI & dealer levels", oiBody),
    fiSection("Technical analysis", techBody),
    fiSection("Fundamental / thesis", fundBody),
    fiSection("Spotlight", spotBody),
  ].join("");
}

function volOi(name) {
  if (!name.vol_oi) return { value: null, hint: "No contract on file" };
  return {
    value: `${Number(name.vol_oi.volume).toLocaleString("en-US")} / ${Number(name.vol_oi.oi).toLocaleString("en-US")}`,
    hint: `${name.vol_oi.contract} · ${shortDate(name.vol_oi.as_of.slice(0, 10))}`,
  };
}

function metric(label, value, sub, tone = "") {
  return `<div class="sb-metric${tone ? ` is-${tone}` : ""}"><dt>${esc(label)}</dt><dd>${value}</dd>${sub ? `<dd class="sb-metric-sub">${esc(sub)}</dd>` : ""}</div>`;
}

function score(value) {
  return `${esc(value)}<span class="sb-of">/100</span>`;
}

function conditionLabel(name) {
  if (name.put_sale_only) return "Put-sale only";
  const s = String(name.structure_bias || "").toLowerCase();
  if (s.startsWith("mixed")) return "Mixed flow";
  if (s.startsWith("calls")) return "Call-led";
  return "Board filter";
}

function swatch(kind, label, title) {
  return `<span class="tl-key"${title ? ` title="${esc(title)}"` : ""}><i class="tl-sw is-${kind}"></i>${esc(label)}</span>`;
}

/** Fills the trade card in the order it reads: ticker and contract, analysis, metrics, chart, strategy row. */
function renderTradeCard(dialog, name, board, active) {
  const lv = name.levels || {};
  const t = name.technicals || {};
  const prem = name.net_premium;
  const vo = volOi(name);
  const dates = tradeDates(name);
  const total = (board.names || []).length;

  $("#bc-ticker", dialog).textContent = name.ticker;
  $("#bc-star", dialog).innerHTML = spotlightStar(name.ticker, active);
  $("#bc-spot", dialog).textContent = lv.spot != null ? fmtPx(lv.spot) : "";
  $("#bc-rank", dialog).textContent = `Rank #${name.rank} of ${total}`;
  $("#bc-chips", dialog).innerHTML = renderChips(name.chips);
  $("#bc-contract", dialog).textContent = name.lead?.contract || name.structure_bias || "";
  const stamp = $("#bc-stamp", dialog);
  stamp.dateTime = name.lead?.date || "";
  stamp.textContent = name.lead?.date ? `Lead print ${isoLabel(name.lead.date)}` : "";
  $("#bc-pills", dialog).innerHTML = [
    `<span class="sb-pill is-struct">${esc(name.structure_bias || "—")}</span>`,
    `<span class="sb-pill">${esc(`${(name.trades || []).length} trades`)}</span>`,
  ].join("");
  $("#bc-premium", dialog).textContent = prem ? fmtUsd(prem.usd) || prem.raw : "—";
  $("#bc-premium-sub", dialog).textContent = prem
    ? [prem.side, prem.contracts ? `${prem.contracts.toLocaleString("en-US")} contracts` : ""].filter(Boolean).join(" · ")
    : "Not stated in the prints";
  $("#bc-analysis", dialog).innerHTML = md(name.desk_analysis || name.why || "—");

  $("#bc-tiles", dialog).innerHTML = [
    metric("Composite", score(name.composite), `F ${name.flow} / T ${name.tech}`, "comp"),
    metric("Flow", score(name.flow), "Flow score", "flow"),
    metric("Tech", score(name.tech), t.grade ? `${t.grade} tape` : "Tech score", "tech"),
    metric("Vol / OI", vo.value ? esc(vo.value) : "—", vo.hint, vo.value ? "" : "empty"),
  ].join("");
  $("#bc-tiles-2", dialog).innerHTML = [
    metric("Spot", esc(fmtPx(lv.spot)), lv.as_of ? `${shortDate(lv.as_of)} close` : ""),
    metric("Trades", esc(String((name.trades || []).length)), dates.length ? `${shortDate(dates[dates.length - 1])} – ${shortDate(dates[0])}` : ""),
    metric("Confidence", esc(name.confidence || "—"), ""),
    metric("Weekly RSI", esc(t.rsi_weekly || "—"), ""),
    metric("Upcoming ER", esc(name.earnings?.next ? (name.earnings.next.date ? shortDate(name.earnings.next.date) : name.earnings.next.label) : "None"), "", name.earnings?.next ? "" : "empty"),
  ].join("");

  const chart = boardLevels(name);
  $("#bc-head", dialog).textContent = [`${name.ticker} — 6-month price`, ...chart.lines.map((line) => line.label)].join(" · ");
  $("#bc-legend", dialog).innerHTML =
    swatch("price", "Close") +
    (chart.lines.length
      ? chart.lines.map((line) => swatch(SWATCH[line.kind], line.label, line.note)).join("")
      : `<span class="tl-key sb-dim">No strike levels in the flow</span>`);
  const n = chart.window.length;
  $("#bc-range", dialog).textContent = n ? `${shortDate(chart.window[0].t, true)} → ${shortDate(chart.spotDate, true)} · ${n}d` : "";

  $("#bc-foot", dialog).innerHTML = [
    metric("Strategy", esc(name.structure_bias || "—"), ""),
    metric("Condition", esc(conditionLabel(name)), ""),
    metric("Rank", esc(`#${name.rank} of ${total}`), ""),
  ].join("");
  return chart;
}

function setupCard(dialog, board, active) {
  const chartHost = $("#bc-chart", dialog);
  const byTicker = new Map((board.names || []).map((name) => [name.ticker, name]));
  let trigger = null;
  let unmount = null;

  const clearChart = () => {
    unmount?.();
    unmount = null;
  };

  const open = (ticker, from) => {
    const name = byTicker.get(ticker);
    if (!name) return;
    trigger = from ?? null;
    clearChart();
    const chart = renderTradeCard(dialog, name, board, active);
    $("#fi-count", dialog).textContent = `${name.ticker} · ${(name.trades || []).length} trades`;
    $("#flow-intel", dialog).innerHTML = renderFlowIntel(name, active);
    if (!dialog.open) dialog.showModal();
    $(".cc-left", dialog).scrollTop = 0;
    $(".sb-intel", dialog).scrollTop = 0;
    $(".cc-body", dialog).scrollTop = 0;
    $("#bc-close", dialog).focus();
    history.replaceState(null, "", `#${name.ticker}`);
    if (chart.window.length) unmount = drawLevelsChart(chartHost, name.ticker, chart);
    else chartHost.innerHTML = `<p class="cc-chart-loading">No daily bars on the board</p>`;
  };

  $("#bc-close", dialog).addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    clearChart();
    history.replaceState(null, "", window.location.pathname + window.location.search);
    trigger?.focus();
    trigger = null;
  });

  return { open, byTicker };
}

function splitWeek(text) {
  const [main, ...rest] = String(text || "—").split(" — ");
  return { main, rest: rest.join(" — ") };
}

function renderBoard(board, active) {
  const live = board.live === true || (board.label || "").toUpperCase() === "LIVE";
  $("#sb-badge").outerHTML = live
    ? `<span class="badge is-live" id="sb-badge"><i aria-hidden="true"></i>Live</span>`
    : `<span class="badge" id="sb-badge">${esc(board.label === "SNAPSHOT" || !board.label ? "Weekly snapshot" : board.label)}</span>`;

  const names = (board.names || []).slice().sort((a, b) => (a.rank || 99) - (b.rank || 99));
  const week = splitWeek(board.week_of);
  $("#week-of").textContent = week.main;
  $("#iso-week").textContent = [board.iso_week, week.rest].filter(Boolean).join(" · ");
  $("#last-updated").textContent = board.last_updated || board.generated || "—";
  $("#last-updated-et").textContent = [board.last_updated_et, "weekly snapshot"].filter(Boolean).join(" · ");
  const blend = board.composite_blend || {};
  $("#blend-note").textContent = blend.note || `${blend.flow ?? 0.65} flow / ${blend.tech ?? 0.35} tech`;
  $("#lookback").textContent = board.flow_lookback ? `Flow lookback · ${board.flow_lookback}` : "";
  $("#sb-asof").textContent = [board.iso_week, `${names.length} ranked names`, board.last_updated ? `updated ${board.last_updated}` : ""]
    .filter(Boolean)
    .join(" · ");

  $("#board-count").textContent = names.length ? `${names.length} names · composite / flow / tech` : "";
  $("#sb-list").innerHTML = names.length
    ? names.map((name) => boardRow(name, active)).join("")
    : `<li class="sb-empty">No names on the board this week.</li>`;

  const gaps = board.data_gaps || [];
  const gapsEl = $("#gaps");
  gapsEl.hidden = !gaps.length;
  $("ul", gapsEl).innerHTML = gaps.map((g) => `<li>${esc(g)}</li>`).join("");
}

async function loadJson(path) {
  const res = await fetch(dataUrl(path), { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  let active = new Set();
  try {
    active = activeSpotlights(await loadJson("spotlights.json"));
  } catch {
    active = new Set();
  }

  let board;
  try {
    board = await loadJson("scorecard.json");
  } catch {
    $("#sb-asof").textContent = "The scorecard could not load.";
    $("#sb-list").innerHTML = `<li class="sb-empty">The scorecard could not load.</li>`;
    return;
  }

  renderBoard(board, active);
  const card = setupCard($("#board-card"), board, active);
  const list = $("#sb-list");
  list.addEventListener("click", (event) => {
    const row = event.target.closest(".sb-row");
    if (row) card.open(row.dataset.ticker, row);
  });
  const openFromHash = () => {
    const ticker = decodeURIComponent(window.location.hash.slice(1)).toUpperCase();
    if (card.byTicker.has(ticker)) card.open(ticker, $(`.sb-row[data-ticker="${ticker}"]`, list));
  };
  window.addEventListener("hashchange", openFromHash);
  openFromHash();
}

if (typeof document !== "undefined") main();
