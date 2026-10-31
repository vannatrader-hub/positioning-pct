/**
 * Renders the locked public pack: thesis, near-trigger runway, credit trio,
 * Soft ↔ Crowded tracks, and the bull / bear close. Mounts into [data-pulse].
 * "pack" is the full desk read. "cases" is the close alone, for the Vault pack.
 */
import { buildPulse, creditMeta, tracePath } from "./pulse-pack.js";
import { WEEKS, buildReading } from "./readings.js";

const ns = "http://www.w3.org/2000/svg";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function trace(values, stroke) {
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 120 34");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "34");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("pulse-trace");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", tracePath(values));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", stroke);
  path.setAttribute("stroke-width", "2");
  path.setAttribute("vector-effect", "non-scaling-stroke");
  svg.append(path);
  return svg;
}

function thesis(model) {
  const block = el("div", "pulse-thesis");
  block.append(el("p", "pulse-kicker", model.kicker));
  const title = el("h2", "pulse-title");
  title.id = "pulse-title";
  const signal = el("span", `pulse-sig is-${model.title.tone}`, model.title.signal);
  title.append(signal, ` — ${model.title.rest}`);
  block.append(title, el("p", "pulse-lede", model.lede));
  return block;
}

function runway(model) {
  const run = model.runway;
  const armed = el("section", "pulse-card pulse-armed");
  armed.setAttribute("aria-label", run.label);

  const figure = el("div");
  const huge = el("p", "pulse-huge", String(run.cushion));
  huge.append(el("small", "", ` ${run.unit}`));
  figure.append(el("p", "pulse-lbl", run.label), huge);

  const copy = el("div");
  const pills = el("p", "pulse-pills");
  for (const pill of run.pills) pills.append(el("span", pill.tone === "armed" ? "pulse-chip p-chip-armed" : "pulse-chip p-chip-near", pill.text));
  copy.append(pills, el("p", "pulse-callout", run.callout), el("p", "pulse-copy", run.body));
  armed.append(figure, copy);

  const track = el("div", "pulse-runway");
  track.setAttribute("role", "img");
  track.setAttribute("aria-label", `${run.cushion} ${run.unit} of cushion. Trigger on the left, comfortable on the right.`);
  for (const [left, text] of [
    ["0%", "trigger"],
    ["8%", "red"],
    ["22%", "amber"],
    ["80%", "comfortable"],
  ]) {
    const mark = el("span", "pulse-runway-mark", text);
    mark.style.left = left;
    track.append(mark);
  }
  const you = el("i", "pulse-runway-you");
  you.style.left = `${run.marker}%`;
  if (run.cushion > 20) you.style.borderColor = "var(--sc-soft)";
  else if (run.cushion > 0) you.style.borderColor = "var(--p-near-trigger)";
  track.append(you);

  const ends = el("p", "pulse-ends");
  ends.append(el("span", "", "Crowded extreme"), el("span", "", "Soft, comfortable"));

  const phases = el("ol", "pulse-phases");
  phases.setAttribute("aria-label", "Mag 7 zone across the eight committed weeks");
  for (const phase of run.phases) {
    const item = el("li");
    item.dataset.zone = phase.zone;
    item.append(el("i", "pulse-phase"), el("span", "", phase.label));
    phases.append(item);
  }

  const history = el("div", "pulse-history");
  const historyStroke = run.cushion === 0 ? "var(--sc-crowded)" : run.cushion > 20 ? "var(--sc-soft)" : "var(--p-meta)";
  history.append(el("span", "pulse-sec", run.history.label), trace(run.history.points, historyStroke), el("span", "pulse-sec", `${run.history.from} → ${run.history.to}`));

  const bar = el("section", "pulse-card");
  bar.append(el("p", "pulse-lbl", "Cushion runway"), track, ends, phases, history);
  const wrap = el("div", "pulse-stack");
  wrap.append(armed, bar);
  return wrap;
}

function credit(model) {
  const section = el("section", "pulse-block");
  section.id = "pulse-credit";
  const head = el("div", "pulse-head");
  head.append(el("h2", "pulse-h", model.credit.title), el("p", "pulse-sec", model.credit.asOf));
  const grid = el("div", "pulse-grid pulse-grid-3");
  for (const item of model.credit.legs) {
    const card = el("article", "pulse-card");
    const bp = el("p", "pulse-bp", String(item.bp));
    bp.append(el("small", "", " bp"));
    card.append(
      el("p", "pulse-lbl", item.label),
      bp,
      el("p", "pulse-copy", item.blurb),
      el("p", item.tone === "quiet" ? "pulse-chip p-chip-quiet" : "pulse-chip p-chip-widen", item.chip),
      el("p", "pulse-sec", creditMeta(item)),
      trace(item.trace, item.tone === "quiet" ? "var(--p-credit-trace)" : "var(--p-pct)"),
    );
    grid.append(card);
  }
  section.append(head, grid);
  return section;
}

