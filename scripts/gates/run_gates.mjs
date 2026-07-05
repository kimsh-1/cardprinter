#!/usr/bin/env node
// 게이트 오케스트레이터 — 단계별로 해당 게이트를 실행하고 종합 판정.
// 사용: run_gates.mjs <stage> <projectDir>
//   stage: copy | tokens | image | carousel | shorts | all
// self-heal 루프는 파이프라인(SKILL) 쪽에서 이 러너 exit code를 보고 max3 재시도.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const VENV = process.env.CARDSHORTS_PY || "python3";
const stage = process.argv[2] || "all";
const proj = process.argv[3] || ".";
const P = (f) => join(proj, f);

let failed = 0, warned = 0;
function runNode(g, args) { run("node", [join(HERE, g), ...args], g); }
function runPy(g, args) { run(VENV, [join(HERE, g), ...args], g); }
function run(cmd, args, label) {
  try { const o = execFileSync(cmd, args, { encoding: "utf8" }); process.stdout.write(o); }
  catch (e) {
    process.stdout.write(e.stdout || ""); process.stderr.write(e.stderr || "");
    if (e.status === 2) { warned++; console.log(`  ⚠ ${label} INCONCLUSIVE(exit2)`); }
    else { failed++; console.log(`  ✗ ${label} FAILED(exit ${e.status})`); }
  }
}

const has = (f) => existsSync(P(f));
const stages = stage === "all" ? ["copy", "tokens", "image", "carousel", "shorts"] : [stage];

for (const st of stages) {
  console.log(`\n═══ gates: ${st} ═══`);
  if (st === "copy") {
    runNode("g01_copy_count.mjs", [P("copy.json"), P("brief.json")]);
    runNode("g02_copy_len.mjs", [P("copy.json")]);
    if (has("brief.json")) runNode("g10_fact_fidelity.mjs", [P("copy.json"), P("brief.json")]);
    runNode("g16_diversity.mjs", [P("copy.json")]); // §7.6 시퀀스 다양성·밀도웨이브
  }
  if (st === "tokens") {
    runNode("g03_tokens_schema.mjs", [P("tokens.json"), proj]);
    if (has("copy.json")) runPy("g09_glyph_coverage.py", [P("copy.json"), P("tokens.json"), proj]); // 결정론 두부 방지(하드)
  }
  if (st === "image") {
    for (const f of dirList(P("assets/bg")).filter((f) => f.endsWith(".png"))) runPy("g05_ocr_clean.py", [f]);
    if (has("image-manifest.json")) runNode("g13_image.mjs", [proj]); // §4.11+§7.3 이미지 플로어·패턴 다양성
  }
  if (st === "carousel") {
    const ratio = process.env.CS_RATIO || "4:5";
    const pngs = dirList(P("out")).filter((f) => /card-\d+\.png$/.test(f));
    if (!pngs.length) { console.log("  ✗ out/ PNG 0장 — fail-closed(익스포트 미실행/실패를 통과로 세지 않음)"); failed++; }
    for (const png of pngs) {
      runNode("g07_png_export.mjs", [png, ratio]);
      const slots = png.replace(/\.png$/, ".slots.json");
      if (existsSync(slots)) {
        runPy("g06_contrast.py", [png, slots]);
        runNode("g11_overflow.mjs", [slots, "carousel_4_5"]);
        const cuts = png.replace(/\.png$/, ".cutouts.json");
        if (existsSync(cuts)) runPy("g06plus_occlusion.py", [slots, cuts]); // §4.9② 컷아웃 가림
      } else { console.log(`  ✗ ${slots} 없음 → fail-closed(익스포터 slots 방출 필수 — 측정불가≠통과)`); failed++; }
    }
    if (has("copy.json") && has("out")) {
      runNode("g14_typo_floor.mjs", [P("copy.json"), P("out")]); // §7.4 타이포 하한
      runNode("g15_hierarchy.mjs", [P("copy.json"), P("out")]); // §7.5 계층 깊이·강조예산
      runNode("g18_fill.mjs", [proj]); // 세로점유·죽은공간(감사 ★2·★4)
      runNode("g19_render_diversity.mjs", [proj]); // 실렌더 다양성 계약(감사 ★1·★3)
    }
  }
  if (st === "shorts") {
    if (has("out/short.mp4")) {
      runNode("g08_mp4_valid.mjs", [P("out/short.mp4")]);
      runPy("g09_korean_render.py", [P("out/short.mp4"), "1.0"]);
    }
    if (has("storyboard.json") && has("copy.json")) runNode("g12_caption_match.mjs", [P("storyboard.json"), P("copy.json")]);
    if (has("shorts/index.html") && has("copy.json")) runNode("g20_scene_parity.mjs", [P("shorts/index.html"), P("copy.json")]);
  }
}

function dirList(d) { try { return readdirSync(d).map((f) => join(d, f)); } catch { return []; } }

console.log(`\n─── 종합: ${failed} FAIL, ${warned} WARN ───`);
process.exit(failed > 0 ? 1 : 0);
