import { onDeskReady } from "./when-mounted.js";
import { catchUpChip, catchUpSummary, deskDay, deskWindow, publicDeskItems } from "./new-today-window.js";

const base = import.meta.env ? import.meta.env.BASE_URL : "/";
const painted = new WeakSet();

async function loadFeed() {
  const response = await fetch(`${base}data/new-today.json`, { cache: "no-cache" });
  if (!response.ok) throw new Error(`new-today.json ${response.status}`);
  return response.json();
}

function visibleItems(chip, items) {
  /* data-public="1" is the Dashboard chip. Vault uses data-public="0" (or omits it) so flow rows count. */
  return chip.dataset.public === "1" ? publicDeskItems(items) : items;
}

function paint(chip, items, updatedAt) {
  const today = deskDay();
  const visible = visibleItems(chip, items);
  const copy = catchUpChip(catchUpSummary(visible, today), updatedAt);
  const sub = chip.querySelector('[data-nt="sub"]');
  chip.classList.toggle("is-lit", copy.lit);
  chip.classList.toggle("is-quiet", copy.quiet);
  if (sub) sub.textContent = copy.sub;
  chip.title = copy.title;
  chip.setAttribute("aria-label", copy.aria);
  /* Recount at the midnight CT rollover if the page stays open. Yesterday stays yesterday. */
  const wait = deskWindow(today).end - Date.now();
  if (wait > 0 && wait < 2 ** 31 - 1) setTimeout(() => paint(chip, items, updatedAt), wait + 1000);
}

function mountChips() {
  const chips = [...document.querySelectorAll("[data-new-today]")].filter((chip) => !painted.has(chip));
  if (!chips.length) return;
  chips.forEach((chip) => painted.add(chip));
  loadFeed()
    .then((feed) => chips.forEach((chip) => paint(chip, feed.items ?? [], feed.updatedAt ?? "")))
    .catch(() => chips.forEach((chip) => paint(chip, [], "")));
}

onDeskReady(mountChips);
