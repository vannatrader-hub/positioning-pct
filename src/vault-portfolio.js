/**
 * Portfolio journal. Renders only after the Vault gate opens the page, from
 * the locked book in public/data/vault/portfolio/journal.json.
 * A working close (exit_pending_fill) stays pending and out of the closed total.
 */

const base = import.meta.env?.BASE_URL ?? "/";
const DATA = `${base}data/vault/portfolio/journal.json`;
const SCHEMA = "ahead-portfolio-journal-v1";
const POST_STAMP = ["ha", "wk_post_ts_ct"].join("");
const POST = ["ha", "wk_post"].join("");

export function isPending(trade) {
  return trade?.status === "exit_pending_fill" || trade?.outcome === "loss_pending";
}

export function resultLabel(trade) {
  if (isPending(trade)) return "Pending";
  if (trade?.outcome === "win") return "Win";
  if (trade?.outcome === "loss") return "Loss";
  return "—";
}

export function closedPnl(journal) {
  return (journal?.trades ?? [])
    .filter((trade) => trade.status === "closed" && !isPending(trade))
    .reduce((sum, trade) => sum + Number(trade.pnl_usd), 0);
}

export function formatUsd(value) {
  const amount = Math.round(Math.abs(Number(value)));
  const digits = amount.toLocaleString("en-US");
  if (value > 0) return `+$${digits}`;
  if (value < 0) return `−$${digits}`;
  return `$${digits}`;
}

