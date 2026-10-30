/**
 * Portfolio journal. Renders only after the Vault gate opens the page, from
 * the locked book in public/data/vault/portfolio/journal.json.
 * A working close (exit_pending_fill) stays pending and out of the closed total.
 * A line still held (status open, or outcome open) stays open and out of that total.
 */

import { isoWeek, isoWeekRange } from "./iso-week.js";

const base = import.meta.env?.BASE_URL ?? "/";
const DATA = `${base}data/vault/portfolio/journal.json`;
const SCHEMA = "ahead-portfolio-journal-v1";
const POST_STAMP = ["ha", "wk_post_ts_ct"].join("");
const POST = ["ha", "wk_post"].join("");

export function isPending(trade) {
  return trade?.status === "exit_pending_fill" || trade?.outcome === "loss_pending";
}

export function isOpen(trade) {
  if (isPending(trade)) return false;
  return trade?.status === "open" || trade?.outcome === "open";
}

export function resultLabel(trade) {
  if (isPending(trade)) return "Pending";
  if (isOpen(trade)) return "Open";
  if (trade?.outcome === "win") return "Win";
  if (trade?.outcome === "loss") return "Loss";
  return "—";
}

const SOURCE = ["Ha", "wk"].join("");
const SOURCE_NAME = new RegExp(`\\b(?:options)?${SOURCE}(?:[- ]team[- ]lead|[- ]only)?\\b`, "gi");
const NEVER_SHOWN = new RegExp(
  [["ha", "wk"], ["vol", "land"], ["dark", "room"], ["w", "sj"], ["robin", "hood"], ["wall street ", "journal"]].map((part) => part.join("")).join("|"),
  "i",
);

/**
 * Journal text as the page shows it. The locked journal names where each
 * ticket came from; the page says "ticket" instead, and drops any line that
 * would still carry a source name.
 */
export function deskCopy(text) {
  if (typeof text !== "string" || !text.trim()) return "";
  const out = text
    .replace(SOURCE_NAME, (match) => {
      const lower = match.toLowerCase();
      if (lower.endsWith("only")) return "ticketed";
      if (lower.endsWith("lead")) return "team lead";
      return "ticket";
    })
    .replace(/(^|[.!?]\s+)ticket/g, (_, lead) => `${lead}Ticket`);
  return NEVER_SHOWN.test(out) ? "" : out;
}

/** Calendar date at the front of a journal stamp such as "2026-10-30 2:18 PM CT". */
export function stampDate(stamp) {
  return String(stamp ?? "").match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
}

export function stopOf(trade) {
  return trade?.stop_stock ?? trade?.[POST]?.stop ?? null;
}

export function targetOf(trade) {
  return trade?.target_stock ?? trade?.[POST]?.target ?? null;
}

/** Mark-to-market for a line still held. Every field is optional; a missing mark stays missing. */
export function markOf(trade) {
  const price = typeof trade?.mtm_price === "number" && Number.isFinite(trade.mtm_price) ? trade.mtm_price : null;
  const pnl = typeof trade?.mtm_pnl_usd === "number" && Number.isFinite(trade.mtm_pnl_usd) ? trade.mtm_pnl_usd : null;
  const asOf = typeof trade?.mtm_as_of_ct === "string" && trade.mtm_as_of_ct.trim() ? trade.mtm_as_of_ct.trim() : "";
  return { price, pnl, asOf, marked: price !== null || pnl !== null };
}

/**
 * The ISO week of the journal's as-of date: filled closes inside it, and the
 * lines still held. Uses the journal stamp, not the reader's clock.
 */
export function weekStrip(journal) {
  const asOf = stampDate(journal?.summary?.as_of_ct) || stampDate(journal?.summary?.updated_ct);
  if (!asOf) return null;
  const week = isoWeek(asOf);
  const { start, end } = isoWeekRange(week);
  const trades = journal.trades ?? [];
  const closed = trades.filter((trade) => {
    if (trade.status !== "closed" || isPending(trade)) return false;
    const day = stampDate(trade.exit_ts_ct);
    return day >= start && day <= end;
  });
  const open = trades.filter(isOpen);
  const marks = open.map(markOf).filter((mark) => mark.marked);
  return {
    week,
    start,
    end,
    asOf,
    closedPnl: closed.reduce((sum, trade) => sum + Number(trade.pnl_usd), 0),
    closedCount: closed.length,
    wins: closed.filter((trade) => trade.outcome === "win").length,
    losses: closed.filter((trade) => trade.outcome === "loss").length,
    closedTickers: closed.map((trade) => trade.ticker),
    openCount: open.length,
    markedCount: marks.length,
    markPnl: marks.length && marks.every((mark) => mark.pnl !== null) ? marks.reduce((sum, mark) => sum + mark.pnl, 0) : null,
    pending: trades.filter(isPending).length,
  };
}

