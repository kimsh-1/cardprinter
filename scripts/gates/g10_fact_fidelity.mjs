// G10 fact-fidelity: 카드 fact_refs ⊆ brief.facts & 카드 텍스트의 숫자가 참조 fact에 존재(날조 0)
import { loadJSON, check, done, arg } from "./lib.mjs";
const copy = loadJSON(arg(0, "copy.json"));
const brief = loadJSON(arg(1, "brief.json"));
const factById = new Map((brief.facts || []).map((f) => [f.id, f]));

// 숫자 토큰: 2자리+ 연속숫자 또는 소수/퍼센트/콤마 포함(예 3.5, 12%, 1,200). 연도/한자리 제외.
const numRe = /\d[\d,.]*\d%?|\d%/g;
function nums(s) {
  return String(s || "").match(numRe)?.map((x) => x.replace(/[,]/g, "")) || [];
}

for (const c of copy.cards || []) {
  const tag = `카드[${c.index}] ${c.type}`;
  const refs = c.fact_refs || [];
  for (const r of refs) check(factById.has(r), `${tag} fact_ref '${r}' 이(가) brief.facts에 없음`);
  const refStr = refs.map((r) => factById.get(r)).filter(Boolean)
    .map((f) => `${f.claim || ""} ${f.number || ""}`).join(" ").replace(/[,]/g, "");
  // chart 표시 문자열(독자가 보는 라벨·display)도 날조 0 스캔 — 축 수치는 display에서 렌더 시 파생
  const chartText = c.chart ? (c.chart.items || []).map((it) => `${it.label || ""} ${it.display || ""}`).join(" ") : "";
  const blockText = (c.blocks || []).map((b) => [b.text, b.label, ...(b.items || [])].filter(Boolean).join(" ")).join(" ");
  const stepText = (c.steps || []).map((s) => `${s.label || ""} ${s.text || ""}`).join(" ");
  const text = [c.headline, c.subhead, c.body, chartText, blockText, stepText].filter(Boolean).join(" ");
  for (const n of nums(text)) {
    check(refStr.includes(n), `${tag} 숫자 '${n}' 이(가) 참조 fact에 없음(날조 의심). fact_refs=[${refs.join(",")}]`);
  }
}
done("G10 fact-fidelity");