export function formatPx(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function toneOf(value, pending = false) {
  if (pending) return "pending";
  if (value > 0) return "win";
  if (value < 0) return "loss";
  return "flat";
}

function isCredit(trade) {
  return String(trade?.structure ?? "").trim().toLowerCase().startsWith("short");
}

function postedStamp(trade) {
  const flat = trade?.[POST_STAMP];
  if (typeof flat === "string" && flat) return flat;
  const post = trade?.[POST];
  return post && typeof post.posted_ct === "string" ? post.posted_ct : "";
}

function wpId(trade) {
  if (Number.isInteger(trade?.wp_id)) return trade.wp_id;
  const post = trade?.[POST];
  return post && Number.isInteger(post.wp_id) ? post.wp_id : null;
}

function exactTicket(trade) {
  const post = trade?.[POST];
  return post && typeof post.exact_ticket === "string" ? post.exact_ticket : "";
}

function formatLevel(value) {
  if (value == null || value === "") return "—";
  return String(value);
}

function pendingSentence(trades) {
  const names = trades.filter(isPending).map((trade) => trade.ticker);
  if (!names.length) return "";
  const verb = names.length === 1 ? "is" : "are";
  return `${names.join(", ")} ${verb} still a working close. The estimate stays out of the closed total until the order fills.`;
}

function countLabel(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function stat(label, figure, aside, tone) {
  const card = el("div", `pf-stat is-${tone}`);
  card.append(el("p", "pf-kicker", label), el("p", "pf-figure", figure), el("p", "pf-aside", aside));
  return card;
}

function summaryBlock(journal) {
  const summary = journal.summary;
  const wrap = el("div", "pf-lead");
  wrap.append(el("p", "pf-event", summary.event));
  const bits = [summary.as_of_ct, summary.account];
  if (summary.journal_lock) bits.push(`Locked ${summary.journal_lock}`);
  wrap.append(el("p", "pf-meta", bits.filter(Boolean).join(" · ")));

  const grid = el("div", "pf-summary");
  grid.append(
    stat(
      "Closed PnL",
      formatUsd(summary.closed_pnl_usd),
      countLabel(summary.closed_count, "filled close", "filled closes"),
      toneOf(summary.closed_pnl_usd),
    ),
    stat(
      "Pending",
      `est ${formatUsd(summary.pending_est_pnl_usd)}`,
      `${countLabel(summary.pending_count, "working exit", "working exits")}. Not in the closed total.`,
      "pending",
    ),
  );

  const cats = el("div", "pf-stat");
  cats.append(el("p", "pf-kicker", "Closed by category"));
  const list = el("ul", "pf-cats");
  for (const [name, pnl] of Object.entries(summary.by_category ?? {})) {
    const row = el("li");
    row.append(el("span", "", name), el("span", `is-${toneOf(pnl)}`, formatUsd(pnl)));
    list.append(row);
  }
  cats.append(list);
  grid.append(cats);
  wrap.append(grid);

  const pending = pendingSentence(journal.trades ?? []);
  if (pending) wrap.append(el("p", "pf-pending-line", pending));
  return wrap;
}

function tag(node, label) {
  node.dataset.label = label;
  return node;
}

function entryCell(trade) {
  const cell = tag(el("td"), "Entry timestamp");
  cell.append(el("span", "pf-when", trade.entry_ts_ct));
  const posted = postedStamp(trade);
  const wp = wpId(trade);
  if (posted || wp) {
    const bits = [];
    if (posted) bits.push(`Posted ${posted}`);
    if (wp) bits.push(`WP ${wp}`);
    cell.append(el("span", "pf-sub", bits.join(" · ")));
  }
  return cell;
}

function structureCell(trade) {
  const cell = tag(el("td", "pf-structure"), "Structure");
  cell.append(el("span", "pf-struct", `${trade.structure} ×${trade.qty}`));
  const ticket = exactTicket(trade);
  if (ticket) cell.append(el("span", "pf-ticket", ticket));
  if (trade.ticket_lock) cell.append(el("span", "pf-lock", trade.ticket_lock));
  if (trade.notes) {
    const details = el("details", "pf-details");
    details.append(el("summary", "", "Note"), el("p", "", trade.notes));
    cell.append(details);
  }
  return cell;
}

function pxCell(value, extra, label) {
  const cell = tag(el("td", "pf-num"), label);
  cell.textContent = extra ? `${formatPx(value)} ${extra}` : formatPx(value);
  return cell;
}

function tableBlock(journal) {
  const scroll = el("div", "pf-scroll");
  const table = el("table", "pf-table");
  const caption = el("caption", "", "Personal book");
  const head = el("thead");
  const headRow = el("tr");
  for (const label of [
    "Category",
    "Ticker",
    "Structure",
    "Entry timestamp",
    "Entry $",
    "Stop",
    "Target",
    "Exit timestamp",
    "Exit $",
    "Win/Loss",
    "PnL",
  ]) {
    const th = el("th", label.endsWith("$") || label === "PnL" || label === "Stop" || label === "Target" ? "is-num" : "", label);
    th.scope = "col";
    headRow.append(th);
  }
  head.append(headRow);

  const body = el("tbody");
  for (const trade of journal.trades) {
    const pending = isPending(trade);
    const tone = toneOf(trade.pnl_usd, pending);
    const row = el("tr", `is-${tone}`);
    row.dataset.status = trade.status ?? "";

    const category = tag(el("td", "", trade.category), "Category");
    const ticker = tag(el("td"), "Ticker");
    const symbol = el("span", "pf-ticker", trade.ticker);
    if (trade.title) symbol.title = trade.title;
    ticker.append(symbol);

    const credit = isCredit(trade);
    const exitExtra = [credit ? "db" : "", pending ? "limit" : ""].filter(Boolean).join(" · ");
    const exitWhen = tag(el("td"), "Exit timestamp");
    exitWhen.append(el("span", "pf-when", trade.exit_ts_ct));

    const result = tag(el("td"), "Win/Loss");
    result.append(el("span", `pf-result is-${tone}`, resultLabel(trade)));

    const pnl = tag(el("td", `pf-num pf-pnl is-${tone}`), "PnL");
    pnl.textContent = pending ? `est ${formatUsd(trade.pnl_usd)}` : formatUsd(trade.pnl_usd);

    row.append(
      category,
      ticker,
      structureCell(trade),
      entryCell(trade),
      pxCell(trade.entry_price, credit ? "cr" : "", "Entry $"),
      tag(el("td", "pf-num", formatLevel(trade.stop_stock)), "Stop"),
      tag(el("td", "pf-num", formatLevel(trade.target_stock)), "Target"),
      exitWhen,
      pxCell(trade.exit_price, exitExtra, "Exit $"),
      result,
      pnl,
    );
    body.append(row);
  }

  table.append(caption, head, body);
  scroll.append(table);
  return scroll;
}

export function renderPortfolio(root, journal) {
  const board = el("section", "pf-board");
  board.id = "journal-board";
  board.setAttribute("aria-label", "Portfolio journal");
  board.append(summaryBlock(journal), tableBlock(journal));
  if (journal.summary?.sources_note) board.append(el("p", "pf-basis", journal.summary.sources_note));
  root.replaceChildren(board);
}

async function load(root) {
  const response = await fetch(DATA);
  if (!response.ok) throw new Error(`journal ${response.status}`);
  const journal = await response.json();
  if (journal.schema !== SCHEMA || !journal.summary || !Array.isArray(journal.trades)) {
    throw new Error("journal document is missing portfolio fields");
  }
  renderPortfolio(root, journal);
  const asOf = journal.summary.as_of_ct ? ` · ${journal.summary.as_of_ct}` : "";
  document.title = `Portfolio${asOf} · Vault · Positioning %.`;
}

function onOpen() {
  const root = document.getElementById("journal");
  if (!root || root.dataset.ready === "1") return;
  root.dataset.ready = "1";
  load(root).catch((error) => {
    console.error(error);
    root.replaceChildren(el("p", "hint", "The journal did not load. Refresh to try again."));
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("vault-open", onOpen);
}
