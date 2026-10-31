/**
 * Phase 1 positioning desk.
 *
 * Every read has eight weeks that line up with the history slider.
 * When `ref` is set, the last value was read off a reference chart dated `ref`
 * and the earlier weeks are a path toward it. When `ref` is null the series is
 * a desk estimate.
 *
 * `pcts` is where the read sits on its Soft ↔ Crowded bar, 0 to 100.
 * Houses are public labels only: jpm, ms, gs, boa, desk.
 */

import { ordinal } from "./readings.js";

export const HOUSES = {
  jpm: "JPM",
  ms: "MS",
  gs: "GS",
  boa: "BoA",
  desk: "Desk",
};

export const SECTIONS = [
  {
    id: "sectors",
    nav: "Sectors",
    title: "Sector Soft ↔ Crowded",
    blurb: "The 11 Select Sector funds on one scale, plus breadth and the cyclical versus defensive tilt.",
  },
  {
    id: "broad",
    nav: "Broad equity",
    title: "Broad equity & cross-asset",
    blurb: "Composite reads of how full investors are on stocks and risk assets overall.",
  },
  {
    id: "retail",
    nav: "Retail & funds",
    title: "Retail & fund managers",
    blurb: "What the fund manager survey and retail order flow say about who is already in.",
  },
  {
    id: "prime",
    nav: "Prime book",
    title: "Hedge fund prime book",
    blurb: "How hedge funds are positioned, from prime brokerage exposure data.",
  },
  {
    id: "vol",
    nav: "Options & vol",
    title: "Options & volatility",
    blurb: "Whether protection is cheap or rich, and which side customers are buying.",
  },
  {
    id: "correlation",
    nav: "Correlation",
    title: "Correlation & concentration",
    blurb: "Low correlation means a few names are carrying the index — a concentration read.",
  },
  {
    id: "credit",
    nav: "Credit",
    title: "Credit",
    blurb: "Spreads and default swaps. Tight credit means investors are relaxed about risk.",
  },
  {
    id: "policy",
    nav: "Policy & flows",
    title: "Policy & regional flows",
    blurb: "Central bank direction and where hedge funds are buying or selling by region.",
  },
  {
    id: "futures",
    nav: "Futures",
    title: "Futures & trend followers",
    blurb: "Futures hedger positioning and how systematic trend followers are doing.",
  },
  {
    id: "themes",
    nav: "Semis & AI",
    title: "Semis, Mag 7 & AI",
    blurb: "The market’s biggest themes, read as positioning rather than price.",
  },
];

const signed = (value, digits = 1) => {
  const text = Math.abs(value).toFixed(digits);
  if (value > 0) return `+${text}`;
  if (value < 0) return `−${text}`;
  return text;
};

const money = (value, unit) => `${value < 0 ? "−" : "+"}$${Math.abs(value)}${unit}`;

const fixed = (digits) => (value) => value.toFixed(digits);
const whole = (value) => String(Math.round(value));

