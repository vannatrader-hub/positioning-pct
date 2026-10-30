# Positioning %.

Phase 1 public reading of where sector positioning sits: soft, crowded, or somewhere between.

Figures are weekly snapshots committed with the site (`src/series.js` and `public/data/`), not a live feed.

Public sources are bank labels only: JPM, Morgan Stanley, BoA, GS, and a desk composite. The choice stays in this browser.

## Surfaces

Two surfaces, switched from the `Desk | Vault` control in every topbar:

- Desk. Everything live today: home, the Positioning hub and its desk, Options Flow and its subpages, SPX Levels. URLs stay where they are; Desk is the surface name, not a path.
- Vault (`/vault/`). Behind a sign-in wall. Signed out, the page shows one centered card ("Sign in to open Vault", email and password fields, a disabled "Create account · Coming soon", and a link back to the Desk) and nothing else. Signed in, it shows the private desk: a Soft ↔ Crowded weekly pack (`/vault/soft-crowded/`), the Vol · Credit · Momentum wall (`/vault/vol-credit-momentum/`, with the NY and Nasdaq Summation breadth cards), a Portfolio journal (`/vault/portfolio/`), three `Soon` preview tiles that do not link, and a panel pointing back to the Desk pages. The pack, the wall, and the journal are linked only from the Vault. It has its own darker theme scoped under `body.is-vault`. Sign-in is email and password for allowlisted emails only, and there is no checkout. See [Vault sign-in](#vault-sign-in).

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

Desk day: **12:00:00 AM America/Chicago → 11:59:59 PM the same calendar day** (half-open [midnight, next midnight)). `src/new-today-window.js` reads each stamp on the Chicago wall clock (`Intl.DateTimeFormat`, `timeZone: "America/Chicago"`); the item belongs to that calendar date, so 4:05 AM CT stays on the same desk day as the afternoon. The same file gives the window's midnight open with the CDT/CST offset in force, so the fall-back day runs 25 hours and the spring-forward day 23. The browser filters on every load and the chip goes quiet on its own at the midnight rollover.

Feed: `public/data/new-today.json`.

```json
{
  "timeZone": "America/Chicago",
  "dayStartsAt": "00:00",
  "dayStart": "2026-10-28T00:00:00-05:00",
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
- `sourceLabel`: `Desk`, `X`, `Bank note`, or a public bank or outlet label (`JPM`, `MS`, `GS`, `Goldman Sachs`, `BoA`, `Citi`, `UBS`, `Barclays`, `BNP`, `Nomura`, `Citadel`, `WSJ`, `Bloomberg`). The list lives in `SOURCE_LABELS`.
- `thumb` (optional, Research): a chart image committed under `public/data/new-today/thumbs/` or an `https` URL, with optional `thumbAlt`.

For desk pipelines (site refreshes, X pulls, bank notes, research charts): append items, set `dayStart` to `deskDayStart(deskDay(newest.publishedAt))` and `updatedAt` to the write time, keep about a week of desk days, and run `npm run check`. Public copy follows the same scrub as the rest of the site: research rows name the bank or a generic label, never the upstream service or author, and `npm run check` fails on a banned source name anywhere in the file. Live scraper wiring is not part of this page yet; the file ships with the Oct 27 and Oct 28 desk days seeded from site timestamps and an empty Research desk.

Options Flow data lives in `public/data/flow/`: `plays.json` is the Shopping List seed (with `industry.broad` / `industry.focus`), `bars/<TICKER>.json` holds committed daily bars (`t,o,h,l,c,v`), `spotlights.json` holds the Spotlight tickets by row (`active`, `open`, `closed`) with their daily bars in `bars/` too, and `scorecard.json` is the weekly board snapshot. Charts are drawn as SVG from committed data, so no page needs a chart service.

Each sector card shows the percentile, a status, and a Soft to Crowded bar; one timeframe select drives every card. Green is the soft end. Dark is crowded. The triangle marks that week’s print.

The Vault Portfolio journal (`/vault/portfolio/`) reads `public/data/vault/portfolio/journal.json` (`ahead-portfolio-journal-v1`). It is the locked personal book: category, structure, entry and exit, and the result. A line with status `exit_pending_fill` stays pending and out of the closed total until it fills. The Desk does not link to it.

The Vault Soft ↔ Crowded pack (`/vault/soft-crowded/`) reads `public/data/vault/soft-crowded/`. `schema.json` is the week document: sector buckets on the Soft ↔ Crowded scale, batch-1 chart refs, the one-page read, and a short article under each chart (`headline`, `bodyMarkdown`, `bias`, `dumbMoney`, `smartMoney`, `invalidation`). `index.json` names the latest week. `2026-10-23.json` is that week, seeded from the Desk’s JPM sector read for the same date. The chart cards link out to the public Positioning charts. The Desk does not link back.

The Vault Vol · Credit · Momentum wall (`/vault/vol-credit-momentum/`) carries five cards in order: Spot Vol Beta and Credit Spread Regime side by side (stacked under 1360px), then the MAG7 Oscillator, NY Summation, and Nasdaq Summation, each across the full width.

Spot Vol Beta (`src/vault-svb.js`) reads `public/data/vault/spot-vol-beta/`. `latest.json` is the gauge and the inputs for the desk estimate `UV_Δ − (−0.70 × SPX%)`; the card shows the gauge first and the estimate second. `series.json` is the daily close line, one point per session, appended at the close. SPX sits behind that line, and a band marks closes at or above 2. The committed gauge is not a live feed.

Credit Spread Regime (`src/vault-csr.js`) reads `public/data/vault/credit-spread-regime/csr.json`: FRED ICE BofA US High Yield OAS (`BAMLH0A0HYM2`) and US Corporate OAS (`BAMLC0A0CM`) in bps, the S&P 500 close (`SP500`), and the Cboe VIX close (`VIXCLS`), one column each, on S&P 500 sessions with OAS and VIX carried forward over gaps. `src/csr.js` scores the HY−IG excess spread (or HY alone): EMA 5, then Z against the trailing 252 sessions, percentile rank, 5-session momentum, and regimes Low (Z under −1), Normal, Elevated (1 and up), Stress (2 and up). `src/csr-chart.js` draws the pane on a canvas: per-session regime tint, zone fills, threshold lines, the glowing Z line, roll-over markers (red: Z 2 and up with the spread narrowing; green: Z −2 and down with it widening), and the SPX overlay with its own scale. The statistics panel is the last session. FRED serves the last three years of ICE BofA history, so Z starts one 252-session window after the first print. Refresh with `npm run data:csr`, then `npm run check`; the check recomputes the snapshot from the series and pins the Oct 29, 2026 panel (HY 326 / IG 89 / excess 237 / Z 1.85 Elevated, 95.2%, Risk-off).

The MAG7 Oscillator card:

- Math (`src/mag7-osc.js`, pure, shared with `npm run check`). Equal weight across AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, META. Each name's momentum is the % change over 14 sessions; the average is smoothed with a 5-session simple average. Bullish above +2, bearish below −2, neutral between. Breadth is the share of the seven with momentum above zero. Mode switches between MAG7, S&P EW (the equal-weight S&P 500 fund), and Relative (MAG7 minus S&P EW, ±1 thresholds). Type reshapes the smoothed line into Momentum (default), RSI, Stochastic, Williams %R, or CCI, each centred on zero.
- Pane (`src/mag7-chart.js`). Near-black chart room with a vertical band per bar in the regime colour, the line coloured by regime, the zero line, the ±threshold lines, and two dashed horizontals in the default MAG7 Momentum view: caution at +9 and stretched at −5. Right-hand value scale with last-value, caution, and stretched tags; month scale with the year on January; crosshair on hover, or arrow keys once the chart has focus.
- Stats panel. Value, Mode, Signal, Type, Breadth, Threshold for the last bar (plus the MAG7 and S&P EW legs in Relative), top right of the pane; under the plot on phones.
- Data (`public/data/vault/mag7/oscillator.json`). Split-adjusted daily closes for the seven names and RSP from Jan 2, 2024, so every type has settled before the default window opens on Jan 13, 2025. `asOf` and `lastBar` (`close` or `intraday`) describe the last bar; `snapshot` records what the panel should read and `npm run check` recomputes it. Refresh with `node scripts/vault-mag7-seed.mjs` (last session close) or `node scripts/vault-mag7-seed.mjs --at HH:MM` (today's 5-minute bar at that CT time as the last bar).

Card copy uses Desk labels only. The cards are redrawn from committed data: no embedded chart widget, no third-party indicator source in the repo. `npm run check` fails on either.

The breadth cards on the same wall (`#nysi`, `#nasi`) are two end-of-day charts, NY Summation (NYSI) and Nasdaq Summation (NASI), the ratio-adjusted McClellan Summation Index for each exchange. Each chart frame follows the familiar EOD layout: symbol and name header with Open / High / Low / Close / Chg for the hovered session, an SPX pane on top for context, the summation line drawn black on rising sessions and red on falling ones, MA(8), right-axis value tags, and a horizontal **buy line at −1000** marked `BUY`. Defaults are daily bars (1D) over one year; presets (3M to 10Y) and a range slider run the window out to ten years, and the SPX pane can be hidden. `src/breadth.js` holds the math (MA, windows, ticks) and `src/vault-breadth.js` draws the SVG into the wall's `[data-breadth]` cards. Cards use desk labels only; no chart-vendor branding.

Data lives in `public/data/vault/breadth/`: `index.json` (as-of date, `period`, `defaultRangeMonths`, `maxRangeMonths`, chart list), `nysi.json` and `nasi.json` (label, title, `ma`, `buyLine`, and daily `bars` as `{t, c}`), and `spx.json` (SPX daily closes on the same sessions). The seed runs eleven years through Oct 29, 2026 so the ten-year window has its MA lead-in. To refresh after the close:

```bash
BREADTH_FEED="<desk EOD text feed>" npm run pull:breadth
npm run check
```

The feed address is kept in env, never in a committed file. `npm run check` pins the Oct 29, 2026 prints (NYSI −504.41, NASI −699.51 with MA(8) −769.33, SPX 7720.39), the 1Y / 10Y defaults, and the −1000 buy line.

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

- Key set. Allowlisted emails sign in with email and password through Clerk (`@clerk/clerk-js`, loaded on demand). Everything happens on this page with no redirect, and the wall swaps for the Vault with a quiet "Signed in as … / Sign out" line. `/vault/`, `/vault/soft-crowded/`, `/vault/vol-credit-momentum/`, and `/vault/portfolio/` share the same gate.
- Key empty. Same card, but sign-in is switched off and the card says so. Clerk is left out of the build entirely.

Rules the wall follows:

- Only emails in `src/vault-allowlist.js` are sent to Clerk. Any other email gets "That email is not on the Vault list" and nothing leaves the browser. To add someone, follow the comment at the top of that file.
- The wall never signs anyone up. There is no sign-up call, no email link, no sign-up transfer, and no waitlist. **Create account** is shown disabled as **Coming soon**. New people are added as users in the Clerk Dashboard.
- If Clerk asks for a code on a new device (`needs_client_trust`) or a second step (`needs_second_factor`), the same card asks for the 6-digit code from the email (or an authenticator app).
- **Set or reset password** sends a 6-digit code to an allowlisted email and sets a new password on the same card. Use it when an account has no password yet.

To set this up with Clerk's Hobby plan (no cost, up to 50,000 monthly retained users):

1. Create an application at [dashboard.clerk.com](https://dashboard.clerk.com) with **Email** as the identifier and **Password** turned on.
2. Under **Restrictions**, set sign-up to **Restricted** and add allowlisted emails, so Clerk itself refuses new accounts.
3. Create each Vault user under **Users → Create user** (email and password), or set a password on an existing user from that user's page.
4. Copy the publishable key from **API keys**. Locally: `cp .env.example .env.local`, paste it into `VITE_CLERK_PUBLISHABLE_KEY`, and restart `npm run dev`. `.env.local` is git-ignored.
5. For GitHub Pages: **Settings → Secrets and variables → Actions → Variables → New repository variable**, name `VITE_CLERK_PUBLISHABLE_KEY`. The Pages workflow passes it to the build. Re-run **Deploy to GitHub Pages**.
6. Keep `https://vannatrader-hub.github.io/positioning-pct/vault/`, `https://vannatrader-hub.github.io/positioning-pct/vault/soft-crowded/`, `https://vannatrader-hub.github.io/positioning-pct/vault/vol-credit-momentum/`, and `https://vannatrader-hub.github.io/positioning-pct/vault/portfolio/` in the Clerk allowed origins and redirect URLs. Password sign-in does not redirect, but sign-out and any later SSO do.

Password sign-in replaced the magic link because a link has to come back through a redirect. On `github.io` the development instance keeps the session in the dev-browser token (`__clerk_db_jwt`), and links opened in another browser, or a new email that Clerk turned into a sign-up transfer, left Vault on the signed-out wall.

A publishable key is meant to ship in browser code, but it still lives only in env and repo settings, never in a committed file. Clerk secret keys (`sk_…`) are never needed by this site. Clerk production instances need a domain you own; on `github.io`, use the development instance key until the site moves to its own domain.

The gate is a client-side UX lock for GitHub Pages, not access control. The Vault page and its template still ship in the public static build, so anyone can read them from the source or the `dist` files. Before Vault carries anything that must stay private, move hosting to Vercel or Cloudflare (Pages/Workers) and gate Vault on the server (Clerk middleware or an edge check of the session), so Vault HTML, data, and assets are only served to signed-in users and are not part of the public bundle.

## GitHub Pages

Pushes to `main` run `.github/workflows/pages.yml`. The workflow builds the Vite site with base path `/positioning-pct/` and deploys the `dist` folder to GitHub Pages.

Live URL: https://vannatrader-hub.github.io/positioning-pct/

If the site is not public yet, a repo admin opens **Settings → Pages → Build and deployment → Source: GitHub Actions**, then re-runs **Deploy to GitHub Pages**. That settings control is the one step automation cannot always click.

## Fonts

Bodoni Moda (SIL Open Font License) and Inter (SIL Open Font License). License texts are in `src/fonts/`.
