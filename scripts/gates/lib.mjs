// Shared helpers for card-shorts hard gates. Each gate exits 0 (pass) or 1 (fail).
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const CFG = JSON.parse(readFileSync(join(HERE, "gate-config.json"), "utf8"));

export function loadJSON(p) {
  if (!existsSync(p)) fail(`input not found: ${p}`);
  try { return JSON.parse(readFileSync(p, "utf8")); }
  catch (e) { fail(`invalid JSON ${p}: ${e.message}`); }
}

// Count grapheme-ish length: Korean syllable = 1, ignore spaces? We count visible chars incl spaces
// but excluding leading/trailing whitespace, to match "글자수" intent (spaces count as layout width).
export function charLen(s) {
  if (s == null) return 0;
  return [...String(s).trim()].length;
}

export function relLuminance(hex) {
  const h = String(hex).replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrastRatio(a, b) {
  const [L1, L2] = [relLuminance(a), relLuminance(b)].sort((x, y) => y - x);
  return (L1 + 0.05) / (L2 + 0.05);
}

const errors = [];
export function check(cond, msg) { if (!cond) errors.push(msg); }
export function fail(msg) { console.error(`  ✗ ${msg}`); process.exit(1); }

export function done(gateName) {
  if (errors.length) {
    console.error(`✗ ${gateName} FAIL (${errors.length})`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`✓ ${gateName} PASS`);
  process.exit(0);
}

export function arg(i, fallback) { return process.argv[2 + i] ?? fallback; }
