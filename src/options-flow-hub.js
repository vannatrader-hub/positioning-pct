const base = import.meta.env ? import.meta.env.BASE_URL : "/";

/** Watchlist calling cards used to live at /options-flow/#TICKER. */
const legacy = /^#[A-Za-z.]{1,6}$/.exec(window.location.hash);
if (legacy) window.location.replace(`dollar/${legacy[0].toUpperCase()}`);

async function load(path) {
  const response = await fetch(`${base}data/flow/${path}`, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json();
}

function fact(key, text) {
  const item = document.querySelector(`[data-hub="${key}"]`);
  if (item) item.textContent = text;
}

load("plays.json")
  .then((seed) => fact("dollar", `${seed.plays.length} names · ${seed.window}`))
  .catch(() => {});

load("spotlights.json")
  .then((seed) => fact("spotlights", `${seed.cards.length} sample cards · ${seed.window}`))
  .catch(() => {});

load("scorecard.json")
  .then((board) => fact("scorecard", `${board.names.length} ranked names · ${board.iso_week} · composite / flow / tech`))
  .catch(() => {});
