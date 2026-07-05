// G20 scene-parity: 쇼츠 index.html의 씬 수/순서/헤드라인이 copy.json 카드와 일치하는지(fail-closed).
// 쇼츠는 완성된 카드의 파생이어야 한다 — 이중소스(카피에서 독자 재조판) 발생을 막는 마지막 방어선.
// 사용: g20_scene_parity.mjs <shorts/index.html> <copy.json>
import { readFileSync, existsSync } from "node:fs";
import { loadJSON, check, done, arg, fail } from "./lib.mjs";

const htmlPath = arg(0, "shorts/index.html");
const copyPath = arg(1, "copy.json");
if (!existsSync(htmlPath)) fail(`쇼츠 index.html 없음: ${htmlPath}`);
const html = readFileSync(htmlPath, "utf8");
const copy = loadJSON(copyPath);
const cards = copy.cards || [];

const m = html.match(/<script type="application\/json" id="scene-manifest">([\s\S]*?)<\/script>/);
if (!m) fail("scene-manifest 스크립트 태그 없음 — 씬 파리티 측정 불가(fail-closed)");
let manifest;
try { manifest = JSON.parse(m[1]); } catch (e) { fail(`scene-manifest JSON 파싱 실패: ${e.message}`); }

const norm = (s) => String(s || "").replace(/\s+/g, "").replace(/[.,!?~·…"'"'\-—]/g, "");

check(Array.isArray(manifest) && manifest.length > 0, "scene-manifest 비어있음");
check(manifest.length === cards.length, `씬 수 ${manifest.length} != copy.json 카드 수 ${cards.length}`);

const n = Math.min(manifest.length, cards.length);
for (let i = 0; i < n; i++) {
  const scene = manifest[i], card = cards[i];
  check(scene.index === card.index, `씬[${i}] index=${scene.index} != copy.json 카드 index=${card.index}(순서 불일치)`);
  const expected = card.headline || card.left?.headline || card.cta_label || "";
  const a = norm(scene.headline), b = norm(expected);
  check(!b || a === b, `씬[${i}](card=${scene.index}) 헤드라인 불일치: 쇼츠="${scene.headline}" vs copy.json="${expected}"`);
}
done("G20 scene-parity");
