/**
 * Flow Show: weekly bank chart packs on the Positioning charts page.
 * Editions live under public/data/flow-show/; crops under public/flow-show/.
 */

const DATA = `${import.meta.env.BASE_URL}data/flow-show/`;
const HOUSE_CLASS = {
  JPM: "h-jpm",
  MS: "h-ms",
  GS: "h-gs",
  BoA: "h-boa",
  Desk: "h-desk",
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function assetUrl(path) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${String(path).replace(/^\//, "")}`;
}

function card(chart) {
  const article = el("article", "flow-show-card");
  const top = el("div", "icard-top");
  const house = chart.bank || "Desk";
  top.append(el("span", `house ${HOUSE_CLASS[house] ?? "h-desk"}`, house));
  if (chart.asOfLabel) top.append(el("span", "basis", `As of ${chart.asOfLabel}`));
  const figure = el("figure", "flow-show-figure");
  const img = el("img", "flow-show-img");
  img.src = assetUrl(chart.src);
  img.alt = chart.alt || `${house} chart`;
  img.loading = "lazy";
  img.decoding = "async";
  figure.append(img);
  const caption = el("figcaption", "flow-show-cap");
  caption.append(el("strong", "flow-show-title", chart.caption));
  figure.append(caption);
  article.append(top, figure);
  return article;
}

function paintEdition(host, edition) {
  const head = el("header", "flow-show-edition-head");
  head.append(
    el("p", "flow-show-edition-label", edition.label),
    el("h3", "flow-show-edition-title", edition.title),
    el("p", "flow-show-edition-summary", edition.summary),
  );
  const grid = el("div", "flow-show-grid");
  for (const chart of edition.charts ?? []) grid.append(card(chart));
  host.replaceChildren(head, grid);
}

export async function mountFlowShow(root = document.getElementById("flow-show-body")) {
  if (!root) return null;
  root.replaceChildren(el("p", "flow-show-status", "Loading weekly bank charts…"));
  try {
    const indexRes = await fetch(`${DATA}index.json`);
    if (!indexRes.ok) throw new Error(`flow-show index ${indexRes.status}`);
    const index = await indexRes.json();
    const latest = index.editions?.find((row) => row.id === index.latest) ?? index.editions?.[0];
    if (!latest?.href) throw new Error("flow-show index has no latest edition");
    const editionRes = await fetch(`${DATA}${latest.href}`);
    if (!editionRes.ok) throw new Error(`flow-show edition ${editionRes.status}`);
    const edition = await editionRes.json();
    paintEdition(root, edition);
    const asof = document.getElementById("flow-show-asof");
    if (asof) asof.textContent = `Week of ${edition.label} · ${edition.charts.length} charts`;
    return edition;
  } catch (error) {
    root.replaceChildren(el("p", "flow-show-status", "Flow Show charts could not load."));
    console.error(error);
    return null;
  }
}
