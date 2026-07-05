#!/usr/bin/env node
// S7 쇼츠 컴포지션 빌더 v2 — 쇼츠 = 완성된 캐러셀 카드의 파생.
// carousel/card-NN.html(1080x1350, self-contained)을 씬 단위로 그대로 임베드해 9:16 HyperFrames
// index.html을 만든다. copy/storyboard에서 독자적으로 재렌더하지 않는다 — 카드 완성도가 그대로
// 영상에 전달되는 게 핵심 원칙(구v1은 카피에서 재조판해 카드 디자인이 0% 전달되는 문제가 있었음).
// 사용: node build_shorts.mjs <projectDir> → <projectDir>/shorts/index.html
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, cpSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SPECS = JSON.parse(readFileSync(join(HERE, "../../references/shorts-specs.json"), "utf8"));
const GATECFG = JSON.parse(readFileSync(join(HERE, "../gates/gate-config.json"), "utf8"));

const proj = resolve(process.argv[2] || ".");
const rd = (f) => JSON.parse(readFileSync(join(proj, f), "utf8"));
const copy = rd("copy.json");
const byIndex = new Map((copy.cards || []).map((c) => [c.index, c]));

const carouselDir = join(proj, "carousel");
const outDir = join(proj, "shorts");
mkdirSync(outDir, { recursive: true });

// ── 카드 자산(fonts/bg 등) 미러링 — 카드 HTML의 상대경로(assets/...)가 그대로 통하게 ──
const assetsSrc = join(carouselDir, "assets");
if (existsSync(assetsSrc)) cpSync(assetsSrc, join(outDir, "assets"), { recursive: true });

// ── 스펙 값(하드코딩 금지 — shorts-specs.json / gate-config.json에서 읽음) ──
const V = GATECFG.video; // { width, height, fps, codec }
const SAFE = GATECFG.safe_zone.shorts_9_16; // { x:[..], y:[..] }
const DWELL = GATECFG.dwell; // { cps, add_seconds, floor_seconds, video_card_min }
const HOOK_SECONDS = SPECS.hook_seconds?.value ?? 3;
// 카드당 체류 상한 — shorts-specs.json card_duration_seconds.max(4s). 한 카드=한 아이디어이므로
// 연속 모션(Ken Burns) 위에서 2~4s 홀드가 리텐션 스윗스팟. 상한 없으면 긴 본문 카드가
// 릴스 전체를 60s 권장선 위로 밀어올림(R4 실측 134.9s → 상한 적용 근거).
const CARD_MAX = SPECS.card_duration_seconds?.max ?? 4;

// ── 카드 파일 수집(carousel/card-NN.html, .orig 등 제외) ──
const cardFiles = readdirSync(carouselDir)
  .filter((f) => /^card-\d+\.html$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
if (!cardFiles.length) { console.error(`✗ ${carouselDir}에 card-NN.html 없음`); process.exit(1); }

// ── CSS 스코프 유틸: :root/html,body는 씬 컨테이너 자체로, 나머지는 후손 셀렉터로 ──
function splitTopLevel(css) {
  const out = []; let depth = 0, buf = "";
  for (const ch of css) {
    buf += ch;
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { out.push(buf); buf = ""; } }
  }
  return out.map((s) => s.trim()).filter(Boolean);
}
function splitSelectors(sel) {
  const out = []; let depth = 0, buf = "";
  for (const ch of sel) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(buf); buf = ""; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out;
}
function scopeSelector(sel, scopeClass) {
  const s = sel.trim();
  if (s === ":root") return `.${scopeClass}`;
  if (/^(html\s*,\s*body|html|body)$/.test(s)) return `.${scopeClass}`;
  if (s === "*") return `.${scopeClass} *`;
  return `.${scopeClass} ${s}`;
}
function scopeCss(css, scopeClass) {
  const fontFaces = [];
  const scoped = [];
  for (const stmt of splitTopLevel(css)) {
    const braceIdx = stmt.indexOf("{");
    if (braceIdx === -1) continue;
    const head = stmt.slice(0, braceIdx).trim();
    const body = stmt.slice(braceIdx + 1, stmt.length - 1);
    if (/^@font-face/i.test(head)) { fontFaces.push(stmt); continue; }
    if (head.startsWith("@")) {
      const inner = scopeCss(body, scopeClass);
      scoped.push(`${head}{${inner.css}}`);
      fontFaces.push(...inner.fontFaces);
      continue;
    }
    const newSel = splitSelectors(head).map((s) => scopeSelector(s, scopeClass)).join(",");
    scoped.push(`${newSel}{${body}}`);
  }
  return { css: scoped.join("\n"), fontFaces };
}

