/**
 * Soft ↔ Crowded weekly pack. Renders only after the Vault gate opens the
 * page, from the committed week document in public/data/vault/soft-crowded/.
 * Sector columns use the same cards as the Desk. Chart cards are references
 * to the public batch-1 charts, not a second drawing of them.
 */

const DATA = `${import.meta.env.BASE_URL}data/vault/soft-crowded/`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function pinLeft(points) {
  return Math.min(98, Math.max(2, points));
}

function chartIcon() {
  const wrap = el("span", "chart-icon");
  wrap.innerHTML =
    '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="17" width="5.5" height="10" rx="1.4" fill="#5b8def"/><rect x="13.2" y="11" width="5.5" height="16" rx="1.4" fill="#3d6fe0"/><rect x="21.4" y="5" width="5.5" height="22" rx="1.4" fill="#2f5fd6"/></svg>';
  return wrap;
}

function zones() {
  const track = el("div", "sc-track");
  for (const zone of ["z-soft", "z-mid", "z-crowd"]) track.append(el("i", `z ${zone}`));
  return track;
}

function statusPill(text, tone) {
  const status = el("p", `status lv-${tone}`);
  const dot = el("i");
  dot.setAttribute("aria-hidden", "true");
  status.append(dot, document.createTextNode(text));
  return status;
}

function softBar(sector) {
  const crowded = sector.regime === "Crowded";
  const root = el("div", crowded ? "sc is-crowded" : "sc");
  root.setAttribute("role", "img");
  root.setAttribute(
    "aria-label",
    `${sector.ticker}, ${sector.caption}. ${sector.wowText}. Soft on the left, crowded on the right.`,
  );
  const line = el("div", "sc-line");
  const wrap = el("div", "sc-track-wrap");
  const pin = el("i", "sc-pin");
  pin.style.left = `${pinLeft(sector.points)}%`;
  pin.setAttribute("aria-hidden", "true");
  wrap.append(pin, zones(), el("div", "sc-caption", sector.caption));
  line.append(el("span", "sc-end", "Soft"), wrap, el("span", "sc-end", "Crowded"));
  root.append(line);
  return root;
}

function sectorCard(sector) {
  const card = el("article", "card is-compact");
  if (sector.regime === "Crowded") card.classList.add("is-crowded");
  card.dataset.ticker = sector.ticker;

  const top = el("div", "card-top");
  const ident = el("div", "ident");
  const names = el("span");
  names.append(el("span", "ticker", sector.ticker), el("span", "fund", sector.short));
  ident.append(chartIcon(), names);
  ident.title = sector.name;
  top.append(ident);

  const figure = el("div", "figure");
  figure.append(
    el("p", "pct", sector.display),
    el("p", "pct-kicker", "positioning percentile"),
    statusPill(sector.pill, sector.regime.toLowerCase()),
  );
  const body = el("div", "card-body");
  body.append(figure, softBar(sector));
  card.append(top, body);
  card.setAttribute(
    "aria-label",
    `${sector.ticker}, ${sector.name}, ${sector.display} positioning percentile, ${sector.pill}. ${sector.caption}. ${sector.wowText}.`,
  );
  return card;
}

function bucketColumn(bucket) {
  const col = el("section", `bucket is-${bucket.tone}`);
  col.setAttribute("aria-label", `${bucket.title}, ${bucket.range}`);
  const head = el("header", "bucket-head");
  const title = el("div", "bucket-title");
  title.append(el("h3", "", bucket.title), el("span", "bucket-range", bucket.range));
  head.append(title, el("span", "bucket-count", String(bucket.sectors.length)));
  col.append(head);
  if (!bucket.sectors.length) col.append(el("p", "bucket-empty", "None"));
  for (const sector of bucket.sectors) col.append(sectorCard(sector));
  return col;
}

function missingRow(sector) {
  const row = el("div", "bucket-miss");
  row.dataset.ticker = sector.ticker;
  const id = el("span", "map-id");
  id.append(el("strong", "", sector.ticker), el("span", "", sector.short));
  row.append(id, statusPill(sector.note, "none"));
  row.setAttribute("aria-label", `${sector.ticker}, ${sector.name}. ${sector.note}.`);
  return row;
}

function points(items) {
  const list = el("ul", "pack-points");
  for (const item of items) list.append(el("li", "", item));
  return list;
}

