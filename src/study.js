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
  const fixed = value.toFixed(3);
  return fixed.endsWith("0") ? value.toFixed(2) : fixed;
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

/** Study math for a short put spread, per share, at expiration. */
export function bullPutMath(spread) {
  const credit = spread.short.mark - spread.long.mark;
  const natural = spread.short.bid - spread.long.ask;
  const width = spread.short.strike - spread.long.strike;
  return {
    credit,
    natural,
    width,
    maxLoss: width - credit,
    breakeven: spread.short.strike - credit,
  };
}

export function leapMath(leap) {
  return { premium: leap.long.mark, breakeven: leap.long.strike + leap.long.mark };
}

function stamp(marks) {
  const node = el("p", "marks-stamp");
  const dot = el("i");
  dot.setAttribute("aria-hidden", "true");
  node.append(dot, el("span", "", `Marks as of ${marks.asOfLabel}`), el("span", "stamp-note", "Snapshot · not streaming"));
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

function bullPutCard(ticker, structures, marks) {
  if (!structures?.bullPut) {
    return studyCard(
      "Bull put",
      ticker,
      el("p", "study-copy", "A defined-risk structure: two puts, same expiration, the short strike above the long strike."),
      pending(`No ${ticker} put marks in this snapshot yet.`),
    );
  }
  const spread = structures.bullPut;
  const math = bullPutMath(spread);
  return studyCard(
    "Bull put",
    `${ticker} ${expiry(spread.expiration)} · ${strike(spread.short.strike)} / ${strike(spread.long.strike)}`,
    el(
      "p",
      "study-copy",
      `An example studied when a sector is soft: short the ${strike(spread.short.strike)} put and long the ${strike(spread.long.strike)} put, same expiration. The long put sets a floor, so the most it can lose is known up front.`,
    ),
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
    el("p", "study-fine", "Per share, at expiration, from the marks shown. No size."),
    stamp(marks),
  );
}

function chainTable(chain, { spot, highlight = {}, caption }) {
  const wrap = el("div", "chain-wrap");
  const table = el("table", "chain");
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

function spotRow(spot) {
  const tr = el("tr", "spot-row");
  const td = el("td");
  td.append(el("span", "", `Spot ${price(spot)}`));
  td.colSpan = 7;
  tr.append(td);
  return tr;
}

function leapCard(ticker, structures, chains, underlying, marks) {
  if (!structures?.callLeap) {
    return studyCard(
      "Call LEAP",
      ticker,
      el("p", "study-copy", "A long-dated call. Textbooks use it to carry a view on a distant expiration instead of one that ends this month."),
      pending(`No ${ticker} LEAP marks in this snapshot yet.`),
    );
  }
  const leap = structures.callLeap;
  const math = leapMath(leap);
  const children = [
    el(
      "p",
      "study-copy",
      `An example long-dated call near the money: long the ${strike(leap.long.strike)} call expiring ${expiry(leap.expiration)}.`,
    ),
    legsTable([["Long", leap.long]]),
    quoteGrid([
      ["Premium at mid", price(math.premium), "accent"],
      ["Breakeven at expiry", price(math.breakeven)],
      ["Max loss", `${price(math.premium)} premium`],
    ]),
  ];
  if (chains?.leapCalls) {
    children.push(
      chainTable(chains.leapCalls, {
        spot: underlying.spot,
        highlight: { [leap.long.strike]: "Long" },
        caption: `${ticker} ${expiry(chains.leapCalls.expiration)} calls`,
      }),
    );
  }
  children.push(el("p", "study-fine", "Per share, from the marks shown. No size."), stamp(marks));
  return studyCard("Call LEAP", `${ticker} ${expiry(leap.expiration)} · ${strike(leap.long.strike)}C`, ...children);
}

function panel(sector, marks) {
  const ticker = sector.ticker;
  const underlying = marks.underlyings[ticker] ?? {};
  const chains = marks.chains?.[ticker];
  const structures = chains?.structures;

  const root = el("div", "study-panel");
  root.id = `study-panel-${ticker}`;
  root.setAttribute("role", "tabpanel");
  root.setAttribute("aria-labelledby", `study-tab-${ticker}`);

  const lead = el(
    "p",
    "study-lead",
    `${ticker} (${sector.short}) reads ${sector.display} on the JPM monitor, inside the soft quartile under 0.25. These are the structures people study when a sector sits on the soft side.`,
  );

  const grid = el("div", "study-cards");
  grid.append(sharesCard(ticker, underlying, marks), bullPutCard(ticker, structures, marks), leapCard(ticker, structures, chains, underlying, marks));

  const strip = el("div", "chain-block");
  const stripHead = el("div", "chain-head");
  stripHead.append(el("h3", "", "Put chain strip"));
  if (chains?.putStrip) {
    stripHead.append(el("span", "study-kicker", `${ticker} ${expiry(chains.putStrip.expiration)} puts · the bull put curriculum`));
    const legs = structures?.bullPut
      ? { [structures.bullPut.short.strike]: "Short", [structures.bullPut.long.strike]: "Long" }
      : {};
    strip.append(
      stripHead,
      chainTable(chains.putStrip, { spot: underlying.spot, highlight: legs, caption: `${ticker} ${expiry(chains.putStrip.expiration)} puts` }),
      stamp(marks),
    );
  } else {
    strip.append(stripHead, pending(`The ${ticker} chain lands with the next marks snapshot.`));
  }

  root.append(lead, grid, strip);
  return root;
}

export async function loadMarks() {
  const response = await fetch(marksUrl(), { cache: "no-cache" });
  if (!response.ok) throw new Error(`marks ${response.status}`);
  return response.json();
}

/** soft: sector readings under 0.25 from the JPM latest week; crowded: sectors at 0.75 and up. */
export async function renderStudy(root, { soft, crowded, selected }) {
  const tabs = root.querySelector("#study-tabs");
  const body = root.querySelector("#study-body");
  const summary = root.querySelector("#study-summary");

  summary.textContent = soft.length
    ? `Soft JPM sectors this week: ${soft.map((sector) => `${sector.ticker} ${sector.display}`).join(" · ")}.`
    : "No JPM sector is under 0.25 this week.";

  let marks;
  try {
    marks = await loadMarks();
  } catch {
    body.replaceChildren(el("p", "empty", "Study marks could not be loaded right now. Refresh to try again."));
    return;
  }

  let current = soft.some((sector) => sector.ticker === selected) ? selected : soft[0]?.ticker;

  const draw = () => {
    tabs.replaceChildren();
    for (const sector of soft) {
      const on = sector.ticker === current;
      const tab = el("button", on ? "study-tab is-on" : "study-tab");
      tab.type = "button";
      tab.id = `study-tab-${sector.ticker}`;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.setAttribute("aria-controls", `study-panel-${sector.ticker}`);
      tab.tabIndex = on ? 0 : -1;
      tab.append(el("strong", "", sector.ticker), el("span", "", sector.short), el("em", "", sector.display));
      tab.addEventListener("click", () => {
        current = sector.ticker;
        const url = new URL(location.href);
        url.searchParams.set("study", current);
        history.replaceState(null, "", url);
        draw();
      });
      tabs.append(tab);
    }
    const sector = soft.find((item) => item.ticker === current);
    const nodes = sector ? [panel(sector, marks)] : [];
    if (crowded.length) {
      nodes.push(
        el(
          "p",
          "crowded-note",
          `Crowded side: ${crowded.map((item) => `${item.ticker} ${item.display}`).join(" · ")}. Notes on what people study when a sector is crowded come in a later phase.`,
        ),
      );
    }
    body.replaceChildren(...nodes);
  };

  tabs.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const ids = soft.map((sector) => sector.ticker);
    const step = event.key === "ArrowRight" ? 1 : -1;
    current = ids[(ids.indexOf(current) + step + ids.length) % ids.length];
    draw();
    tabs.querySelector(`#study-tab-${current}`)?.focus();
  });

  draw();
}
