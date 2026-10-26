/**
 * Study desk. Marks come from a committed JSON snapshot in public/data, so the
 * static site never holds broker keys. Copy names legs as short or long and
 * never prompts an order or a size.
 */

function marksUrl() {
  const base = import.meta.env ? import.meta.env.BASE_URL : "/";
  return `${base}data/study-marks.json`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function price(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const rounded = Math.round(value * 1000) / 1000;
  const fixed = Math.abs(rounded).toFixed(3);
  const text = fixed.endsWith("0") ? Math.abs(rounded).toFixed(2) : fixed;
  return rounded < 0 ? `−${text}` : text;
}

export function strike(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const iv = (value) => `${(value * 100).toFixed(1)}%`;
const count = (value) => value.toLocaleString("en-US");

export function expiry(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

/**
 * Study math for a vertical credit spread, per share, at expiration.
 * Puts: short strike above long (bull put). Calls: short strike below long (bear call).
 */
export function creditSpreadMath(spread) {
  const credit = spread.short.mark - spread.long.mark;
  const natural = spread.short.bid - spread.long.ask;
  const width = Math.abs(spread.short.strike - spread.long.strike);
  const isPut = spread.short.type === "put";
  return {
    credit,
    natural,
    width,
    maxLoss: width - credit,
    breakeven: isPut ? spread.short.strike - credit : spread.short.strike + credit,
  };
}

export const bullPutMath = creditSpreadMath;

export function leapMath(leap) {
  const premium = leap.long.mark;
  const breakeven = leap.long.type === "put" ? leap.long.strike - premium : leap.long.strike + premium;
  return { premium, breakeven };
}

/** Which structures and chains each side of the curriculum reads. */
export const CURRICULUM = {
  soft: { spread: "bullPut", leap: "callLeap", strip: "putStrip", leapRows: "leapCalls" },
  crowded: { spread: "bearCall", leap: "putLeap", strip: "callStrip", leapRows: "leapPuts" },
};

const COPY = {
  soft: {
    spreadTitle: "Bull put",
    spreadCopy: (s) =>
      `An example studied when a sector is soft: short the ${strike(s.short.strike)} put and long the ${strike(s.long.strike)} put, same expiration. The long put sets a floor, so the most it can lose is known up front.`,
    spreadEmpty: "A defined-risk structure: two puts, same expiration, the short strike above the long strike.",
    leapTitle: "Call LEAP",
    leapCopy: (l) =>
      `An example long-dated call near the money: long the ${strike(l.long.strike)} call expiring ${expiry(l.expiration)}.`,
    leapEmpty: "A long-dated call. Textbooks use it to carry a view on a distant expiration instead of one that ends this month.",
    stripTitle: "Put chain strip",
    stripKicker: "the bull put curriculum",
    lead: (sector) =>
      `${sector.ticker} (${sector.short}) reads ${sector.display} on the JPM monitor, inside the soft quartile under 0.25. These are the structures people study when a sector sits on the soft side.`,
  },
  crowded: {
    spreadTitle: "Bear call",
    spreadCopy: (s) =>
      `An example studied when a sector is crowded: short the ${strike(s.short.strike)} call and long the ${strike(s.long.strike)} call, same expiration. The long call sets a ceiling on the loss, so the most it can lose is known up front.`,
    spreadEmpty: "A defined-risk structure: two calls, same expiration, the short strike below the long strike.",
    leapTitle: "Put LEAP",
    leapCopy: (l) =>
      `An example long-dated put near the money: long the ${strike(l.long.strike)} put expiring ${expiry(l.expiration)}. Textbooks use it as distant protection when positioning is full.`,
    leapEmpty: "A long-dated put. Textbooks use it as distant protection when positioning is full.",
    stripTitle: "Call chain strip",
    stripKicker: "the bear call curriculum",
    lead: (sector) =>
      `${sector.ticker} (${sector.short}) reads ${sector.display} on the JPM monitor, at the 0.75 line where the crowded quartile starts. These are the structures people study when a sector sits on the crowded side.`,
  },
};

function stamp(marks) {
  const node = el("p", "marks-stamp");
  const dot = el("i");
  dot.setAttribute("aria-hidden", "true");
  node.append(
    dot,
    el("span", "", `Marks as of ${marks.asOfLabel}`),
    document.createTextNode(" "),
    el("span", "stamp-note", "Snapshot · not streaming"),
  );
  return node;
}

function quoteGrid(pairs) {
  const grid = el("dl", "quote-grid");
  for (const [label, value, tone] of pairs) {
    const item = el("div", tone ? `q is-${tone}` : "q");
    item.append(el("dt", "", label), el("dd", "", value));
    grid.append(item);
  }
  return grid;
}

function studyCard(title, kicker, ...children) {
  const card = el("article", "study-card");
  const head = el("div", "study-card-head");
  head.append(el("h3", "", title));
  if (kicker) head.append(el("span", "study-kicker", kicker));
  card.append(head, ...children);
  return card;
}

function pending(text) {
  const node = el("div", "chain-pending");
  node.append(el("strong", "", "Chain refresh pending"), el("span", "", text));
  return node;
}

function sharesCard(ticker, underlying, marks) {
  const pairs = [
    ["Last", price(underlying.spot)],
    ["Prior close", price(underlying.previousClose)],
  ];
  if (underlying.spotBid !== undefined) pairs.push(["Bid", price(underlying.spotBid)], ["Ask", price(underlying.spotAsk)]);
  return studyCard(
    "Shares",
    ticker,
    el("p", "study-copy", "The sector fund itself. Lessons treat this as the plain way to hold the basket, with no contract and no expiration."),
    quoteGrid(pairs),
    stamp(marks),
  );
}

function legsTable(legs) {
  const table = el("table", "legs");
  const head = el("tr");
  for (const label of ["Leg", "Strike", "Bid", "Ask", "Mark"]) head.append(el("th", "", label));
  const thead = el("thead");
  thead.append(head);
  const body = el("tbody");
  for (const [role, leg] of legs) {
    const row = el("tr");
    row.append(
      el("td", `leg-role is-${role.toLowerCase()}`, `${role} ${leg.type}`),
      el("td", "num", strike(leg.strike)),
      el("td", "num", price(leg.bid)),
      el("td", "num", price(leg.ask)),
      el("td", "num strong", price(leg.mark)),
    );
    body.append(row);
  }
  table.append(thead, body);
  const wrap = el("div", "legs-wrap");
  wrap.append(table);
  return wrap;
}

function spreadCard(ticker, spread, copy, marks) {
  if (!spread) return studyCard(copy.spreadTitle, ticker, el("p", "study-copy", copy.spreadEmpty), pending(`No ${ticker} spread marks in this snapshot yet.`));
  const math = creditSpreadMath(spread);
  const children = [
    el("p", "study-copy", copy.spreadCopy(spread)),
    legsTable([
      ["Short", spread.short],
      ["Long", spread.long],
    ]),
    quoteGrid([
      ["Credit at mid", price(math.credit), "accent"],
      ["Credit at bid/ask", price(math.natural)],
      ["Width", price(math.width)],
      ["Max loss at expiry", price(math.maxLoss)],
      ["Breakeven at expiry", price(math.breakeven)],
    ]),
  ];
  if (math.natural <= 0) {
    children.push(
      el("p", "study-fine is-warn", "Quotes are wide here: at bid/ask the spread collects no credit. Mid marks are a reference, not a fill."),
    );
  }
  children.push(el("p", "study-fine", "Per share, at expiration, from the marks shown. No size."), stamp(marks));
  return studyCard(
    copy.spreadTitle,
    `${ticker} ${expiry(spread.expiration)} · ${strike(spread.short.strike)} / ${strike(spread.long.strike)}`,
    ...children,
  );
}

function spotRow(spot) {
  const tr = el("tr", "spot-row");
  const td = el("td");
  td.append(el("span", "", `Spot ${price(spot)}`));
  td.colSpan = 7;
  tr.append(td);
  return tr;
}

function chainTable(chain, { spot, highlight = {}, caption }) {
  const wrap = el("div", "chain-wrap");
  const table = el("table", "chain");
  table.dataset.type = chain.type;
  table.append(el("caption", "", caption));
  const head = el("tr");
  for (const label of ["Strike", "Bid", "Ask", "Mark", "IV", "OI", "Volume"]) head.append(el("th", "", label));
  const thead = el("thead");
  thead.append(head);
  const body = el("tbody");

  let spotPlaced = spot === undefined;
  for (const row of chain.rows) {
    if (!spotPlaced && row.strike > spot) {
      body.append(spotRow(spot));
      spotPlaced = true;
    }
    const tr = el("tr");
    const tag = highlight[row.strike];
    if (tag) {
      tr.className = "is-leg";
      tr.dataset.leg = tag;
    }
    const strikeCell = el("td", "num strike", strike(row.strike));
    if (tag) strikeCell.append(el("span", "leg-tag", tag));
    tr.append(
      strikeCell,
      el("td", "num", price(row.bid)),
      el("td", "num", price(row.ask)),
      el("td", "num strong", price(row.mark)),
      el("td", "num", iv(row.iv)),
      el("td", "num", count(row.oi)),
      el("td", "num", count(row.volume)),
    );
    body.append(tr);
  }
  if (!spotPlaced) body.append(spotRow(spot));
  table.append(thead, body);
  wrap.append(table);
  return wrap;
}

function leapCard(ticker, leap, leapRows, underlying, copy, marks) {
  if (!leap) return studyCard(copy.leapTitle, ticker, el("p", "study-copy", copy.leapEmpty), pending(`No ${ticker} LEAP marks in this snapshot yet.`));
  const math = leapMath(leap);
  const side = leap.long.type === "put" ? "P" : "C";
  const children = [
    el("p", "study-copy", copy.leapCopy(leap)),
    legsTable([["Long", leap.long]]),
    quoteGrid([
      ["Premium at mid", price(math.premium), "accent"],
      ["Breakeven at expiry", price(math.breakeven)],
      ["Max loss", `${price(math.premium)} premium`],
    ]),
  ];
  if (leapRows) {
    children.push(
      chainTable(leapRows, {
        spot: underlying.spot,
        highlight: { [leap.long.strike]: "Long" },
        caption: `${ticker} ${expiry(leapRows.expiration)} ${leapRows.type}s`,
      }),
    );
  }
  children.push(el("p", "study-fine", "Per share, from the marks shown. No size."), stamp(marks));
  return studyCard(copy.leapTitle, `${ticker} ${expiry(leap.expiration)} · ${strike(leap.long.strike)}${side}`, ...children);
}

function panel(sector, marks) {
  const { ticker, side } = sector;
  const plan = CURRICULUM[side];
  const copy = COPY[side];
  const underlying = marks.underlyings[ticker] ?? {};
  const chains = marks.chains?.[ticker] ?? {};
  const structures = chains.structures ?? {};
  const spread = structures[plan.spread];
  const strip = chains[plan.strip];

  const root = el("div", `study-panel is-${side}`);
  root.id = `study-panel-${ticker}`;
  root.dataset.side = side;
  root.setAttribute("role", "tabpanel");
  root.setAttribute("aria-labelledby", `study-tab-${ticker}`);

  const grid = el("div", "study-cards");
  grid.append(
    sharesCard(ticker, underlying, marks),
    spreadCard(ticker, spread, copy, marks),
    leapCard(ticker, structures[plan.leap], chains[plan.leapRows], underlying, copy, marks),
  );

  const block = el("div", "chain-block");
  const head = el("div", "chain-head");
  head.append(el("h3", "", copy.stripTitle));
  if (strip) {
    head.append(el("span", "study-kicker", `${ticker} ${expiry(strip.expiration)} ${strip.type}s · ${copy.stripKicker}`));
    const legs = spread ? { [spread.short.strike]: "Short", [spread.long.strike]: "Long" } : {};
    block.append(
      head,
      chainTable(strip, { spot: underlying.spot, highlight: legs, caption: `${ticker} ${expiry(strip.expiration)} ${strip.type}s` }),
      stamp(marks),
    );
  } else {
    block.append(head, pending(`The ${ticker} chain lands with the next marks snapshot.`));
  }

  root.append(el("p", "study-lead", copy.lead(sector)), grid, block);
  return root;
}

export async function loadMarks() {
  const response = await fetch(marksUrl(), { cache: "no-cache" });
  if (!response.ok) throw new Error(`marks ${response.status}`);
  return response.json();
}

function tabGroup(label, side) {
  const group = el("div", `study-tab-group is-${side}`);
  group.setAttribute("role", "presentation");
  group.append(el("span", "study-tab-label", label));
  return group;
}

/** soft: JPM sector reads under 0.25 this week; crowded: 0.75 and up. */
export async function renderStudy(root, { soft, crowded, selected }) {
  const tabs = root.querySelector("#study-tabs");
  const body = root.querySelector("#study-body");
  const summary = root.querySelector("#study-summary");

  const list = (items) => items.map((sector) => `${sector.ticker} ${sector.display}`).join(" · ");
  const parts = [];
  parts.push(soft.length ? `Soft JPM sectors this week: ${list(soft)}.` : "No JPM sector is under 0.25 this week.");
  if (crowded.length) parts.push(`Crowded: ${list(crowded)}.`);
  summary.textContent = parts.join(" ");

  let marks;
  try {
    marks = await loadMarks();
  } catch {
    body.replaceChildren(el("p", "empty", "Study marks could not be loaded right now. Refresh to try again."));
    return;
  }

  const sectors = [
    ...soft.map((sector) => ({ ...sector, side: "soft" })),
    ...crowded.map((sector) => ({ ...sector, side: "crowded" })),
  ];
  let current = sectors.some((sector) => sector.ticker === selected) ? selected : sectors[0]?.ticker;

  const choose = (ticker) => {
    current = ticker;
    const url = new URL(location.href);
    url.searchParams.set("study", current);
    history.replaceState(null, "", url);
    draw();
  };

  const draw = () => {
    tabs.replaceChildren();
    const groups = { soft: tabGroup("Soft", "soft"), crowded: tabGroup("Crowded", "crowded") };
    for (const sector of sectors) {
      const on = sector.ticker === current;
      const tab = el("button", on ? `study-tab is-${sector.side} is-on` : `study-tab is-${sector.side}`);
      tab.type = "button";
      tab.id = `study-tab-${sector.ticker}`;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.setAttribute("aria-controls", `study-panel-${sector.ticker}`);
      tab.tabIndex = on ? 0 : -1;
      tab.append(el("strong", "", sector.ticker), el("span", "", sector.short), el("em", "", sector.display));
      tab.addEventListener("click", () => choose(sector.ticker));
      groups[sector.side].append(tab);
    }
    for (const side of ["soft", "crowded"]) {
      if (groups[side].querySelector(".study-tab")) tabs.append(groups[side]);
    }
    const sector = sectors.find((item) => item.ticker === current);
    body.replaceChildren(...(sector ? [panel(sector, marks)] : []));
  };

  tabs.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const ids = sectors.map((sector) => sector.ticker);
    const step = event.key === "ArrowRight" ? 1 : -1;
    choose(ids[(ids.indexOf(current) + step + ids.length) % ids.length]);
    tabs.querySelector(`#study-tab-${current}`)?.focus();
  });

  draw();
}
