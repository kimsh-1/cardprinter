// G16 sequence-diversity & density-wave (반려축④ 획일 — §7.6)
// 사용: node g16_diversity.mjs <copy.json>
// 법칙3(고정슬롯)·archetype 결손 = 하드 FAIL. 법칙1(다양성)·2(연속)·4(웨이브)는 §8.5 정책상
// 캘리브레이션 전 enforce=warn → exit 2. 법칙5(rail)는 인라인 override 검출 시 FAIL.
// exit 0 pass · 1 fail · 2 warn-only
import { loadJSON, CFG, arg } from "./lib.mjs";

const copy = loadJSON(arg(0, "copy.json"));
const D = CFG.diversity;
const hardMode = D.enforce === "hard";
const fails = [], warns = [];
const derived = (msg) => (hardMode ? fails : warns).push(msg);

const cards = copy.cards || [];
const N = cards.length;
const seq = cards.map((c) => c.archetype);
seq.forEach((a, i) => { if (!CFG.archetype.values.includes(a)) fails.push(`card[${i + 1}] archetype 결손/무효: ${a} (S2 계약 §8.4)`); });
if (!fails.length) {
  // 법칙3 — 고정슬롯 (착수부터 하드)
  if (seq[0] !== D.cover_archetype) fails.push(`법칙3: seq[0]=${seq[0]} ≠ ${D.cover_archetype}`);
  if (!D.close_archetypes.includes(seq[N - 1])) fails.push(`법칙3: seq[last]=${seq[N - 1]} ∉ ${D.close_archetypes}`);

  // 법칙1 — 다양성
  const counts = {}; seq.forEach((a) => (counts[a] = (counts[a] || 0) + 1));
  const distinct = Object.keys(counts).length;
  const needDistinct = Math.ceil(N * D.distinct_min_ratio);
  if (distinct < needDistinct) derived(`법칙1: distinct ${distinct} < ⌈N×${D.distinct_min_ratio}⌉=${needDistinct}`);
  const H = -Object.values(counts).reduce((a, n) => a + (n / N) * Math.log2(n / N), 0);
  const shannon = N > 1 ? H / Math.log2(N) : 1;
  if (shannon < D.shannon_norm_min) derived(`법칙1: normalized_shannon ${shannon.toFixed(2)} < ${D.shannon_norm_min}`);

  // 법칙2 — 동일 아키타입 연속 ≤3 (4연속 FAIL — §2.6 통일값)
  let run = 1;
  for (let i = 1; i < N; i++) {
    run = seq[i] === seq[i - 1] ? run + 1 : 1;
    if (run > D.max_consecutive_same) { derived(`법칙2: ${seq[i]} ${run}연속 (허용 ${D.max_consecutive_same})`); break; }
  }

  // 법칙4 — 밀도웨이브: 고밀도 런 뒤 3장 내 밸리 (말미 wave_tail_exempt 면제)
  const isHigh = (a) => D.high_density.includes(a);
  const isValley = (a) => D.low_density.includes(a) || D.wave_valley_extra.includes(a);
  let hRun = 0;
  for (let i = 0; i < N; i++) {
    hRun = isHigh(seq[i]) ? hRun + 1 : 0;
    if (hRun > D.wave_run_max) { derived(`법칙4: 고밀도 ${hRun}연속 > ${D.wave_run_max}`); break; }
    const runEnds = hRun >= D.max_consecutive_same && !(i + 1 < N && isHigh(seq[i + 1]));
    if (runEnds && N - 1 - i > D.wave_tail_exempt) {
      const win = seq.slice(i + 1, i + 1 + D.wave_valley_within);
      if (!win.some(isValley)) derived(`법칙4: 고밀도 런 종료(카드${i + 1}) 후 ${D.wave_valley_within}장 내 밸리 없음`);
    }
  }

  // 법칙5 — consistency rail: 인라인 색/폰트 override 금지(팔레트·폰트는 tokens 단일 소유)
  cards.forEach((c, i) => {
    if (c.style_override || c.color || c.font) fails.push(`법칙5: card[${i + 1}] 인라인 스타일 override 금지(rail)`);
  });
}
if (fails.length) { console.log(`✗ G16 diversity FAIL (${fails.length}):`); fails.forEach((f) => console.log("   -", f)); warns.forEach((w) => console.log("   ~", w)); process.exit(1); }
if (warns.length) { console.log(`△ G16 diversity WARN (${warns.length}, §8.5 캘리브레이션 전):`); warns.forEach((w) => console.log("   ~", w)); process.exit(2); }
console.log(`✓ G16 diversity PASS (${N}장, distinct=${new Set(seq).size})`); process.exit(0);
