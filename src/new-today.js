import {
  NT_SECTIONS,
  ctTime,
  dayLabel,
  deskDay,
  itemsForDay,
  nextDeskDay,
  prevDeskDay,
  resolveHref,
  windowLabel,
} from "./new-today-window.js";

const base = import.meta.env ? import.meta.env.BASE_URL : "/";
const HOUSE_CLASS = { JPM: "h-jpm", GS: "h-gs", BoA: "h-boa", MS: "h-ms", Desk: "h-desk" };
const SECTION_TITLE = Object.fromEntries(NT_SECTIONS.map((section) => [section.id, section.title]));

const $ = (selector) => document.querySelector(selector);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function readState() {
  const params = new URLSearchParams(window.location.search);
  const today = deskDay();
  const asked = params.get("day");
  const day = /^\d{4}-\d{2}-\d{2}$/.test(asked ?? "") && asked < today ? asked : today;
  return { today, day, view: params.get("view") === "all" ? "all" : "sections" };
}

function stateUrl({ day, view, today }) {
  const params = new URLSearchParams();
  if (day !== today) params.set("day", day);
  if (view === "all") params.set("view", "all");
  const query = params.toString();
  return query ? `?${query}` : "./";
}

function row(item, { showSection }) {
  const href = resolveHref(item.href || item.thumb, base);
  const external = /^https?:\/\//.test(href);
  const node = el(href ? "a" : "div", `nt-row${item.thumb ? " has-thumb" : ""}`);
  if (href) {
    node.href = href;
    if (external) {
      node.target = "_blank";
      node.rel = "noopener noreferrer";
    }
  }

  const when = el("time", "nt-time", ctTime(item.publishedAt));
  when.dateTime = item.publishedAt;
  node.append(when);

  if (item.thumb) {
    const img = el("img", "nt-thumb");
    img.src = resolveHref(item.thumb, base);
    img.alt = item.thumbAlt || `${item.sourceLabel} chart: ${item.title}`;
    img.loading = "lazy";
    img.decoding = "async";
    node.append(img);
  }

  const copy = el("div", "nt-copy");
  const tags = el("div", "nt-tags");
  if (showSection) tags.append(el("span", "nt-sec", SECTION_TITLE[item.section] ?? item.section));
  tags.append(el("span", `house ${HOUSE_CLASS[item.sourceLabel] ?? ""}`.trim(), item.sourceLabel));
  copy.append(tags, el("strong", "nt-title", item.title), el("p", "nt-summary", item.summary));
  node.append(copy);

  if (href) node.append(el("span", "arrow nt-arrow", external ? "↗" : "→"));
  return node;
}

function list(items, options) {
  const ol = el("ol", "nt-list");
  for (const item of items) {
    const li = el("li");
    li.append(row(item, options));
    ol.append(li);
  }
  return ol;
}

function render(state, items) {
  const todays = itemsForDay(items, state.day);
  const isToday = state.day === state.today;

  const pill = $("#nt-pill");
  pill.replaceChildren(document.createTextNode(isToday ? "New Today " : `Desk day ${dayLabel(state.day)} `));
  const badge = el("span", todays.length ? "badge is-live" : "badge");
  if (todays.length) {
    const dot = el("i");
    dot.setAttribute("aria-hidden", "true");
    badge.append(dot);
  }
  badge.append(document.createTextNode(todays.length ? `${todays.length} new` : "Quiet"));
  pill.append(badge);
  $("#nt-window").textContent = `Desk day ${windowLabel(state.day)}`;

  for (const button of document.querySelectorAll("[data-view]")) {
    const on = button.dataset.view === state.view;
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-pressed", String(on));
  }
  $("#nt-prev").href = stateUrl({ ...state, day: prevDeskDay(state.day) });
  $("#nt-next").hidden = isToday;
  $("#nt-next").href = stateUrl({ ...state, day: nextDeskDay(state.day) });
  $("#nt-today").hidden = isToday;
  $("#nt-today").href = stateUrl({ ...state, day: state.today });

  const body = $("#nt-body");
  body.replaceChildren();
  if (!todays.length) {
    body.append(el("p", "nt-empty is-all", isToday ? "Nothing new this desk day yet." : "Nothing new that desk day."));
  }

  if (state.view === "all") {
    if (todays.length) {
      const section = el("section", "desk-section nt-section");
      section.append(list(todays, { showSection: true }));
      body.append(section);
    }
    return;
  }

  for (const meta of NT_SECTIONS) {
    const rows = todays.filter((item) => item.section === meta.id);
    const section = el("section", "desk-section nt-section");
    section.id = `nt-${meta.id}`;
    section.setAttribute("aria-labelledby", `nt-${meta.id}-title`);
    const head = el("div", "section-title-row");
    const title = el("h2", null, meta.title);
    title.id = `nt-${meta.id}-title`;
    head.append(title, el("span", "section-count", rows.length ? `${rows.length} new` : "None"));
    section.append(head);
    section.append(rows.length ? list(rows, { showSection: false }) : el("p", "nt-empty", meta.empty));
    body.append(section);
  }
}

async function main() {
  let state = readState();
  let items = [];
  try {
    const response = await fetch(`${base}data/new-today.json`, { cache: "no-cache" });
    if (!response.ok) throw new Error(String(response.status));
    items = (await response.json()).items ?? [];
  } catch {
    items = [];
  }
  render(state, items);

  for (const button of document.querySelectorAll("[data-view]")) {
    button.addEventListener("click", () => {
      state = { ...state, view: button.dataset.view };
      history.replaceState(null, "", stateUrl(state));
      render(state, items);
    });
  }

  const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) target.scrollIntoView({ behavior: "instant", block: "start" });
}

main();