function readSection(week) {
  const section = el("section", "desk-section");
  section.id = "read";
  const head = el("div", "section-head");
  const row = el("div", "section-title-row");
  row.append(el("h2", "", "One-page read"), el("span", "section-count", `${week.houseLabel} · ${week.windowWeeks}-week window`));
  head.append(row, el("p", "overview-headline", week.read.headline));
  const sheet = el("div", "pack-sheet");
  sheet.append(el("p", "pack-stance", week.read.stance));
  const cols = el("div", "pack-cols");
  const moved = el("div");
  moved.append(el("h3", "", "What moved"), points(week.read.moved));
  const watch = el("div");
  watch.append(el("h3", "", "Keep in view"), points(week.read.watch));
  cols.append(moved, watch);
  sheet.append(cols);
  section.append(head, sheet);
  return section;
}

function sectorSection(week) {
  const section = el("section", "desk-section");
  section.id = "sectors";
  const printed = week.buckets.reduce((sum, bucket) => sum + bucket.sectors.length, 0);
  const head = el("div", "section-head");
  const row = el("div", "section-title-row");
  row.append(
    el("h2", "", "Sector Soft ↔ Crowded"),
    el("span", "section-count", `${printed} sectors · ${week.houseLabel}`),
  );
  const desk = el("a", "section-link", "Open this week on the Desk →");
  desk.href = `../../positioning/desk/?source=${week.house}&week=${week.week}#sectors`;
  row.append(desk);
  head.append(
    row,
    el(
      "p",
      "hint",
      `Sector columns read from ${week.sectorSource}, grouped on the Soft ↔ Crowded scale. Direction uses the ${week.windowWeeks}-week window. The large number is the positioning percentile.`,
    ),
  );
  const grid = el("div", "bucket-grid");
  grid.id = "cards";
  for (const bucket of week.buckets) grid.append(bucketColumn(bucket));
  section.append(head, grid);
  if (week.unprinted.length) {
    const missing = el("div", "bucket-missing");
    missing.append(el("span", "bucket-missing-label", "No print"), ...week.unprinted.map(missingRow));
    section.append(missing);
  }
  return section;
}

function chartSection(week) {
  const section = el("section", "desk-section");
  section.id = "charts";
  const head = el("div", "section-head");
  const row = el("div", "section-title-row");
  const all = el("a", "section-link", "Open all six on the Desk →");
  all.href = "../../positioning/charts/";
  row.append(el("h2", "", "Charts"), el("span", "section-count", `Batch ${week.charts.batch} · six refs`), all);
  head.append(row, el("p", "hint", "The six Positioning charts for this week. Each card opens that chart on the Desk."));
  const tiles = el("div", "chart-tiles");
  week.charts.refs.forEach((ref, index) => {
    const tile = el("a", "tile chart-tile");
    tile.href = `../../positioning/charts/#${ref.id}`;
    const kicker = el("div", "tile-kicker");
    kicker.append(el("span", "tile-num", String(index + 1).padStart(2, "0")), el("span", `house h-${ref.house}`, ref.houseLabel));
    tile.append(kicker, el("h3", "", ref.title), el("p", "chart-tile-fact", ref.fact));
    const open = el("span", "open", "Open chart ");
    open.append(el("span", "arrow", "→"));
    tile.append(open);
    tiles.append(tile);
  });
  section.append(head, tiles);
  return section;
}

function pageHead(week) {
  const head = el("section", "page-head");
  head.append(el("span", "pill", week.read.kicker), el("h1", "", "Soft ↔ Crowded"), el("p", "lede", week.read.lede));
  const asof = el("p", "asof-line pill");
  asof.append(el("span", `house h-${week.house}`, week.houseLabel), document.createTextNode(` · ${week.basis}`));
  head.append(asof);
  return head;
}

async function load(root) {
  const indexRes = await fetch(`${DATA}index.json`);
  if (!indexRes.ok) throw new Error(`index ${indexRes.status}`);
  const index = await indexRes.json();
  const weekRes = await fetch(`${DATA}${index.latest}.json`);
  if (!weekRes.ok) throw new Error(`week ${weekRes.status}`);
  const week = await weekRes.json();
  if (week.sku !== index.sku || !week.read || !Array.isArray(week.buckets) || !week.charts?.refs) {
    throw new Error("week document is missing pack fields");
  }
  root.replaceChildren(pageHead(week), readSection(week), sectorSection(week), chartSection(week));
  document.title = `Soft ↔ Crowded · ${week.weekLabel} · Vault · Positioning %.`;
}

document.addEventListener("vault-open", () => {
  const root = document.getElementById("pack");
  if (!root || root.dataset.ready === "1") return;
  root.dataset.ready = "1";
  load(root).catch((error) => {
    console.error(error);
    root.replaceChildren(el("p", "hint", "The week did not load. Refresh to try again."));
  });
});