function extractRootVars(css) {
  const m = css.match(/:root\s*\{([^}]*)\}/);
  const vars = {};
  if (m) for (const decl of m[1].split(";")) {
    const i = decl.indexOf(":");
    if (i === -1) continue;
    const k = decl.slice(0, i).trim(), v = decl.slice(i + 1).trim();
    if (k.startsWith("--")) vars[k] = v;
  }
  return vars;
}

const decodeEntities = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'");

// 씬 dwell 계산용: wm/page 코너 표기는 "읽는 내용"이 아니므로 글자수 계산에서 제외
function textLenOf(bodyHtml) {
  const s = bodyHtml
    .replace(/<div class="wm">[\s\S]*?<\/div>/g, "")
    .replace(/<div class="page">[\s\S]*?<\/div>/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return [...decodeEntities(s).replace(/\s+/g, " ").trim()].length;
}

// 매니페스트(G20 대조용): 카드 안 첫 [data-slot="headline"] 텍스트 추출
function firstHeadlineOf(bodyHtml) {
  const m = bodyHtml.match(/<(\w+)[^>]*\bdata-slot="headline"[^>]*>([\s\S]*?)<\/\1>/);
  if (!m) return "";
  const s = m[2].replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ");
  return decodeEntities(s).replace(/\s+/g, " ").trim();
}

// ── 세이프존 안에서 카드 세로 위치 균형(치우침 최소화) — 카드가 세이프박스보다 크면
//    위/아래 침범량이 같아지는 지점이 최소-최대-침범 지점(표준 결과). 하드코딩 금지, SAFE에서 계산.
const [firstW, firstH] = (() => {
  const first = readFileSync(join(carouselDir, cardFiles[0]), "utf8");
  const vp = first.match(/width=(\d+)\s*,?\s*height=(\d+)/);
  return vp ? [parseInt(vp[1], 10), parseInt(vp[2], 10)] : [1080, 1350];
})();
const topOffset = Math.round((SAFE.y[0] + SAFE.y[1] - firstH) / 2);
const bottomBandH = V.height - topOffset - firstH;

// ── 카드별 파싱 + 씬 조립 ──
let t = 0;
const clips = [], tlLines = [], scopedStyles = [], allFontFaces = [];
const manifest = [];
const total = cardFiles.length;

cardFiles.forEach((file, i) => {
  const idx = parseInt(file.match(/\d+/)[0], 10);
  const html = readFileSync(join(carouselDir, file), "utf8");
  const styleM = html.match(/<style>([\s\S]*?)<\/style>/);
  const bodyM = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  const rawCss = styleM ? styleM[1] : "";
  const rawBody = bodyM ? bodyM[1] : "";
  const scopeClass = `scene-${idx}`;

  const rootVars = extractRootVars(rawCss);
  const bg = rootVars["--bg"] || "#111111";
  const ink = rootVars["--ink"] || "#FFFFFF";
  const acc = rootVars["--acc"] || "#FF6A00";

  const { css: scopedCss, fontFaces } = scopeCss(rawCss, scopeClass);
  scopedStyles.push(`/* ${file} */\n${scopedCss}`);
  allFontFaces.push(...fontFaces);

  const isCover = /class="[^"]*\bcard--cover\b[^"]*"/.test(rawBody);
  const len = textLenOf(rawBody);
  const rawDur = len / DWELL.cps + DWELL.add_seconds;
  // ms 정밀도로 먼저 반올림한 뒤 누적 — start/dur를 각각 toFixed(3)로 표시할 때
  // 부동소수 누적오차로 인접 클립이 1ms씩 겹치는 걸 방지(결정론 겹침 방지).
  // 바닥(가독 최소 체류) 먼저 보장 → 천장(카드당 상한)으로 클램프. 커버 카드는 훅 구간이라 상한 예외.
  const durFloored = Math.max(rawDur, DWELL.video_card_min, DWELL.floor_seconds);
  const dur = Math.round((isCover ? durFloored : Math.min(durFloored, CARD_MAX)) * 1000) / 1000;
  const start = Math.round(t * 1000) / 1000;
  t = start + dur;

  manifest.push({ index: idx, headline: firstHeadlineOf(rawBody) });

  // 진행 인디케이터(점) — 씬마다 고정 마크업이라 GSAP 불필요(결정론)
  const dots = cardFiles.map((_, di) => {
    const active = di === i;
    return `<span class="dot${active ? " active" : ""}" style="background:${active ? acc : ink};opacity:${active ? 1 : 0.32};width:${active ? 26 : 14}px"></span>`;
  }).join("");

  clips.push(`<div class="clip" id="scene-${idx}" data-start="${start.toFixed(3)}" data-duration="${dur.toFixed(3)}" data-track-index="0">
  <div class="letterbox" style="background:${bg}"></div>
  <div class="wordmark" style="height:${topOffset}px;color:${ink}">${decodeEntities(copy.series_wordmark || "")}</div>
  <div id="cardbox-${idx}" class="${scopeClass}" style="top:${topOffset}px">
${rawBody}
  </div>
  <div class="progress" style="top:${topOffset + firstH + 40}px">${dots}</div>
</div>`);

  // ── 모션(요소가 없으면 GSAP 셀렉터가 빈 배열 → 자연히 no-op) ──
  const entranceDur = Math.min(HOOK_SECONDS, dur * 0.8);
  tlLines.push(`tl.fromTo("#cardbox-${idx}",{scale:1},{scale:1.045,duration:${dur.toFixed(3)},ease:"none"},${start.toFixed(3)});`);
  if (isCover) {
    tlLines.push(`tl.from("#scene-${idx} .cover-block",{opacity:0,scale:0.82,duration:${entranceDur.toFixed(3)},ease:"power3.out"},${start.toFixed(3)});`);
  } else {
    tlLines.push(`tl.from("#scene-${idx} .z1",{opacity:0,y:50,duration:0.6,ease:"power2.out"},${(start + 0.1).toFixed(3)});`);
  }
  tlLines.push(`tl.from("#scene-${idx} .li-row, #scene-${idx} .blk-bullets li, #scene-${idx} .blk-icon-cell",{opacity:0,y:30,duration:0.5,stagger:0.12,ease:"power2.out"},${(start + 0.35).toFixed(3)});`);
  tlLines.push(`tl.from("#scene-${idx} .dispnum",{opacity:0,scale:0.7,duration:0.5,ease:"back.out(1.7)"},${(start + 0.25).toFixed(3)});`);
  tlLines.push(`tl.fromTo("#scene-${idx} .chart-box",{scaleX:0.05},{scaleX:1,duration:0.7,ease:"power2.out",transformOrigin:"left center"},${(start + 0.3).toFixed(3)});`);
  tlLines.push(`tl.from("#scene-${idx} .cutout",{opacity:0,scale:0.85,duration:0.5,ease:"back.out(1.5)"},${(start + 0.2).toFixed(3)});`);
});

const totalDur = Math.round(t * 100) / 100;

// font-face 중복 제거(카드마다 동일 폰트 반복 선언 — 1회만)
const uniqFonts = [...new Set(allFontFaces.map((s) => s.trim()))];

const manifestJson = JSON.stringify(manifest).replace(/</g, "\\u003c");

const htmlOut = `<!doctype html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=${V.width}, height=${V.height}">
<title>shorts</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
${uniqFonts.join("\n")}
*{margin:0;box-sizing:border-box}
html,body{width:${V.width}px;height:${V.height}px;overflow:hidden;background:#000;font-family:'Pretendard',sans-serif}
.clip{position:absolute;inset:0;overflow:hidden}
.letterbox{position:absolute;inset:0}
.wordmark{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:center;
  font-family:'Pretendard',sans-serif;font-weight:700;font-size:34px;letter-spacing:.08em;opacity:.82}
[id^="cardbox-"]{position:absolute;left:${(V.width - firstW) / 2}px;width:${firstW}px;height:${firstH}px;transform-origin:center center}
.progress{position:absolute;left:0;right:0;display:flex;align-items:center;justify-content:center;gap:14px}
.progress .dot{display:inline-block;height:14px;border-radius:999px;transition:none}
${scopedStyles.join("\n")}
</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${totalDur}" data-width="${V.width}" data-height="${V.height}">
${clips.join("\n")}
</div>
<script type="application/json" id="scene-manifest">${manifestJson}</script>
<script>
window.__timelines=window.__timelines||{};
const tl=gsap.timeline({paused:true});
${tlLines.join("\n")}
window.__timelines["main"]=tl;
</script></body></html>`;

writeFileSync(join(outDir, "index.html"), htmlOut);
console.log(`✓ shorts/index.html 빌드 — ${total}씬 ${totalDur}초 (카드 ${firstW}x${firstH}, topOffset=${topOffset}px, bottomBand=${bottomBandH}px)`);
