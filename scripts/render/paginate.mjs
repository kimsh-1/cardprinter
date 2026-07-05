#!/usr/bin/env node
// Tier-1 페이지네이터 + 밀도웨이브 엔진 (§5.1·§5.4) — 카드수를 LLM 추측이 아닌 산술로 확정.
// 사용: node paginate.mjs <projectDir> [--profile=4:5] [--apply-measure=<measure.json>]
// 입력: copy.json (S2 초안 계약)
//   { cover:{headline,subhead,kicker?}, cta:{headline,body?,cta_label?},
//     sections:[ { kicker?, headline, body, supplement?, source?, highlight_chars? } ],  ← 논리 블록(문단 경계)
//     stats?:[{number,unit?,caption,source?}], quotes?:[{text,attribution?}], bridges?:[{headline,subhead?}],
//     image_slots?: [n…] (A10 사전예약) }
// 출력: copy.json 갱신 — cards[]·card_count·card_count_derivation 산술 기입 (§5.5 스키마)
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SKILL = ROOT;
const PCFG = JSON.parse(readFileSync(join(SKILL, "references/pagination.config.json"), "utf8"));
const proj = resolve(process.argv[2] || ".");
const opts = Object.fromEntries(process.argv.slice(3).filter((a) => a.startsWith("--")).map((a) => a.replace(/^--/, "").split("=")));
const profile = PCFG.aspect_profiles[opts.profile || "4:5"];
const T = profile.threshold;
const copyPath = join(proj, "copy.json");
const copy = JSON.parse(readFileSync(copyPath, "utf8"));

const len = (s) => (s ? [...String(s).trim()].length : 0);
const RW = PCFG.role_weight;
// 섹션(소제목+본문 문단) 단위 가중치 — flat(L0/L5)은 threshold에 내장(§5.1 유도)
const secWeight = (s) => len(s.headline) * RW.headline_per_char + len(s.body) * RW.body_per_char
  + (s.highlight_chars || 0) * RW.highlight_extra_per_char + len(s.supplement) * RW.caption_per_char;
const secLines = (s) => Math.ceil(len(s.body) / PCFG.hard_caps.chars_per_line);

// ── Tier-1 그리디: 섹션(문단 경계)으로만 자름, 소제목 고아 금지 ──
function paginateBody(sections) {
  const cards = []; let cur = [], w = 0, lines = 0, chars = 0;
  for (const s of sections) {
    const wb = secWeight(s), lb = secLines(s), cb = len(s.body);
    const over = cur.length && (w + wb > T || lines + lb > profile.body_line_cap || chars + cb > PCFG.hard_caps.body_chars);
    if (over) { cards.push({ secs: cur, w }); cur = []; w = 0; lines = 0; chars = 0; }
    cur.push(s); w += wb; lines += lb; chars += cb;
  }
  if (cur.length) cards.push({ secs: cur, w });
  return cards;
}

// ── 밸리 선택(콘텐츠 파생 우선, §5.4) — 소스 없는 밸리는 날조 금지 → 폴백 체인 ──
const pools = { stats: [...(copy.stats || [])], quotes: [...(copy.quotes || [])], bridges: [...(copy.bridges || [])] };
function pickValley() {
  if (pools.stats.length) { const s = pools.stats.shift();
    return { type: "stat", archetype: "A4", viz_kind: "number", role: "valley", kicker: s.kicker, headline: String(s.number), unit: s.unit, body: s.caption, source: s.source, fact_refs: s.fact_refs || [] }; }
  if (pools.quotes.length) { const q = pools.quotes.shift();
    return { type: "quote", archetype: "A6", role: "valley", body: q.text, attribution: q.attribution, fact_refs: q.fact_refs || [] }; }
  if (pools.bridges.length) { const b = pools.bridges.shift();
    return { type: "hook", archetype: "A12", body_mode: "bridge", role: "valley", headline: b.headline, subhead: b.subhead, fact_refs: b.fact_refs || [] }; }
  return null; // 소스 없음 — 삽입 생략(G16 웨이브 WARN 감수, 날조 금지)
}

