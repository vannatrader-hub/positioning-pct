#!/usr/bin/env node
/**
 * Appends one Soft Vol cash close and rewrites latest.json.
 *
 *   npm run soft-vol:close -- --date 2026-11-03 --vix 19.00 --spx 6700.00,6701.00,... (21 closes)
 *
 * Formula: Soft Vol = VIX close − HV20(SPX), rounded to 0.1.
 * HV20: 21 SPX closes, oldest first, last close is the session.
 *       20 log returns → sample standard deviation (n−1) → × √252 × 100,
 *       rounded to 0.01, then subtracted from the VIX close.
 * Bucket: Soft Vol ≤ −0.4 · Fair between · Stretched ≥ +0.4.
 *
 * Official cash close only. Equity cash close is 4:00 PM ET (3:00 PM CT).
 * The VIX close follows, about 4:15 PM ET (3:15 PM CT). A pass around 3:30 CT
 * can still be ahead of those official prints. If this script runs before the
 * official VIX close and SPX close are out, run it again after they print:
 *
 *   npm run soft-vol:close -- --date <same session> --vix <official> --spx <21 closes> --replace-last
 *
 * and re-commit. --replace-last rewrites only the last session, and only when
 * --date is that session. A date before the last session is refused.
 *
 * This series does not read underlying-vol change or the Vol Stress close.
 * Vol Stress stays on scripts/svb-close.mjs.
 *
 * Closes: pass the official cash prints. The 2026-10-30 seed was reconstructed
 * from Yahoo Finance chart API daily closes (^VIX and ^GSPC). This script does
 * not fetch. Do not invent a session.
 *
 * --vix          VIX close for the session
 * --spx          21 SPX closes, comma-separated, oldest first
 * --recorded-at  ISO time with offset; defaults to now in Central time
 * --replace-last rewrite the last point when --date is that session
 * --dir          data folder; defaults to public/data/vault/soft-vol
 * --dry-run      print the point and latest.json without writing
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSoftVolClose, latestFrom } from "../src/soft-vol.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) throw new Error(`unexpected argument ${key}`);
    const name = key.slice(2);
    if (name === "dry-run" || name === "help" || name === "replace-last") {
      args[name] = true;
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${key} needs a value`);
    args[name] = value;
    i += 1;
  }
  return args;
}

function centralNow(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZoneName: "longOffset",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const offset = parts.timeZoneName.replace("GMT", "") || "+00:00";
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}

function spxCloses(value) {
  if (value === undefined) throw new Error("--spx needs 21 closes, comma-separated, oldest first");
  const closes = value.split(",").map((part) => Number(part.trim()));
  if (closes.length !== 21 || closes.some((close) => !Number.isFinite(close))) {
    throw new Error("--spx needs 21 numeric SPX closes, oldest first");
  }
  return closes;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]);
    return;
  }
  if (args.vix === undefined) throw new Error("--vix is required: the VIX close for the session");
  const vix = Number(args.vix);
  if (!Number.isFinite(vix)) throw new Error(`--vix ${args.vix} is not a number`);
  const dir = args.dir ? resolve(args.dir) : join(root, "public/data/vault/soft-vol");
  const seriesPath = join(dir, "series.json");
  const latestPath = join(dir, "latest.json");
  const series = JSON.parse(readFileSync(seriesPath, "utf8"));
  const recordedAt = args["recorded-at"] ?? centralNow();
  const point = buildSoftVolClose(series.points.at(-1), {
    date: args.date,
    vix,
    spxCloses: spxCloses(args.spx),
    recordedAt,
    replaceLast: Boolean(args["replace-last"]),
  });
  const nextLatest = latestFrom(point, recordedAt);
  const replaced = series.points.at(-1)?.date === point.date;

  if (args["dry-run"]) {
    console.log(JSON.stringify({ point, latest: nextLatest, replaced }, null, 2));
    return;
  }
  if (replaced) series.points[series.points.length - 1] = point;
  else series.points.push(point);
  writeFileSync(seriesPath, `${JSON.stringify(series, null, 2)}\n`);
  writeFileSync(latestPath, `${JSON.stringify(nextLatest, null, 2)}\n`);
  console.log(`${replaced ? "replaced" : "appended"} ${point.date} close: Soft Vol ${point.softVol >= 0 ? "+" : ""}${point.softVol.toFixed(1)} ${point.bucket}`);
}

try {
  main();
} catch (error) {
  console.error(`soft-vol:close ${error.message}`);
  process.exit(1);
}
