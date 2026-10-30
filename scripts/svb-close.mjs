#!/usr/bin/env node
/**
 * Appends one Spot Vol Beta session close for the Vault wall.
 *
 *   npm run svb:close -- --date 2026-11-02 --svb 1.92 --spx 6801.25 --uv-delta 2.10 --vix-move 1.4
 *
 * --svb       Spot Vol Beta gauge at the close (primary reading)
 * --spx       SPX close
 * --uv-delta  underlying vol change at the close, for the desk estimate close
 * --vix-move  VIX close-to-close move in points; 2 or more is a formal vol event
 * --recorded-at  ISO time with offset; defaults to now in Central time
 * --dir       data folder; defaults to public/data/vault/spot-vol-beta
 * --dry-run   print the point and latest.json without writing
 *
 * series.json gets the close appended (origin close-routine). latest.json is
 * rewritten to the same close with closed true. Earlier points are never
 * touched; a date at or before the last close is refused.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildClose, formatSession } from "../src/vault-svb.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) throw new Error(`unexpected argument ${key}`);
    const name = key.slice(2);
    if (name === "dry-run" || name === "help") {
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

function num(args, name) {
  if (args[name] === undefined) return undefined;
  const value = Number(args[name]);
  if (!Number.isFinite(value)) throw new Error(`--${name} ${args[name]} is not a number`);
  return value;
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]);
    return;
  }
  const dir = args.dir ? resolve(args.dir) : join(root, "public/data/vault/spot-vol-beta");
  const seriesPath = join(dir, "series.json");
  const latestPath = join(dir, "latest.json");
  const series = JSON.parse(readFileSync(seriesPath, "utf8"));
  const latest = JSON.parse(readFileSync(latestPath, "utf8"));

  if (args["uv-delta"] === undefined) throw new Error("--uv-delta is required: every routine close stores the desk estimate beside the gauge");
  const recordedAt = args["recorded-at"] ?? centralNow();
  const point = buildClose(
    series.points.at(-1),
    {
      date: args.date,
      svb: num(args, "svb"),
      spx: num(args, "spx"),
      uvDelta: num(args, "uv-delta"),
      vixCloseMove: num(args, "vix-move"),
      recordedAt,
    },
    series.deskBeta,
  );

  const time = recordedAt.slice(11, 16);
  const nextLatest = {
    ...latest,
    session: point.date,
    asOf: recordedAt,
    asOfLabel: `${formatSession(point.date, { weekday: true })} · ${time} CT · session close`,
    closed: true,
    gauge: point.svb,
    uvDelta: point.estimate.uvDelta,
    spxPct: point.estimate.spxPct,
    spx: point.spx,
  };

  if (args["dry-run"]) {
    console.log(JSON.stringify({ point, latest: nextLatest }, null, 2));
    return;
  }
  series.points.push(point);
  writeFileSync(seriesPath, `${JSON.stringify(series, null, 2)}\n`);
  writeFileSync(latestPath, `${JSON.stringify(nextLatest, null, 2)}\n`);
  console.log(`appended ${point.date} close: gauge ${point.svb}${point.estimate ? `, desk estimate ${point.estimate.value}` : ""}`);
}

try {
  main();
} catch (error) {
  console.error(`svb:close ${error.message}`);
  process.exit(1);
}
