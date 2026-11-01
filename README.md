# Positioning %.

Phase 1 public reading of where sector positioning sits: soft, crowded, or somewhere between.

Figures are weekly snapshots committed with the site (`src/series.js` and `public/data/`), not a live feed.

Public sources are bank labels only: JPM, Morgan Stanley, BoA, GS, and a desk composite. The choice stays in this browser.

## Surfaces

Two surfaces, switched from the `Dashboard | Vault` control in every topbar. `/insight/` only tells the reader the old surface moved, then opens the Dashboard.

- Dashboard (`/`). Public, no login. Positioning hub, the Soft ↔ Crowded desk, the six charts, trade ideas, a New Today chip, the Market Health Snapshot (a weekly Soft ↔ Crowded color board under the Pulse read; the cells are a demo pattern until the breadth series is wired), and the vol wall widgets on the page: Vol Stress, Credit Spread Regime, the MAG7 Oscillator, NY and Nasdaq Summation, NY Highs − Lows, and NY Advance − Decline. Options Flow, Spotlights, and Portfolio are not on this surface. SPX Levels is an unlinked placeholder.
- Vault (`/vault/`). Behind a sign-in wall. Signed out, the page shows one centered card ("Sign in to open Vault", email and password fields, a disabled "Create account · Coming soon", and a link back to Dashboard) and nothing else. Signed in, it has everything on the Dashboard plus Options Flow (`/options-flow/`, Shopping List, Spotlights, and the scorecard), the Desk mock book (`/vault/portfolio/`), the Soft ↔ Crowded weekly pack (`/vault/soft-crowded/`), and the desk-day archive (`/vault/archive/`). The full wall page remains at `/vault/vol-credit-momentum/`. Three preview tiles open short Coming soon notes (`/coming-soon/`). It has its own darker theme scoped under `body.is-vault`. Sign-in is email and password for allowlisted emails only (`src/vault-allowlist.js`), and there is no checkout. See [Vault sign-in](#vault-sign-in).

**Access model:**
- `VAULT_ALLOWLIST` (`src/vault-allowlist.js`): Emails that can open Vault, including Options Flow and the mock book.

Reports, flow files, and the vol wall read one set of files under `public/data/` and the render modules in `src/`. Change a feed once and every page that reads it updates on the next deploy. The book file is read only from Vault. `src/product-feeds.js` is the map. Do not keep a second copy of a feed.

Surface chrome (home, hubs, Vault, 404, and every topbar and footer) never carries monetization words or `$` outside the `$$$` flow mark; `npm run check` enforces this along with the two-surface switcher on every page.

## Pages

Site nav, in order: Positioning | Options Flow | SPX Levels.

- Home. Three destinations. Each tile opens its own page: Positioning and Options Flow open hubs of calling cards.
- Positioning (`/positioning/`). A hub with four calling cards, each opening the Soft ↔ Crowded desk at a real section id from `SECTIONS` in `src/desk.js`:
  - Soft ↔ Crowded (`/positioning/desk/#sectors`). Eleven Select Sector cards grouped into four columns on the Soft ↔ Crowded scale (Extreme soft, Soft, Mid, Crowded) and a soft-to-crowded map, with JPM the default house for sector bars.
  - Credit (`/positioning/desk/#credit`). CDX, BBB minus AAA, and high yield versus investment grade.
  - Options & Soft Vol (`/positioning/desk/#vol`). The Soft Vol ↔ Stretched gauge, customer calls versus puts, and the vol panic index.
  - Full desk (`/positioning/desk/`). The desk at a glance plus all ten categories, source chips, the history slider, and Trade Ideas for sectors that are very soft or very crowded. Old `/positioning/?source=…` and `/positioning/#section` links forward here.
  - Trade ideas (`/positioning/ideas/`). This week's Soft ↔ Crowded read and a short idea under each chart, on the public Dashboard. The Vault pack keeps the archived weeks.
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
- New Today (`/new-today/`). A catch-up directory of what landed on the public desk this desk day, linked from the Dashboard chip. The public page lists Positioning, SPX Levels, and the Research desk, and stamps when the feed was updated. Options Flow rows stay out of that page. `← Earlier desk day` (`?day=YYYY-MM-DD`) steps back through days still in the file. A quiet day still shows the feed stamp.

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

### Desk-day pack

Midnight, morning, and afternoon auto-ship each call the same builder, then `npm run check`. A second run with the same inputs does not write. `unchanged` means the routine stays silent and opens no PR.

```bash
npm run new-today:pack
npm run new-today:pack -- --dry-run
```

- **Midnight auto-ship.** Weekdays at 12:00 AM CT (±15 min). Runs `npm run new-today:pack`.
- **Morning auto-ship.** Weekdays at 6:30 AM CT (±15 min). Runs `npm run new-today:pack`.
- **Afternoon auto-ship.** Weekdays, after session artifacts have landed. Hook it to the vol close routine (about 3:30 PM CT) so a later gauge and any session note still append on that desk day. Runs `npm run new-today:pack`.

Weekend quiet is Friday 3:00 PM CT through Sunday 5:00 PM CT. Those routines do not run.

The builder reads the last-ship stamp, the flow-post watcher, the chart-note watcher, the Soft ↔ Crowded vault index, and the Vol Stress latest stamp. It diffs them against this file, appends America/Chicago desk-day rows, dedupes by `id`, sorts newest first, sets `dayStart` from the newest row, and sets `updatedAt` to the write time only when the list changes. The last-ship stamp is reported and does not hide a row that is still missing, so a note that landed after the morning ship is not stuck behind that stamp. About eight desk days stay in the file. Paths and the overrides `NEW_TODAY_LAST_SHIP`, `NEW_TODAY_FLOW_POSTS`, `NEW_TODAY_FLOW_SEEN`, `NEW_TODAY_CHART_STATE`, and `NEW_TODAY_CHART_DIRS` live in `scripts/new-today-pack.mjs`.

New rows use Desk, a bank or outlet from `SOURCE_LABELS`, or X. A row is written only when a file on disk has a title, a summary, and a timestamp. Seen ids with no post body, and a chart-note file with no titled note, are logged as gaps and do not become rows.

The 2026-11-01 wire-up did not have the box watcher roots mounted, so Oct 30 and Oct 31 session lines (wraps, flow tickets, chart notes) were not backfilled. Two Positioning rows did come from committed Oct 30 vault files: the W44 Soft ↔ Crowded pack (sector columns carried forward from the Oct 23 freeze, stamped with that week's `asOf`) and the Vol Stress gauge at 12:18 CT (2.98, intraday, not a session close). Oct 31 has no on-disk note, so that desk day stays empty.

Public copy follows the same scrub as the rest of the site: research rows name the bank or a generic label, never the upstream service or author, and `npm run check` fails on a banned source name anywhere in the file.

Options Flow data lives in `public/data/flow/`: `plays.json` is the Shopping List seed (with `industry.broad` / `industry.focus`), `bars/<TICKER>.json` holds committed daily bars (`t,o,h,l,c,v`), `spotlights.json` holds the Spotlight tickets by row (`active`, `open`, `closed`) with their daily bars in `bars/` too, and `scorecard.json` is the weekly board snapshot. Charts are drawn as SVG from committed data, so no page needs a chart service.

Each sector card shows the percentile, a status, and a Soft to Crowded bar; one timeframe select drives every card. Green is the soft end. Dark is crowded. The triangle marks that week’s print.

The desk's theme cards on the Soft ↔ Crowded scale name their direction against the middle of the bar: **Stretching** when the percentile moves away from mid over the timeframe, **Unwinding** when it moves back toward mid, and steady under 3 points. Custom-scale cards (bar ends such as Unwinding ↔ Extending, Easing ↔ Tightening or Net sold ↔ Net bought) chip their own level word only (`unwinding`, `mid`, `net sold`) and never borrow Stretching / Unwinding; their move is on the card's change line. `npm run check` fails if a custom-scale chip carries that drift vocabulary. A card on the Soft ↔ Crowded scale at or under the 25th percentile gets a soft green glow and one at or over the 90th gets a magenta glow (`extremeOf` in `src/desk.js`, `--sc-glow-*` tokens in `src/styles.css`). The glow follows the level only, never the direction, and is a shadow rather than an outline. If most cards glow, tighten the thresholds; `npm run check` fails when more than a third do.

The Vault Portfolio journal (`/vault/portfolio/`) reads `public/data/vault/portfolio/journal.json` (`ahead-portfolio-journal-v1`). It is the Desk mock book: a 50,000 start. Spotlights and Featured Options Radar are sized to a 4,000 ticket. Earnings Snapshot, Weekly Radar Earnings Preview, and Weekly Radar Credit Spread of the Week are 1 contract. Dollars on the page come from that line's ticket, not from a brokerage fill. Open lines land on the Open tab and filled lines land on the Closed tab from `status`. A line with status `open` (or outcome `open`) is still held and stays out of the closed total. A line with status `exit_pending_fill` stays pending, on the Open tab, and out of the closed total until it fills. The book path and the week strip sit above the tabs. The Dashboard does not link to it.

The journal copy is shown through `deskCopy` in `src/vault-portfolio.js`, which turns source names in the locked file into ticket wording and drops any line that would still name one. The board reads, top to bottom:

- A week strip for the journal's own ISO week (from `summary.as_of_ct`, not the browser clock): closed PnL, wins and losses, and the tickers closed that week, plus the open count.
- Open lines (`Still held`) with entry, stop, and target from the journal (`stop_stock`, else the ticket stop; the same for target).
- The full table.

Marks are optional per trade: `mtm_price`, `mtm_pnl_usd`, and `mtm_as_of_ct`, each a value or `null` (`public/data/vault/portfolio/schema.json`). Until a line carries them the mark reads `—` and the line stays `Open`. The week strip only totals open marks when every open line is marked. Nothing on the page computes a mark from a quote.

The Vault Soft ↔ Crowded pack (`/vault/soft-crowded/`) reads `public/data/vault/soft-crowded/`. `schema.json` is the week document: sector buckets on the Soft ↔ Crowded scale, batch-1 chart refs, the one-page read, and a short article under each chart (`headline`, `bodyMarkdown`, `bias`, `dumbMoney`, `smartMoney`, `invalidation`). `index.json` lists the weeks newest first and names the latest; each week is titled by ISO week (`2026-W43 Soft ↔ Crowded`) and stamped as of that Friday's open (`asOf` is `05:00` Central on the Friday). `2026-10-23.json` (W43) and `2026-10-16.json` (W42) are seeded from the Desk’s JPM sector read for those Fridays. Each document freezes the six batch-1 charts as they stood that week (`snapshot`), so an older pack never redraws with later prints. Once a Friday is on the Desk, `npm run pack:build -- 2026-10-30` writes that week's frame (buckets, moves, snapshot) and its `index.json` row. The read and the articles are written by hand and kept on a rebuild; `npm run check` fails until they are filled in, and it rebuilds the frame and compares it.

The page opens on the latest week; `?week=2026-W42` (or `?week=2026-10-16`) opens an older one, and the week bar switches between them. `Print / Save as PDF` prints the read on page one and one chart with its article per page after that. The Vault home lists the packs, latest first. The chart cards link out to the public Positioning charts. The Dashboard does not link back to the pack.

The desk-day archive (`/vault/archive/`, `src/vault-archive.js`) is an index over data already in the build: one Soft ↔ Crowded entry per committed Desk Friday (linking to the pack when the week has one, else to that week on the Dashboard) and one entry per New Today desk day from `public/data/new-today.json`, grouped by ISO week, newest first. Search takes a date (`2026-10-28`, `Oct 28`, `10/28`), an ISO week (`W44`, `2026-W44`), or words (all must match; a desk day is cut to its matching lines), and the filter narrows to packs or New Today. A week past the last committed Friday says its print is not committed yet. The query stays in the URL (`?q=W44&kind=day`). New Today on Dashboard shows only the current day.

The Vol · Credit · Momentum widgets render on the public Dashboard and again on `/vault/vol-credit-momentum/`. Vol Stress is the desk number. At or above 2 is a possible bottom. The session chart plots that close with the S&P 500 on its own scale, and marks closes at or above 2. The gauge and the longer close read stay off the public page. NY Highs − Lows and NY Advance − Decline sit under the summation cards.

Vol Stress (`src/vault-svb.js`) reads `public/data/vault/spot-vol-beta/`. `latest.json` holds the gauge and the inputs for the desk number. `series.json` is one close per session, appended at the close. The committed print is not a live feed.

Under the plate, `Session closes` shows the latest close of both numbers, labeled `Spot Vol Beta · gauge close` and `desk estimate close`, and a table of the last ten sessions with SPX, SPX %, the VIX close move, the close read, and who entered it (`Seeded` or `Close routine`). The vol event rule is the same as the gauge band: a gauge close at 2 or more is in the band, and a formal vol event is close-based (VIX up 2 points or more close to close). The ten closes through Oct 29, 2026 are seeded with their desk estimate inputs.

A weekday routine (about 3:30 PM CT, after the cash close) appends one close:

```bash
npm run svb:close -- --date 2026-11-02 --svb 1.92 --spx 6801.25 --uv-delta 2.10 --vix-move 1.4
```

`scripts/svb-close.mjs` computes SPX % from the previous point and the estimate from `uvDelta`, appends to `series.json`, rewrites `latest.json` as that close (`closed: true`), and refuses a date that is not after the last point. `--dry-run` prints without writing. Each appended point looks like this (`estimate` is left out when UV_Δ was not recorded):

```json
{
  "date": "2026-11-02",
  "svb": 1.92,
  "spx": 6801.25,
  "vixCloseMove": 1.4,
  "origin": "close-routine",
  "recordedAt": "2026-11-02T15:55:00-06:00",
  "estimate": { "uvDelta": 2.1, "spxPct": 0.14, "value": 2.2 }
}
```

`schema.json` is the shape, and `index.json` carries the same routine notes.

Above the cards, a `Data as of` strip names each card's last committed session and how many sessions behind the desk day it is. It reads the committed files only and never stands in a quote for a missing one.

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

- Key set. Allowlisted emails sign in with email and password through Clerk (`@clerk/clerk-js`, loaded on demand). Everything happens on this page with no redirect, and the wall swaps for the Vault with a quiet "Signed in as … / Sign out" line. `/vault/`, `/vault/soft-crowded/`, `/vault/vol-credit-momentum/`, `/vault/portfolio/`, and `/vault/archive/` share the same gate.
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
6. Keep `https://vannatrader-hub.github.io/positioning-pct/vault/`, `https://vannatrader-hub.github.io/positioning-pct/vault/soft-crowded/`, `https://vannatrader-hub.github.io/positioning-pct/vault/vol-credit-momentum/`, `https://vannatrader-hub.github.io/positioning-pct/vault/portfolio/`, and `https://vannatrader-hub.github.io/positioning-pct/vault/archive/` in the Clerk allowed origins and redirect URLs. Password sign-in does not redirect, but sign-out and any later SSO do.

Password sign-in replaced the magic link because a link has to come back through a redirect. On `github.io` the development instance keeps the session in the dev-browser token (`__clerk_db_jwt`), and links opened in another browser, or a new email that Clerk turned into a sign-up transfer, left Vault on the signed-out wall.

A publishable key is meant to ship in browser code, but it still lives only in env and repo settings, never in a committed file. Clerk secret keys (`sk_…`) are never needed by this site. Clerk production instances need a domain you own; on `github.io`, use the development instance key until the site moves to its own domain.

The gate is a client-side UX lock for GitHub Pages, not access control. The Vault page and its template still ship in the public static build, so anyone can read them from the source or the `dist` files. Before Vault carries anything that must stay private, move hosting to Vercel or Cloudflare (Pages/Workers) and gate Vault on the server (Clerk middleware or an edge check of the session), so Vault HTML, data, and assets are only served to signed-in users and are not part of the public bundle.

## GitHub Pages

Pushes to `main` run `.github/workflows/pages.yml`. The workflow builds the Vite site with base path `/positioning-pct/` and deploys the `dist` folder to GitHub Pages.

Live URL: https://vannatrader-hub.github.io/positioning-pct/

If the site is not public yet, a repo admin opens **Settings → Pages → Build and deployment → Source: GitHub Actions**, then re-runs **Deploy to GitHub Pages**. That settings control is the one step automation cannot always click.

## Fonts

Bodoni Moda (SIL Open Font License) and Inter (SIL Open Font License). License texts are in `src/fonts/`.
