#!/usr/bin/env node
// S3+ 차트 렌더러 — copy.json의 chart 카드(viz_kind:"chart")를 echarts SSR로 가로 바 차트 SVG 방출.
// 사용: node render_chart.mjs <projectDir>
// echarts SSR: CARDSHORTS_ECHARTS 또는 기본 scripts/node_modules/echarts 에서 직접 import.
// 산출: <projectDir>/assets/chart/card-NN.svg (viewBox 900x560, 배경 투명, font-family: Pretendard 상속)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ECHARTS_PATH = process.env.CARDSHORTS_ECHARTS || resolve(ROOT, "scripts/node_modules/echarts/index.js");
const VIEWPORT = { width: 900, height: 560 }; // 기본값 — 실제 높이는 항목 수 기반(아래 chartHeight)

const proj = resolve(process.argv[2] || "");
if (!proj || !existsSync(proj)) { console.error("✗ projectDir 없음: " + (process.argv[2] || "(미지정)")); process.exit(1); }

const copyPath = join(proj, "copy.json");
if (!existsSync(copyPath)) { console.error("✗ copy.json 없음: " + copyPath); process.exit(1); }
const copy = JSON.parse(readFileSync(copyPath, "utf8"));

const tokensPath = join(proj, "tokens.json");
const tokens = existsSync(tokensPath) ? JSON.parse(readFileSync(tokensPath, "utf8")) : {};
const cssVars = tokens.css_vars || {};
const palette = tokens.palette || {};
const colorInk = cssVars["--ink"] || palette.fg || "#F6F1E8";
const colorAcc = cssVars["--acc"] || palette.accent || "#C8B08A";
const colorMuted = cssVars["--ink-muted"] || cssVars["--ink"] || "#8a8a8a";
const colorInkMuted = cssVars["--ink-muted"] || palette.ink_muted || "#9A968C";
const colorHairline = cssVars["--hairline"] || palette.hairline || "#23252A";

const cards = Array.isArray(copy.cards) ? copy.cards : [];
const chartCards = cards.filter((c) => c && c.chart);

if (chartCards.length === 0) {
  console.log("차트 카드 없음 — 스킵");
  process.exit(0);
}

// "7시간 41분" → 461, "48%" → 48, "-8분" → -8, "+4.6%p" → 4.6(부호 보존). 파싱 불가면 fail-closed.
// 델타/증감 표기(±)는 부호를 떼어 나머지 규칙으로 파싱 후 부호 복원 — 막대는 0기준 좌/우로 뻗음.
function parseDisplayValue(display) {
  let s = String(display).trim();
  let sign = 1;
  if (s[0] === "+") s = s.slice(1).trim();
  else if (s[0] === "-" || s[0] === "−" /*U+2212*/) { sign = -1; s = s.slice(1).trim(); }
  const v = parseMagnitude(s);
  return v === null ? null : sign * v;
}
function parseMagnitude(s) {
  const hm = s.match(/^(\d+)\s*시간\s*(\d+)?\s*분?$/);
  if (hm) return (+hm[1]) * 60 + (hm[2] ? +hm[2] : 0);
  const minOnly = s.match(/^(\d+)\s*분$/);
  if (minOnly) return +minOnly[1];
  const pct = s.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (pct) return +pct[1];
  // 수 단위: "15억 개"→15e8, "1,750억"→1750e8, "97.1GW"→97.1 (조/억/만 배수 + 라틴/한글 단위어 무시)
  const kunit = s.match(/^([\d,]+(?:\.\d+)?)\s*(조|억|만)?\s*[A-Za-z가-힣%]{0,6}$/);
  if (kunit && kunit[1]) {
    const n = +kunit[1].replace(/,/g, "");
    const mul = { "조": 1e12, "억": 1e8, "만": 1e4 }[kunit[2]] || 1;
    if (!Number.isNaN(n)) return n * mul;
  }
  const plain = s.match(/^(\d+(?:\.\d+)?)$/);
  if (plain) return +plain[1];
  return null;
}

const assetsDir = join(proj, "assets", "chart");
mkdirSync(assetsDir, { recursive: true });

const echarts = await import(pathToFileURL(ECHARTS_PATH).href);

