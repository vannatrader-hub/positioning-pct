/**
 * Vault home: the weekly pack list, latest first, read from the pack index
 * once the gate opens the page.
 */

const DATA = `${import.meta.env.BASE_URL}data/vault/soft-crowded/index.json`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function shortDate(iso) {
  const [, month, day] = iso.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}`;
}

function packRow(row, latest) {
  const item = el("li");
  const link = el("a", latest ? "vault-pack-row is-latest" : "vault-pack-row");
  link.href = latest ? "soft-crowded/" : `soft-crowded/?week=${row.isoWeek}`;
  const head = el("span", "vault-pack-row-head");
  head.append(el("strong", "", row.title), el("span", latest ? "badge is-live" : "badge is-journal", latest ? "Latest" : "Archive"));
  const counts = row.counts ?? {};
  const meta = el(
    "span",
    "vault-pack-row-meta",
    `Fri ${shortDate(row.week)} · 5:00 AM CT open · ${counts["extreme soft"] ?? 0} extreme soft · ${counts.soft ?? 0} soft · ${counts.mid ?? 0} mid · ${counts.crowded ?? 0} crowded`,
  );
  link.append(head, el("span", "vault-pack-row-line", row.headline), meta);
  item.append(link);
  return item;
}

async function renderPacks(host) {
  const res = await fetch(DATA);
  if (!res.ok) throw new Error(`pack index ${res.status}`);
  const index = await res.json();
  const weeks = [...(index.weeks ?? [])].sort((a, b) => b.week.localeCompare(a.week));
  if (!weeks.length) {
    host.replaceChildren(el("p", "hint", "No week is filed yet. The first pack lands on a Friday desk day."));
    return;
  }
  const list = el("ol", "vault-pack-list");
  weeks.forEach((row) => list.append(packRow(row, row.week === index.latest)));
  host.replaceChildren(list);
  const fact = document.getElementById("vault-pack-latest");
  const latest = weeks.find((row) => row.week === index.latest);
  if (fact && latest) fact.textContent = `${latest.title} · ${latest.weekLabel}`;
}

document.addEventListener("vault-open", () => {
  const host = document.getElementById("vault-pack-weeks");
  if (!host || host.dataset.ready === "1") return;
  host.dataset.ready = "1";
  renderPacks(host).catch((error) => {
    console.error(error);
    host.replaceChildren(el("p", "hint", "The pack list did not load. Open the pack directly, or refresh to try again."));
  });
});
