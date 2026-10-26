import { CANON, SOURCES, WEEKS, buildReading, ordinal, studyCopy } from "./readings.js";
import { HOUSES, INDICATORS, SECTIONS, leanOf, median, readIndicator } from "./desk.js";

const STORAGE_KEY = "positioning-pct-source";

const state = {
  source: "all",
  weekIndex: WEEKS.length - 1,
  windowWeeks: 4,
  sector: "XLF",
};

const shells = new Map();

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function readStoredSource() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeSource(sourceId) {
  try {
    localStorage.setItem(STORAGE_KEY, sourceId);
  } catch {
    /* The page still works when storage is blocked. */
  }
}

function readState() {
  const params = new URLSearchParams(location.search);
  const requested = params.get("source") || readStoredSource();
  state.source = SOURCES.some((source) => source.id === requested) ? requested : "all";

  const weekIndex = WEEKS.indexOf(params.get("week") || "");
  state.weekIndex = weekIndex >= 0 ? weekIndex : WEEKS.length - 1;

  state.windowWeeks = params.get("window") === "8" ? 8 : 4;

  const sector = (params.get("sector") || "XLF").toUpperCase();
  state.sector = CANON.includes(sector) ? sector : "XLF";

  const range = document.getElementById("week");
  range.min = "0";
  range.max = String(WEEKS.length - 1);
  range.value = String(state.weekIndex);
}

function remember() {
  storeSource(state.source);
  const url = new URL(location.href);
  url.searchParams.set("source", state.source);
  url.searchParams.set("week", WEEKS[state.weekIndex]);
  url.searchParams.set("window", String(state.windowWeeks));
  url.searchParams.set("sector", state.sector);
  history.replaceState(null, "", url);
}

