/**
 * Builds or refreshes one Soft ↔ Crowded pack week from the committed Desk series.
 *
 *   npm run pack:build -- 2026-10-23
 *
 * Writes public/data/vault/soft-crowded/<week>.json and its row in index.json.
 * The Desk-derived parts (buckets, chart snapshots, facts) are rewritten from
 * src/vault-pack-frame.js. The written parts (read, articles) are kept when the
 * file exists; a new week starts with empty ones, and `npm run check` fails
 * until they are filled in.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WEEKS } from "../src/readings.js";
import { packFrame } from "../src/vault-pack-frame.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "public/data/vault/soft-crowded");
const week = process.argv[2] ?? WEEKS[WEEKS.length - 1];

if (!WEEKS.includes(week)) {
  console.error(`${week} is not a Desk week. Desk weeks: ${WEEKS.join(", ")}`);
  process.exit(1);
}

const file = join(dir, `${week}.json`);
const prior = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
const frame = packFrame(week);

const emptyRead = {
  kicker: `${frame.isoWeek} · week of ${frame.weekLabel}`,
  headline: "",
  lede: "",
  stance: "",
  softened: "",
  crowded: "",
  backdrop: "",
  moved: [""],
  watch: [""],
  nextWeek: ["", "", ""],
};
const emptyArticle = { headline: "", bodyMarkdown: "", bias: "neutral", dumbMoney: "", smartMoney: "", invalidation: "" };

const doc = {
  $schema: "./schema.json",
  ...frame,
  read: { ...emptyRead, ...(prior?.read ?? {}) },
  charts: {
    ...frame.charts,
    refs: frame.charts.refs.map((ref) => ({
      ...ref,
      article: prior?.charts?.refs?.find((old) => old.id === ref.id)?.article ?? { ...emptyArticle },
    })),
  },
};
writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);

const indexFile = join(dir, "index.json");
const index = JSON.parse(readFileSync(indexFile, "utf8"));
const rows = (index.weeks ?? []).filter((row) => row.week !== week);
const counts = Object.fromEntries(frame.buckets.map((bucket) => [bucket.level, bucket.sectors.length]));
rows.push({
  week,
  isoWeek: frame.isoWeek,
  title: frame.title,
  weekLabel: frame.weekLabel,
  file: `${week}.json`,
  headline: doc.read.headline,
  counts,
});
rows.sort((a, b) => (a.week < b.week ? 1 : -1));
index.weeks = rows;
index.latest = rows[0].week;
writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`);

console.log(`wrote ${week}.json (${frame.isoWeek}); index lists ${rows.map((row) => row.isoWeek).join(", ")}`);
