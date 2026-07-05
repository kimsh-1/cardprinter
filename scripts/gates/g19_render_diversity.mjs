// G19 render-diversity: 아키타입 실렌더 계약 게이트 (감사 ★1·★3 — 라벨≠픽셀 봉쇄, 2026-07-05)
// 사용: node g19_render_diversity.mjs <projectDir>
// 카드별: 렌더된 slots 구조가 archetype 기대 시그니처(expected)와 일치해야 함 — 라벨만 A2인데 DOM이 dense면 FAIL.
// 전역: 구조지문(슬롯 multiset) 종수 ≥ min(라벨 아키타입 종수, distinct_fp_min). slots 결손 = fail-closed.
import { existsSync } from "node:fs";
import { loadJSON, CFG, arg } from "./lib.mjs";
import { join } from "node:path";

const proj = arg(0, ".");
const copy = loadJSON(join(proj, "copy.json"));
const RD = CFG.render_diversity;
const fails = [], fps = new Map();

for (const c of copy.cards || []) {
  const idx = String(c.index).padStart(2, "0");
  const sp = join(proj, "out", `card-${idx}.slots.json`);
  if (!existsSync(sp)) { fails.push(`card-${idx}: slots.json 결손 — fail-closed`); continue; }
  const count = {};
  for (const s of loadJSON(sp)) count[s.slot] = (count[s.slot] || 0) + 1;
  const fp = Object.entries(count).sort().map(([k, n]) => `${k}:${n}`).join(",");
  fps.set(fp, (fps.get(fp) || 0) + 1);
  const exp = RD.expected[c.archetype];
  if (!exp) continue;
  if (exp.slot && (count[exp.slot] || 0) < exp.min_count)
    fails.push(`card-${idx}(${c.archetype}): 실렌더 계약 위반 — slot '${exp.slot}' ${count[exp.slot] || 0}개 < ${exp.min_count} (라벨만 ${c.archetype})`);
  if (exp.any_slot && !exp.any_slot.some((s) => count[s]))
    fails.push(`card-${idx}(${c.archetype}): 실렌더 계약 위반 — [${exp.any_slot.join(",")}] 슬롯 전무`);
}
const distinctArch = new Set((copy.cards || []).map((c) => c.archetype)).size;
const needFp = Math.min(distinctArch, RD.distinct_fp_min);
if (fps.size < needFp) fails.push(`전역: 렌더 구조지문 ${fps.size}종 < ${needFp} (라벨 ${distinctArch}종인데 실렌더 획일)`);
if (fails.length) { console.log(`✗ G19 render-diversity FAIL (${fails.length}):`); fails.forEach((f) => console.log("   -", f)); process.exit(1); }
console.log(`✓ G19 render-diversity PASS (구조지문 ${fps.size}종 / ${(copy.cards || []).length}장)`); process.exit(0);
