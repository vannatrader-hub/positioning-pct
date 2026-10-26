import { CANON, SOURCES, WEEKS, buildReading, studyCopy } from "./readings.js";

const STORAGE_KEY = "positioning-pct-source";

const state = {
  source: "jpm",
  weekIndex: WEEKS.length - 1,
  windowWeeks: 4,
  sector: "XLF",
};

const SVG_NS = "http://www.w3.org/2000/svg";

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
  state.source = SOURCES.some((source) => source.id === requested) ? requested : "jpm";

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
  const wrap = document.createElement("span");
  wrap.className = "chart-icon";
  wrap.innerHTML =
    '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="17" width="5.5" height="10" rx="1.4" fill="#5b8def"/><rect x="13.2" y="11" width="5.5" height="16" rx="1.4" fill="#3d6fe0"/><rect x="21.4" y="5" width="5.5" height="22" rx="1.4" fill="#2f5fd6"/></svg>';
  return wrap;
}

function softCrowdedBar(sector, hero) {
  const root = document.createElement("div");
  root.className = hero ? "sc is-hero" : "sc";
  root.setAttribute("role", "img");
  root.setAttribute(
    "aria-label",
    `${sector.ticker}, ${sector.caption}. Soft on the left, crowded on the right.`,
  );

  const line = document.createElement("div");
  line.className = "sc-line";

  const soft = document.createElement("span");
  soft.className = "sc-end";
  soft.textContent = "Soft";

  const wrap = document.createElement("div");
  wrap.className = "sc-track-wrap";

  const left = `${pinLeft(sector.points)}%`;

  if (hero) {
    const name = document.createElement("div");
    name.className = "sc-name";
    name.style.left = left;
    name.textContent = sector.ticker;
    wrap.append(name);
  }

  const pin = document.createElement("i");
  pin.className = "sc-pin";
  pin.style.left = left;
  pin.setAttribute("aria-hidden", "true");
  wrap.append(pin);

  const track = document.createElement("div");
  track.className = "sc-track";
  for (const zone of ["z-soft", "z-mid", "z-crowd"]) {
    const block = document.createElement("i");
    block.className = `z ${zone}`;
    track.append(block);
  }
  wrap.append(track);

  const caption = document.createElement("div");
  caption.className = "sc-caption";
  caption.textContent = sector.caption;
  wrap.append(caption);

  const crowded = document.createElement("span");
  crowded.className = "sc-end";
  crowded.textContent = "Crowded";

  line.append(soft, wrap, crowded);
  root.append(line);
  return root;
}

function weeksSelect() {
  const select = document.createElement("select");
  select.className = "weeks";
  select.setAttribute("aria-label", "Timeframe");
  for (const weeks of [4, 8]) {
    const option = document.createElement("option");
    option.value = String(weeks);
    option.textContent = `${weeks} Weeks`;
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
  const card = document.createElement("article");
  card.className = hero ? "card is-hero" : "card";
  card.dataset.ticker = sector.ticker;

  const top = document.createElement("div");
  top.className = "card-top";

  const ident = document.createElement("button");
  ident.type = "button";
  ident.className = "feature ident";
  ident.setAttribute("aria-pressed", hero ? "true" : "false");
  ident.setAttribute(
    "aria-label",
    `${sector.ticker}, ${sector.name}, ${sector.display} positioning percentile, ${sector.pill}. ${sector.caption}`,
  );
  ident.append(chartIcon());
  const names = document.createElement("span");
  const ticker = document.createElement("span");
  ticker.className = "ticker";
  ticker.textContent = sector.ticker;
  const fund = document.createElement("span");
  fund.className = "fund";
  fund.textContent = sector.name;
  names.append(ticker, fund);
  ident.append(names);
  ident.addEventListener("click", () => feature(sector.ticker));

  top.append(ident, weeksSelect());

  const body = document.createElement("div");
  body.className = "card-body";

  const figure = document.createElement("div");
  figure.className = "figure";
  const pct = document.createElement("p");
  pct.className = "pct";
  pct.textContent = sector.display;
  const kicker = document.createElement("p");
  kicker.className = "pct-kicker";
  kicker.textContent = "positioning percentile";
  const status = document.createElement("p");
  status.className = "status";
  const dot = document.createElement("i");
  dot.setAttribute("aria-hidden", "true");
  status.append(dot, document.createTextNode(sector.pill));
  figure.append(pct, kicker, status);

  body.append(figure, softCrowdedBar(sector, hero));
  body.addEventListener("click", () => feature(sector.ticker));

  card.append(top, body);
  return card;
}

function sparkPoints(series, weekIndex) {
  const shown = series.slice(0, weekIndex + 1);
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = Math.max(8, max - min);
  const points = shown.length === 1 ? [shown[0], shown[0]] : shown;
  return points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 11 - ((value - min) / span) * 7;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function mapSpark(series, weekIndex) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "map-spark");
  svg.setAttribute("viewBox", "0 0 100 20");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  const points = sparkPoints(series, weekIndex);
  for (const [stroke, width] of [
    ["#f7f4ee", "3.2"],
    ["#1c1915", "1.6"],
  ]) {
    const line = document.createElementNS(SVG_NS, "polyline");
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", stroke);
    line.setAttribute("stroke-width", width);
    line.setAttribute("stroke-linejoin", "round");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("vector-effect", "non-scaling-stroke");
    line.setAttribute("points", points);
    svg.append(line);
  }
  return svg;
}

