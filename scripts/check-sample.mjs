import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReading, ordinal } from "../src/readings.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;

function assert(condition, message) {
  if (condition) return;
  failed += 1;
  console.error(`FAIL ${message}`);
}

const reading = buildReading("jpm", 7, 4);
const expected = {
  XLF: { display: "0.18", pill: "extreme soft → easing", caption: "18th %ile · call skew soft", wow: "WoW −4 pts" },
  XLK: { display: "0.82", pill: "crowded → still building", caption: "82nd %ile · crowded", wow: "WoW +2 pts" },
  XLE: { display: "0.48", pill: "mid → firming", caption: "48th %ile · mid", wow: "WoW +1 pts" },
  XLV: { display: "0.28", pill: "soft → easing", caption: "28th %ile · soft", wow: "WoW −2 pts" },
  XLI: { display: "0.54", pill: "mid → firming", caption: "54th %ile · mid", wow: "WoW +1 pts" },
  XLY: { display: "0.74", pill: "crowded → still building", caption: "74th %ile · crowded", wow: "WoW +2 pts" },
  XLP: { display: "0.24", pill: "extreme soft → easing", caption: "24th %ile · soft", wow: "WoW −2 pts" },
  XLU: { display: "0.22", pill: "extreme soft → catching up", caption: "22nd %ile · soft", wow: "WoW +2 pts" },
  XLB: { display: "0.47", pill: "mid → easing", caption: "47th %ile · mid", wow: "WoW −1 pts" },
  XLRE: { display: "0.81", pill: "crowded → still building", caption: "81st %ile · crowded", wow: "WoW +1 pts" },
  XLC: { display: "0.49", pill: "mid → firming", caption: "49th %ile · mid", wow: "WoW +1 pts" },
};

assert(Object.keys(reading.sectors).length === 11, "expected 11 sector funds");
for (const [ticker, want] of Object.entries(expected)) {
  const got = reading.sectors[ticker];
  assert(got, `${ticker} missing`);
  if (!got) continue;
  assert(got.display === want.display, `${ticker} display ${got.display} !== ${want.display}`);
  assert(got.pill === want.pill, `${ticker} pill "${got.pill}" !== "${want.pill}"`);
  assert(got.caption === want.caption, `${ticker} caption "${got.caption}" !== "${want.caption}"`);
  assert(got.wowText === want.wow, `${ticker} wow "${got.wowText}" !== "${want.wow}"`);
}

assert(reading.volDisplay === "1.4", `soft vol display ${reading.volDisplay}`);
assert(reading.volName === "Soft Vol", `soft vol name ${reading.volName}`);
assert(reading.weekLabel === "Oct 23, 2026", `week label ${reading.weekLabel}`);
assert(ordinal(18) === "18th" && ordinal(22) === "22nd" && ordinal(21) === "21st", "ordinals");

const desk = buildReading("desk", 7, 4);
assert(desk.sectors.XLF.points !== reading.sectors.XLF.points, "desk composite should blend banks");
assert(desk.sourceLabel === "Desk composite", "desk label");

const eight = buildReading("jpm", 7, 8);
assert(eight.sectors.XLF.pill === "extreme soft → easing", "8-week XLF still easing");
assert(eight.sectors.XLU.pill === "extreme soft → catching up", "8-week XLU still catching up");

const banned = ["sentiment ai", "wallstjesus", "optionshawk", "volland", "copy-trading", "copy trading"];
const scanExt = new Set([".html", ".js", ".css", ".md", ".yml", ".svg"]);

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".git" || name === "fonts") continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
      continue;
    }
    if (!scanExt.has(extname(name))) continue;
    const text = readFileSync(path, "utf8").toLowerCase();
    for (const phrase of banned) {
      assert(!text.includes(phrase), `${path} contains forbidden phrase "${phrase}"`);
    }
  }
}

walk(root);

const css = readFileSync(join(root, "src/styles.css"), "utf8");
assert(!css.includes("sparkline"), "stylesheet should not define a sparkline treatment");
const page = readFileSync(join(root, "src/positioning.js"), "utf8");
assert(page.includes("Soft") && page.includes("Crowded"), "cards render Soft and Crowded labels");
assert(!page.includes("linear-gradient(90deg, #3"), "no blue-green card fill");

if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log("sample readings ok");