let skipped = 0; // 한 카드 실패가 전체 차트를 죽이면 안 됨 — 카드별 격리(스킵 시 SVG 미생성 → G19가 그 카드만 fail-closed)
for (const card of chartCards) {
  const chart = card.chart;
  if (chart.kind !== "bar") { console.error(`✗ 미지원 chart.kind: ${chart.kind} (card index=${card.index}) — 스킵`); skipped++; continue; }
  const items = Array.isArray(chart.items) ? chart.items : [];
  if (items.length < 2 || items.length > 5) { console.error(`✗ chart.items 개수 범위 위반(2~5): ${items.length} (card index=${card.index}) — 스킵`); skipped++; continue; }

  const values = [];
  const labels = [];
  const displays = [];
  let parseFail = false;
  for (const item of items) {
    const value = parseDisplayValue(item.display);
    if (value === null) {
      console.error(`✗ display 파싱 불가: "${item.display}" (card index=${card.index}, label=${item.label}) — 이 카드 스킵`);
      parseFail = true;
      break;
    }
    values.push(value);
    labels.push(item.label);
    displays.push(item.display);
  }
  if (parseFail) { skipped++; continue; }

  // echarts 카테고리축은 배열 인덱스 순서로 위→아래 렌더 — 원본 순서(첫 항목이 위)를 유지하려면 역순 전달.
  const catData = labels.slice().reverse();
  const valData = values.slice().reverse();
  const dispData = displays.slice().reverse();

  // 저항목(2~3바) 차트는 얇고 짧으면 카드에 여백이 큼(G18) — 바를 두껍고 차트를 높게 해 인포그래픽답게 채움.
  const barW = items.length <= 3 ? 108 : 64;

  const option = {
    backgroundColor: "transparent",
    animation: false,
    textStyle: { fontFamily: "Pretendard" },
    grid: { left: 16, right: 96, top: 16, bottom: 16, containLabel: true },
    xAxis: {
      type: "value",
      // zoom: 근접 값들의 차이 증폭(축 절단 — G17 판정: 기록경신 드라마). display 원문이 정직성 담보.
      // 음수(델타) 포함 시 auto-range(막대가 0 좌측으로 뻗음) — min:0이면 음수 막대가 클립됨. 전부 양수면 0기준 정직 유지.
      min: values.some((v) => v < 0) ? undefined : (card.chart.zoom ? Math.max(0, Math.floor(2 * Math.min(...values) - Math.max(...values))) : 0),
      show: false,
      splitLine: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false }
    },
    yAxis: {
      type: "category",
      data: catData,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        show: true,
        fontFamily: "Pretendard",
        fontSize: 30,
        color: colorInkMuted
      }
    },
    series: [
      {
        // 트랙(전체 배율) — hairline 색으로 값 바 뒤에 깔아 상대적 눈금감 제공(축눈금 숨김 대체)
        type: "bar",
        data: valData.map(() => Math.max(...valData) * 1.12),
        barMaxWidth: barW,
        silent: true,
        itemStyle: { color: colorHairline, borderRadius: [0, 6, 6, 0] },
        label: { show: false }
      },
      {
        type: "bar",
        // 최대값 바만 accent, 나머지 muted — 축 절단 없이(0기준 정직 비례) 색으로 드라마(G17 재판정 수렴)
        data: valData.map((v) => ({ value: v, itemStyle: { color: v === Math.max(...valData) ? colorAcc : colorMuted, borderRadius: [0, 6, 6, 0] } })),
        barGap: "-100%",
        barMaxWidth: barW,
        itemStyle: { color: colorAcc, borderRadius: [0, 6, 6, 0] },
        label: {
          show: true,
          position: "right",
          fontFamily: "Pretendard",
          fontSize: 34,
          fontWeight: 700,
          color: colorInk,
          formatter: (params) => dispData[params.dataIndex]
        }
      }
    ]
  };

  // 항목 수 기반 동적 높이 — 바 2개가 560px에 퍼지면 간격 과대(G17 판정: 비교 펀치 죽음)
  const perItem = values.length <= 2 ? 240 : values.length === 3 ? 190 : 150;
  const chartHeight = Math.min(760, values.length * perItem + 80);
  const instance = echarts.init(null, null, {
    renderer: "svg",
    ssr: true,
    width: VIEWPORT.width,
    height: chartHeight
  });
  let svg;
  try {
    instance.setOption(option, true);
    svg = instance.renderToSVGString();
  } finally {
    instance.dispose();
  }

  if (!/<svg\b[^>]*\bviewBox=/u.test(svg)) {
    console.error(`✗ 렌더된 SVG에 viewBox 없음 (card index=${card.index})`);
    process.exit(1);
  }

  const idx = String(card.index).padStart(2, "0");
  const outPath = join(assetsDir, `card-${idx}.svg`);
  writeFileSync(outPath, svg, "utf8");
  console.log(`✓ ${outPath} (${items.length}개 바, hairline=${colorHairline})`);
}

// 스킵된 카드가 있으면 비정상 종료로 로그에 신호(단, 파싱된 좋은 차트는 이미 다 렌더됨).
// 해당 카드의 빈 차트 슬롯은 carousel 단계 G19가 fail-closed로 잡는다.
if (skipped > 0) { console.error(`⚠ ${skipped}개 차트 카드 스킵(파싱 불가/규격 위반) — 해당 카드는 G19가 잡음`); process.exit(1); }