export const INDICATORS = [
  /* 1 · Sectors (the 11 sector cards are rendered separately) */
  {
    id: "desk-breadth",
    section: "sectors",
    house: "desk",
    title: "Sector breadth",
    sub: "Share of each sector’s members trading above their 50-day average.",
    unit: "% avg",
    show: fixed(1),
    ends: ["Narrow", "Broad"],
    values: [58.4, 55.1, 52.6, 54.0, 56.8, 59.2, 58.1, 57.3],
    pcts: [58, 55, 53, 54, 57, 59, 58, 57],
    ref: "Oct 22, 2026",
    latest: "Defensives lead: health care, energy, and staples are the broadest. Real estate and communication services lag.",
    rows: {
      kind: "fill",
      max: 100,
      items: [
        { label: "XLE", value: 81.0, text: "81%" },
        { label: "XLV", value: 78.3, text: "78%" },
        { label: "XLP", value: 72.7, text: "73%" },
        { label: "XLU", value: 67.7, text: "68%" },
        { label: "XLB", value: 66.7, text: "67%" },
        { label: "XLK", value: 56.0, text: "56%" },
        { label: "XLI", value: 49.4, text: "49%" },
        { label: "XLY", value: 48.9, text: "49%" },
        { label: "XLF", value: 44.7, text: "45%" },
        { label: "XLC", value: 38.1, text: "38%" },
        { label: "XLRE", value: 26.7, text: "27%" },
      ],
    },
  },
  {
    id: "gs-cyc-def",
    section: "sectors",
    house: "gs",
    title: "Cyclicals minus defensives",
    sub: "Hedge fund net exposure to cyclical sectors minus defensive sectors.",
    unit: "pts",
    show: fixed(1),
    values: [6.6, 6.8, 6.2, 5.9, 5.6, 5.8, 5.0, 5.3],
    pcts: [50, 53, 45, 41, 37, 39, 29, 33],
    ref: "Oct 22, 2026",
    latest: "Near the low end of the range since early 2024. Cyclicals are lightly owned.",
  },

  /* 2 · Broad equity & cross-asset */
  {
    id: "jpm-cross-asset",
    section: "broad",
    house: "jpm",
    title: "Cross Asset Positioning Monitor",
    sub: "Current percentile for each asset class. 0 is the minimum, 1 the maximum.",
    unit: "median",
    show: (value) => (value / 100).toFixed(2),
    ref: "06-Oct-26 (JPM)",
    latest: "Bitcoin, EM equities, and the dollar are the most crowded lines. EM bonds/FX and credit are the softest.",
    assets: [
      { label: "Equities", path: [72, 79, 78, 70, 63, 68, 67, 66] },
      { label: "Govt Bonds", path: [52, 53, 55, 56, 57, 58, 59, 60] },
      { label: "Credit", path: [34, 33, 31, 30, 29, 27, 26, 24] },
      { label: "Dollar", path: [70, 72, 73, 75, 76, 78, 80, 81] },
      { label: "Commodities ex Gold", path: [66, 68, 70, 71, 73, 75, 76, 78] },
      { label: "Gold", path: [52, 50, 48, 46, 44, 42, 40, 38] },
      { label: "Bitcoin", path: [78, 80, 81, 83, 84, 85, 86, 87] },
      { label: "EM Equities", path: [74, 76, 77, 79, 80, 81, 83, 84] },
      { label: "EM Bonds/FX", path: [24, 23, 21, 20, 19, 18, 16, 15] },
      { label: "Japan Equities", path: [58, 59, 61, 62, 63, 64, 66, 67] },
      { label: "Europe Equities", path: [36, 35, 33, 32, 31, 29, 28, 26] },
    ],
  },
  {
    id: "jpm-broad",
    section: "broad",
    house: "jpm",
    title: "Broad equity positioning",
    sub: "The Equities line of the cross-asset positioning monitor, as a percentile since 2016.",
    unit: "percentile",
    show: (value) => (value / 100).toFixed(2),
    values: [72, 79, 78, 70, 63, 68, 67, 66],
    pcts: [72, 79, 78, 70, 63, 68, 67, 66],
    ref: "06-Oct-26 (JPM)",
    latest: "Equities at 0.66 on the monitor, off a September peak near 0.80.",
  },
  {
    id: "gs-sentiment",
    section: "broad",
    house: "gs",
    title: "US equity sentiment indicator",
    sub: "Nine positioning measures across institutional, retail, and foreign investors. Above +1 is stretched.",
    unit: "z",
    show: (value) => signed(value),
    values: [1.1, 1.3, 1.5, 1.7, 1.9, 1.8, 1.7, 1.6],
    pcts: [74, 79, 83, 87, 92, 90, 87, 85],
    ref: "Jul 31, 2026",
    latest: "+1.6, above the +1.0 line for stretched positioning.",
  },
  {
    id: "gs-risky-safe",
    section: "broad",
    house: "gs",
    title: "Risky vs safe assets",
    sub: "How much investors hold in risk assets relative to havens.",
    unit: "%ile",
    show: whole,
    values: [66, 69, 72, 76, 78, 77, 75, 74],
    pcts: [66, 69, 72, 76, 78, 77, 75, 74],
    ref: null,
  },
  {
    id: "desk-st-composite",
    section: "broad",
    house: "desk",
    title: "Short-term composite sentiment",
    sub: "A fast daily blend on a 0 to 80 scale. Low means washed out.",
    unit: "",
    show: fixed(1),
    values: [36, 12, 8, 18, 10, 30, 41.4, 51.7],
    pcts: [45, 15, 10, 23, 13, 38, 52, 65],
    ref: "Oct 21, 2026",
    latest: "51.7, up 10.3 on the day and up from single digits in September.",
  },

  /* 3 · Retail & fund managers */
  {
    id: "boa-fms-crowded",
    section: "retail",
    house: "boa",
    title: "Most crowded trade",
    sub: "Share of fund managers naming the most crowded trade in the monthly survey.",
    unit: "%",
    show: whole,
    values: [47, 47, 47, 47, 53, 53, 53, 53],
    pcts: [86, 86, 86, 86, 93, 93, 93, 93],
    ref: "Aug 2026 survey",
    latest: "Long global semis is the most crowded answer.",
    rows: {
      kind: "fill",
      max: 60,
      items: [
        { label: "Long global semis", value: 53, text: "53%" },
        { label: "Short Japanese yen", value: 12, text: "12%" },
        { label: "Long Magnificent 7", value: 11, text: "11%" },
      ],
    },
  },
  {
    id: "boa-fms-cash",
    section: "retail",
    house: "boa",
    title: "Fund manager cash",
    sub: "Average cash level in the survey. Below 4% has marked crowded markets.",
    unit: "%",
    show: fixed(1),
    values: [4.2, 4.2, 4.1, 4.0, 4.0, 3.9, 3.9, 3.9],
    pcts: [66, 66, 70, 74, 74, 80, 80, 80],
    ref: null,
  },
  {
    id: "boa-money-flow",
    section: "retail",
    house: "boa",
    title: "Equity fund flows",
    sub: "Weekly money flow into equity funds.",
    unit: "",
    show: (value) => money(value.toFixed(1), "bn"),
    values: [6.1, 9.4, 12.8, 4.2, -3.5, 8.7, 14.9, 18.4],
    pcts: [55, 62, 68, 52, 38, 60, 66, 71],
    ref: null,
  },
  {
    id: "boa-levered-etf",
    section: "retail",
    house: "boa",
    title: "Levered ETF positioning",
    sub: "Assets in leveraged long equity ETFs against their own history.",
    unit: "%ile",
    show: whole,
    values: [79, 81, 84, 86, 88, 87, 88, 88],
    pcts: [79, 81, 84, 86, 88, 87, 88, 88],
    ref: null,
  },
  {
    id: "jpm-retail-conviction",
    section: "retail",
    house: "jpm",
    title: "Retail conviction",
    sub: "Dollars bought per dollar sold by retail. Above 1.00 means net buying.",
    unit: "×",
    show: fixed(3),
    values: [1.048, 1.045, 1.041, 1.038, 1.044, 1.04, 1.037, 1.035],
    pcts: [71, 68, 65, 62, 67, 64, 61, 59],
    ref: "Oct 21, 2026",
    latest: "Weaker but holding above 1.00.",
  },
  {
    id: "jpm-retail-impulse",
    section: "retail",
    house: "jpm",
    title: "Retail impulsiveness",
    sub: "Buy ticket size versus sell ticket size. Low means larger sell orders.",
    unit: "×",
    show: fixed(2),
    values: [0.78, 0.77, 0.77, 0.76, 0.76, 0.75, 0.75, 0.74],
    pcts: [32, 28, 28, 24, 24, 20, 20, 16],
    ref: "Oct 21, 2026",
    latest: "Retail is selling impulsively, near the low end since 2020.",
  },
  {
    id: "jpm-retail-tech",
    section: "retail",
    house: "jpm",
    title: "Retail flows into tech ETFs",
    sub: "Weekly net retail buying of technology ETFs.",
    unit: "",
    show: (value) => money(value, "M"),
    values: [80, -210, 170, -90, 40, 290, 170, 540],
    pcts: [55, 20, 68, 30, 50, 82, 68, 99],
    ref: "Oct 21, 2026",
    latest: "A record weekly inflow.",
  },

  /* 4 · Hedge fund prime book */
  {
    id: "gs-prime-factor",
    section: "prime",
    house: "gs",
    title: "Net factor exposure",
    sub: "Prime book net factor exposure as a share of fund equity.",
    unit: "%",
    show: whole,
    values: [57, 58, 56, 57, 55, 52, 50, 49],
    pcts: [95, 96, 94, 95, 93, 91, 89, 88],
    ref: "Jul 2026",
    latest: "Off a 60% peak but still above the +1 standard deviation band near 37%.",
  },
  {
    id: "gs-prime-semis",
    section: "prime",
    house: "gs",
    title: "Semis net exposure",
    sub: "Semis and semi equipment as a share of US net exposure.",
    unit: "%",
    show: fixed(1),
    values: [12.0, 11.5, 10.4, 9.6, 10.2, 11.8, 10.4, 9.5],
    pcts: [88, 84, 78, 72, 76, 86, 78, 72],
    ref: "Oct 22, 2026",
    latest: "Funds have rotated out from a 14% peak earlier this year.",
  },
  {
    id: "gs-prime-software",
    section: "prime",
    house: "gs",
    title: "Software net exposure",
    sub: "Software as a share of US net exposure.",
    unit: "%",
    show: fixed(1),
    values: [4.5, 5.0, 5.2, 5.6, 5.9, 6.3, 6.9, 7.0],
    pcts: [19, 22, 24, 26, 28, 31, 35, 35],
    ref: "Oct 22, 2026",
    latest: "Rebuilding from a 1.5% low, still far under the 16% held in 2022.",
  },

  /* 5 · Options & volatility (the Soft Vol gauge is rendered separately) */
  {
    id: "desk-customer-flow",
    section: "vol",
    house: "desk",
    title: "Customer calls vs puts",
    sub: "Customer options volume by side, as a percentile of its history.",
    unit: "%ile calls",
    show: whole,
    values: [72, 80, 86, 90, 94, 97, 99, 100],
    pcts: [70, 76, 82, 86, 90, 93, 96, 97],
    ref: "Oct 22, 2026",
    latest: "ETF call buying at the 100th percentile while put buying sits at the 5th.",
    rows: {
      kind: "fill",
      max: 100,
      items: [
        { label: "ETF calls", value: 100, text: "100th" },
        { label: "ETF puts", value: 5, text: "5th" },
        { label: "Stock calls", value: 98, text: "98th" },
        { label: "Stock puts", value: 19, text: "19th" },
      ],
    },
  },
  {
    id: "gs-vol-panic",
    section: "vol",
    house: "gs",
    title: "Vol panic index",
    sub: "A 0 to 10 gauge of hedging demand. Low means little protection is in place.",
    unit: "/ 10",
    show: fixed(2),
    values: [3.9, 2.6, 6.9, 4.1, 2.2, 3.8, 1.9, 1.33],
    pcts: [61, 74, 31, 59, 78, 62, 81, 87],
    ref: "Jul 27, 2026",
    latest: "1.33 against a 4.82 average. Very little insurance on.",
  },
  {
    id: "gs-risk-appetite",
    section: "vol",
    house: "gs",
    title: "Risk appetite",
    sub: "A cross-asset risk appetite indicator.",
    unit: "z",
    show: (value) => signed(value),
    values: [0.4, 0.6, 0.7, 0.9, 1.0, 0.9, 0.8, 0.9],
    pcts: [60, 65, 68, 73, 75, 73, 70, 73],
    ref: null,
  },
  {
    id: "ms-momentum",
    section: "vol",
    house: "ms",
    title: "Momentum factor",
    sub: "Month-to-date return of the momentum factor. Negative means crowded winners are being sold.",
    unit: "% MTD",
    show: (value) => signed(value),
    ends: ["Unwinding", "Extending"],
    values: [2.1, 3.4, 4.2, 1.8, 0.6, -1.9, -3.8, -5.26],
    pcts: [62, 70, 76, 58, 52, 36, 26, 16],
    ref: "Oct 2026",
    latest: "Momentum is down 5.3% month to date while tail hedges rally.",
  },

  /* 6 · Correlation & concentration */
  {
    id: "desk-cor1m",
    section: "correlation",
    house: "desk",
    title: "COR1M implied correlation",
    sub: "One-month implied correlation of S&P 500 members. Low means a few names carry the index.",
    unit: "",
    show: fixed(2),
    values: [12.4, 10.8, 9.6, 11.2, 9.1, 10.52, 8.6, 7.41],
    pcts: [83, 87, 89, 86, 91, 88, 92, 94],
    ref: "Jul 23, 2026",
    latest: "7.41, under the 8 line where risk has picked up before.",
  },
  {
    id: "desk-spx-correl",
    section: "correlation",
    house: "desk",
    title: "S&P 500 realized correlation",
    sub: "How closely index members have actually moved together.",
    unit: "",
    show: fixed(2),
    values: [0.26, 0.24, 0.23, 0.21, 0.22, 0.2, 0.19, 0.18],
    pcts: [74, 77, 79, 82, 80, 83, 84, 86],
    ref: null,
  },
  {
    id: "desk-st-correl",
    section: "correlation",
    house: "desk",
    title: "Short-term correlation",
    sub: "A faster, two-week read of the same thing.",
    unit: "",
    show: fixed(2),
    values: [0.31, 0.28, 0.26, 0.27, 0.24, 0.25, 0.23, 0.22],
    pcts: [70, 74, 77, 76, 79, 78, 80, 81],
    ref: null,
  },
  {
    id: "desk-xlk-correl",
    section: "correlation",
    house: "desk",
    title: "Tech (XLK) correlation",
    sub: "Correlation among the largest technology holdings.",
    unit: "",
    show: fixed(2),
    values: [0.42, 0.4, 0.37, 0.36, 0.34, 0.33, 0.32, 0.31],
    pcts: [64, 67, 70, 71, 73, 74, 75, 76],
    ref: null,
  },

  /* 7 · Credit */
  {
    id: "desk-cdx",
    section: "credit",
    house: "desk",
    title: "CDX credit default swaps",
    sub: "Cost to insure a basket of corporate bonds. Low means credit is relaxed.",
    unit: "bp",
    show: whole,
    values: [296, 300, 302, 298, 305, 322, 340, 351.1],
    pcts: [95, 94, 93, 95, 93, 88, 82, 79],
    ref: "Oct 22, 2026",
    latest: "351, up from below 300. Widening off complacent levels.",
  },
  {
    id: "desk-bbb-aaa",
    section: "credit",
    house: "desk",
    title: "BBB minus AAA spread",
    sub: "Extra yield paid on lower-grade investment-grade bonds.",
    unit: "pts",
    show: fixed(2),
    values: [0.49, 0.5, 0.49, 0.52, 0.55, 0.58, 0.61, 0.63],
    pcts: [99, 97, 99, 94, 90, 86, 82, 79],
    ref: "Oct 22, 2026",
    latest: "0.63 from a 0.49 low. The cheapest-credit trade is fading.",
  },
  {
    id: "desk-credit-gap",
    section: "credit",
    house: "desk",
    title: "High yield vs investment grade",
    sub: "Each against Treasuries. A gap means the two are telling different stories.",
    unit: "gap",
    show: fixed(1),
    values: [0.2, 0.3, 0.3, 0.5, 0.6, 0.8, 0.9, 1.0],
    pcts: [60, 61, 61, 63, 64, 65, 66, 66],
    ref: null,
    latest: "High yield is holding near its highs while investment grade rolls over.",
    rows: {
      kind: "text",
      items: [
        { label: "High yield vs Treasuries", text: "0.851 · holding" },
        { label: "Investment grade vs Treasuries", text: "1.15 · rolling over" },
      ],
    },
  },

  /* 8 · Policy & regional flows */
  {
    id: "desk-cb-tightening",
    section: "policy",
    house: "desk",
    title: "Central banks tightening",
    sub: "Share of 33 central banks that raised rates over the last six months.",
    unit: "%",
    show: whole,
    ends: ["Easing", "Tightening"],
    values: [24, 27, 30, 33, 36, 39, 42, 45],
    pcts: [55, 58, 61, 64, 67, 69, 71, 73],
    ref: "Oct 2026",
    latest: "15 of 33 central banks raised rates in the last six months.",
  },
  {
    id: "boa-hikes-cuts",
    section: "policy",
    house: "boa",
    title: "Rate hikes minus cuts",
    sub: "Central bank hikes minus cuts, 3-month rolling.",
    unit: "",
    show: (value) => signed(value, 0),
    ends: ["Easing", "Tightening"],
    values: [-6, -3, -1, 2, 4, 5, 7, 8],
    pcts: [44, 47, 49, 52, 54, 55, 57, 58],
    ref: "Oct 2026",
    latest: "Positive for the first time since September 2023.",
  },
  {
    id: "gs-region-flow",
    section: "policy",
    house: "gs",
    title: "Prime book flows by region",
    sub: "North America net trading flow this year, as a share of regional gross.",
    unit: "% YTD",
    show: (value) => signed(value),
    ends: ["Net sold", "Net bought"],
    values: [-3.2, -3.0, -3.1, -3.3, -3.6, -4.0, -4.8, -4.5],
    pcts: [27, 29, 28, 26, 24, 21, 16, 18],
    ref: "Oct 22, 2026",
    latest: "Every region is net sold in October except Europe.",
    rows: {
      kind: "diverge",
      max: 7,
      items: [
        { label: "North America", value: -4.5, text: "−4.5% · 16.5 pts under" },
        { label: "Europe", value: 0.9, text: "+0.9% · 2.8 pts over" },
        { label: "Asia", value: -5.6, text: "−5.6% · 11.2 pts over" },
      ],
    },
  },

  /* 9 · Futures & trend followers */
  {
    id: "desk-cftc-index",
    section: "futures",
    house: "desk",
    title: "Index futures hedgers",
    sub: "Combined hedger position across major index futures. Hedgers short means speculators are long.",
    unit: "net",
    show: (value) => signed(value),
    values: [-30, -75, -95, -110, -90, -70, -60, -50.74],
    pcts: [60, 72, 77, 81, 76, 70, 68, 65],
    ref: "Oct 22, 2026",
    latest: "−50.7, back toward the middle after a summer flush.",
  },
  {
    id: "desk-cftc-ndx",
    section: "futures",
    house: "desk",
    title: "Nasdaq-100 futures hedgers",
    sub: "Hedger position in Nasdaq-100 futures. Near the lower band means speculators are very long.",
    unit: "",
    show: (value) => `${value < 0 ? "−" : "+"}${(Math.abs(value) / 1000).toFixed(1)}k`,
    values: [3000, -2000, -8000, -10500, -12500, -13800, -12400, -11753],
    pcts: [35, 55, 78, 88, 94, 97, 95, 93],
    ref: "Oct 22, 2026",
    latest: "−11,753, sitting near the lower band around −13.5k.",
  },
  {
    id: "desk-cta",
    section: "futures",
    house: "desk",
    title: "Trend followers (CTAs)",
    sub: "Replicated trend-follower return for the week. Losses push them to cut positions.",
    unit: "% wk",
    show: (value) => signed(value),
    ends: ["De-risking", "Max long"],
    values: [0.6, 0.4, 0.3, 0.5, 0.2, -0.4, -1.3, -2.0],
    pcts: [80, 82, 82, 84, 80, 62, 44, 30],
    ref: "Oct 22, 2026",
    latest: "Past week −2.0%, a 9th percentile week. Bonds drove most of October’s loss.",
    rows: {
      kind: "diverge",
      max: 1.6,
      items: [
        { label: "Bonds", value: -1.5, text: "−1.50%" },
        { label: "Equities", value: -0.15, text: "−0.15%" },
        { label: "Money markets", value: -0.15, text: "−0.15%" },
        { label: "G10 FX", value: -0.05, text: "−0.05%" },
        { label: "EM FX", value: 0.25, text: "+0.25%" },
        { label: "Commodities", value: 0.05, text: "+0.05%" },
      ],
    },
  },

  /* 10 · Semis, Mag 7 & AI */
  {
    id: "gs-mag7",
    section: "themes",
    house: "gs",
    title: "Mag 7 share of net exposure",
    sub: "The Magnificent 7 as a share of hedge fund US net exposure.",
    unit: "%",
    show: fixed(1),
    values: [17.0, 16.5, 18.0, 19.5, 20.5, 21.0, 22.0, 22.5],
    pcts: [62, 59, 69, 78, 84, 88, 94, 97],
    ref: "Oct 22, 2026",
    latest: "Net near a record 22.5%. Gross is 10.6%.",
  },
  {
    id: "gs-semis-software",
    section: "themes",
    house: "gs",
    title: "Semis vs software",
    sub: "Semis net exposure minus software net exposure.",
    unit: "pts",
    show: (value) => signed(value),
    values: [7.5, 6.5, 5.2, 4.0, 4.3, 5.5, 3.5, 2.5],
    pcts: [83, 79, 74, 69, 70, 75, 67, 63],
    ref: "Oct 22, 2026",
    latest: "The gap is closing: semis 9.5%, software 7.0%.",
    rows: {
      kind: "fill",
      max: 14,
      items: [
        { label: "Semis & semi equipment", value: 9.5, text: "9.5%" },
        { label: "Software", value: 7.0, text: "7.0%" },
      ],
    },
  },
  {
    id: "gs-global-ai",
    section: "themes",
    house: "gs",
    title: "Global AI exposure",
    sub: "AI names as a share of global net exposure.",
    unit: "%",
    show: fixed(1),
    values: [27.5, 27.0, 26.0, 27.5, 27.0, 26.5, 27.0, 26.5],
    pcts: [81, 79, 75, 81, 79, 77, 79, 77],
    ref: "Oct 22, 2026",
    latest: "Off a 31.5% peak. The long/short ratio has slipped to 3.25×.",
  },
  {
    id: "desk-ai-pair",
    section: "themes",
    house: "desk",
    title: "AI enablers vs hyperscalers",
    sub: "A pair trade, long AI enablers and short hyperscalers. Year-to-date return.",
    unit: "% YTD",
    show: (value) => signed(value, 0),
    ends: ["Unwinding", "Extending"],
    values: [52, 55, 50, 46, 45, 40, 38, 34],
    pcts: [80, 84, 76, 70, 68, 60, 48, 30],
    ref: "Oct 2026",
    latest: "Down 25.7% from its peak, including −11% in the past week.",
    rows: {
      kind: "diverge",
      max: 30,
      items: [
        { label: "Past week", value: -11, text: "−11%" },
        { label: "Past month", value: -12, text: "−12%" },
        { label: "Past quarter", value: -10, text: "−10%" },
        { label: "From peak", value: -25.7, text: "−25.7%" },
      ],
    },
  },
  {
    id: "jpm-smh-retail",
    section: "themes",
    house: "jpm",
    title: "Retail buying in SMH",
    sub: "Daily net retail buying of the semiconductor ETF.",
    unit: "",
    show: (value) => money(value, "M"),
    values: [12, 18, -25, 30, 22, -15, 40, 165],
    pcts: [58, 62, 30, 66, 61, 38, 72, 98],
    ref: "Oct 21, 2026",
    latest: "Strong buy-the-dip buying on Friday.",
  },
];

