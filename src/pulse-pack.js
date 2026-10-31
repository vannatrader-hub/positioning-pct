/**
 * Pulse + TTWD locked pick-3, read from data already on the desk.
 * Theme percentiles come from the Soft ↔ Crowded indicators. Credit is the
 * committed HY / IG series (no BBB or AA column in csr.json — the third card
 * is the excess the desk already scores). Vol stress and the sector print are
 * passed in from the feeds the desk already ships. Nothing here invents a new
 * FRED series.
 */
import { GLOW_CROWDED_MIN, INDICATORS, isSoftCrowded, readIndicator } from "./desk.js";
import { percentRank, csrPanel, csrSeries } from "./csr.js";
import { WEEKS } from "./readings.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LOOKBACK = 252;
const TRACE = 48;

export const DIAL_IDS = ["gs-mag7", "gs-semis-software", "gs-global-ai", "jpm-retail-impulse"];
export const LAYER_IDS = [...DIAL_IDS, "jpm-smh-retail", "jpm-broad"];

const NAMES = {
  "gs-mag7": "Mag 7",
  "gs-semis-software": "Semis vs software",
  "gs-global-ai": "Global AI",
  "jpm-retail-impulse": "Retail impulse",
  "jpm-smh-retail": "SMH retail",
  "jpm-broad": "Broad equity",
};

function parts(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return { y, d, mon: MONTHS[m - 1], dow: DAYS[date.getUTCDay()] };
}

export function longDate(iso) {
  const p = parts(iso);
  return `${p.dow} ${p.mon} ${p.d}, ${p.y}`;
}

export function monthDay(iso) {
  const p = parts(iso);
  return `${p.mon} ${p.d}`;
}

export function ordinal(n) {
  const value = Math.abs(n) % 100;
  const suffix = value >= 11 && value <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[Math.abs(n) % 10] ?? "th";
  return `${n}${suffix}`;
}

export function signedBp(value) {
  const n = Math.round(value);
  if (n > 0) return `+${n} bp`;
  if (n < 0) return `−${Math.abs(n)} bp`;
  return "0 bp";
}

/** Tip-sheet chip. A one-day jump counts as fast only when the month is also wider. */
export function creditChip(day, month) {
  if ((day >= 8 && month > 0) || month >= 15) return { chip: "Widening fast", tone: "widen" };
  if (day >= 3 || month >= 3) return { chip: "Widening", tone: "widen" };
  return { chip: "Quiet", tone: "quiet" };
}

export function creditMeta(leg) {
  return `1d ${signedBp(leg.day)} · 20d ${signedBp(leg.month)} · ${ordinal(leg.pct)} pct`;
}

/** 0 pts of room means the theme is already inside the Crowded extreme. */
export function cushionOf(pct) {
  return Math.max(0, GLOW_CROWDED_MIN - pct);
}

/** Runway marker, percent from the trigger end. A gone cushion sits on the trigger. */
export function runwayMarker(cushion) {
  const t = Math.min(1, Math.max(0, cushion / GLOW_CROWDED_MIN));
  return Math.round((3 + t * 90) * 10) / 10;
}