function mapRow(sector, weekIndex) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = sector.ticker === state.sector ? "map-row is-on" : "map-row";
  button.setAttribute("aria-pressed", sector.ticker === state.sector ? "true" : "false");
  button.addEventListener("click", () => feature(sector.ticker));

  const id = document.createElement("span");
  id.className = "map-id";
  const ticker = document.createElement("strong");
  ticker.textContent = sector.ticker;
  const name = document.createElement("span");
  name.textContent = sector.short;
  id.append(ticker, name);

  const bar = document.createElement("span");
  bar.className = "map-bar";
  const ends = document.createElement("span");
  ends.className = "map-ends";
  const soft = document.createElement("span");
  soft.textContent = "Soft";
  const crowded = document.createElement("span");
  crowded.textContent = "Crowded";
  ends.append(soft, crowded);

  const track = document.createElement("span");
  track.className = "map-track";
  const zones = document.createElement("span");
  zones.className = "map-zones";
  for (const zone of ["z-soft", "z-mid", "z-crowd"]) {
    const block = document.createElement("i");
    block.className = `z ${zone}`;
    zones.append(block);
  }
  const pin = document.createElement("i");
  pin.className = "sc-pin";
  pin.style.left = `${pinLeft(sector.points)}%`;
  pin.setAttribute("aria-hidden", "true");
  track.append(zones, mapSpark(sector.series, weekIndex), pin);
  bar.append(ends, track);

  const stat = document.createElement("span");
  stat.className = "map-stat";
  const ile = document.createElement("strong");
  ile.textContent = sector.ile;
  stat.append(ile);
  if (sector.note) {
    const note = document.createElement("span");
    note.className = "note";
    note.textContent = sector.note;
    stat.append(note);
  }
  const wow = document.createElement("span");
  wow.className = "wow";
  wow.textContent = sector.wowText;
  const regime = document.createElement("span");
  regime.className = "regime";
  const arrow = sector.wowPts > 0 ? "▲" : sector.wowPts < 0 ? "▼" : "·";
  regime.textContent = `${arrow} ${sector.regime}`;
  stat.append(wow, regime);

  button.append(id, bar, stat);
  button.setAttribute(
    "aria-label",
    `${sector.ticker} ${sector.short}, ${sector.ile}, ${sector.wowText}, ${sector.regime}`,
  );
  return button;
}

function renderChips() {
  const root = document.getElementById("chips");
  root.replaceChildren();
  for (const source of SOURCES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.role = "radio";
    button.dataset.source = source.id;
    button.textContent = source.label;
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

  document.getElementById("sample-line").textContent =
    `Sample · ${reading.weekLabel} · ${reading.sourceLabel}`;
  document.getElementById("history-date").textContent = reading.weekLabel;
  document.getElementById("cards-blurb").textContent =
    `One card per sector fund. The large number is the positioning percentile for the week you select. ${featured.ticker} is the featured card.`;

  const range = document.getElementById("week");
  range.value = String(reading.weekIndex);
  range.setAttribute("aria-valuetext", reading.weekLabel);

  for (const button of document.querySelectorAll("#chips .chip")) {
    const on = button.dataset.source === reading.sourceId;
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-checked", on ? "true" : "false");
    button.tabIndex = on ? 0 : -1;
  }

  const cards = document.getElementById("cards");
  const order = [state.sector, ...CANON.filter((ticker) => ticker !== state.sector)];
  const hero = sectorCard(reading.sectors[order[0]], true);
  const grid = document.createElement("div");
  grid.className = "card-grid";
  for (const ticker of order.slice(1)) grid.append(sectorCard(reading.sectors[ticker], false));
  cards.replaceChildren(hero, grid);

  const map = document.getElementById("map");
  const mapOrder = [...CANON].sort((a, b) => {
    const delta = reading.sectors[a].points - reading.sectors[b].points;
    return delta || a.localeCompare(b);
  });
  map.replaceChildren(...mapOrder.map((ticker) => mapRow(reading.sectors[ticker], reading.weekIndex)));

  document.getElementById("vol-value").textContent = reading.volDisplay;
  document.getElementById("vol-name").textContent = reading.volName;
  const pin = document.getElementById("vol-pin");
  const volLeft = Math.min(98, Math.max(2, reading.volPosition * 100));
  pin.style.left = `${volLeft}%`;
  document.getElementById("g-track").setAttribute(
    "aria-label",
    `${reading.volName}, ${reading.volDisplay} points. Soft vol on the left, stretched on the right.`,
  );

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
renderChips();
bind();
paint();