export function closedPnl(journal) {
  return (journal?.trades ?? [])
    .filter((trade) => trade.status === "closed" && !isPending(trade))
    .reduce((sum, trade) => sum + Number(trade.pnl_usd), 0);
}

export function formatUsd(value) {
  if (value == null || value === "") return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  const digits = Math.round(Math.abs(amount)).toLocaleString("en-US");
  if (amount > 0) return `+$${digits}`;
  if (amount < 0) return `−$${digits}`;
  return `$${digits}`;
}

export function formatPx(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
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

function nameList(names) {
  if (!names.length) return "";
  const verb = names.length === 1 ? "is" : "are";
  return { names: names.join(", "), verb };
}

function pendingSentence(trades) {
  const line = nameList(trades.filter(isPending).map((trade) => trade.ticker));
  if (!line) return "";
  return `${line.names} ${line.verb} still a working close. The estimate stays out of the closed total until the order fills.`;
}

function heldSentence(journal) {
  const listed = Array.isArray(journal.summary?.open_tickers) ? journal.summary.open_tickers.filter(Boolean) : [];
  const names = listed.length ? listed : (journal.trades ?? []).filter(isOpen).map((trade) => trade.ticker);
  const line = nameList(names);
  if (!line) return "";
  return `${line.names} ${line.verb} still held.`;
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
  const event = deskCopy(summary.event);
  if (event) wrap.append(el("p", "pf-event", event));
  const bits = [summary.as_of_ct, summary.account];
  if (deskCopy(summary.journal_lock)) bits.push(`Locked ${deskCopy(summary.journal_lock)}`);
  wrap.append(el("p", "pf-meta", bits.map(deskCopy).filter(Boolean).join(" · ")));

  const grid = el("div", "pf-summary");
  grid.append(
    stat(
      "Closed PnL",
      formatUsd(summary.closed_pnl_usd),
      countLabel(summary.closed_count, "filled close", "filled closes"),
      toneOf(summary.closed_pnl_usd),
    ),
  );
  if (Number.isFinite(summary.open_count)) {
    grid.append(
      stat(
        "Open",
        String(summary.open_count),
        countLabel(summary.open_count, "position still held", "positions still held"),
        "open",
      ),
    );
  }
  if (Number.isFinite(summary.pending_count) && summary.pending_count > 0) {
    grid.append(
      stat(
        "Pending",
        `est ${formatUsd(summary.pending_est_pnl_usd)}`,
        `${countLabel(summary.pending_count, "working exit", "working exits")}. Not in the closed total.`,
        "pending",
      ),
    );
  }

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

  const held = heldSentence(journal);
  if (held) wrap.append(el("p", "pf-open-line", held));
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
  if (deskCopy(ticket)) cell.append(el("span", "pf-ticket", deskCopy(ticket)));
  const lock = deskCopy(trade.ticket_lock);
  if (lock) cell.append(el("span", "pf-lock", lock));
  const notes = deskCopy(trade.notes);
  if (notes) {
    const details = el("details", "pf-details");
    details.append(el("summary", "", "Note"), el("p", "", notes));
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
    "Result",
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
    const open = isOpen(trade);
    const tone = open ? "open" : toneOf(trade.pnl_usd, pending);
    const row = el("tr", `is-${tone}`);
    row.dataset.status = trade.status ?? "";

    const category = tag(el("td", "", trade.category), "Category");
    const ticker = tag(el("td"), "Ticker");
    const symbol = el("span", "pf-ticker", trade.ticker);
    if (deskCopy(trade.title)) symbol.title = deskCopy(trade.title);
    ticker.append(symbol);

    const credit = isCredit(trade);
    const exitExtra = [credit && typeof trade.exit_price === "number" ? "db" : "", pending ? "limit" : ""].filter(Boolean).join(" · ");
    const exitWhen = tag(el("td"), "Exit timestamp");
    exitWhen.append(el("span", "pf-when", trade.exit_ts_ct || "—"));

    const result = tag(el("td"), "Result");
    result.append(el("span", `pf-result is-${tone}`, resultLabel(trade)));

    const pnl = tag(el("td", `pf-num pf-pnl is-${tone}`), "PnL");
    const mark = markOf(trade);
    pnl.textContent = pending ? `est ${formatUsd(trade.pnl_usd)}` : open ? (mark.pnl !== null ? `mark ${formatUsd(mark.pnl)}` : "—") : formatUsd(trade.pnl_usd);

    row.append(
      category,
      ticker,
      structureCell(trade),
      entryCell(trade),
      pxCell(trade.entry_price, credit ? "cr" : "", "Entry $"),
      tag(el("td", "pf-num", formatLevel(stopOf(trade))), "Stop"),
      tag(el("td", "pf-num", formatLevel(targetOf(trade))), "Target"),
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

function shortDay(iso) {
  const [, month, day] = iso.split("-").map(Number);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1]} ${day}`;
}

function weekBlock(journal) {
  const strip = weekStrip(journal);
  const wrap = el("section", "pf-week");
  wrap.setAttribute("aria-label", "This week");
  if (!strip) {
    wrap.append(el("p", "hint", "The journal has no as-of date, so there is no week to total."));
    return wrap;
  }
  const head = el("div", "pf-week-head");
  head.append(el("strong", "", `${strip.week} · ${shortDay(strip.start)} – ${shortDay(strip.end)}`), el("span", "", `Week of the journal as of ${journal.summary.as_of_ct}`));
  const cells = el("div", "pf-week-cells");
  const closed = el("div", `pf-week-cell is-${toneOf(strip.closedPnl)}`);
  closed.append(
    el("p", "pf-kicker", "Closed this week"),
    el("p", "pf-week-figure", strip.closedCount ? formatUsd(strip.closedPnl) : "—"),
    el(
      "p",
      "pf-aside",
      strip.closedCount
        ? `${countLabel(strip.closedCount, "filled close", "filled closes")} · ${strip.wins} won · ${strip.losses} lost · ${strip.closedTickers.join(", ")}`
        : "No filled close this week.",
    ),
  );
  const held = el("div", "pf-week-cell is-open");
  held.append(
    el("p", "pf-kicker", "Open"),
    el("p", "pf-week-figure", String(strip.openCount)),
    el("p", "pf-aside", `${countLabel(strip.openCount, "line", "lines")} still held · ${strip.markedCount ? `${strip.markedCount} marked in the journal` : "no marks in the journal"}`),
  );
  const marks = el("div", "pf-week-cell is-flat");
  marks.append(
    el("p", "pf-kicker", "Open marks"),
    el("p", "pf-week-figure", strip.markPnl === null ? "—" : formatUsd(strip.markPnl)),
    el("p", "pf-aside", strip.markPnl === null ? "Shown only when every open line carries a journal mark. No broker mark is pulled." : "From the journal marks on the open lines."),
  );
  cells.append(closed, held, marks);
  wrap.append(head, cells);
  if (strip.pending) wrap.append(el("p", "pf-pending-line", `${countLabel(strip.pending, "working close", "working closes")} not in the week total until filled.`));
  return wrap;
}

function openBlock(journal) {
  const open = (journal.trades ?? []).filter(isOpen);
  const wrap = el("section", "pf-open");
  wrap.setAttribute("aria-label", "Open lines");
  const head = el("div", "pf-open-head");
  head.append(el("h3", "", "Still held"), el("span", "", open.length ? `${countLabel(open.length, "line", "lines")} · stop and target where the journal has them` : "Nothing open"));
  wrap.append(head);
  if (!open.length) {
    wrap.append(el("p", "hint", "No line is open in this journal."));
    return wrap;
  }
  const grid = el("div", "pf-open-grid");
  for (const trade of open) {
    const card = el("article", "pf-open-card");
    card.dataset.ticker = trade.ticker;
    const top = el("div", "pf-open-top");
    top.append(el("span", "pf-ticker", trade.ticker), el("span", "pf-result is-open", resultLabel(trade)));
    const credit = isCredit(trade);
    const mark = markOf(trade);
    const facts = el("dl", "pf-open-facts");
    for (const [label, value] of [
      ["Entry", `${formatPx(trade.entry_price)}${credit ? " cr" : ""} ×${trade.qty}`],
      ["Stop", formatLevel(stopOf(trade))],
      ["Target", formatLevel(targetOf(trade))],
      ["Mark", formatPx(mark.price)],
      ["Mark PnL", formatUsd(mark.pnl)],
      ["Marked", mark.asOf || "—"],
    ]) {
      const row = el("div");
      row.append(el("dt", "", label), el("dd", value === "—" ? "is-empty" : "", value));
      facts.append(row);
    }
    card.append(top, el("p", "pf-open-structure", trade.structure), facts);
    if (stopOf(trade) === null && targetOf(trade) === null) card.append(el("p", "pf-open-note", "No stop or target in the journal for this line."));
    grid.append(card);
  }
  wrap.append(grid);
  return wrap;
}

export function renderPortfolio(root, journal) {
  const board = el("section", "pf-board");
  board.id = "journal-board";
  board.setAttribute("aria-label", "Portfolio journal");
  board.append(summaryBlock(journal), weekBlock(journal), openBlock(journal), tableBlock(journal));
  const basis = deskCopy(journal.summary?.sources_note);
  if (basis) board.append(el("p", "pf-basis", basis));
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
