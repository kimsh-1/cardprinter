// G3 tokens-schema: 팔레트(bg/fg/accent) + 폰트(woff2 실재) + 그리드 & fg/bg 대비
// v2.0 확장(§6.9 7항): ①직교 위반 ②WCAG 전조합 ③hex 정합 ④D3 예산 ⑤폰트 하드캡 ⑥클래스 비충돌 ⑦글리프 폴백 체인
// v1 tokens(schema_version 없음)는 기존 검사만 수행(하위호환).
import { existsSync } from "node:fs";
import { isAbsolute, resolve, dirname, basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadJSON, contrastRatio, CFG, check, done, arg } from "./lib.mjs";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SKILL_FONTS = resolve(ROOT, "assets/fonts");
const tokPath = arg(0, "tokens.json");
const tok = loadJSON(tokPath);
const baseDir = arg(1, dirname(resolve(tokPath)));

const hex = /^#[0-9A-Fa-f]{6}$/;
const p = tok.palette || {};
for (const k of ["bg", "fg", "accent"]) check(hex.test(p[k] || ""), `palette.${k} HEX 아님: ${p[k]}`);
if (hex.test(p.bg || "") && hex.test(p.fg || "")) {
  const cr = contrastRatio(p.bg, p.fg);
  check(cr >= CFG.contrast.normal_min, `palette fg/bg 대비 ${cr.toFixed(2)} < ${CFG.contrast.normal_min}`);
}
const fonts = tok.fonts || {};
const fontExists = (w) => {
  const abs = isAbsolute(w) ? w : resolve(baseDir, w);
  return existsSync(abs) || existsSync(join(SKILL_FONTS, basename(w)));
};
for (const role of ["title", "body"]) {
  const f = fonts[role];
  check(f && f.family, `fonts.${role}.family 누락`);
  const w = f && (f.woff2 || f.woff2_fallback);
  check(!!w, `fonts.${role} woff2 경로 없음(폴백도 없음)`);
  if (w) check(fontExists(w), `fonts.${role} woff2 파일 없음: ${w}`);
}
check(tok.grid && typeof tok.grid === "object", `grid 필드 누락`);

// ───────── v2.0 확장 (schema_version 2.0 필수) ─────────
if (tok.schema_version === "2.0") {
  const S = tok._surface || {}, A = tok._accent || {}, d3 = tok.d3 || {};

  // ③ hex 정합 — 확장 팔레트·css_vars 색값 전부 6자리(알파 금지), hl_alpha ∈ [0,1]
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === "string" && v.startsWith("#")) check(hex.test(v), `palette.${k} 8자리/축약 hex 금지: ${v}`);
  }
  for (const [k, v] of Object.entries(tok.css_vars || {})) {
    if (typeof v === "string" && v.startsWith("#")) check(hex.test(v), `css_vars ${k} hex 정합 위반: ${v}`);
  }
  const ha = Number(A.hl_alpha ?? p.hl_alpha);
  check(!Number.isNaN(ha) && ha >= 0 && ha <= 1, `hl_alpha 범위 위반: ${ha}`);

  // ① 직교 위반 — accent가 ink 정의 금지 / surface 색은 저채도(chroma ≤15%)
  check(!("ink" in A) && !("ink_body" in A), `직교 위반: accent_set이 ink 필드 정의 (§6.2)`);
  const chroma = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return (Math.max(...c) - Math.min(...c)) / 255; };
  for (const k of ["bg", "ink", "ink_body", "ink_muted", "ink_faint", "hairline", "tint"]) {
    if (S[k] && hex.test(S[k])) check(chroma(S[k]) <= 0.15, `직교 위반: surface.${k} 채도 ${(chroma(S[k]) * 100).toFixed(1)}% > 15% (팝 컬러는 accent 전용)`);
  }

  // ② WCAG 사전검증 — surface ink/ink_body ≥4.5 · muted/faint ≥3 · accent on_acc/acc ≥4.5 (기본 조합 필수)
  if (hex.test(S.bg || "")) {
    for (const [k, need] of [["ink", 4.5], ["ink_body", 4.5], ["ink_muted", 3.0], ["ink_faint", 3.0]]) {
      if (hex.test(S[k] || "")) {
        const cr = contrastRatio(S[k], S.bg);
        check(cr >= need, `surface ${k}/bg 대비 ${cr.toFixed(2)} < ${need}`);
      }
    }
  }
  if (hex.test(A.acc || "") && hex.test(A.on_acc || "")) {
    const cr = contrastRatio(A.on_acc, A.acc);
    check(cr >= 4.5, `accent on_acc/acc 대비 ${cr.toFixed(2)} < 4.5 (pill/badge 가독 하드게이트)`);
  }

  // ④ D3 예산
  check((d3.emphasis_budget ?? 2) <= 2, `emphasis_budget ${d3.emphasis_budget} > 2`);
  check((d3.tier_max_layers ?? 5) <= 5, `tier_max_layers ${d3.tier_max_layers} > 5`);

  // ⑤ 폰트 하드캡 — 패밀리 ≤3종, 선언 woff2 전부 실재
  const fams = new Set(Object.values(fonts).filter((f) => f && f.family).map((f) => f.family));
  check(fams.size <= 3, `폰트 패밀리 ${fams.size}종 > 3`);
  for (const [role, f] of Object.entries(fonts)) {
    if (f && f.woff2) check(fontExists(f.woff2), `fonts.${role}.woff2 미실재: ${f.woff2}`);
    if (f && f.fallback_woff2) check(fontExists(f.fallback_woff2), `fonts.${role}.fallback_woff2 미실재: ${f.fallback_woff2}`);
  }

  // ⑥ 렌더러 클래스 비충돌 — D3 장치 클래스가 현행 점유 클래스와 겹치지 않는지(§6.3 네임스페이스)
  const reserved = ["hl", "hl-sm", "sub", "bd", "quote", "src", "kicker", "save-pill", "accent-bar", "page", "cover-block", "mid-block", "center-block"];
  const device = ["hl-pen", "wj", "wj-acc", "d3-underbar", "d3-pill", "d3-source", "l1--bar", "pill", "stack", "chunk", "l1", "l2", "l4", "l5"];
  const collide = device.filter((d) => reserved.includes(d));
  check(collide.length === 0, `장치 클래스 충돌: ${collide.join(",")}`);

  // ⑦ 글리프 폴백 체인 — 부분 커버 폰트(hangul_glyphs < 11172)는 fallback 필수(실 카피 probe는 G9 소관)
  for (const [role, f] of Object.entries(fonts)) {
    if (f && typeof f.hangul_glyphs === "number" && f.hangul_glyphs < 11172) {
      check(!!(f.fallback_family && f.fallback_woff2), `fonts.${role}(${f.family}, ${f.hangul_glyphs}음절) 부분 커버 — fallback_family/fallback_woff2 필수 (§6.9-7, tofu 봉쇄)`);
    }
  }
}
done("G3 tokens-schema" + (tok.schema_version === "2.0" ? " (v2 확장 7항)" : ""));
