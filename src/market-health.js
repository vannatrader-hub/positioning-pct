/**
 * Market Health Snapshot — weekly Soft ↔ Crowded board.
 * Cells come from the vault engine. Put/Call stays Demo. Global fund,
 * Sharpies, and NAAIM are as-of Desk proxies, not percentiles.
 */

import { buildMarketHealth, MARKET_HEALTH_TIP } from "./market-health-engine.js";

export { MARKET_HEALTH_ROWS, MARKET_HEALTH_STATES, MARKET_HEALTH_TIP, MARKET_HEALTH_WEEKS } from "./market-health-engine.js";

const BASE = `${import.meta.env?.BASE_URL ?? "/"}data/vault/`;

const VAULT_FILES = {
  csr: "credit-spread-regime/csr.json",
  svbSeries: "spot-vol-beta/series.json",
  svbLatest: "spot-vol-beta/latest.json",
  mag7: "mag7/oscillator.json",
  nysi: "breadth/nysi.json",
  nasi: "breadth/nasi.json",
  nyad: "breadth/nyad.json",
  nyhl: "breadth/nyhl.json",
  spx: "breadth/spx.json",
};

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

async function loadVault() {
  const entries = await Promise.all(
    Object.entries(VAULT_FILES).map(async ([key, path]) => {
      try {
        const response = await fetch(`${BASE}${path}`, { cache: "no-cache" });
        if (!response.ok) return [key, null];
        return [key, await response.json()];
      } catch {
        return [key, null];
      }
    }),
  );
  return Object.fromEntries(entries);
}

export function renderMarketHealth(board, doc = document) {
  const table = doc.getElementById("mh-board");
  if (!table) return;
  const tip = doc.getElementById("mh-tip");

  const cols = el(doc, "colgroup");
  const labelCol = el(doc, "col");
  labelCol.style.width = "var(--mh-label-w)";
  cols.append(labelCol);
  for (const _week of board.weeks) {
    const col = el(doc, "col");
    col.style.width = "var(--mh-cell)";
    cols.append(col);
  }

  const head = el(doc, "thead");
  const headRow = el(doc, "tr");
  headRow.append(el(doc, "th", "mh-label", "ISO wk"));
  for (const week of board.weeks) {
    const cell = el(doc, "th", "", `W${week}`);
    cell.scope = "col";
    headRow.append(cell);
  }
  head.append(headRow);

  const body = el(doc, "tbody");
  for (const row of board.rows) {
    const tr = el(doc, "tr");
    tr.dataset.row = row.id;
    if (row.kind) tr.dataset.kind = row.kind;
    const label = el(doc, "th", "mh-label");
    label.scope = "row";
    label.append(doc.createTextNode(row.label));
    if (row.mark) label.append(el(doc, "span", "mh-tag", row.mark));
    tr.append(label);
    for (const cell of row.cells) {
      const td = el(doc, "td");
      const box = el(doc, "span", "mh-cell");
      box.dataset.state = cell.state || "empty";
      if (cell.tip) {
        box.dataset.tip = cell.tip;
        box.setAttribute("aria-hidden", "true");
      }
      td.append(box);
      if (cell.sr) td.append(el(doc, "span", "visually-hidden", cell.sr));
      tr.append(td);
    }
    body.append(tr);
  }

  table.append(cols, head, body);

  const show = (node) => {
    if (!tip) return;
    const box = node?.closest?.("[data-tip]");
    tip.textContent = box?.dataset.tip || MARKET_HEALTH_TIP;
  };
  table.addEventListener("mouseover", (event) => show(event.target));
  table.addEventListener("mouseleave", () => show(null));
  table.addEventListener("focusin", (event) => show(event.target));
  table.addEventListener("focusout", (event) => {
    if (!table.contains(event.relatedTarget)) show(null);
  });
}

export async function mountMarketHealth(doc = document) {
  const table = doc.getElementById("mh-board");
  if (!table || table.dataset.ready) return;
  table.dataset.ready = "1";
  const tip = doc.getElementById("mh-tip");
  if (tip) tip.textContent = "Reading the vault…";
  let docs = {};
  try {
    docs = await loadVault();
  } catch {
    docs = {};
  }
  renderMarketHealth(buildMarketHealth(docs), doc);
  if (tip && tip.textContent === "Reading the vault…") tip.textContent = MARKET_HEALTH_TIP;
}

if (typeof document !== "undefined") {
  const boot = () => mountMarketHealth();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}
