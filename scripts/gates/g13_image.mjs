// G13 image-presence & diversity (반려축① 이미지 0 — §4.11 G13-A + §7.3 G13-B 단일 게이트)
// 사용: node g13_image.mjs <projectDir>   (image-manifest.json + copy.json + assets/)
// A: 래스터 플로어 — (a)커버 래스터(하드) (b)R ≥ ⌈N_elig×0.5⌉(§8.5 WARN 운용) (c)선언≠산출 방지(하드) (d)N_elig==0 면제
// B: 패턴 존재·다양성 법칙1~6(하드)
// exit 0 pass · 1 fail · 2 warn-only
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadJSON, CFG, arg } from "./lib.mjs";

const proj = resolve(arg(0, "."));
const manifest = loadJSON(join(proj, "image-manifest.json"));
const IC = CFG.image;
const fails = [], warns = [];
const cards = manifest.cards || [];
const N = cards.length;

// ── G13-B 법칙1~4·6: 패턴 선언·레이어 실존·스크림·1카드1패턴 ──
const rasterOf = (m) => {
  const bgOk = m.bg?.out && existsSync(join(proj, m.bg.out));
  const cutOk = m.cutout?.out && existsSync(join(proj, m.cutout.out));
  return { bgOk, cutOk, any: bgOk || cutOk };
};
for (const m of cards) {
  if (!IC.valid_patterns.includes(m.pattern)) { fails.push(`card-${m.index}: 법칙1 pattern 무효 '${m.pattern}'`); continue; }
  const r = rasterOf(m);
  if (["A", "G"].includes(m.pattern) && !r.bgOk) fails.push(`card-${m.index}: 법칙2 pattern ${m.pattern}인데 bg 실PNG 없음`);
  if (["B", "C"].includes(m.pattern) && !r.cutOk) fails.push(`card-${m.index}: 법칙2 pattern ${m.pattern}인데 cutout 실PNG 없음`);
  if (["D", "E"].includes(m.pattern) && !r.bgOk && !m.graphic) fails.push(`card-${m.index}: 법칙2 pattern ${m.pattern}인데 그래픽 노드/실PNG 모두 없음`);
  if (m.pattern === "A" && !m.scrim) fails.push(`card-${m.index}: 법칙3 pattern A인데 scrim=false`);
}
// 법칙5 — 시퀀스 다양성(하드)
const pats = cards.map((m) => m.pattern);
const distinct = new Set(pats).size;
const needDistinct = Math.ceil(N * IC.g13b.distinct_min_ratio);
if (distinct < needDistinct) fails.push(`법칙5: 패턴 distinct ${distinct} < ⌈N/3⌉=${needDistinct}`);
// F비율은 '바레텍스트' 상한 — 차트/dispnum(viz:true)은 F여도 시각물이라 제외(데이터 티어 정합, 2026-07-05 실측)
const fBare = cards.filter((m) => m.pattern === "F" && !m.viz).length;
const fRatio = fBare / Math.max(1, N);
if (fRatio > IC.g13b.typo_only_max_ratio) fails.push(`법칙5: 바레텍스트 F 비율 ${(fRatio * 100).toFixed(0)}% > 50% (viz 제외 ${fBare}/${N})`);
let run = 1;
for (let i = 1; i < N; i++) {
  run = pats[i] === pats[i - 1] ? run + 1 : 1;
  if (run > IC.g13b.max_consecutive_same) { fails.push(`법칙5: 패턴 ${pats[i]} ${run}연속 (허용 ${IC.g13b.max_consecutive_same})`); break; }
}

// ── G13-A 래스터 플로어 ──
const elig = cards.filter((m) => IC.g13a.eligible_patterns.includes(m.pattern));
const R = cards.filter((m) => rasterOf(m).any).length;
const cover = cards.find((m) => m.index === 1);
if (IC.g13a.cover_requires_raster && cover && !rasterOf(cover).any)
  fails.push(`G13-A(a): 커버(card-1, pattern ${cover.pattern}) 래스터 실파일 없음 — 하드`);
for (const m of cards) { // (c) 선언≠산출 방지(하드)
  if (m.bg?.gen && !existsSync(join(proj, m.bg.out))) fails.push(`G13-A(c): card-${m.index} bg gen:true인데 실파일 없음`);
  if (m.cutout?.gen && !existsSync(join(proj, m.cutout.out))) fails.push(`G13-A(c): card-${m.index} cutout gen:true인데 실파일 없음`);
}
if (elig.length > 0) { // (b) 플로어 — WARN 운용(§8.5)
  const need = Math.ceil(elig.length * IC.g13a.floor_ratio);
  if (R < need) {
    const msg = `G13-A(b): 래스터 ${R} < ⌈${elig.length}×${IC.g13a.floor_ratio}⌉=${need}`;
    (IC.g13a.floor_ratio_enforce === "hard" ? fails : warns).push(msg);
  }
} // (d) N_elig==0 → (b) 면제, 법칙5 다양성은 위에서 이미 강제

if (fails.length) { console.log(`✗ G13 image FAIL (${fails.length}):`); fails.forEach((f) => console.log("   -", f)); warns.forEach((w) => console.log("   ~", w)); process.exit(1); }
if (warns.length) { console.log(`△ G13 image WARN (${warns.length}):`); warns.forEach((w) => console.log("   ~", w)); process.exit(2); }
console.log(`✓ G13 image PASS (${N}장, 래스터 ${R}/${elig.length}, 패턴 ${[...new Set(pats)].join("/")})`); process.exit(0);