function feature(ticker) {
  state.sector = ticker;
  remember();
  paint();
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

/** The Soft ↔ Crowded bar: zoned track, a marker at the percentile, labelled ends, caption below. */
function bar({ pct, caption, ends = ["Soft", "Crowded"], name = "", hero = false, label }) {
  const root = el("div", hero ? "sc is-hero" : "sc");
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", label ?? `${caption}. ${ends[0]} on the left, ${ends[1]} on the right.`);

  const line = el("div", "sc-line");
  const wrap = el("div", "sc-track-wrap");
  const left = `${pinLeft(pct)}%`;

  if (name) {
    const tag = el("div", "sc-name", name);
    tag.style.left = left;
    wrap.append(tag);
  }
  const pin = el("i", "sc-pin");
  pin.style.left = left;
  pin.setAttribute("aria-hidden", "true");
  wrap.append(pin, zones(), el("div", "sc-caption", caption));

  line.append(el("span", "sc-end", ends[0]), wrap, el("span", "sc-end", ends[1]));
  root.append(line);
  return root;
}

function statusPill(text, tone) {
  const status = el("p", `status lv-${tone}`);
  const dot = el("i");
  dot.setAttribute("aria-hidden", "true");
  status.append(dot, document.createTextNode(text));
  return status;
}

function weeksSelect() {
  const select = el("select", "weeks");
  select.setAttribute("aria-label", "Timeframe");
  for (const weeks of [4, 8]) {
    const option = el("option", "", `${weeks} Weeks`);
    option.value = String(weeks);
    option.selected = state.windowWeeks === weeks;
    select.append(option);
  }
  select.addEventListener("change", () => {
    state.windowWeeks = Number(select.value) === 8 ? 8 : 4;
    remember();
    paint();
  });
  return select;
}

function sectorCard(sector, hero) {
  const card = el("article", hero ? "card is-hero" : "card");
  card.dataset.ticker = sector.ticker;

  const top = el("div", "card-top");
  const ident = el("button", "feature ident");
  ident.type = "button";
  ident.setAttribute("aria-pressed", hero ? "true" : "false");
  ident.setAttribute(
    "aria-label",
    `${sector.ticker}, ${sector.name}, ${sector.display} positioning percentile, ${sector.pill}. ${sector.caption}`,
  );
  const names = el("span");
  names.append(el("span", "ticker", sector.ticker), el("span", "fund", sector.name));
  ident.append(chartIcon(), names);
  ident.addEventListener("click", () => feature(sector.ticker));
  top.append(ident, weeksSelect());

  const body = el("div", "card-body");
  const figure = el("div", "figure");
  figure.append(
    el("p", "pct", sector.display),
    el("p", "pct-kicker", "positioning percentile"),
    statusPill(sector.pill, sector.regime.toLowerCase()),
  );
  body.append(
    figure,
    bar({
      pct: sector.points,
      caption: sector.caption,
      name: hero ? sector.ticker : "",
      hero,
      label: `${sector.ticker}, ${sector.caption}. Soft on the left, crowded on the right.`,
    }),
  );
  body.addEventListener("click", () => feature(sector.ticker));

  card.append(top, body);
  return card;
}

function mapRow(sector) {
  const on = sector.ticker === state.sector;
  const button = el("button", on ? "map-row is-on" : "map-row");
  button.type = "button";
  button.setAttribute("aria-pressed", on ? "true" : "false");
  button.addEventListener("click", () => feature(sector.ticker));

  const id = el("span", "map-id");
  id.append(el("strong", "", sector.ticker), el("span", "", sector.short));

  const track = el("span", "map-track");
  const lane = el("span", "map-zones");
  for (const zone of ["z-soft", "z-mid", "z-crowd"]) lane.append(el("i", `z ${zone}`));
  const pin = el("i", "sc-pin");
  pin.style.left = `${pinLeft(sector.points)}%`;
  pin.setAttribute("aria-hidden", "true");
  track.append(lane, pin);
  const barCell = el("span", "map-bar");
  barCell.append(track);

  const stat = el("span", "map-stat");
  stat.append(el("strong", "", sector.ile));
  if (sector.note) stat.append(el("span", "note", sector.note));
  const arrow = sector.wowPts > 0 ? "▲" : sector.wowPts < 0 ? "▼" : "·";
  stat.append(el("span", "wow", sector.wowText), el("span", "regime", `${arrow} ${sector.regime}`));

  button.append(id, barCell, stat);
  button.setAttribute(
    "aria-label",
    `${sector.ticker} ${sector.short}, ${sector.ile}, ${sector.wowText}, ${sector.regime}`,
  );
  return button;
}

function rowsBlock(rows) {
  const list = el("div", `rows rows-${rows.kind}`);
  for (const item of rows.items) {
    const row = el("div", "row");
    row.append(el("span", "row-label", item.label));
    if (rows.kind === "fill") {
      const track = el("span", "row-track");
      const fill = el("i", "row-fill");
      fill.style.width = `${Math.min(100, (item.value / rows.max) * 100)}%`;
      track.append(fill);
      row.append(track);
    } else if (rows.kind === "diverge") {
      const track = el("span", "row-track is-diverge");
      const fill = el("i", item.value < 0 ? "row-fill is-neg" : "row-fill");
      const width = Math.min(50, (Math.abs(item.value) / rows.max) * 50);
      fill.style.width = `${width}%`;
      fill.style.left = item.value < 0 ? `${50 - width}%` : "50%";
      track.append(el("i", "row-zero"), fill);
      row.append(track);
    }
    row.append(el("span", "row-value", item.text));
    list.append(row);
  }
  return list;
}

function indicatorCard(read) {
  const card = el("article", "icard");
  card.dataset.id = read.id;
  card.dataset.house = read.house;

  const top = el("div", "icard-top");
  top.append(el("span", `house h-${read.house}`, HOUSES[read.house]), el("span", "basis", read.basis));

  const head = el("div", "icard-head");
  head.append(el("h3", "icard-title", read.title), el("p", "icard-sub", read.sub));

  const figure = el("div", "icard-figure");
  const value = el("p", "ivalue", read.value);
  if (read.unit) value.append(el("span", "iunit", read.unit));
  figure.append(value, statusPill(read.pill, read.tone));

  card.append(
    top,
    head,
    figure,
    bar({
      pct: read.pct,
      caption: read.caption,
      ends: read.ends,
      label: `${read.title}: ${read.value} ${read.unit}, ${read.caption}. ${read.ends[0]} on the left, ${read.ends[1]} on the right.`,
    }),
  );
  if (read.rows) card.append(rowsBlock(read.rows));

  const foot = el("div", "icard-foot");
  foot.append(el("p", "icard-change", read.change));
  if (read.latestNote) foot.append(el("p", "icard-latest", read.latestNote));
  card.append(foot);
  return card;
}

function gaugePanel(reading) {
  const panel = el("div", "panel gauge");
  panel.dataset.house = "desk";

  const top = el("div", "icard-top");
  top.append(el("span", "house h-desk", HOUSES.desk), el("span", "method-pill", "Methods later"));

  const main = el("div", "gauge-main");
  const left = el("div");
  left.append(el("h3", "icard-title", "Soft Vol ↔ Stretched"));
  const num = el("p", "vol-num", reading.volDisplay);
  num.id = "vol-value";
  num.append(el("span", "pts", "pts"));
  left.append(num);
  const name = el("p", "vol-name", reading.volName);
  name.id = "vol-name";
  left.append(name);

  const right = el("div");
  const labels = el("div", "g-labels");
  labels.append(el("span", "", "Soft vol"), el("span", "", "Fair"), el("span", "", "Stretched"));
  const track = el("div", "g-track");
  track.id = "g-track";
  track.setAttribute("role", "img");
  track.setAttribute(
    "aria-label",
    `${reading.volName}, ${reading.volDisplay} points. Soft vol on the left, stretched on the right.`,
  );
  const lane = el("div", "g-zones");
  for (const zone of ["z-soft", "z-mid", "z-crowd"]) lane.append(el("i", `z ${zone}`));
  const pin = el("i", "sc-pin");
  pin.id = "vol-pin";
  pin.style.left = `${Math.min(98, Math.max(2, reading.volPosition * 100))}%`;
  track.append(lane, pin);
  const scale = el("div", "g-scale");
  scale.append(el("span", "", "−3"), el("span", "", "0"), el("span", "", "+3"));
  right.append(labels, track, scale);

  main.append(left, right);

  const copy = el("div", "gauge-copy");
  copy.append(
    el("p", "", "Soft Vol means the VIX is cheaper than the S&P 500 usually implies. Stretched means the VIX is richer than fair."),
    el("p", "", "Live history comes from desk-ingested bank notes. Public labels are bank names only."),
    el("p", "", "The calculation note is not in this phase."),
  );

  panel.append(top, main, copy);
  return panel;
}

function emptyNote(sourceId) {
  const label = SOURCES.find((source) => source.id === sourceId)?.label ?? sourceId;
  return el("p", "empty", `No ${label} reads in this section yet. Switch the source to All to see the full desk.`);
}

function buildShells() {
  const root = document.getElementById("desk");
  const nav = document.getElementById("secnav-links");

  for (const [index, section] of SECTIONS.entries()) {
    const shell = el("section", "desk-section");
    shell.id = section.id;
    shell.setAttribute("aria-labelledby", `${section.id}-title`);

    const head = el("div", "section-head");
    const titleRow = el("div", "section-title-row");
    const num = el("span", "section-num", String(index + 1).padStart(2, "0"));
    const title = el("h2", "", section.title);
    title.id = `${section.id}-title`;
    const count = el("span", "section-count");
    titleRow.append(num, title, count);
    head.append(titleRow, el("p", "hint", section.blurb));

    const body = el("div", "section-body");
    shell.append(head, body);
    root.append(shell);
    shells.set(section.id, { shell, body, count });

    const link = el("a", "", section.nav);
    link.href = `#${section.id}`;
    link.dataset.target = section.id;
    nav.append(link);
  }

  const study = el("a", "", "Study");
  study.href = "#study";
  study.dataset.target = "study";
  nav.append(study);
}

function watchSections() {
  const links = [...document.querySelectorAll("#secnav-links a")];
  const targets = links.map((link) => document.getElementById(link.dataset.target)).filter(Boolean);
  const header = document.querySelector(".topbar");
  let currentId = "";
  let queued = false;

  const update = () => {
    queued = false;
    const line = header.getBoundingClientRect().bottom + 24;
    let current = targets[0];
    for (const target of targets) {
      if (target.getBoundingClientRect().top <= line) current = target;
    }
    if (current.id === currentId) return;
    currentId = current.id;
    for (const link of links) {
      const on = link.dataset.target === currentId;
      link.classList.toggle("is-current", on);
      if (on) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
    const active = links.find((link) => link.dataset.target === currentId);
    const strip = active.parentElement;
    strip.scrollTo({ left: active.offsetLeft - strip.clientWidth / 2 + active.clientWidth / 2, behavior: "smooth" });
  };

  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
  update();
}

function sectionCount(reads, extra = 0) {
  const total = reads.length + extra;
  if (!total) return "";
  const byHouse = {};
  for (const read of reads) byHouse[read.house] = (byHouse[read.house] ?? 0) + 1;
  const parts = Object.entries(byHouse).map(([house, n]) => `${HOUSES[house]} ${n}`);
  return `${total} read${total === 1 ? "" : "s"}${parts.length ? ` · ${parts.join(" · ")}` : ""}`;
}

function renderSectors(body, reading, reads, count) {
  const order = [state.sector, ...CANON.filter((ticker) => ticker !== state.sector)];
  const cards = el("div", "sector-cards");
  cards.id = "cards";
  const grid = el("div", "card-grid");
  for (const ticker of order.slice(1)) grid.append(sectorCard(reading.sectors[ticker], false));
  cards.append(sectorCard(reading.sectors[order[0]], true), grid);

  const note = el(
    "p",
    "hint sector-source",
    `Sector cards read from ${reading.sectorSource}. The large number is the positioning percentile for the week you pick. ${order[0]} is the featured card.`,
  );
  note.id = "cards-blurb";

  const mapWrap = el("div", "subblock");
  const mapHead = el("div", "subhead");
  mapHead.append(
    el("h3", "", "Ranked, softest first"),
    el("p", "hint", "Every sector on one scale. The triangle marks this week’s percentile."),
  );
  const map = el("div", "map");
  const header = el("div", "map-head");
  header.setAttribute("aria-hidden", "true");
  const scale = el("span", "map-scale");
  scale.append(el("span", "", "Soft"), el("span", "", "Crowded"));
  header.append(el("span", "", "Sector"), scale, el("span", "", "This week"));
  const rows = el("div");
  rows.id = "map";
  const ranked = [...CANON].sort((a, b) => {
    const delta = reading.sectors[a].points - reading.sectors[b].points;
    return delta || a.localeCompare(b);
  });
  rows.append(...ranked.map((ticker) => mapRow(reading.sectors[ticker])));
  map.append(header, rows);
  mapWrap.append(mapHead, map);

  body.replaceChildren(note, cards);
  if (reads.length) {
    const extras = el("div", "icard-grid subblock");
    extras.append(...reads.map(indicatorCard));
    body.append(extras);
  }
  body.append(mapWrap);
  count.textContent = sectionCount(reads, 11);
}

function overviewTile(section, index, pcts, reads, sourceId, extras = []) {
  const tile = el("a", "ov-tile");
  tile.href = `#${section.id}`;

  const top = el("div", "ov-top");
  top.append(el("span", "section-num", String(index + 1).padStart(2, "0")));

  if (!pcts.length) {
    tile.classList.add("is-empty");
    top.append(el("span", "ov-lean lv-none", "—"));
    const label = SOURCES.find((source) => source.id === sourceId)?.label ?? sourceId;
    tile.append(top, el("h3", "", section.title), el("p", "ov-meta", `No ${label} reads in this section.`));
    return tile;
  }

  const mid = median(pcts);
  const lean = leanOf(mid);
  top.append(el("span", `ov-lean lv-${lean.tone}`, lean.word));

  const mini = el("div", "ov-bar");
  mini.setAttribute("aria-hidden", "true");
  mini.append(zones());
  const pin = el("i", "sc-pin");
  pin.style.left = `${pinLeft(mid)}%`;
  mini.append(pin);

  const candidates = [...extras, ...reads.map((read) => ({ name: read.title, pct: read.pct }))];
  const highest = candidates.reduce((best, item) => (!best || item.pct > best.pct ? item : best), null);
  const meta = el("p", "ov-meta");
  meta.textContent = `Median ${ordinal(mid)} · highest: ${highest.name}, ${ordinal(highest.pct)}`;

  tile.setAttribute("aria-label", `${section.title}: leans ${lean.word.toLowerCase()}, median ${mid}th percentile`);
  tile.append(top, el("h3", "", section.title), mini, meta);
  return tile;
}

function renderChips() {
  const root = document.getElementById("chips");
  root.replaceChildren();
  for (const source of SOURCES) {
    const button = el("button", "chip", source.label);
    button.type = "button";
    button.role = "radio";
    button.dataset.source = source.id;
    button.addEventListener("click", () => {
      state.source = source.id;
      remember();
      paint();
    });
    root.append(button);
  }

  root.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const ids = SOURCES.map((source) => source.id);
    const index = ids.indexOf(state.source);
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = ids[(index + step + ids.length) % ids.length];
    state.source = next;
    remember();
    paint();
    root.querySelector(`[data-source="${next}"]`)?.focus();
  });
}

