/**
 * One data tree. Edit a feed once; the next deploy updates every surface
 * listed here. Portfolio stays on "vault" only. The unlisted entry is named
 * only in src/family-allowlist.js, not in the public README.
 *
 * surfaces: "dashboard" (public Positioning %), "vault", "private".
 */
export const PRODUCT_FEEDS = [
  {
    id: "positioning",
    file: "src/series.js",
    surfaces: ["dashboard", "private"],
  },
  {
    id: "new-today",
    file: "public/data/new-today.json",
    surfaces: ["dashboard", "private"],
  },
  {
    id: "flow-plays",
    file: "public/data/flow/plays.json",
    surfaces: ["vault", "private"],
  },
  {
    id: "spotlights",
    file: "public/data/flow/spotlights.json",
    surfaces: ["vault", "private"],
  },
  {
    id: "scorecard",
    file: "public/data/flow/scorecard.json",
    surfaces: ["vault", "private"],
  },
  {
    id: "spot-vol-beta",
    file: "public/data/vault/spot-vol-beta/latest.json",
    surfaces: ["dashboard", "vault", "private"],
  },
  {
    id: "credit-spread-regime",
    file: "public/data/vault/credit-spread-regime/csr.json",
    surfaces: ["dashboard", "vault", "private"],
  },
  {
    id: "mag7",
    file: "public/data/vault/mag7/oscillator.json",
    surfaces: ["dashboard", "vault", "private"],
  },
  {
    id: "breadth",
    file: "public/data/vault/breadth/index.json",
    surfaces: ["dashboard", "vault", "private"],
  },
  {
    id: "portfolio",
    file: "public/data/vault/portfolio/journal.json",
    surfaces: ["vault"],
  },
];