for (const indicator of INDICATORS) {
  if (!indicator.assets) continue;
  const weeks = indicator.assets[0].path.length;
  indicator.pcts = Array.from({ length: weeks }, (_, week) => median(indicator.assets.map((asset) => asset.path[week])));
  indicator.values = [...indicator.pcts];
}

function zoneWord(pct, ends) {
  const [low, high] = ends.map((end) => end.toLowerCase());
  const scaled = ends[0] === "Soft" && ends[1] === "Crowded";
  if (pct < 20) return { word: scaled ? `very ${low}` : low, tone: "soft" };
  if (pct < 40) return { word: low, tone: "soft" };
  if (pct < 60) return { word: "mid", tone: "mid" };
  if (pct < 80) return { word: high, tone: "crowded" };
  return { word: scaled ? `very ${high}` : high, tone: "crowded" };
}

/** Direction is read against the middle of the bar, not the sign of the move. */
export function drift(pct, past) {
  const delta = pct - past;
  if (Math.abs(delta) < 3) return "steady";
  return delta * (pct - 50) > 0 ? "stretching" : "unwinding";
}

/** Keep in step with --sc-glow-soft-max / --sc-glow-crowded-min in styles.css. */
export const GLOW_SOFT_MAX = 25;
export const GLOW_CROWDED_MIN = 90;