export function tracePath(values, width = 120, height = 34) {
  if (!values.length) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - 4 - ((value - min) / span) * (height - 8);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function direction(pill) {
  const part = pill.split("→")[1];
  return part ? part.trim() : pill;
}

function latest(id) {
  const indicator = INDICATORS.find((item) => item.id === id);
  if (!indicator) throw new Error(`missing indicator ${id}`);
  const read = readIndicator(indicator, indicator.values.length - 1);
  if (!isSoftCrowded(read.ends)) throw new Error(`${id} is not a Soft ↔ Crowded scale`);
  return read;
}

function dialSub(read) {
  if (read.id === "gs-mag7") return `${read.value}% of book`;
  if (read.id === "jpm-smh-retail") return `${Math.round(Math.abs(read.values.at(-1)))}M on the day`;
  if (read.id === "jpm-retail-impulse") return "larger sell tickets";
  if (read.pill.endsWith("steady")) return "steady";
  if (read.pill.includes("unwinding") && !read.extreme) return "off the extreme";
  if (read.extreme === "soft") return "under-owned";
  return read.caption;
}

function dialOf(id) {
  const read = latest(id);
  return {
    id,
    name: NAMES[id] ?? read.title,
    pct: read.pct,
    ile: ordinal(read.pct),
    pill: read.pill,
    tone: read.tone,
    extreme: read.extreme,
    sub: dialSub(read),
  };
}

function spellStart(series, minZ) {
  const last = series.t.length - 1;
  if (series.z[last] === null || series.z[last] < minZ) return null;
  let index = last;
  while (index > 0 && series.z[index - 1] !== null && series.z[index - 1] >= minZ) index -= 1;
  return series.t[index];
}

function lastAt(series, minZ) {
  for (let index = series.t.length - 1; index >= 0; index -= 1) {
    if (series.z[index] !== null && series.z[index] >= minZ) return series.t[index];
  }
  return null;
}

function volText(vol) {
  if (vol == null || !Number.isFinite(Number(vol))) return null;
  const value = Number(vol);
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function leg(series, key, index, label, blurb) {
  const values = series[key];
  const now = values[index];
  const day = now - values[index - 1];
  const month = now - values[index - 20];
  const tone = creditChip(day, month);
  return {
    id: key,
    label,
    bp: Math.round(now),
    day: Math.round(day),
    month: Math.round(month),
    pct: Math.round(percentRank(values, LOOKBACK)[index]),
    blurb,
    trace: values.slice(index - TRACE + 1, index + 1),
    ...tone,
  };
}

function hyBlurb(chip) {
  return chip === "Quiet" ? "Junk-bond spreads. Calm on this print." : "Junk-bond spreads. The first place a jump shows up.";
}

function igBlurb(chip) {
  return chip === "Quiet" ? "High-grade credit. No flight from quality on this print." : "High-grade credit. Drifting wider, not breaking.";
}

function excessBlurb(chip) {
  return chip === "Quiet" ? "High yield minus investment grade. The gap is quiet." : "High yield minus investment grade. The gap is moving.";
}

/**
 * @param {{ csr: object, vol?: number, asOf?: string, financials?: { points: number }, weeks?: object[] }} input
 */
export function buildPulse({ csr, vol = null, asOf = null, financials = null, weeks = [] }) {
  const series = csrSeries(csr);
  const panel = csrPanel(series);
  const index = series.t.length - 1;
  const hy = leg(series, "hy", index, "High yield", "");
  const ig = leg(series, "ig", index, "Investment grade", "");
  const excess = leg(series, "excess", index, "Excess", "");
  hy.blurb = hyBlurb(hy.chip);
  ig.blurb = igBlurb(ig.chip);
  excess.blurb = excessBlurb(excess.chip);

  const creditArmed = panel.regime === "STRESS" || panel.status === "STRESSED";
  const creditNear = !creditArmed && panel.regime === "ELEVATED";
  const since = monthDay(spellStart(series, creditArmed ? 2 : 1) ?? panel.date);
  const stressOn = lastAt(series, 2);

  const mag = latest("gs-mag7");
  const semis = latest("gs-semis-software");
  const retail = latest("jpm-retail-impulse");
  const smh = latest("jpm-smh-retail");
  const cushion = cushionOf(mag.pct);
  const positioningArmed = cushion === 0;
  const volLine = volText(vol);

  const state = creditArmed ? "armed" : creditNear ? "near" : "quiet";
  const stateLabel = creditArmed ? "ARMED" : creditNear ? "NEAR TRIGGER" : "QUIET";
  const creditSentence =
    state === "quiet"
      ? `Credit is quiet on this print: high yield is ${hy.bp} bp and ${hy.chip.toLowerCase()}, investment grade is ${ig.bp} bp and ${ig.chip.toLowerCase()}.`
      : `Credit is the tell: high yield is ${hy.bp} bp and ${hy.chip.toLowerCase()}, investment grade is ${ig.bp} bp and ${ig.chip.toLowerCase()}, and the stress read has been ${state === "armed" ? "armed" : "elevated"} since ${since}.`;

  const signal = mag.extreme === "crowded" ? "Mag 7 crowding is the story" : `Mag 7 is ${mag.pill.split("→")[0].trim()}`;
  const rest = semis.pill.includes("unwinding") ? "semis are unwinding into it." : `semis read ${semis.pill}.`;
  const deskDay = asOf ?? WEEKS.at(-1);

  const cushions = mag.pcts.map((pct) => cushionOf(pct));
  const pills = [];
  if (creditNear) pills.push({ tone: "near", text: "Near trigger" });
  if (creditArmed || positioningArmed) pills.push({ tone: "armed", text: "Armed" });

  const bull = [
    `Semis versus software are at the ${ordinal(semis.pct)} and ${direction(semis.pill)}, off the extreme.`,
    `Retail impulsiveness is very soft at the ${ordinal(retail.pct)} — larger sell tickets, not a chase.`,
    `Investment grade is ${ig.bp} bp. The 20-day change is ${signedBp(ig.month)}, drifting rather than breaking.`,
  ];
  if (financials && Number.isFinite(financials.points)) bull.push(`Financials are at the ${ordinal(financials.points)} on the sector print carried forward with this week, extreme soft.`);

  const bear = [
    `Mag 7 is at the ${ordinal(mag.pct)} and still ${direction(mag.pill)} — ${mag.value}% of hedge fund US net exposure (GS).`,
    `Retail buying in SMH is at the ${ordinal(smh.pct)} (JPM).`,
    `High yield is ${hy.bp} bp, ${signedBp(hy.day)} on the day, near the ${ordinal(hy.pct)} of the past year.${stressOn && state !== "quiet" ? ` ${state === "armed" ? "Armed" : "Elevated"} since ${since}; a stress session printed ${monthDay(stressOn)}.` : ""}`,
    cushion === 0
      ? `The cushion before the Crowded extreme is 0 pts. Mag 7 is already inside that band.`
      : `The cushion before the Crowded extreme is ${cushion} pts.`,
  ];
  if (volLine) bear.push(`Vol stress printed ${volLine} on the ${monthDay(asOf ?? panel.date)} desk day, inside the band at 2 or more.`);

  const creditChipLabel = creditArmed ? "Credit armed" : creditNear ? "Credit near trigger" : "";

  return {
    kicker: `${longDate(deskDay)} · Soft↔Crowded desk`,
    title: { signal, rest, tone: mag.extreme === "soft" ? "soft" : "crowded" },
    lede: `Megacap positioning sits at the ${ordinal(mag.pct)} percentile and is ${direction(mag.pill)}, the most crowded read on the board. Semis versus software are at the ${ordinal(semis.pct)} and ${direction(semis.pill)}. ${creditSentence}`,
    note: `Theme percentiles are the latest committed desk print (${monthDay(WEEKS.at(-1))}).`,
    runway: {
      cushion,
      unit: "pts",
      label: "Cushion before Crowded extreme",
      pills,
      callout: `credit stress (HY): ${stateLabel}${state === "quiet" ? "" : ` since ${since}`} · ${hy.bp} bp`,
      body: `${
        cushion === 0
          ? `Mag 7 is already inside the Crowded extreme, at the ${ordinal(mag.pct)}. There is no cushion left before that band.`
          : `Mag 7 has ${cushion} pts of room before the Crowded extreme, at the ${ordinal(mag.pct)}.`
      } ${state === "quiet" ? `High yield is quiet at ${hy.bp} bp.` : `High yield has been ${state === "armed" ? "armed" : "elevated"} since ${since}.`}`,
      marker: runwayMarker(cushion),
      history: {
        label: "8w cushion",
        from: `${cushions[0]} pts`,
        to: `${cushions.at(-1)} pts`,
        points: cushions,
      },
      phases: mag.pcts.map((pct, week) => ({
        date: WEEKS[week],
        label: monthDay(WEEKS[week]),
        zone: pct >= 60 ? "crowded" : pct >= 40 ? "mid" : "soft",
      })),
    },
    credit: {
      title: "Credit.",
      asOf: `As of ${monthDay(panel.date)} · Desk`,
      legs: [hy, ig, excess],
    },
    dials: DIAL_IDS.map(dialOf),
    layers: LAYER_IDS.map(dialOf),
    cases: { bull: bull.slice(0, 5), bear: bear.slice(0, 5) },
    brief: {
      kicker: `Positioning % — Desk brief · ${parts(deskDay).d} ${parts(deskDay).mon} ${parts(deskDay).y}`,
      title: mag.extreme === "crowded" && state !== "quiet" ? "Crowded at the top, credit near the line" : `${signal}`,
      sub: state === "quiet" ? "Megacaps carry the book. Credit is quiet on this print." : "Megacaps carry the book while high yield sits elevated.",
      paragraphs: [
        {
          kw: "Soft↔Crowded.",
          text: `Mag 7 sits at the ${ordinal(mag.pct)} percentile and is ${direction(mag.pill)}. Semis versus software are at the ${ordinal(semis.pct)} and ${direction(semis.pill)}. Retail impulsiveness is soft at the ${ordinal(retail.pct)}.`,
        },
        {
          kw: "Credit.",
          text: `High yield is ${hy.bp} bp and ${hy.chip.toLowerCase()}. Investment grade is ${ig.bp} bp and ${ig.chip.toLowerCase()}. The excess, high yield minus investment grade, is ${excess.bp} bp. The stress read has been ${state === "armed" ? "armed" : state === "near" ? "elevated" : "quiet"}${state === "quiet" ? "" : ` since ${since}`}.`,
        },
        {
          kw: "What changes the current picture.",
          text: `High yield narrowing back under 300 bp, or Mag 7 easing below the ${GLOW_CROWDED_MIN}th, would put a cushion back in front of the Crowded extreme.`,
        },
        {
          kw: "Note.",
          text: "Committed desk read. Not a forecast or a recommendation.",
        },
      ],
    },
    digests: (weeks ?? []).slice(0, 3).map((week, digestIndex) => ({
      asOf: week.weekLabel,
      text: week.headline,
      chip: digestIndex === 0 ? creditChipLabel : "",
    })),
    foot: "Not a forecast. Not a recommendation. Positioning % desk read.",
  };
}
