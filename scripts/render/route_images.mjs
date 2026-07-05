#!/usr/bin/env node
// S4 이미지 라우팅 (§4.1) — copy.json + routing.json + tier → image-manifest.json + prompts.jsonl + copy.cards 이미지 필드.
// 결정론: pattern = tier_reroute(photo_branch(archetype default)) → 인접 동일패턴 교체(§2.5④, G13-B 법칙5 run≤2).
// 사용: node route_images.mjs <projectDir> [--photo=false]
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SKILL = ROOT;
const R = JSON.parse(readFileSync(join(SKILL, "references/routing.json"), "utf8"));
const proj = resolve(process.argv[2] || ".");
const opts = Object.fromEntries(process.argv.slice(3).filter((a) => a.startsWith("--")).map((a) => a.replace(/^--/, "").split("=")));
const copy = JSON.parse(readFileSync(join(proj, "copy.json"), "utf8"));
const tok = JSON.parse(readFileSync(join(proj, "tokens.json"), "utf8"));
let brief = {};
try { brief = JSON.parse(readFileSync(join(proj, "brief.json"), "utf8")); } catch {}
const subject = brief.image_subject || {}; // {bg, cutout} — 주제 소재(S1 기획 소유, 카피 아님 → G5와 무충돌
const tier = tok.tier;
const hasPhoto = opts.photo === "true"; // 실물사진 자산 유무(§2.3) — 기본 없음(AI 생성 경로)
const reroute = R.tier_override[tier]?.pattern_reroute || {};
const hint = tok.image || {};
const S = tok._surface || {};

const first = (v) => (typeof v === "string" ? v.split("|")[0] : v);
function basePattern(arch) {
  const e = R.archetypes[arch];
  if (!e) return "F";
  let p = hasPhoto ? e.image_pattern.default : first(e.image_pattern.no_photo);
  p = reroute[p] || p;
  return p;
}
function altPattern(arch, avoid, used) {
  const e = R.archetypes[arch];
  const cands = [...new Set([e?.image_pattern?.alt, e?.image_pattern?.default, "F"]
    .map((x) => reroute[first(x)] || first(x))
    .filter((x) => x && x !== avoid && !(e?.f_forbidden && x === "F")))];
  if (!cands.length) return avoid;
  // 다양성 인지: 지금까지 덜 쓴 패턴 우선(§2.5④ + G13-B distinct 하한 방어)
  return cands.sort((a, b) => (used.get(a) || 0) - (used.get(b) || 0))[0];
}

// 패턴 확정 + 인접 런 ≤2 강제
const RASTER = ["A", "B", "C", "G"];
const seq = [], used = new Map();
for (const c of copy.cards) {
  let p = basePattern(c.archetype);
  // 커버는 래스터 하드(G13-A(a)) + §4.1 티어별 표지: 럭셔리=A / 캐릭터·브랜드=B(컷아웃)
  if (c.type === "cover" && !RASTER.includes(p)) p = tier === "luxury" ? "A" : "B";
  if (c.type === "stat" && c.viz_kind === "chart") p = "F"; // 차트는 클린 색면(A14) — 사진/블롭 위 차트 금지
  if (c.dispnum) p = "F"; // 디스플레이 수치 히어로도 클린 색면 — 사진 위 dispnum은 렌더러가 억제하므로 라우팅에서 정합
  if (c.pattern_force) p = c.pattern_force; // S1/S2 카드별 패턴 지정(마스코트 다량 배치 등) — 게이트(G13/G6+occ)가 결과 검증
  const n = seq.length;
  if (n >= 2 && !c.pattern_force && seq[n - 1] === p && seq[n - 2] === p) p = altPattern(c.archetype, p, used); // 강제 지정은 런 조정 면제
  seq.push(p); used.set(p, (used.get(p) || 0) + 1);
}
// 통짜사진 예산(이미지 사용 판단 규칙, D4 + R2 티어 차등): 정보카드는 텍스트가 주인공.
// 사진 문법이 티어 정체성인 news/editorial은 4장, luxury 3장, 그 외 2장. 초과분 F.
const A_BUDGET = { news: 4, editorial: 4, luxury: 3 }[tier] ?? 2;
let aUsed = 0;
copy.cards.forEach((c, i) => {
  if (seq[i] === "A" && c.type !== "cover") { aUsed++; if (aUsed > A_BUDGET) seq[i] = "F"; }
});

