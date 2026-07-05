// G15 hierarchy-depth & emphasis-budget (반려축③ 계층 없음 — §7.5)
// 사용: node g15_hierarchy.mjs <copy.json> <slotsDir>
// 법칙1 고계층 최소깊이(role≥3 AND 크기·굵기 클러스터≥3, §8.2) FAIL / 법칙2 저계층 상한(≤2) WARN /
// 법칙3 티어 대비 2축(크기1.4x·weightΔ200·fg명도 — role 티어그룹 headline→body→meta 기준, §3.6 정답예시 정합 해석) FAIL /
// 법칙4 강조예산 ≤2 FAIL / 법칙5 accent ≤1종(A7=2·A14=3 예외) FAIL / 법칙6 출처 무강조 FAIL
// exit 0 pass · 1 fail · 2 warn-only
import { existsSync } from "node:fs";
import { loadJSON, contrastRatio, CFG, arg } from "./lib.mjs";
import { join } from "node:path";

const copy = loadJSON(arg(0, "copy.json"));
const slotsDir = arg(1, "out");
const H = CFG.hierarchy;
const FG_CR_MIN = H.tier_contrast_fg_cr_min ?? 1.2;
const fails = [], warns = [];
const GROUPS = [["headline", "bignum"], ["body", "subhead"], ["supplement", "caption", "source"]]; // kicker·cta-pill=장치 제외
const ROLE_SLOTS = new Set(GROUPS.flat().concat(["kicker"]));

for (const c of copy.cards || []) {
  const idx = String(c.index).padStart(2, "0");
  const p = join(slotsDir, `card-${idx}.slots.json`);
  if (!existsSync(p)) { fails.push(`card-${idx}: slots.json 결손 — fail-closed`); continue; }
  const slots = loadJSON(p).filter((s) => ROLE_SLOTS.has(s.slot));
  const arch = c.archetype || "";
  const tier = H.high_archetypes.includes(arch) ? "high" : H.low_archetypes.includes(arch) ? "low" : "mid";

  // 법칙1·2 — 깊이
  const roleCount = new Set(slots.map((s) => s.slot)).size;
  const clusters = new Set(slots.map((s) => `${Math.round(s.font_px / 4) * 4}|${(s.font_weight || 400) >= 600}`)).size;
  if (tier === "high" && (roleCount < 3 || clusters < 3))
    fails.push(`card-${idx}(${arch}): 고계층인데 role ${roleCount}/클러스터 ${clusters} < 3 (축③ 반려)`);
  if (tier === "low" && roleCount > 2)
    warns.push(`card-${idx}(${arch}): 저계층인데 role ${roleCount} > 2 (표지 dense 남발 경계)`);
  if (tier === "mid" && roleCount < 2)
    warns.push(`card-${idx}(${arch}): 중계층인데 role ${roleCount} < 2`);

  // 법칙3 — 인접 티어그룹 2축 대비 (headline→body→meta 대표 슬롯쌍)
  const reps = GROUPS.map((g) => slots.filter((s) => g.includes(s.slot)).sort((a, b) => b.font_px - a.font_px)[0]).filter(Boolean);
  for (let i = 0; i + 1 < reps.length; i++) {
    const a = reps[i], b = reps[i + 1];
    let axes = 0;
    if (a.font_px / b.font_px >= H.tier_contrast_size_ratio) axes++;
    if (Math.abs((a.font_weight || 400) - (b.font_weight || 400)) >= H.tier_contrast_weight_delta) axes++;
    try { if (contrastRatio(a.fg, b.fg) >= FG_CR_MIN) axes++; } catch {}
    if (axes < H.tier_contrast_axes_min)
      fails.push(`card-${idx}: 티어대비 ${a.slot}(${a.font_px}/${a.font_weight})↔${b.slot}(${b.font_px}/${b.font_weight}) ${axes}축 < ${H.tier_contrast_axes_min}`);
  }

  // 법칙4·5·6 — 강조
  const emphTotal = slots.reduce((n, s) => n + (s.emph_count || 0), 0);
  if (emphTotal > H.emphasis_budget) fails.push(`card-${idx}: 강조 ${emphTotal} > 예산 ${H.emphasis_budget} (전체강조=강조없음)`);
  const accents = new Set(slots.flatMap((s) => s.emph_colors || []));
  const accMax = (H.accent_max_exceptions || {})[arch] ?? H.accent_max_per_card;
  if (accents.size > accMax) fails.push(`card-${idx}: 강조 accent ${accents.size}종 > ${accMax}`);
  const src = slots.find((s) => s.slot === "source");
  if (src && (src.emph_count || 0) > 0) fails.push(`card-${idx}: 출처 강조 금지 위반`);
}
if (fails.length) { console.log(`✗ G15 hierarchy FAIL (${fails.length}):`); fails.forEach((f) => console.log("   -", f)); warns.forEach((w) => console.log("   ~", w)); process.exit(1); }
if (warns.length) { console.log(`△ G15 hierarchy WARN (${warns.length}):`); warns.forEach((w) => console.log("   ~", w)); process.exit(2); }
console.log(`✓ G15 hierarchy PASS (${(copy.cards || []).length} cards)`); process.exit(0);