function dialCard(dial) {
  const card = el("article", "pulse-card sc-card");
  if (dial.extreme) card.dataset.extreme = dial.extreme;
  const track = el("div", "pulse-track");
  track.setAttribute("role", "img");
  track.setAttribute("aria-label", `${dial.name}, ${dial.ile}, ${dial.pill}`);
  const marker = el("i");
  marker.style.left = `${dial.pct}%`;
  if (dial.extreme === "soft") marker.style.borderColor = "var(--sc-soft)";
  else if (dial.extreme === "crowded" || dial.tone === "crowded") marker.style.borderColor = "var(--sc-crowded)";
  else if (dial.tone === "soft") marker.style.borderColor = "var(--sc-soft)";
  track.append(marker);
  const chipTone = dial.tone === "soft" || dial.extreme === "soft" ? "is-soft" : dial.pill.includes("unwinding") || dial.pill.endsWith("steady") ? "is-unwind" : "is-stretch";
  card.append(el("p", "pulse-lbl", dial.name), el("p", "pulse-pctl", dial.ile), el("p", "pulse-sec", dial.sub), track, el("p", `pulse-chip ${chipTone}`, dial.pill));
  return card;
}

function dials(model, deskHref) {
  const section = el("section", "pulse-block");
  section.id = "pulse-dials";
  section.append(el("h2", "pulse-h", "Soft↔Crowded."));
  const grid = el("div", "pulse-grid pulse-grid-4");
  for (const dial of model.dials) grid.append(dialCard(dial));
  const actions = el("p", "pulse-actions");
  const why = el("a", "pulse-btn", "Why this read");
  why.href = "#pulse-cases";
  const desk = el("a", "pulse-btn", "Full desk");
  desk.href = deskHref || "#themes";
  actions.append(why, desk);
  section.append(grid, actions, el("p", "pulse-sec", model.note));
  return section;
}

function cases(model) {
  const section = el("section", "pulse-block");
  section.id = "pulse-cases";
  const grid = el("div", "pulse-cases");
  const bull = el("article", "pulse-card pulse-case is-bull");
  bull.append(el("h2", "", "Bull case"));
  const bullList = el("ul");
  for (const item of model.cases.bull) bullList.append(el("li", "", item));
  bull.append(bullList);
  const bear = el("article", "pulse-card pulse-case is-bear");
  bear.append(el("h2", "", "Bear case"));
  const bearList = el("ul");
  for (const item of model.cases.bear) bearList.append(el("li", "", item));
  bear.append(bearList);
  grid.append(bull, bear);
  section.append(grid);
  return section;
}

export function renderPulse(root, model) {
  root.replaceChildren();
  root.removeAttribute("aria-busy");
  root.hidden = false;
  if (root.dataset.pulse === "cases") {
    root.append(cases(model), el("p", "pulse-foot", model.foot));
    return;
  }
  root.append(thesis(model), runway(model), credit(model), dials(model, root.dataset.deskHref), cases(model), el("p", "pulse-foot", model.foot));
}

let pending;
export function loadPulse() {
  if (!pending) pending = fetchPulse();
  return pending;
}

async function fetchPulse() {
  const base = import.meta.env.BASE_URL;
  const [csrRes, svbRes] = await Promise.all([
    fetch(`${base}data/vault/credit-spread-regime/csr.json`),
    fetch(`${base}data/vault/spot-vol-beta/latest.json`),
  ]);
  if (!csrRes.ok || !svbRes.ok) throw new Error("desk read unavailable");
  const [csr, svb] = await Promise.all([csrRes.json(), svbRes.json()]);
  const financials = buildReading("jpm", WEEKS.length - 1, 4).sectors.XLF;
  return buildPulse({
    csr,
    vol: svb.gauge,
    asOf: svb.session,
    financials: financials ? { points: financials.points } : null,
  });
}

async function mount(root) {
  if (root.dataset.pulseReady) return;
  root.dataset.pulseReady = "1";
  try {
    renderPulse(root, await loadPulse());
  } catch (error) {
    console.error(error);
    root.replaceChildren(el("p", "hint", "The desk read is not available."));
    root.removeAttribute("aria-busy");
  }
}

function boot() {
  for (const root of document.querySelectorAll("[data-pulse]")) mount(root);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("vault-open", boot);
}

export { dialCard };
