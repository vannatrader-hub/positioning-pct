/**
 * Phase 1 weekly series.
 * Eight weekly snapshots, committed with the site.
 * Percentile figures are stored as whole points (18 = 18th percentile = 0.18).
 * Soft vol is stored in tenths of a vol point. Negative means the VIX is cheap.
 */

export const WEEKS = [
  "2026-09-04",
  "2026-09-11",
  "2026-09-18",
  "2026-09-25",
  "2026-10-02",
  "2026-10-09",
  "2026-10-16",
  "2026-10-23",
];

export const SECTORS = [
  { ticker: "XLF", name: "Financial Select Sector SPDR Fund", short: "Financials" },
  { ticker: "XLK", name: "Technology Select Sector SPDR Fund", short: "Technology" },
  { ticker: "XLE", name: "Energy Select Sector SPDR Fund", short: "Energy" },
  { ticker: "XLV", name: "Health Care Select Sector SPDR Fund", short: "Health Care" },
  { ticker: "XLI", name: "Industrial Select Sector SPDR Fund", short: "Industrials" },
  { ticker: "XLY", name: "Consumer Discretionary Select Sector SPDR Fund", short: "Consumer Discretionary" },
  { ticker: "XLP", name: "Consumer Staples Select Sector SPDR Fund", short: "Consumer Staples" },
  { ticker: "XLU", name: "Utilities Select Sector SPDR Fund", short: "Utilities" },
  { ticker: "XLB", name: "Materials Select Sector SPDR Fund", short: "Materials" },
  { ticker: "XLRE", name: "Real Estate Select Sector SPDR Fund", short: "Real Estate" },
  { ticker: "XLC", name: "Communication Services Select Sector SPDR Fund", short: "Communication Services" },
];

export const CANON = SECTORS.map((sector) => sector.ticker);

export const JPM_MONITOR_REF = "06-Oct-26";

/**
 * JPM path, oldest week first. The last print of each series is the current
 * percentile on the JPM Cross Asset Positioning Monitor as of 06-Oct-26;
 * earlier weeks are illustrative. Real Estate is not on that monitor, so XLRE
 * has no JPM series.
 */
export const JPM = {
  XLF: [36, 34, 32, 30, 28, 25, 22, 18],
  XLK: [64, 66, 67, 69, 70, 72, 74, 75],
  XLE: [58, 60, 61, 63, 64, 66, 67, 69],
  XLV: [44, 43, 41, 40, 38, 37, 35, 34],
  XLI: [42, 41, 40, 39, 38, 37, 36, 35],
  XLY: [56, 55, 54, 53, 52, 50, 49, 48],
  XLP: [30, 29, 28, 27, 25, 24, 22, 21],
  XLU: [26, 27, 28, 29, 30, 31, 32, 33],
  XLB: [52, 51, 51, 50, 49, 48, 47, 46],
  XLC: [42, 43, 44, 44, 45, 47, 48, 49],
};

/** Illustrative base for sectors JPM does not print, shifted per house like the rest. */
export const HOUSE_ONLY_BASE = {
  XLRE: [44, 45, 46, 46, 47, 48, 49, 50],
};

/** Added to the JPM path, in percentile points. */
export const SHIFTS = {
  jpm: {},
  ms: { XLF: 6, XLK: -4, XLE: 5, XLV: -3, XLI: 2, XLY: -5, XLP: 4, XLU: 3, XLB: -2, XLRE: -6, XLC: 4 },
  boa: { XLF: -3, XLK: 3, XLE: -4, XLV: 5, XLI: -2, XLY: 4, XLP: -2, XLU: 4, XLB: 3, XLRE: 2, XLC: -3 },
  gs: { XLF: 4, XLK: -2, XLE: 2, XLV: 3, XLI: 4, XLY: -3, XLP: 2, XLU: -4, XLB: 5, XLRE: -3, XLC: 2 },
};

export const JPM_VOL = [-2, -4, -6, -8, -10, -11, -12, -14];

export const VOL_SHIFT = {
  jpm: 0,
  ms: 4,
  boa: -3,
  gs: 6,
};

export const SOURCES = [
  { id: "all", label: "All" },
  { id: "jpm", label: "JPM" },
  { id: "ms", label: "MS" },
  { id: "gs", label: "GS" },
  { id: "boa", label: "BoA" },
  { id: "desk", label: "Desk" },
];

export const SOURCE_IDS = SOURCES.map((source) => source.id);
