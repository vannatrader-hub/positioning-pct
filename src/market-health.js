/**
 * Market Health Snapshot — weekly Soft ↔ Crowded color board.
 *
 * The cell strings are the locked preview demo from 2026-10-31 (s soft,
 * S deeper soft, m mid, c crowded, C deeper crowded). They are not a live
 * week-over-week read and must not be treated as desk data. The coloring
 * engine is a separate job, wired when the breadth series is live.
 */

/** ISO weeks W29–W44 2026, the locked demo window through Fri Oct 30. */
export const MARKET_HEALTH_WEEKS = [29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44];

export const MARKET_HEALTH_ROWS = [
  { id: "soft-vol", label: "Soft Vol", cells: "SsmmccmmSsmmccms" },
  { id: "vol-stress", label: "Vol Stress", cells: "ssmmmmssmmmcCcmm" },
  { id: "mag7", label: "Mag 7", cells: "mmmmmmcmccmccCCc" },
  { id: "credit", label: "Credit / CSR", cells: "sssssmmmmmmccCCc" },
  { id: "global-fund", label: "Global fund", cells: "mmsssmmmmmmmmccm" },
  { id: "sharpies", label: "Sharpies / COT", cells: "cmmmSssmmmmmmmcc" },
  { id: "nysi", label: "NY Summation", cells: "mmmcCccmmmsssmmm" },
  { id: "nasi", label: "Nasdaq Summation", cells: "smmmccCccmmmmssm" },
  { id: "nyad", label: "NYAD", cells: "sssmmmmmsSssmmmm" },
  { id: "nyhl", label: "NYHL", cells: "ssmmmcmmssSsmmmc" },
  { id: "put-call", label: "Put / Call", cells: "smcsmcSmcmsmCmsm" },
  { id: "naaim", label: "NAAIM / risk appetite", cells: "mcccmmsssmmmcccC" },
  { id: "spx-ema", label: "SPX vs 8/21 weekly EMA", cells: "ssssccccssssssCc" },
];

/** Demo alphabet → board state. Deeper weeks stay the same voice, darker cell. */
export const MARKET_HEALTH_STATES = {
  s: { state: "soft", name: "Soft", voice: "Buy index / possible bottom" },
  S: { state: "soft-extreme", name: "Soft", voice: "Buy index / possible bottom" },
  m: { state: "mid", name: "Mid", voice: "Mid" },
  c: { state: "crowded", name: "Crowded", voice: "Crowded / don’t add" },
  C: { state: "crowded-extreme", name: "Crowded", voice: "Crowded / don’t add" },
};

export const MARKET_HEALTH_TIP = "Hover a box — Row · W{n} · Soft|Mid|Crowded";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function mountMarketHealth(doc = document) {
  const table = doc.getElementById("mh-board");
  if (!table || table.dataset.ready) return;
  const tip = doc.getElementById("mh-tip");

  const cols = el("colgroup");
  const labelCol = el("col");
  labelCol.style.width = "var(--mh-label-w)";
  cols.append(labelCol);
  for (const _week of MARKET_HEALTH_WEEKS) {
    const col = el("col");
    col.style.width = "var(--mh-cell)";
    cols.append(col);
  }

  const head = el("thead");
  const headRow = el("tr");
  headRow.append(el("th", "mh-label", "ISO wk"));
  for (const week of MARKET_HEALTH_WEEKS) {
    const cell = el("th", "", `W${week}`);
    cell.scope = "col";
    headRow.append(cell);
  }
  head.append(headRow);

  const body = el("tbody");
  for (const row of MARKET_HEALTH_ROWS) {
    const tr = el("tr");
    const label = el("th", "mh-label", row.label);
    label.scope = "row";
    tr.append(label);
    for (let i = 0; i < MARKET_HEALTH_WEEKS.length; i += 1) {
      const code = row.cells[i];
      const spec = MARKET_HEALTH_STATES[code];
      const td = el("td");
      const box = el("span", "mh-cell");
      if (!spec) {
        box.dataset.state = "empty";
        td.append(box);
        tr.append(td);
        continue;
      }
      const week = MARKET_HEALTH_WEEKS[i];
      const text = `${row.label} · W${week} · ${spec.name}`;
      box.dataset.state = spec.state;
      box.dataset.tip = text;
      box.setAttribute("aria-hidden", "true");
      td.append(box, el("span", "visually-hidden", `${spec.name}. ${spec.voice}. Demo pattern.`));
      tr.append(td);
    }
    body.append(tr);
  }

  table.append(cols, head, body);
  table.dataset.ready = "1";

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

if (typeof document !== "undefined") {
  const boot = () => mountMarketHealth();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}
