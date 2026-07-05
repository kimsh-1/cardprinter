#!/usr/bin/env node
// S3 토큰 컴파일러 — tiers/<tier>.json(v2.0 분위기 번들) → 프로젝트 tokens.json (§6.9)
// 사용: node compile_tokens.mjs <projectDir> [tier] [surfaceId] [accentId]
//   tier 미지정 시 <projectDir>/brief.json 의 tier 사용.
// 산출: tokens.json { tier, schema_version, palette(확장), css_vars, fonts, typography, grid, radius_px, d3, _surface, _accent }
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SKILL = ROOT;
const proj = resolve(process.argv[2] || ".");
const briefPath = join(proj, "brief.json");
const brief = existsSync(briefPath) ? JSON.parse(readFileSync(briefPath, "utf8")) : {};
const tier = process.argv[3] || brief.tier;
if (!tier) { console.error("✗ tier 미지정 (인자 또는 brief.json.tier)"); process.exit(1); }
const mood = JSON.parse(readFileSync(join(SKILL, `references/tiers/${tier}.json`), "utf8"));

// §6.2 composePreset — Surface × Accent 직교 병합
const surfaceId = process.argv[4] || mood.default_surface;
const accentId = process.argv[5] || mood.default_accent;
const S = mood.surface_set.find((s) => s.id === surfaceId) ?? mood.surface_set[0];
const A = mood.accent_set.find((a) => a.id === accentId) ?? mood.accent_set[0];
const palette = {
  bg: S.bg, fg: S.ink, accent: A.acc, // build_carousel 하위호환 최소셋
  ink_body: S.ink_body, ink_muted: S.ink_muted, ink_faint: S.ink_faint,
  hairline: S.hairline, tint: S.tint,
  on_acc: A.on_acc, hl: A.hl, hl_alpha: A.hl_alpha, pill_bg: A.pill_bg, pill_ink: A.pill_ink,
};

// §3.1 dense px — 계획 확정값을 티어 밴드로 클램프
const T = mood.typography || {};
const d3 = mood.d3 || {};
const clampBand = (v, band) => (Array.isArray(band) ? Math.min(Math.max(v, band[0]), band[1]) : v);
const l0 = T.l0_px ?? 28;
const l1 = clampBand(82, T.l1_px ?? [80, 84]);
const l2 = clampBand(48, T.l2_px ?? [40, 48]);
const l4 = clampBand(34, T.l4_px ?? [30, 36]);
const l5 = clampBand(30, T.l5_px ?? [28, 32]);
const titleMax = Array.isArray(T.title_px) ? T.title_px[1] : (T.title_px ?? 140);
const fsCover = Math.max(160, Math.min(200, Math.round(titleMax * 1.6))); // §3.4 클램프 + G14 하한 160 보장
const bodySingle = Array.isArray(T.body_px) ? T.body_px[1] : (T.body_px ?? 52); // 단일본문(BAND-MID)

const css_vars = {
  "--bg": palette.bg, "--ink": palette.fg, "--ink-body": palette.ink_body,
  "--ink-muted": palette.ink_muted, "--ink-faint": palette.ink_faint,
  "--hairline": palette.hairline, "--tint": palette.tint,
  "--acc": palette.accent, "--on-acc": palette.on_acc, "--hl": palette.hl,
  "--hl-alpha": String(palette.hl_alpha), "--hl-cover": d3.hl_cover ?? "55%",
  "--pill-bg": palette.pill_bg, "--pill-ink": palette.pill_ink,
  "--rule-hair": `${d3.rule_hair_px ?? 1.5}px`, "--rule-bold": `${d3.rule_bold_px ?? 6}px`,
  "--underline-bar": `${d3.underline_bar_px ?? 8}px`, "--pill-radius": `${d3.pill_radius_px ?? 999}px`,
  "--kicker-px": `${d3.kicker_px ?? 28}px`, "--kicker-weight": String(d3.kicker_weight ?? 700),
  "--block-gap": `${d3.block_gap_em ?? 1.0}em`, "--emphasis-budget": String(d3.emphasis_budget ?? 2),
  "--l0": `${l0}px`, "--l1": `${l1}px`, "--l2": `${l2}px`, "--l4": `${l4}px`, "--l5": `${l5}px`,
  "--fs-cover": `${fsCover}px`, "--fs-bignum": "480px", "--fs-body-single": `${bodySingle}px`,
  "--lh-title": String(T.line_height_title ?? 1.2), "--lh-body": String(T.line_height_body ?? 1.6),
  "--ls-title": T.letter_spacing_title ?? "-0.02em", "--ls-body": T.letter_spacing_body ?? "-0.01em",
};

const tokens = {
  tier, schema_version: "2.0",
  surface: surfaceId, accent_id: accentId,
  palette, css_vars,
  fonts: mood.fonts, typography: { ...T, cover_px: fsCover },
  grid: mood.grid, radius_px: mood.radius_px ?? 0,
  d3, compose_mode: mood.compose_mode, image: mood.image, motion: mood.motion,
  _surface: S, _accent: A, // G3 직교 검증용 원본 스냅샷
};
writeFileSync(join(proj, "tokens.json"), JSON.stringify(tokens, null, 2));
console.log(`✓ tokens.json 컴파일 — tier=${tier} surface=${surfaceId} accent=${accentId} (cover ${fsCover}px, dense L1 ${l1}/L2 ${l2})`);
