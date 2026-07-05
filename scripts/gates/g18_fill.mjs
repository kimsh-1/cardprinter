// G18 fill: 세로점유·죽은공간 게이트 (감사 ★2·★4 — 상단몰림 물리 봉쇄, 2026-07-05)
// 사용: node g18_fill.mjs <projectDir>
// 콘텐츠 세그먼트(slots bbox + cutout frame + 상단분할 bg) 병합 → span ≥ span_min AND 최대 갭(엣지 포함) ≤ max_gap.
// 풀블리드 bg 카드 면제(이미지가 캔버스 담당) · 저밀도 밸리 type은 apply_types로 면제 · slots 결손 = fail-closed.
import { existsSync } from "node:fs";
import { loadJSON, CFG, arg } from "./lib.mjs";
import { join } from "node:path";

const proj = arg(0, ".");
const copy = loadJSON(join(proj, "copy.json"));
const F = CFG.fill;
const [safeT, safeB] = CFG.safe_zone.carousel_4_5.y;
const safeH = safeB - safeT;
const fails = [];

for (const c of copy.cards || []) {
  if (!F.apply_types.includes(c.type)) continue;
  const idx = String(c.index).padStart(2, "0");
  if (c.bg && c.image_pattern !== "G") continue; // 풀블리드
  const sp = join(proj, "out", `card-${idx}.slots.json`);
  if (!existsSync(sp)) { fails.push(`card-${idx}: slots.json 결손 — fail-closed`); continue; }
  const segs = loadJSON(sp).filter((s) => s.bbox).map((s) => [s.bbox[1], s.bbox[1] + s.bbox[3]]);
  const cp = join(proj, "out", `card-${idx}.cutouts.json`);
  if (existsSync(cp)) for (const k of loadJSON(cp).cutouts || []) segs.push([k.frame_bbox[1], k.frame_bbox[3]]);
  if (c.image_pattern === "G" && c.bg) segs.push([safeT, F.bg_top_px]);
  const m = segs.map(([a, b]) => [Math.max(a, safeT), Math.min(b, safeB)]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  if (!m.length) { fails.push(`card-${idx}: 콘텐츠 세그먼트 0 — fail-closed`); continue; }
  const merged = [];
  for (const s of m) { const last = merged[merged.length - 1]; if (last && s[0] <= last[1] + 1) last[1] = Math.max(last[1], s[1]); else merged.push([...s]); }
  const top = merged[0][0], bot = merged[merged.length - 1][1];
  const span = (bot - top) / safeH;
  let maxGap = Math.max(top - safeT, safeB - bot);
  for (let i = 0; i + 1 < merged.length; i++) maxGap = Math.max(maxGap, merged[i + 1][0] - merged[i][1]);
  const gapR = maxGap / safeH;
  if (span < F.span_min_ratio) fails.push(`card-${idx}(${c.type}): 세로 span ${(span * 100).toFixed(0)}% < ${F.span_min_ratio * 100}% (미채움)`);
  if (gapR > F.max_gap_ratio) fails.push(`card-${idx}(${c.type}): 최대 죽은공간 ${(gapR * 100).toFixed(0)}% > ${F.max_gap_ratio * 100}% (${Math.round(maxGap)}px)`);
}
if (fails.length) { console.log(`✗ G18 fill FAIL (${fails.length}):`); fails.forEach((f) => console.log("   -", f)); process.exit(1); }
console.log(`✓ G18 fill PASS`); process.exit(0);
