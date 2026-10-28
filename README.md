# Positioning %.

Phase 1 public reading of where sector positioning sits: soft, crowded, or somewhere between.

Education only. Not advice. Nothing on the site names a size, and nothing on the site is a prompt to act. Figures are weekly snapshots in a sample file, not a live source.

Public sources are bank labels only: JPM, Morgan Stanley, BoA, GS, and a desk composite. The choice stays in this browser.

## Pages

- Home. Three destinations. Each tile opens its own page.
- Positioning. Eleven Select Sector cards, a soft-to-crowded map, and a soft-vol gauge.
- SPX Levels. Placeholder for this phase.
- Options Flow (`/options-flow/`). A hub with three calling cards, each opening its own page:
  - $$$ watchlist (`/options-flow/dollar/`). The last three weeks, newest alert first, with alert date and time (CT) on every row. Each row opens a calling card: condensed flow, Customer purchased (the most recent customer trade named in the alert, hidden when there is none), flow in open interest, and a Recommendation on the left; a trade-levels chart on the right (about six months of daily closes, the lead option strike, and break-even when the premium is known). Old `/options-flow/#TICKER` links forward here.
  - Spotlight trades (`/options-flow/spotlights/`). Live Spotlight tickets in three dropdown rows: Active (open, inside the current October window, expanded by default), Open (still open, posted earlier), and Closed (banked with a link to the public close note, or expired worthless at OpEx). Each card opens the idea, the structure, and a Recommendation on the left; on the right, the same six-month line chart as the $$$ calling cards, with the ticket's stop, strike, break-even, and target drawn across the price path, the expiry rule, and markers where the ticket posted and closed.
  - Weekly scorecard (`/options-flow/scorecard/`). The dark flow board: names ranked by composite (0.65 flow / 0.35 tech), each row opening a trade card with flow intelligence panels and a six-month price chart, plus the Spotlight watch strip. Advisory only.

Options Flow data lives in `public/data/flow/`: `plays.json` is the watchlist seed, `bars/<TICKER>.json` holds committed daily bars (`t,o,h,l,c,v`), `spotlights.json` holds the Spotlight tickets by row (`active`, `open`, `closed`) with their daily bars in `bars/` too, and `scorecard.json` is the weekly board snapshot. Charts are drawn as SVG from committed data, so no page needs a chart service.

Each sector card shows the percentile, a timeframe, a status, and a Soft to Crowded bar. Green is the soft end. Dark is crowded. The triangle marks that week’s print.

## Develop

```bash
npm install
npm run check
npm run dev
```

Open http://localhost:5173/positioning-pct/

```bash
npm run build
npm run preview
```

Preview serves the production build at http://127.0.0.1:4173/positioning-pct/

## GitHub Pages

Pushes to `main` run `.github/workflows/pages.yml`. The workflow builds the Vite site with base path `/positioning-pct/` and deploys the `dist` folder to GitHub Pages.

Live URL: https://vannatrader-hub.github.io/positioning-pct/

If the site is not public yet, a repo admin opens **Settings → Pages → Build and deployment → Source: GitHub Actions**, then re-runs **Deploy to GitHub Pages**. That settings control is the one step automation cannot always click.

## Fonts

Bodoni Moda (SIL Open Font License) and Inter (SIL Open Font License). License texts are in `src/fonts/`. The weekly scorecard also uses IBM Plex Sans and IBM Plex Mono (SIL Open Font License), bundled from the `@fontsource` packages at build time.
