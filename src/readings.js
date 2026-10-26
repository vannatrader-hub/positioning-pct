import {
  CANON,
  JPM,
  JPM_VOL,
  SECTORS,
  SHIFTS,
  SOURCE_IDS,
  SOURCES,
  VOL_SHIFT,
  WEEKS,
} from "./sample.js";

export { CANON, SECTORS, SOURCES, WEEKS };

const BANKS = ["jpm", "ms", "boa", "gs"];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function ordinal(n) {
  const value = Math.abs(n) % 100;
  if (value >= 11 && value <= 13) return `${n}th`;
  switch (Math.abs(n) % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function formatWeek(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function sectorSeries(sourceId, ticker) {
  const base = JPM[ticker];
  if (!base) throw new Error(`Unknown sector ${ticker}`);
  if (sourceId === "desk") {
    return base.map((_, index) => {
      const values = BANKS.map((id) => sectorSeries(id, ticker)[index]);
      return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    });
  }
  if (!SOURCE_IDS.includes(sourceId)) throw new Error(`Unknown source ${sourceId}`);
  const shift = SHIFTS[sourceId][ticker] ?? 0;
  return base.map((value) => clamp(value + shift, 2, 98));
}

export function volSeries(sourceId) {
  if (sourceId === "desk") {
    return JPM_VOL.map((_, index) => {
      const values = BANKS.map((id) => volSeries(id)[index]);
      return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    });
  }
  if (!SOURCE_IDS.includes(sourceId)) throw new Error(`Unknown source ${sourceId}`);
  const shift = VOL_SHIFT[sourceId] ?? 0;
  return JPM_VOL.map((value) => clamp(value + shift, -30, 30));
}

export function levelOf(points) {
  if (points < 25) return "extreme soft";
  if (points < 40) return "soft";
  if (points < 67) return "mid";
  return "crowded";
}

export function regimeOf(points) {
  if (points < 40) return "Soft";
  if (points < 67) return "Mid";
  return "Crowded";
}

export function directionOf(level, deltaPoints) {
  const up = deltaPoints >= 2;
  const down = deltaPoints <= -2;
  if (level === "extreme soft" || level === "soft") {
    if (up) return "catching up";
    if (down) return "easing";
    return "steady";
  }
  if (level === "crowded") {
    if (up) return "still building";
    if (down) return "easing";
    return "steady";
  }
  if (up) return "firming";
  if (down) return "easing";
  return "steady";
}

export function formatWow(points) {
  const rounded = Math.round(points);
  if (rounded > 0) return `WoW +${rounded} pts`;
  if (rounded < 0) return `WoW −${Math.abs(rounded)} pts`;
  return "WoW 0 pts";
}

export function captionFor(ticker, points) {
  const ile = `${ordinal(points)} %ile`;
  if (ticker === "XLF" && points < 40) return `${ile} · call skew soft`;
  return `${ile} · ${regimeOf(points).toLowerCase()}`;
}

export function studyCopy(ticker, shortName, points) {
  const place = `${ticker} (${shortName}) at the ${ordinal(points)} percentile`;
  if (points < 25) {
    return {
      title: "Structures people study when a sector is soft",
      lead: `${place} is inside the soft quartile this week, under the 25th percentile.`,
    };
  }
  if (points < 40) {
    return {
      title: "Structures people study when a sector is soft",
      lead: `${place} is on the soft side of the range this week, under the 40th percentile.`,
    };
  }
  if (points >= 75) {
    return {
      title: "Structures people study when a sector is crowded",
      lead: `${place} is inside the crowded quartile this week, above the 75th percentile.`,
    };
  }
  if (points >= 67) {
    return {
      title: "Structures people study when a sector is crowded",
      lead: `${place} is on the crowded side of the range this week.`,
    };
  }
  return {
    title: "Structures people study when a sector is near the middle",
    lead: `${place} sits near the middle of the range this week, between the soft and crowded ends.`,
  };
}

export function volLabel(tenths) {
  if (tenths <= -4) return "Soft Vol";
  if (tenths >= 4) return "Stretched";
  return "Fair";
}

function sourceLabel(sourceId) {
  return SOURCES.find((source) => source.id === sourceId)?.label ?? sourceId;
}

export function buildReading(sourceId, weekIndex, windowWeeks) {
  const week = clamp(weekIndex, 0, WEEKS.length - 1);
  const lookback = windowWeeks === 8 ? 8 : 4;
  const sectors = {};

  for (const meta of SECTORS) {
    const series = sectorSeries(sourceId, meta.ticker);
    const points = series[week];
    const past = series[Math.max(0, week - lookback)];
    const previous = series[Math.max(0, week - 1)];
    const level = levelOf(points);
    const direction = directionOf(level, points - past);
    sectors[meta.ticker] = {
      ...meta,
      series,
      points,
      display: (points / 100).toFixed(2),
      level,
      direction,
      pill: `${level} → ${direction}`,
      caption: captionFor(meta.ticker, points),
      ile: `${ordinal(points)} %ile`,
      wowPts: points - previous,
      wowText: formatWow(points - previous),
      regime: regimeOf(points),
      note: meta.ticker === "XLF" && points < 40 ? "call skew soft" : "",
    };
  }

  const vol = volSeries(sourceId);
  const tenths = vol[week];

  return {
    sourceId,
    sourceLabel: sourceLabel(sourceId),
    weekIndex: week,
    weekIso: WEEKS[week],
    weekLabel: formatWeek(WEEKS[week]),
    windowWeeks: lookback,
    sectors,
    volTenths: tenths,
    volDisplay: (Math.abs(tenths) / 10).toFixed(1),
    volName: volLabel(tenths),
    volPosition: (tenths + 30) / 60,
  };
}
