import { onDeskReady } from "./when-mounted.js";
import {
  NT_SECTIONS,
  PUBLIC_NT_SECTIONS,
  catchUpCountText,
  catchUpDays,
  catchUpSummary,
  catchUpWindowLabel,
  ctTime,
  dayLabel,
  deskDay,
  deskStateUrl,
  earlierState,
  emptyDayMessage,
  emptyDeskMessage,
  feedLine,
  laterState,
  readDeskState,
  resolveHref,
  rowDayLabel,
  sectionEmptyMessage,
  visibleDeskItems,
  windowLabel,
  yesterdayNote,
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
  return readDeskState(window.location.search, deskDay());
}

function row(item, { showSection, state }) {
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
  if (state?.mode === "catchup") {
    const dated = rowDayLabel(item.publishedAt, state.today);
    tags.append(el("span", `nt-day is-${dated.relation}`, dated.label));
  }
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

function countText(rows, state) {
  if (state.mode !== "catchup") return rows.length ? `${rows.length} new` : "None";
  const [today, yesterday] = catchUpDays(state.today);
  return catchUpCountText(
    {
      todayCount: rows.filter((item) => deskDay(item.publishedAt) === today).length,
      yesterdayCount: rows.filter((item) => deskDay(item.publishedAt) === yesterday).length,
      total: rows.length,
    },
    { quiet: "None" },
  );
}

function dayTitle(day, today) {
  const relation = day === today ? "today" : "yesterday";
  const word = relation === "today" ? "Today" : "Yesterday";
  return { relation, text: `${word} · ${dayLabel(day)}` };
}

function withFlowBase(items) {
  const flowBase = document.body?.dataset.flowBase;
  if (!flowBase) return items;
  return items.map((item) => {
    if (typeof item.href !== "string" || !item.href.startsWith("options-flow/")) return item;
    return { ...item, href: `${flowBase}${item.href.slice("options-flow/".length)}` };
  });
}

function render(state, items, updatedAt) {
  const routed = withFlowBase(items);
  const publicOnly = document.body?.dataset.surface === "public";
  const sections = publicOnly ? PUBLIC_NT_SECTIONS : NT_SECTIONS;
  const rows = visibleDeskItems(routed, {
    today: state.today,
    mode: state.mode,
    day: state.day,
    publicOnly,
  });
  const summary = state.mode === "catchup" ? catchUpSummary(rows, state.today) : null;
  const onCatchUp = state.mode === "catchup";
  const fresh = document.querySelector("#nt-fresh");
  if (fresh) fresh.textContent = feedLine(updatedAt, { quiet: rows.length === 0, mode: state.mode });

  const pill = $("#nt-pill");
  pill.replaceChildren(document.createTextNode(onCatchUp ? "New Today " : `Desk day ${dayLabel(state.day)} `));
  const live = summary ? summary.todayCount > 0 : rows.length > 0;
  const badge = el("span", live ? "badge is-live" : "badge");
  if (live) {
    const dot = el("i");
    dot.setAttribute("aria-hidden", "true");
    badge.append(dot);
  }
  const badgeText = summary ? catchUpCountText(summary, { quiet: "Quiet" }) : rows.length ? `${rows.length} new` : "Quiet";
  badge.append(document.createTextNode(badgeText));
  pill.append(badge);
  $("#nt-window").textContent = onCatchUp ? catchUpWindowLabel(state.today) : `Desk day ${windowLabel(state.day)}`;

  for (const button of document.querySelectorAll("[data-view]")) {
    const on = button.dataset.view === state.view;
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-pressed", String(on));
  }
  $("#nt-prev").href = deskStateUrl(earlierState(state));
  const later = laterState(state);
  $("#nt-next").hidden = !later;
  if (later) $("#nt-next").href = deskStateUrl(later);
  $("#nt-today").hidden = onCatchUp;
  $("#nt-today").href = deskStateUrl({ ...state, mode: "catchup", day: state.today });

  const body = $("#nt-body");
  body.replaceChildren();
  if (!rows.length) {
    body.append(el("p", "nt-empty is-all", emptyDeskMessage(state.mode)));
    return;
  }

  if (summary && summary.todayCount === 0 && summary.yesterdayCount > 0) {
    body.append(el("p", "nt-note", yesterdayNote(state.today)));
  }

  if (state.view === "all") {
    if (!onCatchUp) {
      const section = el("section", "desk-section nt-section");
      section.append(list(rows, { showSection: true, state }));
      body.append(section);
      return;
    }
    for (const day of catchUpDays(state.today)) {
      const group = rows.filter((item) => deskDay(item.publishedAt) === day);
      const dated = dayTitle(day, state.today);
      const section = el("section", "desk-section nt-section");
      const head = el("div", "section-title-row");
      head.append(el("h2", null, dated.text), el("span", "section-count", group.length ? String(group.length) : "None"));
      section.append(head);
      section.append(group.length ? list(group, { showSection: true, state }) : el("p", "nt-empty", emptyDayMessage(dated.relation)));
      body.append(section);
    }
    return;
  }

  for (const meta of sections) {
    const sectionRows = rows.filter((item) => item.section === meta.id);
    const section = el("section", "desk-section nt-section");
    section.id = `nt-${meta.id}`;
    section.setAttribute("aria-labelledby", `nt-${meta.id}-title`);
    const head = el("div", "section-title-row");
    const title = el("h2", null, meta.title);
    title.id = `nt-${meta.id}-title`;
    head.append(title, el("span", "section-count", countText(sectionRows, state)));
    section.append(head);
    if (!sectionRows.length) {
      section.append(el("p", "nt-empty", sectionEmptyMessage(meta, state.mode)));
    } else if (onCatchUp) {
      for (const day of catchUpDays(state.today)) {
        const group = sectionRows.filter((item) => deskDay(item.publishedAt) === day);
        if (!group.length) continue;
        section.append(el("h3", "nt-dayhead", dayTitle(day, state.today).text));
        section.append(list(group, { showSection: false, state }));
      }
    } else {
      section.append(list(sectionRows, { showSection: false, state }));
    }
    body.append(section);
  }
}

let booted = false;

async function main() {
  if (booted || !document.getElementById("nt-body")) return;
  booted = true;
  let state = readState();
  let items = [];
  let updatedAt = "";
  try {
    const response = await fetch(`${base}data/new-today.json`, { cache: "no-cache" });
    if (!response.ok) throw new Error(String(response.status));
    const feed = await response.json();
    items = feed.items ?? [];
    updatedAt = feed.updatedAt ?? "";
  } catch {
    items = [];
  }
  render(state, items, updatedAt);

  for (const button of document.querySelectorAll("[data-view]")) {
    button.addEventListener("click", () => {
      state = { ...state, view: button.dataset.view };
      history.replaceState(null, "", deskStateUrl(state));
      render(state, items, updatedAt);
    });
  }

  const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) target.scrollIntoView({ behavior: "instant", block: "start" });
}

onDeskReady(() => {
  main();
});
