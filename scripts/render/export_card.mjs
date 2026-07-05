#!/usr/bin/env node
// S6 캐러셀 PNG 익스포터 — 4:5 카드 HTML을 headless Chrome로 스크린샷 + [data-slot] bbox를 slots.json 방출.
// 사용: node export_card.mjs <card.html> <out.png> [width=1080] [height=1350]
// 요구: LD_LIBRARY_PATH(=~/.bashrc), puppeteer-core, chrome-headless-shell(hyperframes 번들)
import { readFileSync, writeFileSync, existsSync, globSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

// chrome-headless-shell이 libnss3 등 시스템 라이브러리를 찾도록 rootless lib 경로 주입(셸 env에 의존 안 함)
const CHROME_LIBS = process.env.CARDSHORTS_CHROME_LIBS || "";
if (CHROME_LIBS && !(process.env.LD_LIBRARY_PATH || "").includes(CHROME_LIBS)) {
  process.env.LD_LIBRARY_PATH = CHROME_LIBS + (process.env.LD_LIBRARY_PATH ? ":" + process.env.LD_LIBRARY_PATH : "");
}

function findChrome() {
  const pats = [
    `${process.env.HOME}/.cache/hyperframes/chrome/chrome-headless-shell/*/chrome-headless-shell-linux64/chrome-headless-shell`,
    `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-*/chrome-linux/headless_shell`,
  ];
  for (const p of pats) { const m = globSync(p); if (m.length) return m.sort().pop(); }
  throw new Error("chrome-headless-shell 못 찾음 — npx hyperframes browser ensure");
}

const [html, outPng, w = "1080", h = "1350"] = process.argv.slice(2);
if (!html || !outPng) { console.error("usage: export_card.mjs <card.html> <out.png> [w] [h]"); process.exit(1); }
if (!existsSync(html)) { console.error("HTML 없음: " + html); process.exit(1); }
const W = +w, H = +h;

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  args: ["--no-sandbox", "--force-device-scale-factor=1", "--hide-scrollbars"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(resolve(html)).href, { waitUntil: "networkidle0", timeout: 30000 });
  await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
  await new Promise((r) => setTimeout(r, 150));
  const slots = await page.evaluate(() => {
    const toHex = (rgb) => {
      const m = rgb.match(/\d+/g); if (!m) return "#000000";
      return "#" + m.slice(0, 3).map((n) => (+n).toString(16).padStart(2, "0")).join("");
    };
    return [...document.querySelectorAll("[data-slot]")].map((el) => {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      const fg = toHex(cs.color);
      const emphEls = [...el.querySelectorAll("[data-emph]")];
      return { slot: el.dataset.slot, bbox: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        fg, font_px: Math.round(parseFloat(cs.fontSize)),
        font_weight: parseInt(cs.fontWeight) || 400,
        emph_count: emphEls.length,
        emph_colors: [...new Set(emphEls.map((e) => toHex(getComputedStyle(e).color)).filter((c) => c !== fg))] };
    });
  });
  writeFileSync(outPng.replace(/\.png$/, ".slots.json"), JSON.stringify(slots, null, 2));
  // 컷아웃 분리 방출(§4.9③ G11' 스코프 패치) — 텍스트→slots.json / 컷아웃→cutouts.json
  const cutouts = await page.evaluate(() => {
    return [...document.querySelectorAll('[data-role="cutout"]')].map((el) => {
      const r = el.getBoundingClientRect();
      const img = el.querySelector("img");
      return { role: "cutout", src: el.dataset.src || img?.getAttribute("src"),
        frame_bbox: [Math.round(r.x), Math.round(r.y), Math.round(r.x + r.width), Math.round(r.y + r.height)],
        z: parseInt(getComputedStyle(el).zIndex) || 20,
        src_wh: img ? [img.naturalWidth, img.naturalHeight] : null, alpha_threshold: 32 };
    });
  });
  if (cutouts.length) writeFileSync(outPng.replace(/\.png$/, ".cutouts.json"), JSON.stringify({ canvas: [W, H], cutouts }, null, 2));
  await page.screenshot({ path: outPng, clip: { x: 0, y: 0, width: W, height: H } });
  console.log(`✓ exported ${outPng} (${W}x${H}) + ${slots.length} slots${cutouts.length ? ` + ${cutouts.length} cutouts` : ""}`);
} finally { await browser.close(); }
