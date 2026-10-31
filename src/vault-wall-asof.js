/**
 * Wall status strip: one line per card saying how old its committed data is.
 * Nothing here is a quote. Each line reads the same files the cards read and
 * names the last close or stamp in them.
 */

import { onDeskReady } from "./when-mounted.js";
import { isFamilySurface } from "./family-entry.js";

const BASE = `${import.meta.env?.BASE_URL ?? "/"}data/vault/`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dayLabel(iso) {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return `${DAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]} ${MONTHS[month - 1]} ${day}`;
}

export function ctTime(stamp) {
  const [hour, minute] = stamp.slice(11, 16).split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"} CT`;
}

/** Today's date in Central time, YYYY-MM-DD. */
export function centralToday(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Weekday sessions after `iso` up to and including `today`, holidays not counted. */
export function sessionsBehind(iso, today) {
  let count = 0;
  const cursor = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const end = new Date(`${today}T12:00:00Z`);
  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

/** Age line for a data date: today, one session back, or older. Older than one session reads as behind. */
export function freshness(iso, today) {
  const behind = sessionsBehind(iso, today);
  if (behind <= 0) return { tone: "fresh", text: "Today" };
  if (behind === 1) return { tone: "fresh", text: "Last session" };
  return { tone: "stale", text: `${behind} sessions behind` };
}

export function statusLines(files) {
  const lines = [];
  const { svbLatest, svbSeries, csr, mag7, breadth } = files;
  if (svbLatest && svbSeries) {
    const last = svbSeries.points.at(-1);
    const family = isFamilySurface();
    lines.push({
      id: "spot-vol-beta",
      name: family ? "Vol Stress" : "Vol Stress",
      date: svbLatest.closed ? svbLatest.session : last.date,
      text: family
        ? svbLatest.closed
          ? `Session close ${dayLabel(svbLatest.session)} · gauge and Vol Stress`
          : `Gauge ${dayLabel(svbLatest.asOf)} ${ctTime(svbLatest.asOf)} · closes through ${dayLabel(last.date)}`
        : `Closes through ${dayLabel(last.date)}`,
      note: family ? (svbLatest.live ? "Live gauge" : "Committed gauge, live feed not wired") : "Committed",
    });
  }
  if (csr) {
    lines.push({ id: "credit-spread-regime", name: "Credit Spread Regime", date: csr.asOf, text: `Daily closes through ${dayLabel(csr.asOf)}`, note: "Committed series" });
  }
  if (mag7) {
    const intraday = mag7.lastBar === "intraday";
    lines.push({
      id: "mag7",
      name: "MAG7 Oscillator",
      date: mag7.asOf.slice(0, 10),
      text: intraday ? `Last bar ${dayLabel(mag7.asOf)} ${ctTime(mag7.asOf)}, intraday` : `Daily closes through ${dayLabel(mag7.asOf)}`,
      note: intraday ? "Committed intraday bar, not a live quote" : "Committed series",
    });
  }
  if (breadth) {
    const named = {
      nysi: "NY Summation",
      nasi: "Nasdaq Summation",
      nyhl: "NY Highs − Lows",
      nyad: "NY Advance − Decline",
    };
    for (const chart of breadth.charts ?? []) {
      const name = named[chart.id];
      if (!name) continue;
      const date = chart.asOf || breadth.asOf;
      lines.push({ id: chart.id, name, date, text: `Daily closes through ${dayLabel(date)}`, note: "Committed series" });
    }
  }
  return lines;
}

async function json(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function cardList() {
  const cards = [...document.querySelectorAll("article.pchart[id]")].map((card) => [
    card.id,
    card.querySelector("h2")?.textContent?.trim() || card.id,
  ]);
  return cards.length
    ? cards
    : [
        ["spot-vol-beta", "Vol Stress"],
        ["credit-spread-regime", "Credit Spread Regime"],
        ["mag7", "MAG7 Oscillator"],
        ["nysi", "NY Summation"],
        ["nasi", "Nasdaq Summation"],
      ];
}

async function render(host) {
  const settle = (promise) => promise.then((value) => value, () => null);
  const [svbLatest, svbSeries, csr, mag7, breadth] = await Promise.all([
    settle(json("spot-vol-beta/latest.json")),
    settle(json("spot-vol-beta/series.json")),
    settle(json("credit-spread-regime/csr.json")),
    settle(json("mag7/oscillator.json")),
    settle(json("breadth/index.json")),
  ]);
  const lines = statusLines({ svbLatest, svbSeries, csr, mag7, breadth });
  const today = centralToday();
  const list = el("ol", "wall-asof-list");
  for (const [id, name] of cardList()) {
    const line = lines.find((item) => item.id === id);
    const item = el("li");
    const link = el("a", "wall-asof-item");
    link.href = `#${id}`;
    link.append(el("strong", "", name));
    if (!line) {
      link.classList.add("is-missing");
      link.append(el("span", "wall-asof-text", "Data did not load"), el("span", "wall-asof-age", "No reading shown"));
    } else {
      const age = freshness(line.date, today);
      link.classList.add(`is-${age.tone}`);
      link.append(el("span", "wall-asof-text", line.text), el("span", "wall-asof-age", `${age.text} · ${line.note}`));
    }
    item.append(link);
    list.append(item);
  }
  host.replaceChildren(list);
}

if (typeof document !== "undefined") {
  onDeskReady(() => {
    const host = document.getElementById("wall-asof");
    if (!host || host.dataset.ready === "1") return;
    host.dataset.ready = "1";
    render(host).catch((error) => {
      console.error(error);
      host.replaceChildren(el("p", "hint", "The wall status did not load. Each card still says how old its own data is."));
    });
  });
}
