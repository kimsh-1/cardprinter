#!/usr/bin/env node
// S5 캐러셀 카드 생성 v2.0 — copy.json + tokens.json(v2) → carousel/card-NN.html
// 재설계(§3·§6.3): css_vars → :root 주입 · dense L0~L5 renderDense · 역할클래스 라우팅 ·
// stat/comparison 전용 컴포넌트 · 인라인 강조 마커(==hl==/**wj**) 예산 파서 · body 700 페이스 · 폰트 폴백 체인.
// v1 tokens(palette 3색)도 하위호환 렌더(기본값 폴백).
// 사용: node build_carousel.mjs <projectDir>
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync } from "node:fs";
import { join, resolve, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { icon } from "./icons.mjs"; // E 패턴 아이콘세트(R2 — 20종 스트로크, currentColor 상속)

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const proj = resolve(process.argv[2] || ".");
const rd = (f) => JSON.parse(readFileSync(join(proj, f), "utf8"));
const copy = rd("copy.json"), tok = rd("tokens.json");
const outDir = join(proj, "carousel");
mkdirSync(join(outDir, "assets/fonts"), { recursive: true });
const skFonts = resolve(ROOT, "assets/fonts");
for (const f of readdirSync(skFonts)) copyFileSync(join(skFonts, f), join(outDir, "assets/fonts", f));
for (const sub of ["assets/bg", "assets/cutout"]) {
  const src = join(proj, sub);
  if (existsSync(src)) { mkdirSync(join(outDir, sub), { recursive: true }); for (const f of readdirSync(src)) copyFileSync(join(src, f), join(outDir, sub, f)); }
}

const isNewsprint = tok.tier === "newsprint"; // §newsprint 이식 — tier 조건 분기 전용 플래그(다른 티어 경로 무영향)
const pal = tok.palette || { bg: "#0E0F12", fg: "#F6F1E8", accent: "#C8B08A" };
const vars = tok.css_vars || {};
const V = (k, d) => vars[k] ?? d;
const T = tok.typography || {};
const arr = (v, i, d) => (Array.isArray(v) ? v[i] : v) ?? d;
const radius = tok.radius_px ?? 0;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

// ── 인라인 강조 마커 파서(§3.5a) — ==형광==, **굵기+색**, 예산 카드 단위 공유, source 제외 ──
function inline(s, ctr) {
  return esc(s)
    .replace(/==([^=]+)==/g, (_, w) => (ctr.used++ < ctr.budget ? `<mark class="hl-pen" data-emph="1">${w}</mark>` : w))
    .replace(/\*\*([^*]+)\*\*/g, (_, w) => (ctr.used++ < ctr.budget ? `<strong class="wj-acc" data-emph="1">${w}</strong>` : w));
}
const budget = parseInt(V("--emphasis-budget", "2"), 10) || 2;

// ── 폰트 등록(폴백 체인 포함) ──
const F = tok.fonts || {};
const faces = new Map(); // key family|weight → file
const addFace = (fam, w, file) => { if (fam && file) faces.set(`${fam}|${w}`, basename(file)); };
addFace(F.title?.family, F.title?.weight ?? 900, F.title?.woff2 || F.title?.woff2_fallback);
addFace(F.body?.family, F.body?.weight ?? 400, F.body?.woff2);
addFace(F.accent?.family, F.accent?.weight ?? 700, F.accent?.woff2);
if (F.body?.family === "Pretendard") addFace("Pretendard", 700, "Pretendard-Bold.woff2"); // §3.5d body 700 실페이스
if (isNewsprint && F.body?.family === "Pretendard") addFace("Pretendard", 900, "Pretendard-Black.woff2"); // newsprint T3 기사 헤드라인 실블랙 페이스
for (const role of ["title", "accent"]) {
  const f = F[role];
  if (f?.fallback_family && f?.fallback_woff2) addFace(f.fallback_family, f.weight ?? 700, f.fallback_woff2);
}
// 단일 페이스 패밀리는 100~900 전 굵기 커버 선언 — CSS가 700/800/900을 요청할 때 합성볼드로
// 글리프가 뭉개지는 결함 차단(초블랙 서체에서 판독불가, G17 P2 판정 실측 2026-07-05)
const famCount = {};
for (const [k] of faces) { const fam = k.split("|")[0]; famCount[fam] = (famCount[fam] || 0) + 1; }
const fontCSS = [...faces].map(([k, file]) => { const [fam, w] = k.split("|");
  const wDecl = famCount[fam] === 1 ? "100 900" : w;
  return `@font-face{font-family:'${fam}';font-weight:${wDecl};src:url('assets/fonts/${file}') format('woff2');}`; }).join("\n");
const stack = (role, dflt) => {
  const f = F[role] || {}; const fam = f.family || (F.title?.family && role === "title" ? F.title.family : dflt);
  // 번들 body 폰트(Pretendard)를 모든 슬롯의 폴백으로 강제 — 디스플레이 폰트가 못 가진 글자
  // (미들닷 '·', 대시 '—' 등 한국어 표기에 흔한 문장부호)를 시스템폰트가 아니라 번들 폰트로
  // 렌더해 머신 간 결정적 출력 보장. G9 glyph-coverage가 이 폴백 계약에 의존한다.
  const bodyFam = F.body?.family || "Pretendard";
  const fbFam = f.fallback_family || (fam && fam !== bodyFam ? bodyFam : null);
  const fb = fbFam ? `,'${fbFam}'` : "";
  return `'${fam || dflt}'${fb},sans-serif`;
};
const tfS = stack("title", "Pretendard"), bfS = stack("body", "Pretendard"), afS = stack("accent", "Pretendard");

// ── :root 토큰 방출(§6.3) — v1 tokens면 palette에서 합성 ──
const rootVars = Object.keys(vars).length
  ? Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";")
  : `--bg:${pal.bg};--ink:${pal.fg};--ink-body:${pal.fg};--ink-muted:${pal.fg};--hairline:${pal.fg}33;--acc:${pal.accent};--pill-bg:${pal.accent};--pill-ink:${pal.bg};--hl:${pal.accent};--hl-alpha:.5;--hl-cover:55%;--rule-hair:1.5px;--underline-bar:8px;--pill-radius:999px;--kicker-px:28px;--kicker-weight:700;--block-gap:1em;--emphasis-budget:2;--l0:28px;--l1:82px;--l2:48px;--l4:34px;--l5:30px;--fs-cover:${arr(T.title_px, 1, 160)}px;--fs-bignum:480px;--fs-body-single:${arr(T.body_px, 1, 52)}px;--lh-title:1.2;--lh-body:1.6;--ls-title:-0.02em;--ls-body:-0.01em`;