// ── 조립 ──
function build() {
  const bodyCards = paginateBody(copy.sections || []);
  const n_body_arith = bodyCards.length;
  const total_weight = Math.round((copy.sections || []).reduce((a, s) => a + secWeight(s), 0) * 10) / 10;

  const seq = [];
  seq.push({ type: "cover", archetype: "A1", kicker: copy.cover?.kicker, headline: copy.cover?.headline, subhead: copy.cover?.subhead });
  const useToc = n_body_arith >= 6;
  if (useToc) seq.push({ type: "toc", archetype: "A2", headline: copy.toc?.headline || "오늘의 목차", body: (copy.sections || []).map((s, i) => `${i + 1}. ${s.headline}`).join("\n") });

  // 두 제약 동시 관리(§2.5③·§5.4): 스파이크 런(f≥0.6) ≤3 AND 동일 아키타입(A3) 런 ≤3
  let spikeRun = 0, archRun = 0, valleys = 0;
  bodyCards.forEach((bc, i) => {
    const first = bc.secs[0];
    const card = { type: "body", archetype: "A3", body_mode: "dense",
      kicker: first.kicker || copy.cover?.kicker, headline: first.headline,
      body: bc.secs.map((s) => s.body).join("\n"),
      supplement: bc.secs.map((s) => s.supplement).filter(Boolean).join(" · ") || undefined,
      source: bc.secs.map((s) => s.source).filter(Boolean).pop(),
      fact_refs: [...new Set(bc.secs.flatMap((s) => s.fact_refs || []))],
      fill: Math.min(1, Math.round((bc.w / T) * 100) / 100) };
    seq.push(card);
    spikeRun = card.fill >= PCFG.wave.spike_fill_min ? spikeRun + 1 : 0;
    archRun++;
    const isLast = i === bodyCards.length - 1;
    if ((spikeRun >= PCFG.wave.max_consecutive_dense || archRun >= PCFG.wave.max_consecutive_dense) && !isLast) {
      const v = pickValley();
      if (v) { seq.push(v); valleys++; spikeRun = 0; archRun = 0; }
    }
  });
  seq.push({ type: "cta", archetype: "A11", headline: copy.cta?.headline, body: copy.cta?.body, cta_label: copy.cta?.cta_label });
  seq.forEach((c, i) => { c.index = i + 1; });

  copy.cards = seq;
  copy.card_count = seq.length;
  copy.card_count_derivation = {
    method: "visual-weight-greedy + stream-verify", profile: opts.profile || "4:5",
    total_weight, threshold: T, n_body_arith, valleys_inserted: valleys,
    toc: useToc ? 1 : 0, n_body_final: n_body_arith + valleys,
    stream_overflow_splits: copy.card_count_derivation?.stream_overflow_splits ?? 0,
  };
}

// ── Tier-2 measure 반영(--apply-measure): overflow 카드를 줄 경계 분할, 밸리 고정(§5.5) ──
function applyMeasure(measurePath) {
  const m = JSON.parse(readFileSync(measurePath, "utf8"));
  if (!m.overflow_count) { console.log("measure: overflow 없음 — 변경 없음"); return; }
  const iter = (copy.card_count_derivation?.stream_overflow_splits ?? 0) + 1;
  if (iter > (PCFG.tier2.max_iterations || 2)) { console.error(`✗ measure 수렴 실패(${iter}회 초과) — G2 카피 단축 필요`); process.exit(1); }
  const out = [];
  for (const c of copy.cards) {
    const mc = m.cards.find((x) => x.index === c.index);
    if (!mc?.overflow || c.type !== "body") { out.push(c); continue; }
    const text = c.body || "";
    let cut = mc.split?.split_char ?? Math.floor(text.length / 2);
    const sp = text.lastIndexOf(" ", cut); if (sp > text.length * 0.25) cut = sp; // 어절 경계
    const head = text.slice(0, cut).trim(), tail = text.slice(cut).trim();
    out.push({ ...c, body: head, supplement: undefined });
    out.push({ ...c, headline: c.headline, body: tail, kicker: c.kicker, source: c.source }); // 이어지는 dense 카드
  }
  out.forEach((c, i) => { c.index = i + 1; });
  copy.cards = out;
  copy.card_count = out.length;
  copy.card_count_derivation.n_body_final += m.suggested_extra_cards;
  copy.card_count_derivation.stream_overflow_splits = iter;
}

if (opts["apply-measure"]) applyMeasure(opts["apply-measure"]);
else build();
writeFileSync(copyPath, JSON.stringify(copy, null, 2));
const d = copy.card_count_derivation;
console.log(`✓ paginate — ${copy.card_count}장 (weight ${d.total_weight}/T${d.threshold} → body ${d.n_body_arith} + 밸리 ${d.valleys_inserted} + toc ${d.toc} + cover/cta, splits ${d.stream_overflow_splits})`);
