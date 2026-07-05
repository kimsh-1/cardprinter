// G1 copy-count: 카드 수 == 요청 수 & 타입 유효 & cover/cta 존재 & 필수필드 채움
import { loadJSON, CFG, check, done, arg } from "./lib.mjs";
const copy = loadJSON(arg(0, "copy.json"));
const briefPath = arg(1, "brief.json");
const cards = copy.cards || [];
const C = CFG.copy;

const requested = copy.card_count ?? cards.length;
check(cards.length === requested, `카드 수 ${cards.length} != 선언 card_count ${requested}`);
check(requested >= C.card_count_min && requested <= C.card_count_max, `카드 수 ${requested} 범위(${C.card_count_min}~${C.card_count_max}) 밖`);

const types = cards.map((c) => c.type);
for (const t of types) check(C.valid_types.includes(t), `알 수 없는 카드 타입: ${t}`);
for (const req of C.required_types_any) check(types.includes(req), `필수 카드 타입 누락: ${req}`);

cards.forEach((c, i) => {
  const hasText = (c.headline && c.headline.trim()) || (c.body && c.body.trim())
    || (c.type === "comparison" && c.left?.headline && c.right?.headline); // A7은 left/right 2열 계약(§3.4)
  check(hasText, `카드[${i + 1}] type=${c.type} 텍스트(headline/body) 비어있음`);
  if (c.type === "cover") check(!!(c.headline && c.headline.trim()), `cover 카드 headline 필수`);
  if (c.type === "cta") check(!!(c.headline && c.headline.trim()), `cta 카드 headline 필수`);
});

// v2 강화(§5.5-4): 고정슬롯 불변식 + Tier-1 산술 예측 ±1
if (C.fixed_slots && cards.length) {
  check(cards[0].type === C.fixed_slots.first_type, `고정슬롯: cards[0].type=${cards[0].type} ≠ ${C.fixed_slots.first_type}`);
  check(cards[cards.length - 1].type === C.fixed_slots.last_type, `고정슬롯: cards[last].type=${cards[cards.length - 1].type} ≠ ${C.fixed_slots.last_type}`);
}
const d = copy.card_count_derivation;
if (d && d.n_body_final != null) {
  const expected = 1 + d.n_body_final + (d.toc || 0) + 1;
  const tol = C.card_count_predict_tolerance ?? 1;
  check(Math.abs(cards.length - expected) <= tol, `산술 예측 이탈: cards ${cards.length} vs 예측 ${expected} (±${tol})`);
}
done("G1 copy-count");