// ── 렌더 함수 ──
// blocks[] 다중 블록(R8-C 정보밀집: 문단→불릿 3~5→콜아웃 층 적층) — body 필드는 para 1개로 하위호환
function renderBlocks(c, ctr) {
  // c.body는 blocks가 body 슬롯을 안 내면 리드 para로 편입(codex가 body+callout만 주면 body가 버려지던 결함 수리
  // 2026-07-05 factory 실측). para/bullets가 이미 있으면 중복 방지로 편입 안 함.
  const blocks = c.blocks ? [...c.blocks] : [];
  const producesBody = blocks.some((b) => !b.kind || b.kind === "para" || b.kind === "bullets");
  if (c.body && !producesBody) blocks.unshift({ kind: "para", text: c.body });
  return blocks.map((b) => {
    if (b.kind === "bullets") return `<ul class="blk-bullets">${(b.items || []).map((it) => `<li data-slot="body">${inline(it, ctr)}</li>`).join("")}</ul>`;
    if (b.kind === "callout") return `<div class="blk-callout">${b.label ? `<span class="blk-callout-label">${esc(b.label)}</span>` : ""}<span class="blk-callout-text" data-slot="supplement">${inline(b.text || "", ctr)}</span></div>`;
    if (b.kind === "icons") return `<div class="blk-icons">${(b.items || []).map((it) => {
      const sv = icon(it.icon, { size: 84 });
      return sv ? `<div class="blk-icon-cell">${sv}<span class="blk-icon-label" data-slot="caption">${esc(it.label || "")}</span></div>` : "";
    }).join("")}</div>`;
    return `<p class="l2" data-slot="body">${inline(b.text || "", ctr)}</p>`;
  }).join("\n      ");
}
function renderDense(c) {
  const ctr = { used: 0, budget };
  const bar = c.headline_device === "band" ? " l1--band" : (c.underline_bar !== false ? " l1--bar" : "");
  const step = c.step_no != null ? `<span class="step-no">${esc(String(c.step_no))}</span>` : "";
  // 3존 세로채움(규칙C): z1 헤더 / z2 히어로(flex:1 중앙, dispnum 승격 수치 포함) / L5 하단 앵커
  // dispnum은 bg 없는 카드만 — 상단분할(G) 카드는 가용고 686px라 넘침(G11) + 이미지가 이미 앵커
  const dn = c.dispnum && !c.bg ? `<div class="dispnum" data-slot="dispnum">${esc(String(c.dispnum.value))}${c.dispnum.unit ? `<span class="unit">${esc(c.dispnum.unit)}</span>` : ""}</div>` : "";
  // 짧은 단일 문단 + 시각앵커 없음(bg/dispnum/cutout/blocks 무) → 패널 블록으로 질량 부여(허공 방지, D3 박스/블록)
  const panel = !c.bg && !c.dispnum && !c.cutout?.src && !c.blocks;
  const hero = `${dn}
      ${renderBlocks(c, ctr)}
      ${c.supplement ? `<p class="l4" data-slot="supplement">${inline(c.supplement, ctr)}</p>` : ""}`;
  return `<div class="stack">
    <div class="z1">
      ${c.kicker ? `<span class="pill" data-slot="kicker">${esc(c.kicker)}</span>` : ""}
      ${c.headline ? `<h2 class="l1${bar}" data-slot="headline">${step}${esc(c.headline)}</h2>` : ""}
    </div>
    <div class="z2">
      ${panel ? `<div class="z2-panel">${hero}</div>` : hero}
    </div>
  </div>
  ${c.source ? `<p class="l5" data-slot="source">${esc(c.source)}</p>` : ""}`;
}
function renderToc(c) { // A2 목차 전용 — variant 3종(WS2): hairline(롱블랙)/pill(캐릿)/band(토스), 티어 기본 매핑
  const items = String(c.body || "").split("\n").map((s) => s.trim()).filter(Boolean)
    .map((s, i) => { const m = s.match(/^(\d+)[.)]\s*(.+)$/); return m ? { no: m[1].padStart(2, "0"), label: m[2] } : { no: String(i + 1).padStart(2, "0"), label: s }; });
  const tocVar = c.variant || ({ character: "pill", brand: "band", data: "band", news: "band" }[tok.tier] || "hairline");
  return `<div class="stack">
    <div class="z1">
      ${c.kicker ? `<span class="pill" data-slot="kicker">${esc(c.kicker)}</span>` : ""}
      ${c.headline ? `<h2 class="l1 l1--bar" data-slot="headline">${esc(c.headline)}</h2>` : ""}
    </div>
    <div class="toc-rows toc--${tocVar}">
      ${items.map((it, i) => `<div class="toc-row${i === 0 ? " toc-row--first" : ""}">
        <span class="toc-no">${esc(it.no)}</span>
        <span class="toc-label" data-slot="subhead">${esc(it.label)}</span>
      </div>`).join("")}
    </div>
    <div class="swipe-cue">넘겨서 확인 →</div>
  </div>`;
}
function renderList(c, isTimeline) { // A5 리스트 / A8 타임라인 전용 — body 줄 또는 blocks(bullets) 겸용(factory 실측 갭 수리)
  const ctr = { used: 0, budget };
  const fromBody = String(c.body || "").split("\n").map((s) => s.trim()).filter(Boolean)
    .map((s) => s.replace(/^(\d+[.)]|[-•*])\s*/, ""));
  const fromBlocks = (c.blocks || []).filter((b) => b.kind === "bullets").flatMap((b) => b.items || []);
  const fromSteps = (c.steps || []).map((s) => (s.label ? `**${s.label}** — ${s.text}` : s.text)); // steps 계약(codex 관행 수용)
  const items = fromBody.length ? fromBody : fromSteps.length ? fromSteps : fromBlocks;
  const lead = (c.blocks || []).filter((b) => b.kind === "para" || (!b.kind && b.text)).map((b) => b.text).join(" ");
  const compact = (items.length >= 5 || (lead && items.length >= 4)) ? " li-rows--compact" : "";
  return `<div class="stack">
    <div class="z1">
      ${c.kicker ? `<span class="pill" data-slot="kicker">${esc(c.kicker)}</span>` : ""}
      ${c.headline ? `<h2 class="l1 l1--bar" data-slot="headline">${esc(c.headline)}</h2>` : ""}
      ${lead ? `<p class="l2" data-slot="body">${inline(lead, ctr)}</p>` : ""}
    </div>
    <div class="li-rows${isTimeline ? " li-rows--tl" : ""}${compact}">
      ${items.map((t, i) => `<div class="li-row">
        <span class="li-no">${String(i + 1).padStart(2, "0")}</span>
        <span class="li-text" data-slot="body">${inline(t, ctr)}</span>
      </div>`).join("")}
    </div>
  </div>
  ${c.source ? `<p class="l5" data-slot="source">${esc(c.source)}</p>` : ""}`;
}
function renderChart(c) { // A14 인포그래픽/차트 전용 — deck-charts SVG 인라인(페이지 폰트 상속 위해 img 금지)
  const ctr = { used: 0, budget };
  const idx = String(c.index).padStart(2, "0");
  let svg = "";
  try { svg = readFileSync(join(proj, "assets/chart", `card-${idx}.svg`), "utf8"); } catch {}
  // svg 결손 시 data-slot 미방출 → G19 A14 계약이 fail-closed로 잡음(자산 없는 차트카드 = 통과 금지)
  return `<div class="stack">
    <div class="z1">
      ${c.kicker ? `<span class="pill" data-slot="kicker">${esc(c.kicker)}</span>` : ""}
      ${c.headline ? `<h2 class="l1 l1--bar" data-slot="headline">${esc(c.headline)}</h2>` : ""}
    </div>
    <div class="z2">
      ${svg ? `<div class="chart-box" data-slot="chart">${svg}</div>` : ""}
      ${c.body ? `<p class="chart-cap" data-slot="body">${inline(c.body, ctr)}</p>` : ""}
    </div>
  </div>
  ${c.source ? `<p class="l5" data-slot="source">${esc(c.source)}</p>` : ""}`;
}
function renderImageCaption(c) { // A10 이미지+캡션 전용(감사 ★1) — 캡션 하단 앵커(스크림 존)
  const ctr = { used: 0, budget };
  return `<div class="cap-spacer"></div>
  <div class="cap-block">
    ${c.kicker ? `<span class="pill" data-slot="kicker">${esc(c.kicker)}</span>` : ""}
    ${c.headline ? `<h2 class="cap-hl" data-slot="headline">${esc(c.headline)}</h2>` : ""}
    ${c.body ? `<p class="cap-body" data-slot="body">${inline(c.body, ctr)}</p>` : ""}
    ${c.source ? `<p class="l5" data-slot="source">${esc(c.source)}</p>` : ""}
  </div>`;
}
function renderStat(c) { // A4 빅넘버 전용(§3.4 위임)
  // dispnum 모드: {value,unit}가 히어로 수치, headline은 그 위 라벨(뱅크샐러드식 "라벨+큰수").
  // dispnum 없으면 legacy — headline 자체가 빅넘버. self-heal 수렴을 위해 codex의 자연 표현
  // (큰 숫자 + 서술 라벨)을 renderStat가 직접 수용(2026-07-05 factory 실측: dispnum stat 미지원이 3회 소진 원인).
  const hasDisp = c.dispnum && c.dispnum.value != null;
  const bigVal = hasDisp ? String(c.dispnum.value) : (c.headline || c.number || "");
  const bigUnit = hasDisp ? c.dispnum.unit : c.unit;
  // 진짜 kicker(짧은 아이브로우)만 pill. dispnum인데 kicker 없으면 headline을 '라벨'로 승격하되
  // pill이 아니라 일반 eyebrow로(서술형 문구를 pill에 넣으면 갑갑하고, 티어 pill 대비 p10 경계 이슈 — 2026-07-05 실측).
  const eyebrow = hasDisp && !c.kicker ? c.headline : null;
  // 빅넘버는 고정 480px(--fs-bignum). 폰트별 자폭 추정이 CSS에서 불신뢰라 반응형 축소는 회귀 유발 →
  // 넓은 4자+ raw 숫자 넘침은 '나쁜 bignum' 카피 이슈로 취급(factory_prompt compact 가이드 + G2 + self-heal 소관).
  return `<div class="stat-block">
    ${c.kicker ? `<span class="pill" data-slot="kicker">${esc(c.kicker)}</span>` : ""}
    ${eyebrow ? `<span class="stat-eyebrow" data-slot="kicker">${esc(eyebrow)}</span>` : ""}
    <div class="bignum" data-slot="bignum">${esc(bigVal)}${bigUnit ? `<span class="unit">${esc(bigUnit)}</span>` : ""}</div>
    ${c.body ? `<p class="stat-cap" data-slot="caption">${esc(c.body)}</p>` : ""}
  </div>
  ${c.source ? `<p class="l5" data-slot="source">${esc(c.source)}</p>` : ""}`;
}
function renderVs(c) { // A7 비교 2열 전용(§3.4 위임)
  const col = (side, i) => {
    const ctr = { used: 0, budget: 1 }; // 양 진영 각 1(§2.2)
    return `<div class="vs-col vs-col-${i}">
      <h3 class="vs-head" data-slot="headline">${esc(side.headline || "")}</h3>
      ${side.body ? `<p class="vs-body" data-slot="body">${inline(side.body, ctr)}</p>` : ""}
    </div>`;
  };
  const L = c.left || { headline: c.headline, body: c.body }, R = c.right || {};
  return `<div class="stack">
    ${c.kicker ? `<span class="pill" data-slot="kicker">${esc(c.kicker)}</span>` : ""}
    <div class="vs-grid">${col(L, 1)}<div class="vs-mark">VS</div>${col(R, 2)}</div>
  </div>
  ${c.source ? `<p class="l5" data-slot="source">${esc(c.source)}</p>` : ""}`;
}
function renderBridge(c) { // A12 전환/브릿지 — BAND-COVER 축소, 중앙
  return `<div class="bridge-block">
    <div class="bridge-hl" data-slot="headline">${esc(c.headline || "")}</div>
    ${c.subhead ? `<div class="sub" data-slot="subhead">${esc(c.subhead)}</div>` : ""}
  </div>`;
}
// ── newsprint 티어 전용(R9 goodgoodgoodco 이식) — 마스트헤드 + T3 기사카드 ──
// 재사용 가능한 마스트헤드: hairline 상/하 + 좌(series_wordmark)/우(masthead_right|tagline) 워드마크.
// series_wordmark 없으면 통째로 생략(레이아웃은 마스트헤드 없이도 완결 — 브리프 지시대로).
function renderMasthead() {
  if (!isNewsprint || !copy.series_wordmark) return "";
  const right = copy.masthead_right || copy.tagline || "";
  return `<div class="masthead">
    <div class="mh-rule"></div>
    <div class="mh-row"><span class="mh-left">${esc(copy.series_wordmark)}</span>${right ? `<span class="mh-right">${esc(right)}</span>` : ""}</div>
    <div class="mh-rule"></div>
  </div>`;
}
function renderNewsprintArticle(c) { // T3 기사카드 — image/renderImageCaption의 newsprint 변주(사진 풀블리드 캡션 대신 상단 사진블록+본문 좌정렬)
  const ctr = { used: 0, budget };
  const inset = c.inset_portrait?.src ? `<div class="np-inset"><img src="${c.inset_portrait.src}"></div>` : "";
  return `${inset}
  <div class="np-article">
    ${c.headline ? `<h2 class="np-hl" data-slot="headline">${inline(c.headline, ctr)}</h2>` : ""}
    ${c.body ? `<p class="np-deck" data-slot="body">${inline(c.body, ctr)}</p>` : ""}
  </div>
  ${c.source ? `<p class="np-credit" data-slot="source">${esc(c.source)}</p>` : ""}`;
}