/** Level-only extreme for cards on the Soft ↔ Crowded scale; direction never feeds it. */
export function extremeOf(pct, ends = ["Soft", "Crowded"]) {
  if (ends[0] !== "Soft" || ends[1] !== "Crowded") return null;
  if (pct <= GLOW_SOFT_MAX) return "soft";
  if (pct >= GLOW_CROWDED_MIN) return "crowded";
  return null;
}

export function changeText(delta, weeks) {
  if (delta === 0) return `Unchanged vs ${weeks} wks ago`;
  const arrow = delta > 0 ? "▲" : "▼";
  return `${arrow} ${Math.abs(delta)} pts vs ${weeks} wks ago`;
}

export function readIndicator(indicator, weekIndex, lookback = 4) {
  const week = Math.min(indicator.values.length - 1, Math.max(0, weekIndex));
  const pct = indicator.pcts[week];
  const past = indicator.pcts[Math.max(0, week - lookback)];
  const ends = indicator.ends ?? ["Soft", "Crowded"];
  const zone = zoneWord(pct, ends);
  const isLatest = week === indicator.values.length - 1;
  const assets = indicator.assets?.map((asset) => {
    const now = asset.path[week];
    const then = asset.path[Math.max(0, week - lookback)];
    return {
      label: asset.label,
      pct: now,
      display: (now / 100).toFixed(2),
      tone: zoneWord(now, ends).tone,
      delta: now - then,
    };
  });
  return {
    ...indicator,
    assets,
    ends,
    pct,
    value: indicator.show(indicator.values[week]),
    tone: zone.tone,
    extreme: extremeOf(pct, ends),
    pill: `${zone.word} → ${drift(pct, past)}`,
    caption: `${ordinal(pct)} %ile`,
    change: changeText(pct - past, lookback),
    latestNote: isLatest ? indicator.latest ?? "" : "",
    basis: indicator.ref ? `Ref chart ${indicator.ref}` : "Desk estimate",
  };
}

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function leanOf(pct) {
  if (pct < 40) return { word: "Soft", tone: "soft" };
  if (pct < 60) return { word: "Mid", tone: "mid" };
  return { word: "Crowded", tone: "crowded" };
}
