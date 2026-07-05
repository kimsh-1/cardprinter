#!/usr/bin/env node
// G6+ 자동 remediation 루프 (§4.9④) — fail 시 §4.8 레버를 고정 순서로 주입·재렌더·재측정.
// 레버: n1 스크림 → n2 오버레이 55% → n3 text-shadow(+블러박스 최후). 상태 = <out>.remediation.json (스키마 참조).
// 정지 규칙: pass→채택 exit0 · attempts 소진→best=argmax(min(med,p10)) 보존 exit1 · Δmed<0.05 조기중단→best.
// 사용: node remediate_contrast.mjs <card.html> <out.png>
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SKILL = ROOT;
const PY = process.env.CARDSHORTS_PY || "python3";
const [html, outPng] = process.argv.slice(2);
if (!html || !outPng) { console.error("usage: remediate_contrast.mjs <card.html> <out.png>"); process.exit(1); }

const LEVERS = [
  { n: 1, levers: ["scrim"], apply: (s) => s.includes('class="scrim"') ? s
      : s.replace(/(<img class="bg[^>]*>|<div class="bg[^>]*><\/div>)/, `$1\n<div class="scrim"></div>`) },
  { n: 2, levers: ["scrim", "overlay55"], apply: (s) => s.includes('class="rem-overlay"') ? s
      : s.replace("</style>", `.rem-overlay{position:absolute;inset:0;z-index:1;background:rgba(0,0,0,.55)}\n</style>`)
         .replace(/(<div class="scrim"><\/div>)/, `$1\n<div class="rem-overlay"></div>`) },
  { n: 3, levers: ["scrim", "overlay55", "text-shadow"], apply: (s) => s.includes("rem-tshadow") ? s
      : s.replace("</style>", `/*rem-tshadow*/.wrap [data-slot]{text-shadow:0 2px 8px rgba(0,0,0,.6)}\n</style>`) },
];

function measure() {
  execFileSync("node", [`${SKILL}/scripts/render/export_card.mjs`, html, outPng], { stdio: "pipe" });
  try {
    const out = execFileSync(PY, [`${SKILL}/scripts/gates/g06_contrast.py`, outPng, outPng.replace(/\.png$/, ".slots.json")], { stdio: "pipe" }).toString();
    return { pass: true, med: null, p10: null, out };
  } catch (e) {
    const out = (e.stdout || "").toString();
    const ms = [...out.matchAll(/median ([\d.]+)\/p10 ([\d.]+)/g)];
    const med = ms.length ? Math.min(...ms.map((m) => +m[1])) : null;
    const p10 = ms.length ? Math.min(...ms.map((m) => +m[2])) : null;
    return { pass: false, med, p10, out };
  }
}

const orig = readFileSync(html, "utf8");
// 레버(스크림·다크 오버레이)는 사진 배경(A/G) 전제 — 색면/블롭 카드에 다크 레버를 얹으면
// 다크 잉크 대비가 오히려 악화된다(§4.8 스코프). 사진 없으면 레버 없이 fail 보고 → 설계 수정 경로.
if (!/<img class="bg/.test(orig)) {
  console.log("✗ remediation skip — 사진 배경 아님(색면/블롭): 레버 비적용, 설계 수정 필요(§4.8 스코프)");
  process.exit(1);
}
copyFileSync(html, html + ".orig");
const state = { card: basename(html, ".html"), max_attempts: 3, attempts: [], best_n: 0, final: "fail-best" };
let current = orig, prevMed = null, best = { n: 0, score: -1 };

let r = measure();
state.attempts.push({ n: 0, levers: [], cr_med: r.med, cr_p10: r.p10, pass: r.pass });
if (!r.pass) {
  best = { n: 0, score: Math.min(r.med ?? 0, r.p10 ?? 0), html: current };
  for (const L of LEVERS) {
    current = L.apply(current);
    writeFileSync(html, current);
    r = measure();
    state.attempts.push({ n: L.n, levers: L.levers, cr_med: r.med, cr_p10: r.p10, pass: r.pass });
    if (r.pass) break;
    const score = Math.min(r.med ?? 0, r.p10 ?? 0);
    if (score > best.score) best = { n: L.n, score, html: current };
    if (prevMed != null && r.med != null && r.med - prevMed < 0.05) { console.log(`  조기중단(Δmed<0.05) → best n${best.n}`); break; }
    prevMed = r.med;
  }
}
if (r.pass) { state.final = "pass"; state.best_n = state.attempts[state.attempts.length - 1].n; }
else { state.best_n = best.n; writeFileSync(html, best.html); measure(); } // 최고대비본 보존(발산 없음)
writeFileSync(outPng.replace(/\.png$/, ".remediation.json"), JSON.stringify(state, null, 2));
console.log(`${state.final === "pass" ? "✓" : "✗"} remediation ${state.final} (attempts ${state.attempts.length}, best n${state.best_n}) → ${outPng.replace(/\.png$/, ".remediation.json")}`);
process.exit(state.final === "pass" ? 0 : 1);
