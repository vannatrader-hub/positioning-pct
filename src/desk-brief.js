/**
 * Desk brief and layer cards for the signed-in family entry. Mounts only into
 * a template ([data-desk-brief]), so the public site never links here and the
 * signed-out wall stays a generic Coming soon card.
 */
import { dialCard } from "./pulse-render.js";
import { loadFamilyPulse } from "./vault-pulse.js";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function brief(model) {
  const scrim = el("div", "pulse-scrim");
  scrim.hidden = true;
  const modal = el("div", "pulse-modal");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "pulse-brief-title");
  const closeBtn = el("button", "pulse-x", "×");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close");
  const title = el("h2", "", model.brief.title);
  title.id = "pulse-brief-title";
  modal.append(closeBtn, el("p", "pulse-lbl", model.brief.kicker), title, el("p", "pulse-modal-sub", model.brief.sub));
  for (const paragraph of model.brief.paragraphs) {
    const p = el("p");
    p.append(el("span", "p-brief-kw", paragraph.kw), document.createTextNode(` ${paragraph.text}`));
    modal.append(p);
  }
  const done = el("button", "pulse-btn", "Close brief");
  done.type = "button";
  modal.append(done);
  scrim.append(modal);

  const close = () => {
    scrim.hidden = true;
    document.body.style.overflow = "";
  };
  const open = () => {
    scrim.hidden = false;
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  };
  closeBtn.addEventListener("click", close);
  done.addEventListener("click", close);
  scrim.addEventListener("click", (event) => {
    if (event.target === scrim) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !scrim.hidden) close();
  });
  return { scrim, open };
}

export function renderFamilyHub(root, model) {
  root.replaceChildren();
  const head = el("div", "desk-brief-head");
  head.append(el("h2", "", "Desk brief"));
  const button = el("button", "pulse-btn", "Open brief");
  button.type = "button";
  head.append(button);

  const tiles = el("div", "pulse-grid pulse-grid-3 desk-digest");
  for (const digest of model.digests) {
    const card = el("article", "pulse-card is-mute");
    card.append(el("p", "pulse-sec", digest.asOf));
    if (digest.chip) card.append(el("p", digest.chip === "Credit armed" ? "pulse-chip p-chip-armed" : "pulse-chip p-chip-near", digest.chip));
    card.append(el("p", "pulse-copy", digest.text));
    tiles.append(card);
  }

  const layers = el("section", "pulse-block");
  layers.append(el("h2", "pulse-h", "Layer themes"));
  const grid = el("div", "pulse-grid pulse-grid-3");
  for (const dial of model.layers) grid.append(dialCard(dial));
  layers.append(grid, el("p", "pulse-sec", model.note));

  const dialog = brief(model);
  button.addEventListener("click", dialog.open);
  root.append(head, tiles, layers, dialog.scrim);
  if (root.dataset.deskBrief === "open") dialog.open();
}

async function mount(root) {
  if (root.dataset.hubReady) return;
  root.dataset.hubReady = "1";
  try {
    renderFamilyHub(root, await loadFamilyPulse());
  } catch (error) {
    console.error(error);
    root.replaceChildren(el("p", "hint", "The desk brief is not available."));
  }
}

function boot() {
  for (const root of document.querySelectorAll("[data-desk-brief]")) mount(root);
}

if (typeof document !== "undefined") {
  document.addEventListener("vault-open", boot);
}
