# Positioning %.

Phase 1 public reading of where sector positioning sits: soft, crowded, or somewhere between.

Figures are weekly snapshots committed with the site (`src/series.js` and `public/data/`), not a live feed.

Public sources are bank labels only: JPM, Morgan Stanley, BoA, GS, and a desk composite. The choice stays in this browser.

## Surfaces

Two surfaces, switched from the `Desk | Vault` control in every topbar:

- Desk. Everything live today: home, the Positioning hub and its desk, Options Flow and its subpages, SPX Levels. URLs stay where they are; Desk is the surface name, not a path.
- Vault (`/vault/`). The Phase 2 surface stub: a hero, three `Soon` preview tiles that do not link, and a panel pointing back to the Desk pages. It has its own darker theme scoped under `body.is-vault`. No sign-in, forms, or checkout.

Surface chrome (home, hubs, Vault, 404, and every topbar and footer) never carries monetization words or `$` outside the `$$$` flow mark; `npm run check` enforces this along with the switcher on every page.

## Pages

Site nav, in order: Positioning | Options Flow | SPX Levels.

- Home. Three destinations. Each tile opens its own page: Positioning and Options Flow open hubs of calling cards.
- Positioning (`/positioning/`). A hub with four calling cards, each opening the Soft ↔ Crowded desk at a real section id from `SECTIONS` in `src/desk.js`:
  - Soft ↔ Crowded (`/positioning/desk/#sectors`). Eleven Select Sector cards grouped into four columns on the Soft ↔ Crowded scale (Extreme soft, Soft, Mid, Crowded) and a soft-to-crowded map, with JPM the default house for sector bars.
  - Credit (`/positioning/desk/#credit`). CDX, BBB minus AAA, and high yield versus investment grade.
  - Options & Soft Vol (`/positioning/desk/#vol`). The Soft Vol ↔ Stretched gauge, customer calls versus puts, and the vol panic index.
  - Full desk (`/positioning/desk/`). The desk at a glance plus all ten categories, source chips, the history slider, and a Study desk that only tabs sectors meeting its criteria (JPM under 0.25 or 0.75 and up). Old `/positioning/?source=…` and `/positioning/#section` links forward here.
- Options Flow (`/options-flow/`). A hub with three calling cards, each opening its own page:
  - $$$ Shopping List (`/options-flow/dollar/`). The last three weeks, newest alert first, with each name's industry (broad sector, focus underneath) and alert date and time (CT) on every row. Each row opens a calling card: condensed flow, Customer purchased (the most recent customer trade named in the alert, hidden when there is none), flow in open interest, and a Recommendation on the left; a trade-levels chart on the right (about six months of daily closes, the lead option strike, and break-even when the premium is known). Old `/options-flow/#TICKER` links forward here.
  - Spotlight trades (`/options-flow/spotlights/`). Live Spotlight tickets in three dropdown rows: Active (open, inside the current October window, expanded by default), Open (still open, posted earlier), and Closed (banked with a link to the public close note, or expired worthless at OpEx). Each card opens the idea, the structure, and a Recommendation on the left; on the right, the same six-month line chart as the $$$ calling cards, with the ticket's stop, strike, break-even, and target drawn across the price path, the expiry rule, and markers where the ticket posted and closed. An empty row reads "None".
  - Weekly scorecard (`/options-flow/scorecard/`). Week meta and the composite blend up top, then names ranked by composite (0.65 flow / 0.35 tech) with their chips, why, trade dates, flow and tech scores, and a 30-session candle strip. A yellow star on the name marks an Active Spotlight. Each row opens a trade card: header tags, ticker / contract / timestamp, the analysis band, and the metric grid with the six-month chart on the left; Flow Intelligence on the right in order (trade summary, IV and open catalyst, OI and dealer levels, technical lines, fundamentals with three past and one upcoming earnings box, Spotlight). Sections without a live pull show an empty state rather than a number.
- SPX Levels. Placeholder for this phase.

Options Flow data lives in `public/data/flow/`: `plays.json` is the Shopping List seed (with `industry.broad` / `industry.focus`), `bars/<TICKER>.json` holds committed daily bars (`t,o,h,l,c,v`), `spotlights.json` holds the Spotlight tickets by row (`active`, `open`, `closed`) with their daily bars in `bars/` too, and `scorecard.json` is the weekly board snapshot. Charts are drawn as SVG from committed data, so no page needs a chart service.

Each sector card shows the percentile, a status, and a Soft to Crowded bar; one timeframe select drives every card. Green is the soft end. Dark is crowded. The triangle marks that week’s print.

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
