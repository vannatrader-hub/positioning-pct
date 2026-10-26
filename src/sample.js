/**
 * Phase 1 public sample.
 * Eight weekly snapshots. Not a live source.
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

/** JPM path, oldest week first. The last print is the Oct 23, 2026 sample. */
export const JPM = {
  XLF: [36, 34, 32, 30, 28, 25, 22, 18],
  XLK: [70, 72, 73, 74, 76, 78, 80, 82],
  XLE: [41, 42, 43, 44, 45, 46, 47, 48],
  XLV: [40, 38, 37, 36, 34, 32, 30, 28],
  XLI: [46, 47, 48, 49, 50, 52, 53, 54],
  XLY: [62, 64, 65, 66, 68, 70, 72, 74],
  XLP: [35, 34, 33, 31, 29, 27, 26, 24],
  XLU: [14, 15, 15, 16, 18, 19, 20, 22],
  XLB: [56, 55, 54, 52, 51, 50, 48, 47],
  XLRE: [73, 74, 75, 75, 77, 78, 80, 81],
  XLC: [42, 43, 44, 44, 45, 47, 48, 49],
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
  { id: "jpm", label: "JPM" },
  { id: "ms", label: "Morgan Stanley" },
  { id: "boa", label: "BoA" },
  { id: "gs", label: "GS" },
  { id: "desk", label: "Desk composite" },
];

export const SOURCE_IDS = SOURCES.map((source) => source.id);