const palette = `palette ${S.bg || ""} / ${S.ink || ""} / ${tok.palette?.accent || ""}`.trim();
// 잉크가 밝으면(다크 surface) 텍스트 존을 딥섀도로, 어두우면 밝은 밴드로 예약 — G6+ 사전 방어(§4.8 레버6)
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16) / 255); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const darkInkZone = S.ink && lum(S.ink) > 0.5;
const BG_GRAMMAR = `the upper half kept as a calm empty band reserved for a title treatment, ${darkInkZone
  ? "the reserved band falls into deep even shadow, low-key"
  : "the reserved band stays bright, airy and evenly lit"}, the surface itself carries no lettering, all typography added later, generous negative space`;
const CUT_GRAMMAR = "single subject centered on a seamless flat field, even soft studio lighting, no cast shadow touching the subject, wide clean margin fully separating the whole silhouette from the background, crisp edges on every contour";

const manifest = { cards: [] }, prompts = [];
copy.cards.forEach((c, i) => {
  const idx = String(c.index).padStart(2, "0");
  const p = seq[i];
  delete c.bg; delete c.scrim; delete c.cutout; // 재라우팅 시 stale 이미지 필드 정리(패턴 강등 카드가 옛 bg를 물고 가는 버그 방지)
  // viz: F 패턴이지만 차트/디스플레이 수치라는 시각물을 품은 카드 — G13 F비율(바레텍스트 상한)에서 제외 신호.
  const m = { index: c.index, type: c.type, tier, pattern: p, viz: !!(c.chart || c.dispnum), bg: null, cutout: null, scrim: false, graphic: null };
  const subjBg = c.image_subject?.bg || subject.bg; // 카드별 소재 오버라이드(내용-이미지 정합, S1/S2 소유)
  const subjCut = c.image_subject?.cutout || subject.cutout;
  if (p === "A" || p === "G") {
    m.bg = { gen: true, size: "1024x1536", out: `assets/bg/card-${idx}.png` };
    // photo-info 문법(R2·뉴닉): news/editorial 본문 A = 전면 오버레이(+밴드 헤드라인은 S2 소관), 그 외 = 하단 스크림
    if (p === "A" && ["news", "editorial"].includes(tier) && c.type !== "cover") { m.overlay = true; c.overlay = true; }
    else m.scrim = p === "A";
    prompts.push({ id: `bg-${idx}`, ar: "4:5", size: "1024x1536",
      prompt: `${subjBg ? subjBg + ", " : ""}${hint.bg_prompt_hint || "clean editorial backdrop"}, ${BG_GRAMMAR}, ${palette}, quality high`,
      output_path: m.bg.out });
    c.bg = m.bg.out; c.scrim = m.scrim;
  } else if (p === "B" || p === "C") {
    // 배치 판단: 커버=코너 420 / character 비커버=코너(전폭 본문과 side_right 520 구조 겹침 — occ 21% 실측, 2026-07-05) /
    // A13 말풍선=측면 / 그 외=하단 히어로
    m.cutout = { gen: true, size: "2048x2048", raw: `assets/cutout/card-${idx}_raw.png`,
      out: `assets/cutout/card-${idx}.png`, matte: "birefnet-general",
      placement: c.type === "cover" ? "corner_br" : (c.archetype === "A13" ? "side_right" : tier === "character" ? "corner_br" : "bottom_hero"),
      shadow: tier === "luxury" ? "float" : "ground" };
    prompts.push({ id: `cut-${idx}`, ar: "1:1", size: "2048x2048",
      prompt: `${subjCut ? subjCut + ", " : ""}${hint.cutout_prompt_hint || "single product hero on a seamless flat #FAFAFA field"}, ${CUT_GRAMMAR}, quality high`,
      output_path: m.cutout.raw });
    // 커버는 우하단 코너 액센트 420px(§2.4 캐릭터 문법·newneek 고슴이 관행) — 텍스트 존과 분리
    c.cutout = { src: m.cutout.out, placement: m.cutout.placement, shadow: m.cutout.shadow,
      width: c.type === "cover" ? 420 : m.cutout.placement === "corner_br" ? (c.type === "cta" ? 380 : 340)
        : m.cutout.placement === "side_right" ? 520 : 720 };
  } else if (p === "D" || p === "E") {
    m.graphic = p === "D" ? "css-blob" : "icon-set"; // 생성 아님 — CSS/SVG 직접(§4.0)
  }
  c.image_pattern = p;
  manifest.cards.push(m);
});

writeFileSync(join(proj, "image-manifest.json"), JSON.stringify(manifest, null, 2));
writeFileSync(join(proj, "prompts.jsonl"), prompts.map((p) => JSON.stringify(p)).join("\n") + (prompts.length ? "\n" : ""));
writeFileSync(join(proj, "copy.json"), JSON.stringify(copy, null, 2));
console.log(`✓ route_images — 패턴 [${seq.join(",")}] · 생성컷 ${prompts.length}건 → image-manifest.json/prompts.jsonl`);
