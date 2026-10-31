/**
 * Soft ↔ Crowded weekly pack. Renders only after the Vault gate opens the
 * page, from the committed week documents in public/data/vault/soft-crowded/.
 * `?week=` takes a pack Friday (2026-10-16) or an ISO week (2026-W42); with
 * none, the latest week opens. Charts redraw from the frozen snapshot stored
 * in the week document, so an archived week never shows a later print.
 */

import { drawLines, drawResidual, drawSectors, mountPlot } from "./chart-svg.js";
import { onDeskReady } from "./when-mounted.js";

const DATA = `${import.meta.env.BASE_URL}data/vault/soft-crowded/`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SECTOR_BANDS = [
  { tone: "xsoft", title: "Extreme soft", from: 0, to: 25 },
  { tone: "soft", title: "Soft", from: 25, to: 40 },
  { tone: "mid", title: "Mid", from: 40, to: 67 },
  { tone: "crowded", title: "Crowded", from: 67, to: 100 },
];
const LINE_COLORS = ["#2f5fd6", "#d97706", "#0e9384"];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function shortDate(iso) {
  const [, month, day] = iso.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}`;
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
  const status = el("p", `status lv-${tone === "xsoft" ? "soft" : tone}`);
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

function points(items, tag = "ul") {
  const list = el(tag, tag === "ol" ? "pack-points is-numbered" : "pack-points");
  for (const item of items) list.append(el("li", "", item));
  return list;
}

function readBlock(title, text) {
  const block = el("div", "pack-read-block");
  block.append(el("h3", "", title), el("p", "", text));
  return block;
}

function deskRoot(pub) {
  return pub ? ".." : "../../positioning";
}

function readSection(week, pub = false) {
  const section = el("section", "desk-section");
  section.id = "read";
  const head = el("div", "section-head");
  const row = el("div", "section-title-row");
  row.append(
    el("h2", "", pub ? "This week" : "One-page read"),
    el("span", "section-count", `${week.houseLabel} · ${week.windowWeeks}-week window`),
  );
  head.append(row, el("p", "overview-headline", week.read.headline));
  const sheet = el("div", "pack-sheet");
  sheet.append(el("p", "pack-stance", week.read.stance));
  const prose = el("div", "pack-read-grid");
  prose.append(
    readBlock("What softened", week.read.softened),
    readBlock("What crowded", week.read.crowded),
    readBlock("Credit and vol backdrop", week.read.backdrop),
  );
  const cols = el("div", "pack-cols is-three");
  const moved = el("div");
  moved.append(el("h3", "", "What moved"), points(week.read.moved));
  const watch = el("div");
  watch.append(el("h3", "", "Keep in view"), points(week.read.watch));
  const next = el("div");
  next.append(el("h3", "", "Watch next week"), points(week.read.nextWeek, "ol"));
  cols.append(moved, watch, next);
  sheet.append(prose, cols);
  section.append(head, sheet);
  return section;
}

function sectorSection(week, pub = false) {
  const section = el("section", "desk-section");
  section.id = "sectors";
  const printed = week.buckets.reduce((sum, bucket) => sum + bucket.sectors.length, 0);
  const frozen = week.carryForward?.from ?? week.week;
  const head = el("div", "section-head");
  const row = el("div", "section-title-row");
  row.append(
    el("h2", "", "Sector Soft ↔ Crowded"),
    el("span", "section-count", `${printed} sectors · ${week.houseLabel} · frozen ${shortDate(frozen)}`),
  );
  const desk = el("a", "section-link", week.carryForward ? "Open the carried week on the Desk →" : "Open this week on the Desk →");
  desk.href = `${deskRoot(pub)}/desk/?source=${week.house}&week=${frozen}#sectors`;
  row.append(desk);
  head.append(
    row,
    el(
      "p",
      "hint",
      `Sector columns read from ${week.sectorSource}, grouped on the Soft ↔ Crowded scale as of the pack Friday. Direction uses the ${week.windowWeeks}-week window. The large number is the positioning percentile.`,
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

const BIAS_LABEL = {
  long: "Long",
  short: "Short",
  neutral: "Neutral",
  "fade-long": "Fade long",
  "fade-short": "Fade short",
};

const FORMATS = {
  pct: (value) => String(Math.round(value)),
  whole: (value) => String(Math.round(value)),
  fixed2: (value) => value.toFixed(2),
  percent0: (value) => `${Math.round(value)}%`,
  percent1: (value) => `${value.toFixed(1)}%`,
  z: (value) => (Math.abs(value) < 0.005 ? "0.0" : `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}`),
};

function signed(value) {
  return Math.abs(value) < 0.05 ? "0.0" : `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}`;
}

function residualTone(value) {
  if (value >= 0.4) return "crowded";
  if (value <= -0.4) return "soft";
  return "mid";
}

function plotHost(className, label) {
  const wrap = el("div", "pack-plot-panel");
  if (label) wrap.append(el("p", "pc-plot-label", label));
  const host = el("div", `pc-plot ${className}`);
  wrap.append(host);
  return { wrap, host };
}

function frozenPlot(snapshot, title) {
  const plate = el("div", "pack-plot");
  const labels = snapshot.weeks.map(shortDate);
  const last = snapshot.weeks.length - 1;
  const paints = [];
  if (snapshot.kind === "residual") {
    const { wrap, host } = plotHost("is-pack", "Residual by week, in vol points");
    plate.append(wrap);
    paints.push(() =>
      mountPlot(host, drawResidual)({
        label: `${title}, frozen at ${labels[last]}.`,
        labels,
        values: snapshot.values,
        week: last,
        tone: residualTone,
        tip: (index) => [`Week of ${labels[index]}`, `${signed(snapshot.values[index])} pts`],
      }),
    );
  } else if (snapshot.kind === "sectors") {
    const { wrap, host } = plotHost("is-pack is-sectors", `Sector percentiles · week of ${labels[last]}`);
    plate.append(wrap);
    paints.push(() =>
      mountPlot(host, drawSectors)({
        label: `${title}, frozen at ${labels[last]}.`,
        bars: snapshot.bars.map((bar) => ({ ...bar, available: bar.points !== null })),
        buckets: SECTOR_BANDS,
        selected: null,
        focus: null,
        tip: (bar) => [`${bar.ticker} · ${bar.short}`, bar.points === null ? bar.note : `${bar.display} · ${bar.note}`],
        onPick: () => {},
      }),
    );
  } else {
    plate.classList.toggle("is-pair", snapshot.panels.length > 1);
    for (const panel of snapshot.panels) {
      const { wrap, host } = plotHost("is-pack", panel.label);
      plate.append(wrap);
      const fmt = FORMATS[panel.format] ?? String;
      paints.push(() =>
        mountPlot(host, drawLines)({
          label: `${panel.label}, frozen at ${labels[last]}.`,
          labels,
          week: last,
          domain: panel.domain,
          yFormat: fmt,
          guides: panel.guides,
          series: panel.series.map((series, index) => ({ values: series.values, color: LINE_COLORS[index % LINE_COLORS.length], label: series.label })),
          tip: (index) => [`Week of ${labels[index]}`, ...panel.series.map((series) => `${series.label} ${fmt(series.values[index])}`)],
        }),
      );
    }
  }
  return { plate, paint: () => paints.forEach((paint) => paint()) };
}

function figureRow(figures) {
  const row = el("div", "pack-figures");
  for (const figure of figures) {
    const box = el("div", "pack-figure");
    const value = el("p", "pack-figure-value", figure.value);
    if (figure.unit) value.append(el("span", "pack-figure-unit", ` ${figure.unit}`));
    box.append(el("p", "pack-figure-label", figure.label), value, statusPill(figure.pill, figure.tone));
    row.append(box);
  }
  return row;
}

function appendInline(parent, text) {
  for (const part of text.split(/(\*\*[^*]+\*\*)/g)) {
    if (/^\*\*[^*]+\*\*$/.test(part)) parent.append(el("strong", "", part.slice(2, -2)));
    else if (part) parent.append(document.createTextNode(part));
  }
}

function articleBody(markdown) {
  const copy = el("div", "pack-article-copy");
  for (const block of markdown.trim().split(/\n\n+/)) {
    const paragraph = el("p");
    appendInline(paragraph, block.replace(/\s*\n\s*/g, " ").trim());
    copy.append(paragraph);
  }
  return copy;
}

function moneyLine(term, text) {
  const row = el("div");
  row.append(el("dt", "", term), el("dd", "", text));
  return row;
}

function chartArticle(ref) {
  const article = ref.article;
  const block = el("div", "pack-article");
  const kicker = el("p", "pack-article-kicker");
  kicker.append(el("span", `pack-bias is-${article.bias}`, BIAS_LABEL[article.bias] || article.bias));
  const money = el("dl", "pack-money");
  money.append(moneyLine("Dumb money", article.dumbMoney), moneyLine("Smart money", article.smartMoney));
  const invalid = el("p", "pack-invalidation");
  invalid.append(el("strong", "", "Invalidation"), document.createTextNode(` ${article.invalidation}`));
  block.append(kicker, el("h4", "pack-article-title", article.headline), articleBody(article.bodyMarkdown), money, invalid);
  return block;
}

function chartBlock(ref, index, paints, pub = false) {
  const block = el("article", "pack-chart");
  block.id = `chart-${ref.id}`;
  const head = el("header", "pack-chart-head");
  const kicker = el("div", "tile-kicker");
  kicker.append(el("span", "tile-num", String(index + 1).padStart(2, "0")), el("span", `house h-${ref.house}`, ref.houseLabel), el("span", "pack-chart-nav", ref.nav));
  const open = el("a", "section-link", "Open on the Desk →");
  open.href = `${deskRoot(pub)}/charts/#${ref.id}`;
  head.append(kicker, el("h3", "", ref.title), el("p", "chart-tile-fact", ref.fact), open);
  const snap = ref.snapshot;
  const { plate, paint } = frozenPlot(snap, ref.title);
  paints.push(paint);
  const foot = el("div", "pack-chart-foot");
  if (snap.rows?.length) {
    const rows = el("dl", "pack-rows");
    for (const item of snap.rows) rows.append(moneyLine(item.label, item.text));
    foot.append(rows);
  }
  foot.append(el("p", "pack-chart-note", `${snap.note} · frozen at the week of ${shortDate(snap.weeks.at(-1))}`));
  block.append(head, figureRow(snap.figures), plate, foot, chartArticle(ref));
  return block;
}

function chartSection(week, paints, pub = false) {
  const section = el("section", "desk-section");
  section.id = "charts";
  const head = el("div", "section-head");
  const row = el("div", "section-title-row");
  const all = el("a", "section-link", "Open all six on the Desk →");
  all.href = `${deskRoot(pub)}/charts/`;
  row.append(el("h2", "", pub ? "Trade ideas" : "Charts"), el("span", "section-count", `Batch ${week.charts.batch} · six charts`), all);
  head.append(
    row,
    el(
      "p",
      "hint",
      pub
        ? `One idea per chart for the week of ${shortDate(week.week)}. Hover the chart. The note under it says who is crowded, who is leaning the other way, and what breaks the idea.`
        : `The six Positioning charts, frozen at the week of ${shortDate(week.week)}. The article under each chart is the week's framing: who is crowded, who is leaning the other way, and what breaks the read.`,
    ),
  );
  const list = el("div", "chart-tiles");
  week.charts.refs.forEach((ref, index) => list.append(chartBlock(ref, index, paints, pub)));
  section.append(head, list);
  return section;
}

function weekBar(index, week) {
  const bar = el("div", "pack-bar");
  const nav = el("nav", "pack-weeks");
  nav.setAttribute("aria-label", "Pack weeks");
  for (const row of index.weeks) {
    const link = el("a", "pack-week");
    link.href = `?week=${row.isoWeek}`;
    link.append(el("strong", "", row.isoWeek), el("span", "", row.week === index.latest ? "Latest" : shortDate(row.week)));
    if (row.week === week.week) {
      link.classList.add("is-current");
      link.setAttribute("aria-current", "page");
    }
    nav.append(link);
  }
  const print = el("button", "pack-print", "Print / Save as PDF");
  print.type = "button";
  print.addEventListener("click", () => window.print());
  bar.append(nav, print);
  return bar;
}

function pageHead(index, week) {
  const head = el("section", "page-head");
  head.append(el("span", "pill", week.read.kicker), el("h1", "", week.title), el("p", "lede", week.read.lede));
  const asof = el("p", "asof-line pill");
  asof.append(el("span", `house h-${week.house}`, week.houseLabel), document.createTextNode(` · ${week.asOfLabel} · ${week.basis}`));
  head.append(asof);
  if (week.week !== index.latest) {
    const latest = index.weeks.find((row) => row.week === index.latest);
    const note = el("p", "pack-archived");
    note.append(document.createTextNode(`Archived week. Every figure is frozen as of ${shortDate(week.week)}. `));
    const link = el("a", "", `Open ${latest?.title ?? "the latest week"} →`);
    link.href = "./";
    note.append(link);
    head.append(note);
  }
  return head;
}

function pickWeek(index, wanted) {
  if (!wanted) return index.weeks.find((row) => row.week === index.latest);
  const key = wanted.trim().toUpperCase();
  return index.weeks.find((row) => row.week === wanted.trim() || row.isoWeek === key);
}

function missingWeek(index, wanted) {
  const box = el("section", "page-head");
  box.append(el("h1", "", "No pack for that week"));
  box.append(el("p", "lede", `Nothing is filed under ${wanted}. Packs are filed on the Friday desk day, from the 5:00 AM CT open.`));
  const list = el("ul", "pack-points");
  for (const row of index.weeks) {
    const item = el("li");
    const link = el("a", "", row.title);
    link.href = `?week=${row.isoWeek}`;
    item.append(link, document.createTextNode(` · ${row.weekLabel}`));
    list.append(item);
  }
  box.append(list);
  return box;
}

async function load(root) {
  const indexRes = await fetch(`${DATA}index.json`);
  if (!indexRes.ok) throw new Error(`index ${indexRes.status}`);
  const index = await indexRes.json();
  const wanted = new URLSearchParams(window.location.search).get("week");
  const row = pickWeek(index, wanted);
  if (!row) {
    root.replaceChildren(missingWeek(index, wanted));
    return;
  }
  const weekRes = await fetch(`${DATA}${row.file}`);
  if (!weekRes.ok) throw new Error(`week ${weekRes.status}`);
  const week = await weekRes.json();
  if (
    week.sku !== index.sku ||
    !week.read ||
    !Array.isArray(week.buckets) ||
    !week.charts?.refs?.every((ref) => ref.snapshot && ref.article?.headline && ref.article?.bodyMarkdown && ref.article?.bias)
  ) {
    throw new Error("week document is missing pack fields");
  }
  const paints = [];
  const pub = root.dataset.public === "1";
  root.replaceChildren(weekBar(index, week), pageHead(index, week), readSection(week, pub), sectorSection(week, pub), chartSection(week, paints, pub));
  paints.forEach((paint) => paint());
  document.title = pub ? `Trade ideas · ${week.title} · Positioning %.` : `${week.title} · Vault · Positioning %.`;
}

onDeskReady(() => {
  const root = document.getElementById("pack") || document.getElementById("trade-ideas");
  if (!root || root.dataset.ready === "1") return;
  root.dataset.ready = "1";
  load(root).catch((error) => {
    console.error(error);
    root.replaceChildren(el("p", "hint", "This week did not load. Refresh to try again."));
  });
});
