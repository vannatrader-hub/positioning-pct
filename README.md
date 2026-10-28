# Positioning %.

Phase 1 public reading of where sector positioning sits: soft, crowded, or somewhere between.

Education only. Not advice. Nothing on the site names a size, and nothing on the site is a prompt to act. Figures are weekly snapshots in a sample file, not a live source.

Public sources are bank labels only: JPM, Morgan Stanley, BoA, GS, and a desk composite. The choice stays in this browser.

## Pages

- Home. Three destinations. Each tile opens its own page.
- Positioning. Eleven Select Sector cards, a soft-to-crowded map, and a soft-vol gauge.
- SPX Levels. Placeholder for this phase.
- Options Flow. A $$$ watchlist of the last three weeks, newest alert first, with alert date and time (CT) on every row. Each row opens a calling card: condensed flow, Customer purchased (the most recent customer trade named in the alert, hidden when there is none), flow in open interest, and a Recommendation on the left; a trade-levels chart on the right (about six months of daily closes, the lead option strike, and break-even when the premium is known).

Options Flow data lives in `public/data/flow/`: `plays.json` is the seed, and `bars/<TICKER>.json` holds committed daily bars (`t,o,h,l,c,v`). The chart is drawn as SVG from those closes, so the page needs no chart service.

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

Bodoni Moda (SIL Open Font License) and Inter (SIL Open Font License). License texts are in `src/fonts/`.
