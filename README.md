# Positioning %.

Phase 1 public reading of where sector positioning sits: soft, crowded, or somewhere between.

Figures are weekly snapshots committed with the site (`src/series.js` and `public/data/`), not a live feed.

Public sources are bank labels only: JPM, Morgan Stanley, BoA, GS, and a desk composite. The choice stays in this browser.

## Surfaces

Two surfaces, switched from the `Desk | Vault` control in every topbar:

- Desk. Everything live today: home, the Positioning hub and its desk, Options Flow and its subpages, SPX Levels. URLs stay where they are; Desk is the surface name, not a path.
- Vault (`/vault/`). Behind a sign-in wall. Signed out, the page shows one centered card ("Sign in to open Vault", an email field, and a link back to the Desk) and nothing else. Signed in, it shows the private desk: a Soft ↔ Crowded weekly pack (`/vault/soft-crowded/`), three `Soon` preview tiles that do not link, and a panel pointing back to the Desk pages. The pack is linked only from the Vault. It has its own darker theme scoped under `body.is-vault`. No password field and no checkout. See [Vault sign-in](#vault-sign-in).

Surface chrome (home, hubs, Vault, 404, and every topbar and footer) never carries monetization words or `$` outside the `$$$` flow mark; `npm run check` enforces this along with the switcher on every page.

## Pages

Site nav, in order: Positioning | Options Flow | SPX Levels.

- Home. Three destinations. Each tile opens its own page: Positioning and Options Flow open hubs of calling cards.
- Positioning (`/positioning/`). A hub with four calling cards, each opening the Soft ↔ Crowded desk at a real section id from `SECTIONS` in `src/desk.js`:
  - Soft ↔ Crowded (`/positioning/desk/#sectors`). Eleven Select Sector cards grouped into four columns on the Soft ↔ Crowded scale (Extreme soft, Soft, Mid, Crowded) and a soft-to-crowded map, with JPM the default house for sector bars.
  - Credit (`/positioning/desk/#credit`). CDX, BBB minus AAA, and high yield versus investment grade.
  - Options & Soft Vol (`/positioning/desk/#vol`). The Soft Vol ↔ Stretched gauge, customer calls versus puts, and the vol panic index.
  - Full desk (`/positioning/desk/`). The desk at a glance plus all ten categories, source chips, the history slider, and a Study desk that only tabs sectors meeting its criteria (JPM under 0.25 or 0.75 and up). Old `/positioning/?source=…` and `/positioning/#section` links forward here.
  - Under the four cards, a Charts row of six chart calling cards. Each has a live mini preview and fact line and opens its chart.
- Positioning charts (`/positioning/charts/`). Six reads redrawn as interactive Soft ↔ Crowded charts, sharing one eight-week history slider. Tapping a week on any chart moves every chart to that week. Each chart carries its house chip and basis, and links back to its desk section:
  - Soft Vol ↔ Stretched VIX (`#soft-vol`). A semicircle gauge and weekly residual columns, with house chips and a Compare houses overlay.
  - Sector Soft ↔ Crowded (`#sectors`). XLF to XLC columns on the four-bucket scale, with house chips, fund order or softest first, bucket highlights, and a detail panel showing the picked sector's eight-week path.
  - Broad equity positioning (`#broad-equity`). The JPM monitor's Equities percentile, with up to three other monitor lines to compare.
  - Credit stress (`#credit-stress`). CDX and BBB minus AAA as stacked level panels or one percentile view, plus high yield against investment grade.
  - Fund manager survey · crowded trades (`#fund-managers`). The survey's crowded-trade answers next to the crowded share or cash level by week, with the 4% cash line.
  - GS risk appetite (`#risk-appetite`). Risk appetite, the equity sentiment indicator, risky vs safe, and the short-term composite as tabs, each with its own chip.

  Chart data comes from `src/pct-charts.js`, which reads the same committed series as the desk (`src/series.js`, `INDICATORS` in `src/desk.js`), so a chart and its desk card always agree. Plots are SVG drawn by `src/chart-svg.js`. No source images are shown.
- Options Flow (`/options-flow/`). A hub with three calling cards, each opening its own page:
  - $$$ Shopping List (`/options-flow/dollar/`). The last three weeks, newest alert first, with each name's industry (broad sector, focus underneath) and alert date and time (CT) on every row. Each row opens a calling card: condensed flow, Customer purchased (the most recent customer trade named in the alert, hidden when there is none), flow in open interest, and a Recommendation on the left; a trade-levels chart on the right (about six months of daily closes, the lead option strike, and break-even when the premium is known). Old `/options-flow/#TICKER` links forward here.
  - Spotlight trades (`/options-flow/spotlights/`). Live Spotlight tickets in three dropdown rows: Active (open, inside the current October window, expanded by default), Open (still open, posted earlier), and Closed (banked with a link to the public close note, or expired worthless at OpEx). Each card opens the idea, the structure, and a Recommendation on the left; on the right, the same six-month line chart as the $$$ calling cards, with the ticket's stop, strike, break-even, and target drawn across the price path, the expiry rule, and markers where the ticket posted and closed. An empty row reads "None".
  - Weekly scorecard (`/options-flow/scorecard/`). Week meta and the composite blend up top, then names ranked by composite (0.65 flow / 0.35 tech) with their chips, why, trade dates, flow and tech scores, and a 30-session candle strip. A yellow star on the name marks an Active Spotlight. Each row opens a trade card: header tags, ticker / contract / timestamp, the analysis band, and the metric grid with the six-month chart on the left; Flow Intelligence on the right in order (trade summary, IV and open catalyst, OI and dealer levels, technical lines, fundamentals with three past and one upcoming earnings box, Spotlight). Sections without a live pull show an empty state rather than a number.
- SPX Levels. Placeholder for this phase.
- New Today (`/new-today/`). A catch-up directory of everything that landed on the Desk this desk day, opened from the small New Today chip in the home hero, to the right of the wordmark. Rows are grouped Positioning · Options Flow · SPX Levels · Research desk (or one flat All list), newest first, each with its time (CT), title, one-line summary, and a deep link; Research rows can carry a chart thumb. `← Earlier desk day` (`?day=YYYY-MM-DD`) steps back through days still in the file.

## New Today

The chip runs an RGB outline (a conic gradient turning around the border) with a soft pulse while the current desk day has at least one item, and sits on a quiet static outline when it has none. Motion stops under `prefers-reduced-motion`.

Desk day: **5:00 AM America/Chicago → 4:59:59 AM the next calendar day.** `src/new-today-window.js` reads each stamp on the Chicago wall clock (`Intl.DateTimeFormat`, `timeZone: "America/Chicago"`); if the hour is before 5, the item belongs to the previous calendar day's desk day. The same file gives the window's 5:00 AM open with the CDT/CST offset in force, so the fall-back night runs 25 hours and the spring-forward night 23. The browser filters on every load and the chip goes quiet on its own at the 5:00 AM rollover.

Feed: `public/data/new-today.json`.

```json
{
  "timeZone": "America/Chicago",
  "dayStartsAt": "05:00",
  "dayStart": "2026-10-28T05:00:00-05:00",
  "updatedAt": "2026-10-28T17:32:00-05:00",
  "items": [
    {
      "id": "2026-10-28-casy-dollar",
      "section": "options-flow",
      "title": "CASY joins the $$$ Shopping List",
      "summary": "One line on why it is new.",
      "href": "options-flow/dollar/#CASY",
      "publishedAt": "2026-10-28T08:40:00-05:00",
      "sourceLabel": "Desk",
      "thumb": "data/new-today/thumbs/example.png"
    }
  ]
}
```

- `section`: `positioning`, `options-flow`, `spx`, or `research`.
- `href`: site-relative without a leading slash (`options-flow/spotlights/#XYZ`, `positioning/charts/#sectors`); hash links open the matching card or chart. Research rows may link out over `https`, or carry only a `thumb`.
- `publishedAt`: when the item landed on the Desk, ISO with its offset. That stamp alone decides the desk day.
- `sourceLabel`: `Desk`, `X`, `Bank note`, or a bank label (`JPM`, `MS`, `GS`, `BoA`, `Citi`, `UBS`, `Barclays`, `BNP`, `Nomura`, `Citadel`, `WSJ`). The list lives in `SOURCE_LABELS`.
- `thumb` (optional, Research): a chart image committed under `public/data/new-today/thumbs/` or an `https` URL, with optional `thumbAlt`.

For desk pipelines (site refreshes, X pulls, bank notes, research charts): append items, set `dayStart` to `deskDayStart(deskDay(newest.publishedAt))` and `updatedAt` to the write time, keep about a week of desk days, and run `npm run check`. Public copy follows the same scrub as the rest of the site: research rows name the bank or a generic label, never the upstream service or author, and `npm run check` fails on a banned source name anywhere in the file. Live scraper wiring is not part of this page yet; the file ships with the Oct 27 and Oct 28 desk days seeded from site timestamps and an empty Research desk.

Options Flow data lives in `public/data/flow/`: `plays.json` is the Shopping List seed (with `industry.broad` / `industry.focus`), `bars/<TICKER>.json` holds committed daily bars (`t,o,h,l,c,v`), `spotlights.json` holds the Spotlight tickets by row (`active`, `open`, `closed`) with their daily bars in `bars/` too, and `scorecard.json` is the weekly board snapshot. Charts are drawn as SVG from committed data, so no page needs a chart service.

Each sector card shows the percentile, a status, and a Soft to Crowded bar; one timeframe select drives every card. Green is the soft end. Dark is crowded. The triangle marks that week’s print.

The Vault Soft ↔ Crowded pack (`/vault/soft-crowded/`) reads `public/data/vault/soft-crowded/`. `schema.json` is the week document: sector buckets on the Soft ↔ Crowded scale, batch-1 chart refs, and the one-page read. `index.json` names the latest week. `2026-10-23.json` is that week, seeded from the Desk’s JPM sector read for the same date. The chart cards link out to the public Positioning charts. The Desk does not link back.

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

## Vault sign-in

`vault/index.html` renders the wall by default and keeps the Vault content in an inert `<template id="vault-content">`. `src/vault-gate.js` decides what happens next, based on `VITE_CLERK_PUBLISHABLE_KEY` at build time:

- Key set. Clerk (`@clerk/clerk-js`, loaded on demand) sends a magic link to the email entered. Opening the link signs the visitor in and the wall swaps for the Vault, with a quiet "Signed in as … / Sign out" line. Known emails sign in; new emails sign up through the same link, or join the Clerk waitlist when sign-up is restricted.
- Key empty. Same card, but the button reads "Request access". The email is kept in this browser's `localStorage` (`positioning-pct-vault-requests`) and nothing is sent anywhere. Clerk is left out of the build entirely.

To turn on magic links with Clerk's Hobby plan (no cost, up to 50,000 monthly retained users):

1. Create an application at [dashboard.clerk.com](https://dashboard.clerk.com) with **Email** as the sign-in identifier.
2. Under the email settings, turn on **Email verification link** (magic link) for sign-in and sign-up. Password is optional and the wall never asks for one.
3. Optional: under **Restrictions**, set sign-up to Restricted or Waitlist (or add an allowlist) so only invited emails open Vault.
4. Copy the publishable key from **API keys**. Locally: `cp .env.example .env.local`, paste it into `VITE_CLERK_PUBLISHABLE_KEY`, and restart `npm run dev`. `.env.local` is git-ignored.
5. For GitHub Pages: **Settings → Secrets and variables → Actions → Variables → New repository variable**, name `VITE_CLERK_PUBLISHABLE_KEY`. The Pages workflow passes it to the build. Re-run **Deploy to GitHub Pages**.

A publishable key is meant to ship in browser code, but it still lives only in env and repo settings, never in a committed file. Clerk secret keys (`sk_…`) are never needed by this site. Clerk production instances need a domain you own; on `github.io`, use the development instance key until the site moves to its own domain.

The gate is a client-side UX lock for GitHub Pages, not access control. The Vault page and its template still ship in the public static build, so anyone can read them from the source or the `dist` files. Before Vault carries anything that must stay private, move hosting to Vercel or Cloudflare (Pages/Workers) and gate Vault on the server (Clerk middleware or an edge check of the session), so Vault HTML, data, and assets are only served to signed-in users and are not part of the public bundle.

## GitHub Pages

Pushes to `main` run `.github/workflows/pages.yml`. The workflow builds the Vite site with base path `/positioning-pct/` and deploys the `dist` folder to GitHub Pages.

Live URL: https://vannatrader-hub.github.io/positioning-pct/

If the site is not public yet, a repo admin opens **Settings → Pages → Build and deployment → Source: GitHub Actions**, then re-runs **Deploy to GitHub Pages**. That settings control is the one step automation cannot always click.

## Fonts

Bodoni Moda (SIL Open Font License) and Inter (SIL Open Font License). License texts are in `src/fonts/`.
