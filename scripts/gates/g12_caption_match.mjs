// G12 caption-match: 쇼츠 자막 텍스트가 copy.json 카드 body에서 파생됐는지(독립편집 이중소스 차단)
import { loadJSON, check, done, arg } from "./lib.mjs";
const sb = loadJSON(arg(0, "storyboard.json"));
const copy = loadJSON(arg(1, "copy.json"));
const byIndex = new Map((copy.cards || []).map((c) => [c.index, c]));
const norm = (s) => String(s || "").replace(/\s+/g, "").replace(/[.,!?~·…"'"'\-—]/g, "");

for (const sc of sb.scenes || []) {
  const card = byIndex.get(sc.card);
  check(!!card, `scene card=${sc.card} 이(가) copy.json에 없음`);
  const cap = sc.caption && sc.caption.text;
  if (!cap || !card) continue;
  const src = norm([card.headline, card.subhead, card.body].filter(Boolean).join(""));
  const nc = norm(cap);
  // 자막(청킹된 body)은 카드 텍스트의 부분집합이어야 함
  check(src.includes(nc) || nc.length === 0,
    `scene card=${sc.card} 자막이 카드 텍스트에서 파생 안 됨(이중소스): "${cap.slice(0, 40)}"`);
}
done("G12 caption-match");
