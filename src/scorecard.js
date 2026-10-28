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

function ticketClass(t) {
  const v = (t || "").toLowerCase();
  if (v === "open") return "open";
  if (v === "filled") return "filled";
  return "";
}

function chipClass(c) {
  const raw = String(c || "").toUpperCase();
  if (raw.includes("PUT-SALE")) return "put-sale";
  return raw.replace(/\s+/g, "-").toLowerCase();
}

function renderChips(chips) {
  return (chips || []).map((c) => `<span class="sb-chip is-${esc(chipClass(c))}">${esc(c)}</span>`).join("");
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

function boardRow(name) {
  const comp = Math.max(0, Math.min(100, Number(name.composite) || 0));
  return `<li><button type="button" class="sb-row" data-ticker="${esc(name.ticker)}" aria-haspopup="dialog"
      aria-label="${esc(name.ticker)}, rank ${esc(name.rank)}, composite ${esc(name.composite)}, flow ${esc(name.flow)}, tech ${esc(name.tech)}. Open trade card">
    <span class="sb-rank">#${esc(name.rank)}</span>
    <span class="sb-id"><strong class="sb-ticker">${esc(name.ticker)}</strong><span class="sb-struct">${esc(name.structure_bias || "—")}</span></span>
    <span class="sb-mid"><span class="sb-chips">${renderChips(name.chips)}</span><span class="sb-why">${md(name.why || "—")}</span></span>
    <span class="sb-scores">
      <span class="sb-comp-line"><strong class="sb-comp">${esc(name.composite)}</strong><span class="sb-ft">F <b>${esc(name.flow)}</b> · T <b>${esc(name.tech)}</b></span></span>
      <span class="sb-bar" aria-hidden="true"><i style="width:${comp}%"></i></span>
    </span>
    <span class="sb-spark">${renderSpark(name.candles)}</span>
    <span class="fr-arrow" aria-hidden="true">→</span>
  </button></li>`;
}

function watchCard(w, linked) {
  const tc = ticketClass(w.ticket);
  const inner = `<span class="spot-top">
      <strong class="spot-ticker">${esc(w.ticker)}</strong>
      ${tc ? `<span class="sb-ticket is-${tc}">${esc(w.ticket)}</span>` : ""}
    </span>
    <span class="spot-title">${esc(w.title || "")}</span>
    <span class="spot-meta"><span class="spot-chip sb-struct-chip">${esc(w.structure || "")}</span></span>
    <span class="spot-foot">
      <time datetime="${esc(w.date || "")}">Posted ${esc(isoLabel(w.date))}</time>
      ${linked ? `<span class="sb-watch-open">Open Spotlight card <span class="fr-arrow" aria-hidden="true">→</span></span>` : ""}
    </span>`;
  return linked
    ? `<li><a class="spot-card sb-watch-card" href="../spotlights/#${esc(w.ticker)}">${inner}</a></li>`
    : `<li><div class="spot-card sb-watch-card is-static">${inner}</div></li>`;
}

function statusPill(status) {
  const s = (status || "open").toLowerCase();
  const labels = { real: "REAL", from_dossier: "DOSSIER", from_oi: "OI READ", not_on_desk: "NOT ON DESK" };
  return `<span class="fi-pill is-${esc(s)}">${esc(labels[s] || "OPEN")}</span>`;
}

function panelStatus(panel) {
  if (!panel || typeof panel !== "object") return "open";
  return panel.status || "open";
}

export function parseLevelsFallback(str) {
  const out = { pos: [], neg: [] };
  if (!str) return out;
  const norm = String(str).replace(/[−–]/g, "-");
  let left = norm;
  let right = "";
  if (norm.includes("|")) {
    const parts = norm.split("|");
    left = parts[0];
    right = parts.slice(1).join("|");
  } else {
    const m = /;\s*(?=-\s*\d)/.exec(norm);
    if (m) {
      left = norm.slice(0, m.index);
      right = norm.slice(m.index + 1);
    }
  }
  const re = /([+\-]?\s*\d+(?:\.\d+)?)\s*\$\s*-?\s*([\d,.]+)\s*([KkMmBb])?/g;
  function side(chunk, defaultSign) {
    const items = [];
    let m;
    const cleaned = String(chunk || "").replace(/^[+:\s-]+/, "");
    while ((m = re.exec(cleaned))) {
      let raw = m[1].replace(/\s+/g, "");
      let sign = defaultSign;
      if (raw.startsWith("+")) {
        sign = "+";
        raw = raw.slice(1);
      } else if (raw.startsWith("-")) {
        sign = "-";
        raw = raw.slice(1);
      }
      const strike = Number(raw);
      if (Number.isNaN(strike)) continue;
      const suf = (m[3] || "").toUpperCase();
      const mult = suf === "B" ? 1e9 : suf === "M" ? 1e6 : suf === "K" ? 1e3 : 1;
      const amount = Math.abs(Number(String(m[2]).replace(/,/g, ""))) * mult;
      if (!(amount > 0)) continue;
      items.push({ strike, usd: amount, display: fmtUsd(amount) || `$${amount}`, sign });
    }
    re.lastIndex = 0;
    return items;
  }
  out.pos = side(left, "+");
  out.neg = side(right, "-");
  return out;
}

function levelList(s, kind) {
  const direct = s[kind];
  if (Array.isArray(direct) && direct.length) return direct;
  const group = kind.startsWith("gamma") ? s.gamma_levels || {} : s.vanna_levels || {};
  const side = kind.endsWith("_pos") ? "pos" : "neg";
  if (Array.isArray(group[side]) && group[side].length) return group[side];
  return parseLevelsFallback(kind.startsWith("gamma") ? s.gamma : s.vanna)[side] || [];
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

function strikeFromCoord(raw) {
  if (raw == null || raw === "") return null;
  const t = String(raw).trim();
  if (/^open$/i.test(t)) return null;
  const m = t.match(/-?\d+(?:\.\d+)?/);
  return m ? m[0] : null;
}

function topStrike(items) {
  if (!items || !items.length) return null;
  let best = items[0];
  for (const it of items) {
    if ((Number(it.usd) || 0) > (Number(best.usd) || 0)) best = it;
  }
  if (best.strike == null || best.strike === "") return null;
  const n = Number(best.strike);
  return Number.isFinite(n) ? String(n) : String(best.strike);
}

function decodeHorizonFoot(s, shortLabel, gPos, gNeg) {
  const support = strikeFromCoord(s.floors) || topStrike(gPos);
  const resist = strikeFromCoord(s.walls) || topStrike(gNeg);
  const pin = strikeFromCoord(s.pins);
  const bits = [support ? `Support at ${support}` : "Support OPEN", resist ? `resistance at ${resist}` : "resistance OPEN"];
  if (pin) bits.push(`pin at ${pin}`);
  const key = "Put floor = support · Call wall = resistance · Pin = magnet";
  return `<div class="oi-levels-foot"><div class="oi-decode">${esc(`${shortLabel}: ${bits.join(", ")}`)}</div><div class="oi-decode-key">${esc(key)}</div></div>`;
}

function coordChip(label, value) {
  if (value) {
    return `<div class="oi-chip"><span class="oi-chip-k">${esc(label)}</span><span class="oi-chip-v">${esc(value)}</span></div>`;
  }
  return `<div class="oi-chip is-open"><span class="oi-chip-k">${esc(label)}</span><span class="oi-chip-v">OPEN</span></div>`;
}

function renderOiHorizon(sub, fallbackLabel) {
  const s = sub || {};
  const st = panelStatus(s);
  const label = s.label || fallbackLabel;
  let body;
  if (st === "not_on_desk" || st === "open") {
    const tag = st === "not_on_desk" ? "NOT ON DESK" : "OPEN";
    const reason =
      String(s.summary || "")
        .replace(/^(OPEN|NOT ON DESK)\s*[—\-]\s*/i, "")
        .trim() || (st === "open" ? "No Monthly OpEx / Third Friday breakout in singles." : "No OI read for this horizon.");
    body = `<div class="oi-open-banner"><span class="oi-open-tag">${tag}</span><span class="oi-open-reason">${esc(reason)}</span></div>`;
  } else {
    const gPos = levelList(s, "gamma_pos");
    const gNeg = levelList(s, "gamma_neg");
    body = `
      ${s.expiry ? `<div class="oi-expiry">${esc(s.expiry)}</div>` : ""}
      <div class="oi-chips">
        ${coordChip("Call wall", s.walls)}
        ${coordChip("Put floor", s.floors)}
        ${coordChip("Pin", s.pins)}
      </div>
      ${s.dealer_positioning ? `<div class="oi-dealer"><span class="oi-chip-k">Dealer</span> ${esc(s.dealer_positioning)}</div>` : ""}
      <div class="oi-greek-grid">
        <div class="oi-greek"><div class="oi-greek-title is-pos">+ Gamma</div>${renderStrikeBars(gPos, "pos")}</div>
        <div class="oi-greek"><div class="oi-greek-title is-neg">− Gamma</div>${renderStrikeBars(gNeg, "neg")}</div>
        <div class="oi-greek"><div class="oi-greek-title is-pos">+ Vanna</div>${renderStrikeBars(levelList(s, "vanna_pos"), "pos")}</div>
        <div class="oi-greek"><div class="oi-greek-title is-neg">− Vanna</div>${renderStrikeBars(levelList(s, "vanna_neg"), "neg")}</div>
      </div>
      ${decodeHorizonFoot(s, /all/i.test(label) ? "All expiry" : "OpEx", gPos, gNeg)}`;
  }
  return `<div class="oi-card">
    <div class="oi-card-title"><span>${esc(label)}</span>${statusPill(st)}</div>
    <div class="oi-card-body">${body}</div>
  </div>`;
}

function renderFlowIntel(name) {
  const p = name.panels || {};
  const trade = p.trade_summary || {};
  const iv = p.iv_catalyst || {};
  const oi = p.oi_levels || {};
  const tech = p.technical || {};
  const fund = p.fundamental || {};
  const thesis = p.thesis_one_liner || name.thesis_one_liner;
  const spot = p.spotlight || name.spotlight;

  const prints = (trade.top_prints || []).map((x) => `<li>${md(x)}</li>`).join("");

  const ivBody =
    panelStatus(iv) === "open"
      ? `<p><strong>OPEN</strong> — ${esc(iv.summary || "IV not on desk.")}</p>
         <p class="fi-note">${esc(iv.note || "")}</p>`
      : `<p>${esc(iv.summary || "")}</p>
         ${iv.as_of ? `<p class="fi-note">as of ${esc(iv.as_of)} · ${esc(iv.note || "")}</p>` : `<p class="fi-note">${esc(iv.note || "")}</p>`}`;

  let oiBody;
  const mo = oi.monthly_opex;
  const ae = oi.all_expiry;
  if ((panelStatus(oi) === "not_on_desk" || panelStatus(oi) === "open") && !mo && !ae) {
    oiBody = `<div class="oi-open-banner"><span class="oi-open-tag">NOT ON DESK</span><span class="oi-open-reason">${esc(oi.summary || "OI levels not on desk.")}</span></div>`;
  } else {
    oiBody = `
      <div class="oi-meta">${oi.as_of ? `as of ${esc(oi.as_of)}` : ""}${oi.as_of && oi.source ? " · " : ""}${oi.source ? esc(oi.source) : ""}</div>
      <div class="oi-cards">
        ${renderOiHorizon(mo, "Monthly OpEx")}
        ${renderOiHorizon(ae, "All expiry")}
      </div>`;
  }

  const lv = tech.levels || name.levels || {};
  const techBody = `
    <p>${md(tech.tech_why || name.tech_why || "—")}</p>
    <p class="fi-note">Tech score ${esc(tech.tech_score ?? name.tech)}/100 ·
      spot ${fmtPx(lv.spot)} · EMA8 ${fmtPx(lv.ema8)} · EMA21 ${fmtPx(lv.ema21)} · 200-MA ${lv.sma200 != null ? fmtPx(lv.sma200) : "OPEN"}</p>
    ${tech.technicals_note ? `<p class="fi-note">${md(tech.technicals_note)}</p>` : ""}`;

  const fundBody = `${panelStatus(fund) === "open" ? `<p><strong>OPEN</strong> — ${esc(fund.summary || "No fundamental profile.")}</p>` : `<p>${esc(fund.summary || "")}</p>`}
    ${thesis ? `<p><em>Thesis:</em> ${esc(thesis)}</p>` : ""}`;

  let spotBody;
  if (!spot) {
    spotBody = `<p class="fi-note">No Spotlight card on this name.</p>`;
  } else {
    const tc = ticketClass(spot.ticket);
    spotBody = `<div class="fi-spot">
      <div class="fi-spot-title">${esc(spot.title || spot.ticker || "Spotlight")}</div>
      <div class="fi-spot-meta">
        <span>${esc(spot.date || "")}</span>
        <span>${esc(spot.structure || "")}</span>
        ${tc ? `<span class="sb-ticket is-${tc}">${esc(spot.ticket)}</span>` : ""}
      </div>
    </div>`;
  }

  return `
    <h3 class="fi-title">Flow Intelligence</h3>
    <details class="fi-acc" open>
      <summary>Trade / Flow Summary ${statusPill(panelStatus(trade))}</summary>
      <div class="fi-body">
        <p><strong>${esc(name.ticker)}</strong> · ${esc(trade.structure || name.structure_bias || "—")} · conf ${esc(trade.confidence || "OPEN")}</p>
        <p>${md(trade.why || name.why || "—")}</p>
        ${trade.net_premium ? `<p>Net premium (from prints): <strong>${esc(fmtUsd(trade.net_premium.usd) || trade.net_premium.raw)}</strong></p>` : `<p class="fi-note">Net premium: OPEN (no $ print parsed)</p>`}
        ${prints ? `<ul>${prints}</ul>` : ""}
      </div>
    </details>
    <details class="fi-acc">
      <summary>IV &amp; catalyst ${statusPill(panelStatus(iv))}</summary>
      <div class="fi-body">${ivBody}</div>
    </details>
    <details class="fi-acc" open>
      <summary>OI / Dealer levels ${statusPill(panelStatus(oi))}</summary>
      <div class="fi-body">${oiBody}</div>
    </details>
    <details class="fi-acc" open>
      <summary>Technical Analysis ${statusPill(panelStatus(tech))}</summary>
      <div class="fi-body">${techBody}</div>
    </details>
    <details class="fi-acc">
      <summary>Fundamental / thesis ${statusPill(panelStatus(fund))}</summary>
      <div class="fi-body">${fundBody}</div>
    </details>
    <details class="fi-acc">
      <summary>Spotlight ${spot ? statusPill("real") : statusPill("open")}</summary>
      <div class="fi-body">${spotBody}</div>
    </details>`;
}

function volOi(name) {
  const top = name.top_print || (name.top_prints || [])[0] || "";
  const oi = (name.panels || {}).oi_levels || {};
  if (name.vol_oi) {
    return {
      value: `${Number(name.vol_oi.volume).toLocaleString("en-US")} / ${Number(name.vol_oi.oi).toLocaleString("en-US")}`,
      hint: `${name.vol_oi.contract} · Oct 9 quote`,
    };
  }
  if (oi.vol_oi) return { value: oi.vol_oi, hint: "from dossier/print" };
  const m = String(top).match(/vol\s*[~≈]?\s*([\d,]+)\s*\/\s*OI\s*([\d,]+)/i);
  return m ? { value: `${m[1]}/${m[2]}`, hint: "from dossier/print" } : { value: null, hint: "no specific contract in print" };
}

function isHighConf(name) {
  return (name.chips || []).includes("HIGH") || (name.confidence || "").toLowerCase().startsWith("high");
}

function premiumLabel(name) {
  const prem = name.net_premium;
  return prem ? fmtUsd(prem.usd) || prem.raw : "OPEN";
}

function cardRow(label, value, sub, extra = "") {
  return `<div class="cc-oi-row${extra ? ` ${extra}` : ""}"><dt>${esc(label)}</dt><dd>${value}${sub ? `<span class="sb-row-sub">${sub}</span>` : ""}</dd></div>`;
}

function renderTradeCard(name) {
  const levels = name.levels || {};
  const prem = name.net_premium;
  const premLabel = premiumLabel(name);
  const vo = volOi(name);
  const asOf = levels.as_of ? ` · as of ${esc(isoLabel(levels.as_of))} close` : "";
  const structure = `${name.structure_bias || "—"}${name.put_sale_only ? " · put-sale only · not a long" : ""}`;
  const score = (label, value, tone, hint) =>
    `<div class="sb-score is-${tone}"><dt>${label}</dt><dd>${esc(value)}<span>/100</span></dd>${hint ? `<dd class="sb-score-hint">${hint}</dd>` : ""}</div>`;

  return `
    <p class="cc-meta">
      <span class="cc-alert sb-alert">Options Flow · Flow alert</span>
      <span>Spot ${fmtPx(levels.spot)}${asOf}</span>
    </p>
    <h3 class="cc-title" id="bc-title">${esc(name.ticker)} · ${esc(structure)}</h3>
    <dl class="sb-scoreboard">
      ${score("Composite", name.composite, "comp", "0.65F / 0.35T")}
      ${score("Flow", name.flow, "flow")}
      ${score("Tech", name.tech, "tech")}
    </dl>
    <div class="cc-block">
      <h4 class="cc-label">Desk analysis</h4>
      <div class="cc-flow"><p>${md(name.desk_analysis || "—")}</p></div>
    </div>
    <div class="cc-block">
      <h4 class="cc-label">Trade card</h4>
      <dl class="cc-oi sb-facts">
        ${cardRow("Top print $", esc(premLabel), prem ? "net premium (from prints)" : "premium OPEN", prem ? "is-flow" : "is-open")}
        ${cardRow("Structure", esc(structure))}
        ${cardRow("Confidence", esc(name.confidence || "OPEN"))}
        ${cardRow("Vol / OI", vo.value ? esc(vo.value) : "n/a", esc(vo.hint), vo.value ? "" : "is-open")}
        ${cardRow("Spot / EMA8", `${fmtPx(levels.spot)} / ${fmtPx(levels.ema8)}`, `EMA21 ${fmtPx(levels.ema21)} · 200 ${levels.sma200 != null ? fmtPx(levels.sma200) : "OPEN"}`)}
        ${cardRow("Strategy bias", esc((name.chips || [])[0] || name.structure_bias || "—"))}
        ${cardRow("Condition", name.put_sale_only ? "Put-sale only" : "Board filter")}
        ${cardRow("Rank", `#${esc(name.rank)} · ${isHighConf(name) ? "High conf" : esc(name.confidence || "OPEN")}`)}
      </dl>
    </div>
    ${name.top_print ? `<div class="cc-block"><h4 class="cc-label">Top print</h4><p class="sb-print">${md(name.top_print)}</p></div>` : ""}`;
}

function tile(label, value, sub, accent) {
  return `<div class="tl-tile${accent ? ` is-${accent}` : ""}"><dt>${esc(label)}</dt><dd>${esc(value)}</dd>${sub ? `<dd class="tl-sub">${esc(sub)}</dd>` : ""}</div>`;
}

function swatch(kind, label, title) {
  return `<span class="tl-key"${title ? ` title="${esc(title)}"` : ""}><i class="tl-sw is-${kind}"></i>${esc(label)}</span>`;
}

function fillRight(dialog, name) {
  const levels = name.levels || {};
  const chart = boardLevels(name);
  const vo = volOi(name);
  $("#bc-contract", dialog).textContent = name.vol_oi?.contract || name.structure_bias || "";
  $("#bc-tiles", dialog).innerHTML = [
    tile("Spot", fmtPx(levels.spot), levels.as_of ? `${shortDate(levels.as_of)} close` : "Spot OPEN"),
    tile("Net premium", premiumLabel(name), name.net_premium ? "From prints" : "Not in a print"),
    tile("Composite", `${name.composite}/100`, `F${name.flow} / T${name.tech}`, "be"),
    tile("Vol / OI", vo.value || "n/a", vo.value ? (name.vol_oi ? "Oct 9 quote" : "From dossier/print") : "No contract in print"),
  ].join("");

  const head = [`${name.ticker} — ~6-month price · daily`, ...chart.lines.map((line) => line.label)];
  $("#bc-head", dialog).textContent = head.join(" · ");
  const lines = name.trade_lines || [];
  $("#bc-legend", dialog).innerHTML =
    swatch("price", "Close") +
    (lines.length
      ? boardLines(name).map((line) => swatch(SWATCH[line.kind], line.label, line.note)).join("")
      : `<span class="tl-key sb-dim">No strike levels in flow</span>`);
  const n = chart.window.length;
  $("#bc-range", dialog).textContent = n ? `${shortDate(chart.window[0].t, true)} → ${shortDate(chart.spotDate, true)} · ${n}d` : "";
  $("#bc-note", dialog).textContent = n
    ? `Daily closes as of ${isoLabel(levels.as_of || chart.spotDate)} from the weekly snapshot. Lines are the strikes and targets named in the flow.`
    : "";
  $("#flow-intel", dialog).innerHTML = renderFlowIntel(name);
  return chart;
}

function setupCard(dialog, board) {
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
    const levels = name.levels || {};
    $("#bc-ticker", dialog).textContent = name.ticker;
    $("#bc-rank", dialog).textContent = `#${name.rank}`;
    $("#bc-chips", dialog).innerHTML = renderChips(name.chips);
    $("#bc-spot", dialog).textContent =
      levels.spot != null ? `Spot ${fmtPx(levels.spot)}${levels.as_of ? ` · ${shortDate(levels.as_of)}` : ""}` : "Spot OPEN";
    $("#trade-card", dialog).innerHTML = renderTradeCard(name);
    const chart = fillRight(dialog, name);
    if (!dialog.open) dialog.showModal();
    $(".cc-left", dialog).scrollTop = 0;
    $(".cc-right", dialog).scrollTop = 0;
    $(".cc-body", dialog).scrollTop = 0;
    $("#bc-close", dialog).focus();
    history.replaceState(null, "", `#${name.ticker}`);
    clearChart();
    if (chart.window.length) unmount = drawLevelsChart(chartHost, name.ticker, chart);
    else chartHost.innerHTML = `<p class="cc-chart-loading">No daily bars on board</p>`;
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

function renderBoard(board, spotlightTickers) {
  const live = board.live === true || (board.label || "").toUpperCase() === "LIVE";
  $("#sb-badge").outerHTML = live
    ? `<span class="badge is-live" id="sb-badge"><i aria-hidden="true"></i>Live</span>`
    : `<span class="badge" id="sb-badge">${esc(board.label === "SNAPSHOT" || !board.label ? "Weekly snapshot" : board.label)}</span>`;

  const names = (board.names || []).slice().sort((a, b) => (a.rank || 99) - (b.rank || 99));
  const week = splitWeek(board.week_of);
  $("#week-of").textContent = week.main;
  $("#iso-week").textContent = [board.iso_week, week.rest].filter(Boolean).join(" · ");
  $("#last-updated").textContent = board.last_updated || board.generated || "—";
  $("#last-updated-et").textContent = [board.last_updated_et, `weekly snapshot · loaded ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`]
    .filter(Boolean)
    .join(" · ");
  const blend = board.composite_blend || {};
  $("#blend-note").textContent = blend.note || `LOCKED v1: ${blend.flow ?? 0.65} flow / ${blend.tech ?? 0.35} tech`;
  $("#lookback").textContent = board.flow_lookback ? `Flow lookback · ${board.flow_lookback}` : "";
  $("#sb-asof").textContent = [board.iso_week, `${names.length} ranked names`, board.last_updated ? `updated ${board.last_updated}` : ""]
    .filter(Boolean)
    .join(" · ");

  $("#board-count").textContent = names.length ? `${names.length} names · composite / flow / tech` : "";
  $("#sb-list").innerHTML = names.length ? names.map(boardRow).join("") : `<li class="sb-empty">No names on the board this week.</li>`;

  const watch = board.spotlight_watch || [];
  $("#sb-watch-section").hidden = !watch.length;
  $("#watch-count").textContent = watch.length ? `${watch.length} in lookback` : "";
  $("#sb-watch").innerHTML = watch.map((w) => watchCard(w, spotlightTickers.has(w.ticker))).join("");

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
  let spotlightTickers = new Set();
  try {
    const spotlights = await loadJson("spotlights.json");
    spotlightTickers = new Set(spotlights.sections.flatMap((section) => section.plays).map((play) => play.ticker));
  } catch {
    spotlightTickers = new Set();
  }

  let board;
  try {
    board = await loadJson("scorecard.json");
  } catch {
    $("#sb-asof").textContent = "The scorecard could not load.";
    $("#sb-list").innerHTML = `<li class="sb-empty">The scorecard could not load.</li>`;
    return;
  }

  renderBoard(board, spotlightTickers);
  const card = setupCard($("#board-card"), board);
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
