# Data gaps — Live Site chart history

Checked 2026-11-01 against files committed in this repo. No series was lengthened, and no week-over-week print was filled in.

Mag 7, Credit Spread Regime, and the breadth files (NYSI, NASI, NYAD, NYHL, SPX) were left as they are. Those histories are already multi-year.

## Soft ↔ Crowded — not extended

`src/series.js` holds eight Fridays, 2026-09-04 through 2026-10-23. The JPM arrays end on the Cross Asset Positioning Monitor print dated 06-Oct-26 (`JPM_MONITOR_REF`). The comment on those arrays says the earlier weeks are not that monitor’s week-over-week record. MS, GS, and BoA are fixed offsets in `SHIFTS`, not separate prints. XLRE is not on the JPM monitor.

Vault packs on disk:

| Week | Friday | What it is | Basis |
|---|---|---|---|
| 2026-W42 | 2026-10-16 | Filed pack | Ref chart 06-Oct-26 (JPM) |
| 2026-W43 | 2026-10-23 | Filed pack | Ref chart 06-Oct-26 (JPM) |
| 2026-W44 | 2026-10-30 | Carry-forward of 2026-10-23 | Carry-forward · ref chart 06-Oct-26 (JPM) · last Desk freeze Oct 23 |

W42, W43, and W44 share one JPM basis, 06-Oct-26. W44 copies the Oct 23 Desk freeze. It is not a new sector print. There is no pack for any Friday before 2026-10-16.

A search of this repo, its git history, and the 2026-11-01 research note found no digitized JPM sector percentile table for Jul–Sep 2026 (W29–W41). The earliest authentic sector basis on file is that 06-Oct-26 monitor. Extending `WEEKS` or the JPM arrays would invent week-over-week prints. Those files were not edited.

To grow the window toward about three months, each new Friday needs its own recorded JPM sector percentile (one number per printed sector that week). A carry-forward applies only to a later Friday that has no fresh print, and only by copying a filed Desk freeze, the way W44 copies W43. It cannot be run backward to invent W29–W41. Soft vol needs the same kind of recorded residual if that chart lengthens with the weeks. MS, GS, and BoA lengthen only from their own prints, or from a desk lock that the current offsets still apply. Each new pack is a separate document: the pack schema caps a chart snapshot at eight weeks, and the read and the six chart articles are written by hand. `src/desk.js` is locked to the same eight weeks, so a longer `WEEKS` list also needs a real value for every indicator on every new week.

## Spot Vol Beta — CSR does not feed the formula

`public/data/vault/spot-vol-beta/series.json` already runs 2026-08-03 through 2026-10-29 (63 session closes), about three months. The chart’s first axis label is Aug 3. Earlier points were not rewritten.

The desk estimate in `src/vault-svb.js` is `UV_Δ − (−0.70 × SPX%)`. That number is the estimate close. It is not the gauge (`svb`), which the schema requires on every point. The Oct 30 gauge file keeps them apart: gauge 2.98, desk estimate 2.57. The schema says not to fill the estimate from the gauge. The gauge is not filled from the formula either.

`public/data/vault/credit-spread-regime/csr.json` does have SPX and VIX closes from 2023-10-31 through 2026-10-29. Those columns were compared with the 63 committed Spot Vol Beta closes. They are not the same history:

- SPX level matches on 0 of 63 dates. On 2026-10-29 the credit file’s SPX close is 7720.39 and the Spot Vol Beta close is 6874.40.
- Daily SPX percent over the 62 sessions after the first close: correlation −0.17, same sign on 26 of 62 days.
- On the 10 closes that store `uvDelta`, correlation with the credit file’s VIX close-to-close change is 0.14.
- The four stored VIX close moves do not match that VIX change. 2026-09-02 is +1.6 in this series and −1.14 in the credit file. 2026-09-03 is +2.6 and −0.88. 2026-09-04 is +2.1 and +0.21. 2026-10-12 is +1.4 and +0.37.
- Correlation of the gauge with the formula applied to the credit file’s VIX change and SPX percent is −0.03.

Prepending those closes would splice a different SPX path onto the line and would invent the gauge. No estimate was added on closes that do not already store `uvDelta`. The credit file itself was not edited. Its SPX and VIX history is already the long series behind the Credit Spread Regime card.

To start the Spot Vol Beta line before 2026-08-03, each weekday session needs a recorded gauge close and an SPX close on the same scale as the existing overlay. Store `uvDelta` only when that input was written down at the close. Do not substitute the credit file’s VIX change. Store a VIX close move only when that move was recorded for this series.

## Market Health color board

The W29–W44 cells in `src/market-health.js` are the locked preview demo. They were not replaced. This repo has no percentile series for Global fund, Sharpies / COT, Put / Call, or NAAIM / risk appetite, so those rows were not backfilled from the research note.