function paint() {
  const reading = buildReading(state.source, state.weekIndex, state.windowWeeks);
  const featured = reading.sectors[state.sector];
  const showAll = state.source === "all";
  const reads = INDICATORS.map((indicator) => readIndicator(indicator, reading.weekIndex)).filter(
    (read) => showAll || read.house === state.source,
  );
  const gaugeVisible = showAll || state.source === "desk";

  document.getElementById("sample-line").textContent =
    `Sample week · ${reading.weekLabel} · ${showAll ? "All sources" : reading.sourceLabel}`;
  document.getElementById("history-date").textContent = reading.weekLabel;

  const range = document.getElementById("week");
  range.value = String(reading.weekIndex);
  range.setAttribute("aria-valuetext", reading.weekLabel);

  for (const button of document.querySelectorAll("#chips .chip")) {
    const on = button.dataset.source === reading.sourceId;
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-checked", on ? "true" : "false");
    button.tabIndex = on ? 0 : -1;
  }

  const sectorPcts = CANON.map((ticker) => reading.sectors[ticker].points);
  const tiles = [];
  const leans = { soft: 0, mid: 0, crowded: 0 };

  for (const [index, section] of SECTIONS.entries()) {
    const { body, count } = shells.get(section.id);
    const sectionReads = reads.filter((read) => read.section === section.id);

    if (section.id === "sectors") {
      renderSectors(body, reading, sectionReads, count);
    } else {
      const children = [];
      if (section.id === "vol" && gaugeVisible) children.push(gaugePanel(reading));
      if (sectionReads.length) {
        const grid = el("div", "icard-grid");
        grid.append(...sectionReads.map(indicatorCard));
        children.push(grid);
      }
      if (!children.length) children.push(emptyNote(state.source));
      body.replaceChildren(...children);
      count.textContent = sectionCount(sectionReads, section.id === "vol" && gaugeVisible ? 1 : 0);
    }

    const pcts =
      section.id === "sectors"
        ? [...sectorPcts, ...sectionReads.map((read) => read.pct)]
        : sectionReads.map((read) => read.pct);
    if (pcts.length) leans[leanOf(median(pcts)).tone] += 1;
    const extras =
      section.id === "sectors"
        ? CANON.map((ticker) => ({ name: ticker, pct: reading.sectors[ticker].points }))
        : [];
    tiles.push(overviewTile(section, index, pcts, sectionReads, state.source, extras));
  }

  document.getElementById("overview-grid").replaceChildren(...tiles);
  const covered = leans.soft + leans.mid + leans.crowded;
  document.getElementById("overview-headline").textContent =
    `${leans.crowded} of ${covered} sections lean crowded, ${leans.mid} sit mid, ${leans.soft} lean soft.`;
  document.getElementById("overview-total").textContent =
    `${reads.length + 11 + (gaugeVisible ? 1 : 0)} reads on the desk this week`;

  const study = studyCopy(featured.ticker, featured.short, featured.points);
  document.getElementById("study-title").textContent = study.title;
  document.getElementById("study-lead").textContent = study.lead;
}

function bind() {
  document.getElementById("week").addEventListener("input", (event) => {
    state.weekIndex = Number(event.target.value);
    remember();
    paint();
  });
}

readState();
buildShells();
renderChips();
bind();
paint();
watchSections();
