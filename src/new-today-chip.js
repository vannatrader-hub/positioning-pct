import { ctTime, dayLabel, deskDay, deskWindow, itemsForDay, publicDeskItems } from "./new-today-window.js";

const base = import.meta.env ? import.meta.env.BASE_URL : "/";

async function loadFeed() {
  const response = await fetch(`${base}data/new-today.json`, { cache: "no-cache" });
  if (!response.ok) throw new Error(`new-today.json ${response.status}`);
  return response.json();
}

function paint(chip, items, updatedAt) {
  const day = deskDay();
  const visible = chip.dataset.public === "1" ? publicDeskItems(items) : items;
  const count = itemsForDay(visible, day).length;
  const sub = chip.querySelector('[data-nt="sub"]');
  const stamp = updatedAt ? `Feed updated ${dayLabel(deskDay(updatedAt))} · ${ctTime(updatedAt)}` : "Feed time is not stamped";
  chip.classList.toggle("is-lit", count > 0);
  chip.classList.toggle("is-quiet", count === 0);
  if (sub) sub.textContent = count ? `${count} new since 12 AM CT` : "Quiet since 12 AM CT";
  chip.title = count ? `${stamp}. ${count} new since 12:00 AM CT.` : `${stamp}. Nothing new since 12:00 AM CT.`;
  chip.setAttribute(
    "aria-label",
    count ? `New Today: ${count} new on the Desk since 12:00 AM CT. ${stamp}.` : `New Today: nothing new on the Desk since 12:00 AM CT. ${stamp}.`,
  );
  /* Go quiet on its own at the midnight CT rollover if the page stays open. */
  const wait = deskWindow(day).end - Date.now();
  if (wait > 0 && wait < 2 ** 31 - 1) setTimeout(() => paint(chip, items), wait + 1000);
}

const chips = [...document.querySelectorAll("[data-new-today]")];
if (chips.length) {
loadFeed()
  .then((feed) => chips.forEach((chip) => paint(chip, feed.items ?? [], feed.updatedAt ?? "")))
  .catch(() => chips.forEach((chip) => paint(chip, [], "")));
}
