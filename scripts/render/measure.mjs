#!/usr/bin/env node
// Tier-2 렌더 실측 measure 스테이지 (§5.2) — paginate 뒤·export 앞. 실제 Chromium 라인박스로 overflow 판정.
// 엔진: puppeteer-core + chrome-headless-shell (export_card.mjs와 동일 — jsdom 배제 요건 충족.
//       계획 자구는 Playwright이나 요건 실질은 '실 레이아웃 엔진'이므로 기검증 스택 재사용, BUILD-LOG 기록).
// 사용: node measure.mjs <projectDir> [--profile=4:5]  →  <projectDir>/measure.json (schemas/measure.schema.json)
import { readFileSync, writeFileSync, globSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SKILL = ROOT;
const PCFG = JSON.parse(readFileSync(join(SKILL, "references/pagination.config.json"), "utf8"));
const CHROME_LIBS = process.env.CARDSHORTS_CHROME_LIBS || "";
if (CHROME_LIBS && !(process.env.LD_LIBRARY_PATH || "").includes(CHROME_LIBS))
  process.env.LD_LIBRARY_PATH = CHROME_LIBS + (process.env.LD_LIBRARY_PATH ? ":" + process.env.LD_LIBRARY_PATH : "");
function findChrome() {
  for (const p of [`${process.env.HOME}/.cache/hyperframes/chrome/chrome-headless-shell/*/chrome-headless-shell-linux64/chrome-headless-shell`,
    `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-*/chrome-linux/headless_shell`]) {
    const m = globSync(p); if (m.length) return m.sort().pop();
  }
  throw new Error("chrome-headless-shell 못 찾음");
}

const proj = resolve(process.argv[2] || ".");
const opts = Object.fromEntries(process.argv.slice(3).filter((a) => a.startsWith("--")).map((a) => a.replace(/^--/, "").split("=")));
const profKey = opts.profile || "4:5";
const profile = PCFG.aspect_profiles[profKey];
const copy = JSON.parse(readFileSync(join(proj, "copy.json"), "utf8"));

const browser = await puppeteer.launch({ executablePath: findChrome(), args: ["--no-sandbox", "--force-device-scale-factor=1"] });
const results = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
  for (const c of copy.cards || []) {
    const idx = String(c.index).padStart(2, "0");
    const rec = { index: c.index, arch: c.archetype || "?", used_px: 0, avail_px: 0, overflow: false, split: null,
                  fill: { top: 0, bottom: 0, max_gap_px: 0 } };
    const html = join(proj, "carousel", `card-${idx}.html`);
    await page.goto(pathToFileURL(html).href, { waitUntil: "networkidle0", timeout: 30000 });
    await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
    const m = await page.evaluate(() => {
      const wrap = document.querySelector(".wrap");
      if (!wrap) return null;
      const cs = getComputedStyle(wrap);
      const wrapTop = wrap.getBoundingClientRect().top;
      const contentTop = wrapTop + parseFloat(cs.paddingTop);
      const avail = wrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      // 실측 대상: wrap의 absolute가 아닌 직계 자식(장식/오버레이는 절대배치라 자동 배제)
      const rects = [...wrap.children]
        .filter((el) => getComputedStyle(el).position !== "absolute")
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.height > 0);
      const top = rects.length ? Math.min(...rects.map((r) => r.top)) : contentTop;
      const bottom = rects.length ? Math.max(...rects.map((r) => r.bottom)) : contentTop;
      const used = bottom - top;
      const overflow = bottom > contentTop + avail + 1;
      // 인접 자식 사이 최대 세로 갭: top 정렬 후 겹치는 구간 병합, 병합 세그먼트 사이 간격 중 최댓값
      const sorted = rects.slice().sort((a, b) => a.top - b.top);
      const segs = [];
      for (const r of sorted) {
        const last = segs[segs.length - 1];
        if (last && r.top <= last.bottom) last.bottom = Math.max(last.bottom, r.bottom);
        else segs.push({ top: r.top, bottom: r.bottom });
      }
      let maxGap = 0;
      for (let i = 1; i < segs.length; i++) maxGap = Math.max(maxGap, segs[i].top - segs[i - 1].bottom);
      // split 제안: .l2(본문 텍스트)가 있고 overflow일 때만(§5.2 — dense 본문 라인 단위 분할)
      const l2 = wrap.querySelector(".l2");
      let split = null;
      if (overflow && l2) {
        const bcs = getComputedStyle(l2);
        const lineH = parseFloat(bcs.lineHeight);
        const l2Rect = l2.getBoundingClientRect();
        const bodyTop = l2Rect.top - contentTop;
        const fitPx = avail - bodyTop;
        const fitLines = Math.max(1, Math.floor(fitPx / lineH));
        const totalLines = Math.max(1, Math.round(l2Rect.height / lineH));
        const text = l2.textContent || "";
        split = { keep_blocks: [0], overflow_blocks: [1], split_at_line: fitLines, line_h: Math.round(lineH * 10) / 10,
                  split_char: Math.max(1, Math.floor(text.length * fitLines / totalLines)) };
      }
      return { used: Math.round(used), avail: Math.round(avail), overflow, split,
                fill: { top: Math.round(top), bottom: Math.round(bottom), max_gap_px: Math.round(maxGap) } };
    });
    if (m) { rec.used_px = m.used; rec.avail_px = m.avail; rec.overflow = m.overflow; rec.split = m.split; rec.fill = m.fill; }
    results.push(rec);
  }
} finally { await browser.close(); }

const overflow_count = results.filter((r) => r.overflow).length;
const out = { profile: profKey, content_box: profile.content_box, cards: results, overflow_count, suggested_extra_cards: overflow_count };
writeFileSync(join(proj, "measure.json"), JSON.stringify(out, null, 2));
console.log(`✓ measure — ${results.length}장 실측, overflow ${overflow_count}건 → measure.json`);
process.exit(0);