const N = (copy.cards || []).length;
copy.cards.forEach((c) => {
  const idx = String(c.index).padStart(2, "0");
  // z0 배경 — 패턴 A=풀블리드, G=상단분할(§4.5 z0 스위치), 없으면 색면
  const isG = c.image_pattern === "G" && c.bg;
  // 패턴 D — CSS/SVG 블롭을 코드로 직접 그림(§4.0, 생성 아님). 카드 index로 결정론 배치.
  // 블롭 배치 규칙: tint(≈bg)는 어디든, hl 블롭은 고대비 슬롯 존(상단 밴드 y≤300·우측 마진)만 + 0.12 —
  // muted/supplement(4.5 마진 얇음) 슬롯 밑에 hl이 깔리면 G6+ 미달(§4.8 레버6 회피 원리)
  const blob = c.image_pattern === "D" && !c.bg ? (() => {
    const v = c.index % 3;
    const spots = [
      [[980, 170, 250, "tint"], [150, 140, 200, "hl"]],
      [[140, 180, 230, "hl"], [1000, 540, 260, "tint"]],
      [[1010, 300, 240, "hl"], [180, 640, 220, "tint"]],
    ][v];
    const el = spots.map(([cx, cy, r, kind]) =>
      `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${Math.round(r * 0.82)}" fill="var(--${kind})" opacity="${kind === "hl" ? 0.12 : 1}"/>`).join("");
    return `<svg class="deco-blob" width="1080" height="1350" viewBox="0 0 1080 1350" aria-hidden="true">${el}</svg>`;
  })() : "";
  const bg = c.bg
    ? (isG ? `<img class="bg bg--top" src="${c.bg}">` : `<img class="bg" src="${c.bg}">`)
    : (isNewsprint ? "" : `<div class="bg" style="background:var(--bg)"></div>`); // newsprint 무사진 카드는 body.tier-newsprint 텍스처가 그대로 비침(불투명 div로 가리지 않음)
  const scrim = c.overlay ? `<div class="overlay"></div>` : (c.scrim ? `<div class="scrim"></div>` : "");
  // z20 컷아웃(§4.5~4.7) — data-slot 아님(G11' 스코프), data-src로 occlusion 게이트가 알파 되읽음
  let cutout = "";
  if (c.cutout?.src) {
    const cw = c.cutout.width || 640;
    const pos = c.cutout.placement === "side_right"
      ? `right:-40px;bottom:0;width:${cw}px`
      : c.cutout.placement === "corner_br"
        ? `right:48px;bottom:0;width:${cw}px`
        : `left:50%;transform:translateX(-50%);bottom:0;width:${cw}px`;
    const cls = c.cutout.shadow === "float" ? "cutout float" : "cutout ground";
    const contact = c.cutout.shadow === "ground" ? `<div class="contact"></div>` : "";
    cutout = `<div class="${cls}" data-role="cutout" data-src="${c.cutout.src}" style="${pos}">
      <img src="${c.cutout.src}" style="width:100%;display:block">${contact}</div>`;
  }
  // 컷아웃이 우하단에 있으면 페이지 표기는 좌하단으로(가림 방지 — G17 brand 지적)
  const pageLeft = c.cutout?.src && (c.cutout.placement === "corner_br" || c.cutout.placement === "side_right");
  const pageTag = `<div class="page"${pageLeft ? ' style="left:96px;right:auto;bottom:30px"' : ""}>${c.index} / ${N}</div>`; // 좌측 이동 시 출처(l5)와 시각 분리(하단 30px)
  // 상시 고스트 워드마크(§7.7 A5 시그니처 — copy.series_wordmark 있을 때만, 우상단)
  const wm = (copy.series_wordmark && !isNewsprint) ? `<div class="wm">${esc(copy.series_wordmark)}</div>` : ""; // newsprint는 마스트헤드가 이미 워드마크를 표기 — 고스트 뱃지 중복/충돌 방지
  let inner = "";
  if (c.type === "cover") {
    // 키커는 pill(accent bg + on_acc 잉크, G3 보증 ≥4.5) — 맨몸 accent 텍스트는 밝은 surface에서 G6+ 미달
    inner = `${c.kicker ? `<span class="pill" data-slot="kicker">${esc(c.kicker)}</span>` : ""}
      <div class="cover-block">
        <div class="hl${c.headline_device === "band" ? " hl--band" : ""}" data-slot="headline">${esc(c.headline || "")}</div>
        ${c.subhead ? `<div class="sub" data-slot="subhead">${inline(c.subhead, { used: 0, budget: 1 })}</div>` : ""}
      </div>`;
  } else if (c.type === "cta" || c.type === "outro") {
    // 가짜 버튼 금지(사용자 반려 2026-07-05) — 정적 이미지 안 버튼 목업은 아마추어 티. 텍스트 큐로.
    const author = c.author || copy.author; // author-bar variant(garyvee) — 핸들 있으면 표기
    inner = `<div class="center-block">
        <div class="cta-hl" data-slot="headline">${esc(c.headline || "")}</div>
        ${c.body ? `<div class="bd" data-slot="body">${esc(c.body)}</div>` : ""}
        <div class="save-cue" data-slot="cta-pill">${esc(c.cta_label || "저장해두고 다시 보기")}</div>
        ${author?.handle ? `<div class="author-bar" data-slot="caption">${esc(author.handle)}${copy.series_wordmark ? ` · ${esc(copy.series_wordmark)}` : ""}</div>`
          : copy.series_wordmark ? `<div class="author-bar" data-slot="caption">— ${esc(copy.series_wordmark)} —</div>` : ""}
      </div>`;
  } else if (c.type === "quote") {
    inner = `<div class="mid-block"><div class="quote" data-slot="body">${esc(c.body || "")}</div>
      ${c.attribution ? `<div class="attr" data-slot="source">${esc(c.attribution)}</div>` : ""}</div>`;
  } else if (c.type === "source") {
    inner = `<div class="src-block"><div class="src" data-slot="body">${esc(c.body || "")}</div></div>`;
  } else if (c.type === "stat" && c.viz_kind === "chart") {
    inner = renderChart(c);
  } else if (c.type === "stat") {
    inner = renderStat(c);
  } else if (c.type === "comparison") {
    inner = renderVs(c);
  } else if (c.type === "hook" || c.body_mode === "bridge") {
    inner = renderBridge(c);
  } else if (c.type === "toc") {
    inner = renderToc(c);
  } else if (c.type === "timeline" || c.type === "list" || c.body_mode === "list") {
    inner = renderList(c, c.type === "timeline");
  } else if (c.type === "image") {
    inner = isNewsprint ? renderNewsprintArticle(c) : renderImageCaption(c);
  } else { // body/stat(chart) → 고계층 dense — A14 차트 전용 조판은 미구현 백로그(G19가 정직하게 FAIL시킴)
    inner = renderDense(c);
  }
  const roleClass = ({ cover: "card--cover", cta: "card--cta", outro: "card--cta", quote: "card--quote",
    stat: c.viz_kind === "chart" ? "card--chart" : "card--stat", comparison: "card--vs",
    hook: "card--bridge", toc: "card--toc", timeline: "card--list", list: "card--list", image: "card--image" })[c.type] || "card--dense";
  const stepClass = (c.type === "timeline" || c.body_mode === "list") ? " is-step" : "";
  const topimgClass = isG ? " has-topimg" : "";
  const bgClass = c.bg && !isG ? " has-bg" : ""; // 풀블리드 사진 위 — muted 감쇠 금지(사진 노이즈가 대비 마진 잠식, 2026-07-05 실측 4.47)
  const cutClass = c.cutout?.src ? " has-cutout" : "";
  const masthead = renderMasthead(); // newsprint 전용, 없으면 빈 문자열(다른 티어 무영향)
  const mastheadClass = masthead ? " has-masthead" : "";

  const html = `<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=1080,height=1350">
<style>
${fontCSS}
:root{${rootVars}}
*{margin:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;overflow:hidden;background:var(--bg);color:var(--ink);font-family:${bfS};word-break:keep-all}
.bg{position:absolute;inset:0;width:1080px;height:1350px;object-fit:cover;z-index:0}
.bg--top{inset:auto;top:0;left:0;height:520px}
.deco-blob{position:absolute;inset:0;z-index:0;pointer-events:none}
/* 스크림·오버레이는 티어 surface 기반 — 다크 티어=어둡게, 라이트 티어=밝게 (다크 고정 rgba는 라이트 잉크와 충돌, 2026-07-05 실측) */
.scrim{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(to top, color-mix(in srgb, var(--bg) 92%, transparent) 0%, color-mix(in srgb, var(--bg) 40%, transparent) 42%, transparent 62%)}
.overlay{position:absolute;inset:0;z-index:1;pointer-events:none;background:color-mix(in srgb, var(--bg) 72%, transparent)} /* photo-info(뉴닉): 강한 워시(72% — 판정단 '유령 배경' 지적으로 78→72 보정) */
.wrap{position:absolute;inset:0;padding:96px;z-index:10;display:flex;flex-direction:column}
.wrap.has-topimg{padding-top:568px}
.cutout{position:absolute;z-index:20;pointer-events:none}
.cutout.ground{filter:drop-shadow(0 20px 24px rgba(0,0,0,.30))}
.cutout.ground .contact{position:absolute;left:12%;right:12%;bottom:-18px;height:46px;background:radial-gradient(ellipse, rgba(0,0,0,.35) 0%, transparent 70%);filter:blur(20px)}
.cutout.float{transform:translateY(-6%);filter:drop-shadow(0 40px 56px rgba(0,0,0,.18))}
/* ── 공용 장치(§3.2·§6.3 — 네임스페이스, 기존 클래스 비충돌) ── */
mark.hl-pen{color:inherit;background:transparent;background-image:linear-gradient(color-mix(in srgb, var(--hl) calc(var(--hl-alpha)*100%), transparent), color-mix(in srgb, var(--hl) calc(var(--hl-alpha)*100%), transparent));background-repeat:no-repeat;background-size:100% var(--hl-cover);background-position:0 88%;padding:0 .04em;box-decoration-break:clone}
strong.wj{font-weight:700;color:var(--ink)}
strong.wj-acc{font-weight:700;color:var(--acc)}
.l1--bar{position:relative;padding-bottom:.28em}
.l1--bar::after{content:"";position:absolute;left:0;bottom:0;width:.72em;height:var(--underline-bar);background:var(--acc);border-radius:2px}
.pill{display:inline-block;align-self:flex-start;padding:.26em .72em;border-radius:var(--pill-radius);background:var(--pill-bg);color:var(--pill-ink);font-family:${afS};font-weight:var(--kicker-weight);font-size:var(--kicker-px);line-height:1;letter-spacing:.04em}
.kicker{align-self:flex-start;color:var(--acc);font-weight:700;font-family:${afS};font-size:38px;letter-spacing:.06em}
/* ── dense L0~L5(§3.3) — F패턴 좌상단 앵커 + 2축 감쇠 ── */
.card--dense .stack,.card--stat .stat-block,.card--vs .stack,.card--toc .stack,.card--list .stack{display:flex;flex-direction:column;align-items:flex-start;gap:var(--block-gap);text-align:left;margin-top:0}
/* ── 3존 세로채움(규칙C v2.1 — 감사 ★2·★4): z1 헤더 / z2 히어로(flex:1 중앙) / L5 하단 ── */
.card--dense .stack,.card--toc .stack,.card--list .stack{flex:1;width:100%}
.z1{display:flex;flex-direction:column;align-items:flex-start;gap:.9em;width:100%}
.z2{flex:1;display:flex;flex-direction:column;justify-content:flex-start;align-items:flex-start;gap:1.15em;width:100%;padding:24px 0}
.z2::before{content:"";flex:2}
.z2::after{content:"";flex:3} /* 히어로 무게중심 40:60 상향(G17 판정 2·3호기: 헤더-본문 허공 밴드 축소) */
.has-topimg .z2{padding:16px 0}
.dispnum{font-family:${tfS};font-weight:900;font-size:210px;line-height:1;letter-spacing:-0.03em;color:var(--ink)}
.dispnum .unit{font-size:.36em;color:inherit;margin-left:.08em} /* muted 금지 — 슬롯 내 이색 픽셀이 G6 p10을 깎음(2026-07-05 실측) */
.has-topimg .dispnum{font-size:150px}
.z2-panel{display:flex;flex-direction:column;gap:1em;width:100%;background:color-mix(in srgb, var(--ink) 5%, var(--bg));border-left:8px solid var(--acc);border-radius:${Math.max(radius, 0)}px;padding:52px 48px}
.z2-panel .l4{color:var(--ink-body)} /* 패널 위 muted 대비 미달(4.16 실측) — ink-body로 */
/* ── blocks 다중 블록(R8-C 층 적층) ── */
.blk-bullets{display:flex;flex-direction:column;gap:.6em;list-style:none;width:100%;margin:0;padding:0}
.blk-bullets li{font-family:${bfS};font-size:44px;line-height:1.5;color:var(--ink-body);padding-left:1.05em;position:relative;word-break:keep-all}
.blk-bullets li::before{content:"";position:absolute;left:0;top:.5em;width:15px;height:15px;border-radius:5px;background:var(--acc)}
.blk-callout{width:fit-content;max-width:100%;border-left:6px solid var(--acc);padding:6px 0 6px 34px}
.blk-callout-label{display:block;font-family:${afS};font-weight:700;font-size:28px;color:var(--acc);margin-bottom:.4em;letter-spacing:.05em}
.blk-callout-text{font-family:${bfS};font-size:34px;line-height:1.55;color:var(--ink-muted);word-break:keep-all} /* 34px·muted — 본문과 2축 위계(G15) + 무틴트 배경(G6) */
.has-bg .blk-callout-text,.has-bg .l4{color:var(--ink-body);font-weight:600} /* 사진 위 muted 금지 — 색 축 대신 굵기 축(Δ200)으로 위계(G15) */
.blk-icons{display:grid;grid-template-columns:repeat(2,1fr);gap:28px;width:100%}
.blk-icon-cell{display:flex;flex-direction:column;align-items:flex-start;gap:18px;background:color-mix(in srgb, var(--ink) 5%, var(--bg));border:var(--rule-hair) solid var(--hairline);border-radius:${Math.max(radius, 0)}px;padding:36px}
.blk-icon-cell svg{color:var(--acc)}
.blk-icon-label{font-family:${bfS};font-weight:600;font-size:38px;color:var(--ink);line-height:1.35;word-break:keep-all}
/* ── 밴드 헤드라인(뉴닉 시그니처 — pill 페어 색으로 G3 대비 보증) ── */
.l1--band{display:inline;align-self:flex-start;background:var(--pill-bg);color:var(--pill-ink);padding:.06em .24em;border-radius:8px;box-decoration-break:clone;-webkit-box-decoration-break:clone}
.hl--band{display:inline;background:var(--pill-bg);color:var(--pill-ink);padding:.04em .18em;border-radius:10px;box-decoration-break:clone;-webkit-box-decoration-break:clone;line-height:1.32} /* 표지 밴드 — inline+clone = 줄 단위 타이트 밴드(통짜 패널 우측 허공 지적 해소) */
/* ── toc(A2) — 번호 badge + 등간격 행 + hairline(§3 목차 스펙) ── */
.toc-rows{flex:1;display:flex;flex-direction:column;justify-content:space-evenly;width:100%;margin-top:40px}
.toc-row{display:flex;align-items:center;gap:44px;padding:22px 0;border-top:var(--rule-hair) solid var(--hairline)}
.toc-row--first{border-top:none}
.toc-no{font-family:${tfS};font-weight:800;font-size:46px;color:var(--acc);min-width:84px;letter-spacing:.02em}
.toc-label{font-family:${bfS};font-weight:600;font-size:56px;color:var(--ink);letter-spacing:-0.01em;line-height:1.3}
.swipe-cue{margin-top:28px;font-family:${afS};font-size:30px;color:var(--ink-muted);letter-spacing:.08em}
/* toc variant: pill(캐릿 — 원형 번호) */
.toc--pill .toc-row{border-top:none;padding:16px 0}
.toc--pill .toc-no{display:flex;align-items:center;justify-content:center;width:74px;height:74px;min-width:74px;border-radius:999px;background:var(--pill-bg);color:var(--pill-ink);font-size:30px}
/* toc variant: band(토스 — 항목=색밴드 반복) */
.toc--band .toc-row{border-top:none;background:var(--pill-bg);border-radius:${Math.max(radius, 10)}px;padding:26px 38px}
.toc--band .toc-no{color:var(--pill-ink);opacity:.8;min-width:74px}
.toc--band .toc-label{color:var(--pill-ink)}
.author-bar{margin-top:34px;font-family:${afS};font-weight:700;font-size:32px;color:var(--ink-muted);letter-spacing:.04em}
/* ── list/timeline(A5/A8) — 패널 행 + 원형 번호 뱃지(질량 채움, D3 박스/블록 장치) ── */
.li-rows{flex:1;display:flex;flex-direction:column;justify-content:center;gap:36px;width:100%;margin-top:40px}
.li-row{display:flex;align-items:center;gap:36px;background:color-mix(in srgb, var(--ink) 5%, var(--bg));border:var(--rule-hair) solid var(--hairline);border-radius:${Math.max(radius, 0)}px;padding:38px 44px}
.li-no{display:flex;align-items:center;justify-content:center;min-width:80px;width:80px;height:80px;border-radius:999px;background:var(--pill-bg);color:var(--pill-ink);font-family:${tfS};font-weight:800;font-size:34px}
.li-text{font-family:${bfS};font-weight:600;font-size:56px;line-height:1.4;color:var(--ink)}
.li-rows--compact{gap:22px}
.li-rows--compact .li-row{padding:26px 36px}
.li-rows--compact .li-text{font-size:48px}
/* ── image+caption(A10) — 캡션 하단 앵커 ── */
.cap-spacer{flex:1}
.card--image .cap-block{display:flex;flex-direction:column;align-items:flex-start;gap:26px}
.cap-hl{font-family:${tfS};font-weight:800;font-size:84px;line-height:1.2;color:var(--ink)}
.cap-body{font-family:${bfS};font-size:52px;line-height:1.55;color:var(--ink-body)}
.l1{font-family:${tfS};font-weight:800;font-size:var(--l1);line-height:1.18;letter-spacing:var(--ls-title);color:var(--ink)}
.l2{font-family:${bfS};font-weight:400;font-size:var(--l2);line-height:var(--lh-body);letter-spacing:var(--ls-body);color:var(--ink-body);word-break:keep-all}
.l4{font-size:var(--l4);line-height:1.5;color:var(--ink-muted);padding-left:.9em;border-left:2px solid var(--hairline);width:fit-content;max-width:100%}
/* source(.l5)=인용, 작은 텍스트라 WCAG 4.5 필요하나 body보다 밝아야 G15 계층(색축) 유지 →
   ink_muted 유지하되 각 티어가 muted를 밝은 surface에서 ≥4.5로 맞춰야 함(news·brand white #6E6E6E=3.20 수리). */
.l5{margin-top:auto;margin-bottom:14px;font-size:var(--l5);line-height:1.4;color:var(--ink-muted);border-top:var(--rule-hair) solid var(--hairline);padding-top:.55em;width:fit-content;max-width:100%;padding-right:.8em}
.is-step .step-no{color:var(--acc);font-weight:800;margin-right:.35em}
/* ── 저계층: cover/CTA/quote/bridge(§3.4) ── */
.card--cover .cover-block{margin-top:auto;display:flex;flex-direction:column;align-items:flex-start}
.card--cover .hl,.card--cover .sub{width:fit-content} /* bbox=실제 글리프 폭 — occlusion/overflow 실측 정밀화 */
.card--cover.has-cutout .cover-block{margin-top:64px} /* §4.7 텍스트 밴드(상단)↔컷아웃 존(하단) 분리 */
.card--cover .hl{font-family:${tfS};font-weight:900;font-size:var(--fs-cover);line-height:1.12;letter-spacing:-0.035em;color:var(--ink)}
.sub{font-family:${bfS};font-size:${arr(T.body_px, 1, 52)}px;line-height:1.5;margin-top:36px;color:var(--ink-body)}
.card--cta .center-block{text-align:center;margin:auto 0;display:flex;flex-direction:column;align-items:center}
.card--cta .cta-hl{font-family:${tfS};font-weight:900;font-size:108px;line-height:1.15}
.card--quote .mid-block{margin:auto 0}
.card--quote .quote{font-family:${tfS};font-weight:800;font-size:80px;line-height:1.35;text-align:left}
.card--quote .attr{font-size:36px;color:var(--ink-muted);margin-top:32px}
.card--bridge .bridge-block{margin:auto 0;text-align:center}
.card--bridge .bridge-hl{font-family:${tfS};font-weight:900;font-size:120px;line-height:1.15;letter-spacing:-0.03em}
/* ── stat/vs 전용(§3.4 위임계약) ── */
.card--stat .stat-block{margin:auto 0;align-items:center;text-align:center;width:100%}
.card--stat .bignum{font-family:${tfS};font-weight:900;font-size:var(--fs-bignum);line-height:0.9;letter-spacing:-0.04em;color:var(--ink)}
.card--stat .bignum .unit{font-size:0.2em;color:var(--ink-muted);margin-left:.1em}
.card--stat .stat-cap{font-family:${bfS};font-size:48px;line-height:1.5;color:var(--ink-body)}
/* dispnum stat의 서술형 라벨 — pill 아닌 ink 아이브로우(전 티어 대비 안전, p10 경계 회피) */
.card--stat .stat-eyebrow{font-family:${afS};font-size:var(--kicker-px,30px);font-weight:800;letter-spacing:.01em;color:var(--ink);margin-bottom:.35em;display:block}
.card--vs .stack{flex:1;width:100%}
.card--vs .vs-grid{display:flex;flex-direction:column;gap:26px;width:100%;flex:1;justify-content:center} /* 위아래 스택 — 좌우 2열은 한국어 가독 불가(사용자 반려 2026-07-05) */
.card--vs .vs-col{border-radius:${Math.max(radius, 0)}px;padding:48px 42px;display:flex;flex-direction:column;justify-content:center}
.card--vs .vs-col-1{background:color-mix(in srgb, var(--ink) 6%, var(--bg));border:var(--rule-hair) solid var(--hairline)}
.card--vs .vs-col-2{background:color-mix(in srgb, var(--acc) 16%, var(--bg));border:2px solid var(--acc)}
.card--vs .vs-head{font-family:${tfS};font-weight:800;font-size:80px;line-height:1.2;color:var(--ink)}
.card--vs .vs-body{font-family:${bfS};font-size:var(--l2);line-height:1.55;color:var(--ink-body);word-break:keep-all;margin-top:.6em}
.card--vs .vs-mark{display:flex;align-items:center;justify-content:center;width:92px;height:92px;border-radius:999px;background:var(--pill-bg);color:var(--pill-ink);font-family:${tfS};font-weight:900;font-size:38px;align-self:center;margin:-10px 0;z-index:1}
/* ── 기타 기존 ── */
.mid-block,.src-block{margin:auto 0}
.bd{font-family:${bfS};font-size:var(--fs-body-single);line-height:var(--lh-body);margin-top:28px;color:var(--ink-body)}
.src{font-family:${bfS};font-size:36px;color:var(--ink-muted);line-height:1.5}
.save-cue{margin-top:56px;padding-top:30px;border-top:var(--rule-hair) solid var(--hairline);font-family:${afS};font-weight:600;font-size:36px;color:var(--ink-body);letter-spacing:.05em}
/* ── chart(A14) — deck-charts 인라인 SVG ── */
.card--chart .stack{flex:1;width:100%}
.chart-box{width:100%}
.chart-box svg{width:100%;height:auto;display:block}
.chart-cap{font-family:${bfS};font-size:44px;line-height:1.55;color:var(--ink-body)}
.page{position:absolute;right:96px;bottom:72px;z-index:11;font-family:${bfS};font-size:30px;color:var(--ink-faint,var(--ink-muted));letter-spacing:.1em}
.wm{position:absolute;right:96px;top:100px;z-index:11;font-family:${afS};font-weight:700;font-size:26px;color:var(--ink-faint,var(--ink-muted));letter-spacing:.14em;opacity:.75}
/* ══ newsprint 티어 전용(R9 goodgoodgoodco 이식) — .tier-newsprint 스코프, 타 티어 무영향 ══ */
body.tier-newsprint{background-color:var(--bg);
  background-image:
    repeating-linear-gradient(90deg, color-mix(in srgb, var(--ink) 3.2%, transparent) 0px, transparent 2px, transparent 34px, color-mix(in srgb, var(--ink) 2%, transparent) 36px, transparent 38px),
    radial-gradient(ellipse 620px 900px at 8% 6%, color-mix(in srgb, var(--ink) 3.5%, transparent), transparent 60%),
    radial-gradient(ellipse 560px 820px at 96% 98%, color-mix(in srgb, var(--ink) 3%, transparent), transparent 58%);
} /* 신문지 텍스처 — CSS 반복그라데이션+비네트(결정론, 외부 이미지/생성이미지 없음). body 배경이라 무사진 카드(.bg 미방출)·상단사진 카드 하단 여백 모두 자동 노출 */
.tier-newsprint .bg--top{top:150px;height:620px} /* T3 사진블록 ~46%(브리프 55%보다 축소 — G11 세이프존 내 2줄 헤드라인+2줄 데크+크레딧 확보가 우선) */
.tier-newsprint .wrap.has-topimg{padding-top:790px}
.tier-newsprint .pill{background:transparent;color:var(--ink);padding:0;border-radius:0;letter-spacing:.02em;line-height:1.3;max-width:88%}
.tier-newsprint .card--cover .hl{letter-spacing:-0.045em;line-height:1.05}
.tier-newsprint .card--cover.has-masthead::after{content:"";position:absolute;left:96px;right:96px;bottom:130px;height:var(--rule-hair);background:var(--ink)} /* 커버 하단 hairline(단독, 텍스트 없음) */
.masthead{position:absolute;left:96px;right:96px;top:64px;z-index:15}
.mh-rule{height:var(--rule-bold);background:var(--ink)}
.mh-row{display:flex;justify-content:space-between;align-items:baseline;padding:16px 2px;font-family:${afS};font-weight:800;font-size:32px;letter-spacing:.14em;color:var(--ink)}
.mh-right{color:var(--ink-body)}
.wrap.has-masthead{padding-top:158px}
.tier-newsprint .card--cover .sub{margin-top:20px}
.np-inset{position:absolute;right:96px;top:590px;width:160px;height:160px;border-radius:50%;overflow:hidden;z-index:9;background:var(--bg);box-shadow:0 0 0 8px var(--bg), 0 0 0 11px var(--ink)} /* 사진블록(150~770) 안에 완전히 담기도록 하단 20px 여유 — 헤드라인(790~) 침범 방지 */
.np-inset img{width:100%;height:100%;object-fit:cover;display:block}
.np-article{display:flex;flex-direction:column;align-items:flex-start;gap:22px;width:100%}
.np-hl{font-family:${bfS};font-weight:900;font-size:86px;line-height:1.2;letter-spacing:-0.01em;color:var(--ink);word-break:keep-all;text-align:left}
.np-deck{font-family:${bfS};font-weight:400;font-size:44px;line-height:1.5;color:var(--ink-body);word-break:keep-all;text-align:left}
.np-credit{margin-top:auto;align-self:flex-end;text-align:right;width:fit-content;max-width:70%;font-family:${bfS};font-size:28px;line-height:1.4;color:var(--ink-muted);border-top:var(--rule-hair) solid var(--hairline);padding-top:.5em} /* ink_muted(≥4.5 실측) — ink_faint는 소형 데이터슬롯에 gate 미달 */
</style></head><body class="tier-${tok.tier}">
${bg}
${blob}
${scrim}
${masthead}
<div class="wrap ${roleClass}${stepClass}${topimgClass}${bgClass}${cutClass}${mastheadClass}">${inner}</div>
${cutout}
${wm}
${pageTag}
</body></html>`;
  writeFileSync(join(outDir, `card-${idx}.html`), html);
});
console.log(`✓ carousel v2 — ${N}장 카드 HTML 생성 (tier=${tok.tier}, schema=${tok.schema_version || "v1"}) → ${outDir}`);
