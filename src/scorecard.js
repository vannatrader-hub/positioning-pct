import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-700.css";
import "@fontsource-variable/ibm-plex-sans/wght.css";

const $ = (sel) => document.querySelector(sel);
const base = import.meta.env ? import.meta.env.BASE_URL : "/";

let boardData = null;
let spotlightTickers = new Set();
let selectedTicker = null;
let trigger = null;

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function md(s) {
  return esc(String(s ?? ""))
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:]|$)/g, "$1<em>$2</em>")
    .replace(/\*+/g, "")
    .replace(/\s*(→|->)\s*/g, " → ");
}

function fmtUsd(n) {
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

function ticketClass(t) {
  const v = (t || "").toLowerCase();
  if (v === "open") return "open";
  if (v === "filled") return "filled";
  return "";
}

function chipClass(c) {
  const raw = String(c || "");
  if (raw.toUpperCase().includes("PUT-SALE")) return "PUT-SALE";
  return raw.replace(/\s+/g, "-").toUpperCase();
}

function renderChips(chips) {
  return (chips || [])
    .map((c) => `<span class="chip ${esc(chipClass(c))}" data-chip="${esc(c)}">${esc(c)}</span>`)
    .join("");
}

function guideColor(kind) {
  if (kind === "put") return "#ff6b6b";
  if (kind === "target") return "#5b9cff";
  if (kind === "longput") return "#c084fc";
  return "#f5a623";
}

function renderSpark(candles) {
  if (!candles || !candles.length) {
    return `<div class="spark empty-spark" title="No daily bars">—</div>`;
  }
  const W = 120;
  const H = 40;
  const padT = 3;
  const padB = 3;
  const padL = 2;
  const padR = 2;
  const n = candles.length;
  let lo = Math.min(...candles.map((b) => Number(b.l)));
  let hi = Math.max(...candles.map((b) => Number(b.h)));
  if (!(hi > lo)) hi = lo + 1;
  const plotH = H - padT - padB;
  const slot = (W - padL - padR) / n;
  const bodyW = Math.max(1.2, Math.min(3.5, slot * 0.55));
  const yOf = (v) => padT + ((hi - v) / (hi - lo)) * plotH;
  const sticks = candles
    .map((b, i) => {
      const x = padL + slot * i + slot / 2;
      const up = Number(b.c) >= Number(b.o);
      const yO = yOf(Number(b.o));
      const yC = yOf(Number(b.c));
      const top = Math.min(yO, yC);
      const bh = Math.max(1, Math.max(yO, yC) - top);
      const cls = up ? "up" : "dn";
      return (
        `<line class="wick ${cls}" x1="${x.toFixed(2)}" y1="${yOf(Number(b.h)).toFixed(2)}" x2="${x.toFixed(2)}" y2="${yOf(Number(b.l)).toFixed(2)}" />` +
        `<rect class="body ${cls}" x="${(x - bodyW / 2).toFixed(2)}" y="${top.toFixed(2)}" width="${bodyW.toFixed(2)}" height="${bh.toFixed(2)}" />`
      );
    })
    .join("");
  const pts = [];
  candles.forEach((b, i) => {
    if (b.ema8 == null) return;
    pts.push(`${(padL + slot * i + slot / 2).toFixed(2)},${yOf(Number(b.ema8)).toFixed(2)}`);
  });
  const emaPath = pts.length >= 2 ? `<polyline class="ema8" points="${pts.join(" ")}" />` : "";
  return `<div class="spark"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">${sticks}${emaPath}</svg></div>`;
}

function renderBoardRow(name) {
  return `<button type="button" class="board-row" data-ticker="${esc(name.ticker)}" aria-haspopup="dialog" aria-label="Open ${esc(name.ticker)} detail, rank ${esc(name.rank)}, composite ${esc(name.composite)}">
    <span class="board-rank">#${esc(name.rank)}</span>
    <span class="board-ticker">${esc(name.ticker)}</span>
    <div class="board-mid">
      <div class="board-chips">${renderChips(name.chips)}</div>
      <div class="board-why">${md(name.why || "—")}</div>
    </div>
    <div class="board-scores">
      <div><span class="comp">${esc(name.composite)}</span></div>
      <div>F <strong>${esc(name.flow)}</strong></div>
      <div>T <strong>${esc(name.tech)}</strong></div>
    </div>
    <div class="board-spark">${renderSpark(name.candles)}</div>
  </button>`;
}

function renderWatch(items) {
  if (!items || !items.length) return "";
  const cards = items
    .map((w) => {
      const tc = ticketClass(w.ticket);
      const linked = spotlightTickers.has(w.ticker);
      const inner = `<div class="wt">${esc(w.ticker)}</div>
        <div class="wd">${esc(w.date || "")}</div>
        <div class="wtitle">${esc(w.title || "")}</div>
        <div class="wstruct">${esc(w.structure || "")}</div>
        ${tc ? `<span class="ticket-pill ${tc}">${esc(w.ticket)}</span>` : ""}
        ${linked ? `<span class="wopen">Open Spotlight card →</span>` : ""}`;
      return linked
        ? `<a class="watch-card is-link" href="../spotlights/#${esc(w.ticker)}">${inner}</a>`
        : `<div class="watch-card">${inner}</div>`;
    })
    .join("");
  return `<h2 class="section-title">Spotlight watch (lookback)</h2>
    <div class="watch-strip">${cards}</div>`;
}

function statusPill(status) {
  const s = (status || "open").toLowerCase();
  const labels = { real: "REAL", from_dossier: "DOSSIER", from_oi: "OI READ", not_on_desk: "NOT ON DESK" };
  return `<span class="status-pill ${esc(s)}">${esc(labels[s] || "OPEN")}</span>`;
}

function buildDetailChart(name) {
  const bars = name.chart || name.candles || [];
  const levels = name.levels || {};
  if (!bars.length) {
    return `<div class="chart-wrap"><div class="chart-empty">No daily bars on board</div></div>`;
  }
  const W = 640;
  const H = 220;
  const padL = 48;
  const padR = 64;
  const padT = 12;
  const padB = 24;
  const closes = bars.map((b) => Number(b.c));
  const guides = [
    { val: levels.spot, color: "#3dd68c", dash: "", label: "Spot" },
    ...(name.trade_lines || []).map((t) => ({
      val: t.value,
      color: guideColor(t.kind),
      dash: t.kind === "target" ? "2 3" : "5 4",
      label: t.label,
      note: t.note,
    })),
  ].filter((g) => g.val != null && !Number.isNaN(Number(g.val)));

  let lo = Math.min(...bars.map((b) => Number(b.l)));
  let hi = Math.max(...bars.map((b) => Number(b.h)));
  for (const g of guides) {
    lo = Math.min(lo, Number(g.val));
    hi = Math.max(hi, Number(g.val));
  }
  const pad = (hi - lo) * 0.06 || 1;
  lo -= pad;
  hi += pad;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = bars.length;
  const xOf = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yOf = (v) => padT + ((hi - v) / (hi - lo)) * plotH;

  const linePts = closes.map((c, i) => `${xOf(i).toFixed(2)},${yOf(c).toFixed(2)}`).join(" ");
  const areaPts = `${xOf(0).toFixed(2)},${(padT + plotH).toFixed(2)} ${linePts} ${xOf(n - 1).toFixed(2)},${(padT + plotH).toFixed(2)}`;

  const guideLines = guides
    .map((g) => {
      const y = yOf(Number(g.val));
      return `
        <line x1="${padL}" y1="${y.toFixed(2)}" x2="${(W - padR).toFixed(2)}" y2="${y.toFixed(2)}"
          stroke="${g.color}" stroke-width="1.25" stroke-dasharray="${g.dash}" opacity="0.85" />
        <text x="${(W - padR + 4).toFixed(2)}" y="${(y + 3).toFixed(2)}" fill="${g.color}"
          font-size="9" font-family="IBM Plex Mono, monospace">${esc(g.label)} ${fmtPx(g.val)}${g.note ? `<title>${esc(g.note)}</title>` : ""}</text>`;
    })
    .join("");

  const yTicks = [lo, (lo + hi) / 2, hi]
    .map((v) => {
      const y = yOf(v);
      return `<text x="${padL - 6}" y="${(y + 3).toFixed(2)}" text-anchor="end" fill="#5a6d8a" font-size="9" font-family="IBM Plex Mono, monospace">${Number(v).toFixed(1)}</text>
        <line x1="${padL}" y1="${y.toFixed(2)}" x2="${(W - padR).toFixed(2)}" y2="${y.toFixed(2)}" stroke="#1a2740" stroke-width="1" />`;
    })
    .join("");

  const first = bars[0].date || "";
  const last = bars[bars.length - 1].date || "";
  const tradeLines = name.trade_lines || [];
  const legend = `
    <span class="lg-spot">Spot</span>
    ${tradeLines.map((t) => `<span style="color:${guideColor(t.kind)}" title="${esc(t.note || "")}">${esc(t.label)} ${fmtPx(t.value)}</span>`).join(" ")}
    ${tradeLines.length ? "" : `<span style="color:var(--dim)">no strike levels in flow</span>`}
  `;

  return `<div class="chart-wrap">
    <div class="chart-head">
      <h3>~6-month price · daily</h3>
      <div class="chart-legend">${legend}</div>
    </div>
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(name.ticker)} 6-month price chart">
      ${yTicks}
      <polygon points="${areaPts}" fill="rgba(61,214,140,0.08)" />
      <polyline fill="none" stroke="#3dd68c" stroke-width="1.75" points="${linePts}" />
      ${guideLines}
    </svg>
    <div class="chart-foot">
      <span>${esc(first)} → ${esc(last)} · ${n}d</span>
      <span>as of ${esc(levels.as_of || last)} · daily closes</span>
    </div>
  </div>`;
}

function panelStatus(panel) {
  if (!panel || typeof panel !== "object") return "open";
  return panel.status || "open";
}

function parseLevelsFallback(str) {
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
      const usd = Math.abs(Number(String(m[2]).replace(/,/g, ""))) * mult;
      if (!(usd > 0)) continue;
      items.push({ strike, usd, display: fmtUsd(usd) || `$${usd}`, sign });
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
      return `<div class="oi-bar-row ${tone}">
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
  return `<div class="oi-chip oi-chip-open"><span class="oi-chip-k">${esc(label)}</span><span class="oi-chip-v">OPEN</span></div>`;
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
        <div class="oi-greek"><div class="oi-greek-title pos">+ Gamma</div>${renderStrikeBars(gPos, "pos")}</div>
        <div class="oi-greek"><div class="oi-greek-title neg">− Gamma</div>${renderStrikeBars(gNeg, "neg")}</div>
        <div class="oi-greek"><div class="oi-greek-title pos">+ Vanna</div>${renderStrikeBars(levelList(s, "vanna_pos"), "pos")}</div>
        <div class="oi-greek"><div class="oi-greek-title neg">− Vanna</div>${renderStrikeBars(levelList(s, "vanna_neg"), "neg")}</div>
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
         <p class="note">${esc(iv.note || "")}</p>`
      : `<p>${esc(iv.summary || "")}</p>
         ${iv.as_of ? `<p class="note">as of ${esc(iv.as_of)} · ${esc(iv.note || "")}</p>` : `<p class="note">${esc(iv.note || "")}</p>`}`;

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
    <p class="note">Tech score ${esc(tech.tech_score ?? name.tech)}/100 ·
      spot ${fmtPx(lv.spot)} · EMA8 ${fmtPx(lv.ema8)} · EMA21 ${fmtPx(lv.ema21)} · 200-MA ${lv.sma200 != null ? fmtPx(lv.sma200) : "OPEN"}</p>
    ${tech.technicals_note ? `<p class="note">${md(tech.technicals_note)}</p>` : ""}`;

  const fundBody =
    panelStatus(fund) === "open"
      ? `<p><strong>OPEN</strong> — ${esc(fund.summary || "No fundamental profile.")}</p>
         ${thesis ? `<p><em>Thesis:</em> ${esc(thesis)}</p>` : ""}`
      : `<p>${esc(fund.summary || "")}</p>
         ${thesis ? `<p><em>Thesis:</em> ${esc(thesis)}</p>` : ""}`;

  let spotBody;
  if (!spot) {
    spotBody = `<p class="note">No Spotlight card on this name — —</p>`;
  } else {
    const tc = ticketClass(spot.ticket);
    spotBody = `<div class="spotlight-strip">
      <div class="sp-title">${esc(spot.title || spot.ticker || "Spotlight")}</div>
      <div class="sp-meta">
        <span>${esc(spot.date || "")}</span>
        <span>${esc(spot.structure || "")}</span>
        ${tc ? `<span class="ticket-pill ${tc}">${esc(spot.ticket)}</span>` : ""}
      </div>
    </div>`;
  }

  return `
    <div class="fi-title">Flow Intelligence</div>
    <details class="accordion" open>
      <summary>Trade / Flow Summary ${statusPill(panelStatus(trade))}</summary>
      <div class="body">
        <p><strong>${esc(name.ticker)}</strong> · ${esc(trade.structure || name.structure_bias || "—")} · conf ${esc(trade.confidence || "OPEN")}</p>
        <p>${md(trade.why || name.why || "—")}</p>
        ${trade.net_premium ? `<p>Net premium (from prints): <strong>${esc(fmtUsd(trade.net_premium.usd) || trade.net_premium.raw)}</strong></p>` : `<p class="note">Net premium: OPEN (no $ print parsed)</p>`}
        ${prints ? `<ul>${prints}</ul>` : ""}
      </div>
    </details>
    <details class="accordion">
      <summary>IV &amp; catalyst ${statusPill(panelStatus(iv))}</summary>
      <div class="body">${ivBody}</div>
    </details>
    <details class="accordion" open>
      <summary>OI / Dealer levels ${statusPill(panelStatus(oi))}</summary>
      <div class="body">${oiBody}</div>
    </details>
    <details class="accordion" open>
      <summary>Technical Analysis ${statusPill(panelStatus(tech))}</summary>
      <div class="body">${techBody}</div>
    </details>
    <details class="accordion">
      <summary>Fundamental / thesis ${statusPill(panelStatus(fund))}</summary>
      <div class="body">${fundBody}</div>
    </details>
    <details class="accordion">
      <summary>Spotlight ${spot ? statusPill("real") : statusPill("open")}</summary>
      <div class="body">${spotBody}</div>
    </details>`;
}

function renderTradeCard(name) {
  const levels = name.levels || {};
  const prem = name.net_premium;
  const premLabel = prem ? fmtUsd(prem.usd) || prem.raw : "OPEN";
  const top = name.top_print || (name.top_prints || [])[0] || "";
  const volOi = (() => {
    const oi = (name.panels || {}).oi_levels || {};
    if (name.vol_oi) return `${Number(name.vol_oi.volume).toLocaleString()} / ${Number(name.vol_oi.oi).toLocaleString()}`;
    if (oi.vol_oi) return oi.vol_oi;
    const m = String(top).match(/vol\s*[~≈]?\s*([\d,]+)\s*\/\s*OI\s*([\d,]+)/i);
    return m ? `${m[1]}/${m[2]}` : null;
  })();
  const dim = `<span style="color:var(--dim);font-size:11px">/100</span>`;
  const highConf = (name.chips || []).includes("HIGH") || (name.confidence || "").toLowerCase().startsWith("high");

  return `
    <div class="tc-header">
      <div class="tc-brand"><strong>OPTIONS FLOW</strong> · Flow Alert</div>
      <div class="tc-chips">${renderChips(name.chips)}</div>
    </div>
    <div class="tc-main">
      <div>
        <div class="tc-ticker-line">
          <span class="tc-ticker" id="detail-ticker">${esc(name.ticker)}</span>
          <span class="tc-spot">${fmtPx(levels.spot)}</span>${levels.as_of ? `<span class="tc-asof" style="font-size:10px;color:var(--dim);margin-left:6px">as of ${esc(levels.as_of)} close</span>` : ""}
        </div>
        <div class="tc-structure">${esc(name.structure_bias || "—")}${name.put_sale_only ? " · put-sale only · not a long" : ""}</div>
      </div>
      <div class="tc-premium">
        <div class="val">${esc(premLabel)}</div>
        <div class="sub">${prem ? "net premium (from prints)" : "premium OPEN"}</div>
        <div class="comp">Composite ${esc(name.composite)} · F${esc(name.flow)} / T${esc(name.tech)}</div>
      </div>
    </div>
    <div class="analysis-block">
      <h3>DESK ANALYSIS</h3>
      <p>${md(name.desk_analysis || "—")}</p>
    </div>
    <div class="metric-grid">
      <div class="metric-tile"><div class="lab">Flow</div><div class="val flow">${esc(name.flow)}${dim}</div></div>
      <div class="metric-tile"><div class="lab">Tech</div><div class="val tech">${esc(name.tech)}${dim}</div></div>
      <div class="metric-tile">
        <div class="lab">Composite</div>
        <div class="val comp">${esc(name.composite)}${dim}</div>
        <div class="hint">0.65F / 0.35T</div>
      </div>
      <div class="metric-tile"><div class="lab">Top print $</div><div class="val ${prem ? "flow" : "open"}">${esc(premLabel)}</div></div>
      <div class="metric-tile"><div class="lab">Structure</div><div class="val" style="font-size:12px">${esc(name.structure_bias || "—")}</div></div>
      <div class="metric-tile"><div class="lab">Confidence</div><div class="val">${esc(name.confidence || "OPEN")}</div></div>
      <div class="metric-tile">
        <div class="lab">Vol / OI</div>
        <div class="val ${volOi ? "" : "open"}">${volOi ? esc(volOi) : "n/a"}</div>
        <div class="hint">${name.vol_oi ? `${esc(name.vol_oi.contract)} · Oct 9 quote` : volOi ? "from dossier/print" : "no specific contract in print"}</div>
      </div>
      <div class="metric-tile">
        <div class="lab">Spot / EMA8</div>
        <div class="val" style="font-size:12px">${fmtPx(levels.spot)} / ${fmtPx(levels.ema8)}</div>
        <div class="hint">EMA21 ${fmtPx(levels.ema21)} · 200 ${levels.sma200 != null ? fmtPx(levels.sma200) : "OPEN"}</div>
      </div>
    </div>
    ${buildDetailChart(name)}
    <div class="tc-footer">
      <div class="tc-foot-box"><div class="lab">Strategy bias</div><div class="val">${esc((name.chips || [])[0] || name.structure_bias || "—")}</div></div>
      <div class="tc-foot-box"><div class="lab">Condition</div><div class="val">${name.put_sale_only ? "Put-sale only" : "Board filter"}</div></div>
      <div class="tc-foot-box"><div class="lab">Rank</div><div class="val">#${esc(name.rank)} · ${highConf ? "High conf" : esc(name.confidence || "OPEN")}</div></div>
    </div>`;
}

function openDetail(ticker, from) {
  if (!boardData) return;
  const name = (boardData.names || []).find((n) => n.ticker === ticker);
  if (!name) return;
  selectedTicker = ticker;
  trigger = from ?? document.querySelector(`.board-row[data-ticker="${ticker}"]`);
  const levels = name.levels || {};
  $("#detail-spot-pill").textContent =
    levels.spot != null ? `Spot: ${fmtPx(levels.spot)}${levels.as_of ? ` · as of ${levels.as_of}` : ""}` : "Spot: OPEN";
  $("#trade-card").innerHTML = renderTradeCard(name);
  $("#flow-intel").innerHTML = renderFlowIntel(name);
  $("#detail-overlay").hidden = false;
  $(".detail-shell").scrollTop = 0;
  document.body.style.overflow = "hidden";
  $("#detail-close").focus();
  history.replaceState(null, "", `#${ticker}`);
}

function closeDetail() {
  if ($("#detail-overlay").hidden) return;
  selectedTicker = null;
  $("#detail-overlay").hidden = true;
  document.body.style.overflow = "";
  history.replaceState(null, "", window.location.pathname + window.location.search);
  trigger?.focus();
  trigger = null;
}

function renderBoard(data) {
  boardData = data;
  const live = data.live === true || (data.label || "").toUpperCase() === "LIVE";
  const blend = data.composite_blend || {};
  const blendNote = blend.note || `LOCKED v1: ${blend.flow ?? 0.65} flow / ${blend.tech ?? 0.35} tech`;

  $("#brand-badges").innerHTML = live
    ? `<span class="badge live">LIVE</span>`
    : `<span class="badge dry">${esc(data.label || "SNAPSHOT")}</span>`;
  $("#week-of").textContent = data.week_of || "—";
  $("#iso-week").textContent = data.iso_week || "";
  $("#last-updated").textContent = data.last_updated || data.generated || "—";
  $("#last-updated-et").textContent = data.last_updated_et || "";
  $("#blend-note").innerHTML = `Composite blend · <em>${esc(blendNote)}</em>`;
  $("#lookback").textContent = data.flow_lookback || "";

  const names = (data.names || []).slice().sort((a, b) => (a.rank || 99) - (b.rank || 99));
  $("#tab-count").textContent = names.length ? String(names.length) : "";
  const grid = $("#grid");
  grid.innerHTML = names.length ? names.map(renderBoardRow).join("") : `<div class="empty">No names on the board this week.</div>`;

  $("#watch-section").innerHTML = renderWatch(data.spotlight_watch);
  $("#advisory").textContent = data.advisory || "Advisory only — not an order ticket.";

  const gaps = data.data_gaps || [];
  const gapsEl = $("#gaps");
  gapsEl.style.display = gaps.length ? "" : "none";
  gapsEl.querySelector("ul").innerHTML = gaps.map((g) => `<li>${esc(g)}</li>`).join("");

  if (selectedTicker && !$("#detail-overlay").hidden) openDetail(selectedTicker);
}

function openFromHash() {
  const ticker = decodeURIComponent(window.location.hash.slice(1)).toUpperCase();
  if (ticker && boardData?.names?.some((n) => n.ticker === ticker)) openDetail(ticker);
}

async function loadJson(path) {
  const res = await fetch(`${base}data/flow/${path}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  $("#grid").addEventListener("click", (event) => {
    const row = event.target.closest(".board-row");
    if (row) openDetail(row.dataset.ticker, row);
  });
  $("#detail-close").addEventListener("click", closeDetail);
  $("#detail-overlay").addEventListener("click", (e) => {
    if (e.target === $("#detail-overlay")) closeDetail();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDetail();
  });
  window.addEventListener("hashchange", openFromHash);

  try {
    const spotlights = await loadJson("spotlights.json");
    spotlightTickers = new Set(spotlights.cards.map((card) => card.ticker));
  } catch {
    spotlightTickers = new Set();
  }

  try {
    const data = await loadJson("scorecard.json");
    $("#poll-status").textContent = `weekly snapshot · loaded ${new Date().toLocaleTimeString()}`;
    renderBoard(data);
    openFromHash();
  } catch (err) {
    $("#poll-status").textContent = `load error: ${err.message}`;
    $("#grid").innerHTML = `<div class="empty">The scorecard could not load.</div>`;
  }
}

main();
