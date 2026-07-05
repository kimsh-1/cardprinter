// G2 copy-len: 표지훅≤24 · 서브헤드≤34 · CTA헤드라인≤14 · 본문≤90.
// v2(§5.2): 흐름 본문(개행 없음)은 keep-all 자동 줄바꿈 + Tier-2 measure 실측 소관 → 줄단위 검사는
// 수동 개행(\n)을 쓴 본문에만 적용(각 분절 ≤18). 강조 마커(==·**)는 마크업이라 글자수에서 제외.
import { loadJSON, CFG, charLen, check, done, arg } from "./lib.mjs";
const copy = loadJSON(arg(0, "copy.json"));
const C = CFG.copy;
const visible = (s) => String(s).replace(/==([^=]+)==/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1");
for (const c of copy.cards || []) {
  const tag = `카드[${c.index}] ${c.type}`;
  const hlMax = c.type === "cta" ? C.cta_headline_max : C.headline_max;
  if (c.headline != null) {
    const hl = visible(c.headline).replace(/\r?\n/g, "");
    check(charLen(hl) <= hlMax, `${tag} headline ${charLen(hl)}자 > ${hlMax}`);
    for (const line of visible(c.headline).split(/\r?\n/))
      check(charLen(line) <= C.line_max, `${tag} headline 한 줄 ${charLen(line)}자 > ${C.line_max}`);
  }
  if (c.subhead != null) check(charLen(visible(c.subhead)) <= C.subhead_max, `${tag} subhead ${charLen(visible(c.subhead))}자 > ${C.subhead_max}`);
  if (c.type === "stat" && c.viz_kind !== "chart") {
    // 빅넘버 실측 대상 = 렌더러가 480px로 그리는 값. dispnum 모드면 dispnum.value(숫자),
    // 아니면 headline. dispnum이면 headline은 라벨(pill)이라 5자 제한 비대상.
    const hasDisp = c.dispnum && c.dispnum.value != null;
    const big = hasDisp ? String(c.dispnum.value) : visible(c.headline || c.number || "");
    // 480px 고정 빅넘버 폭 가드 — 좁은 문자(콜론·점·콤마·%·슬래시)는 0.5, 전각은 1로 세어 합 ≤3.5.
    // "6:58"·"3.2"·"400"·"11.9"는 통과, "1000"·"57000" 같은 넓은 4자+ raw 숫자는 FAIL(compact 단위로 축약 유도).
    const wUnits = [...big].reduce((n, ch) => n + (":.,%/".includes(ch) ? 0.5 : 1), 0);
    check(wUnits <= 3.5, `${tag} bignum '${big}' 폭 ${wUnits} > 3.5 (480px 초과 — "57000"→"5.7만"처럼 compact 단위로; 라벨은 headline/kicker로)`);
  }
  if (c.type === "timeline" || c.type === "list" || c.body_mode === "list") {
    // 리스트류 계약: 항목 ≥3 — copy 단계에서 잡아야 self-heal(codex 되먹임)이 작동(factory 실측 2026-07-05)
    const nItems = (String(c.body || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean).length)
      || (c.steps || []).length
      || (c.blocks || []).filter((b) => b.kind === "bullets").reduce((n, b) => n + (b.items || []).length, 0);
    check(nItems >= 3, `${tag} 리스트/타임라인 항목 ${nItems}개 < 3 (body 줄·steps·bullets로 3~5개 필수)`);
    for (const s of c.steps || []) check(charLen(visible(s.text || "")) <= 48, `${tag} step ${charLen(visible(s.text || ""))}자 > 48`);
  }
  if (Array.isArray(c.blocks)) { // WS1 blocks 다층(R8-C) — 블록≤4, 종류별 상한
    check(c.blocks.length <= 4, `${tag} blocks ${c.blocks.length}개 > 4`);
    for (const b of c.blocks) {
      if (b.kind === "bullets") {
        const n = (b.items || []).length;
        check(n >= 2 && n <= 5, `${tag} bullets ${n}개(허용 2~5)`);
        for (const it of b.items || []) check(charLen(visible(it)) <= 48, `${tag} 불릿 ${charLen(visible(it))}자 > 48: "${visible(it).slice(0, 20)}"`);
      } else if (b.kind === "callout") {
        check(charLen(visible(b.text || "")) <= 70, `${tag} callout ${charLen(visible(b.text || ""))}자 > 70`);
        if (b.label) check(charLen(b.label) <= 10, `${tag} callout label ${charLen(b.label)}자 > 10`);
      } else {
        check(charLen(visible(b.text || "")) <= C.body_max, `${tag} 블록 문단 ${charLen(visible(b.text || ""))}자 > ${C.body_max}`);
      }
    }
  }
  if (c.body != null) {
    const body = visible(c.body);
    if (c.type === "toc") { // 목차 body = 항목 리스트(문단 아님) — 총량 대신 항목당 headline_max
      for (const line of body.split(/\r?\n/))
        check(charLen(line.replace(/^\d+[.)]\s*/, "")) <= C.headline_max, `${tag} 목차 항목 ${charLen(line)}자 > ${C.headline_max}: "${line.trim().slice(0, 20)}"`);
    } else
    check(charLen(body) <= C.body_max, `${tag} body ${charLen(body)}자 > ${C.body_max}`);
    if (/\r?\n/.test(String(c.body)) && c.type !== "toc") { // 수동 개행 선택 시에만 분절 검사(toc는 목차 줄 목록)
      for (const line of body.split(/\r?\n/))
        check(charLen(line) <= C.line_max, `${tag} 수동개행 줄 ${charLen(line)}자 > ${C.line_max}: "${line.trim().slice(0, 30)}"`);
    }
  }
}
done("G2 copy-len");
