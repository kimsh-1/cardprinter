// G11 overflow: 렌더된 텍스트 슬롯 bbox ⊂ 세이프존 (자동조판 클리핑 방지)
// 입력: slots.json (익스포터가 [data-slot]별 {slot, bbox:[x,y,w,h]} 방출) + format
import { loadJSON, CFG, check, done, arg, fail } from "./lib.mjs";
const slotsPath = arg(0, "slots.json");
const format = arg(1, "carousel_4_5"); // or shorts_9_16
const zone = CFG.safe_zone[format];
if (!zone) fail(`unknown format: ${format}`);
const data = loadJSON(slotsPath);
const slots = Array.isArray(data) ? data : data.slots || [];
check(slots.length > 0, `slots.json 비어있음(텍스트 슬롯 0)`);
for (const s of slots) {
  const [x, y, w, h] = s.bbox || [];
  if (x == null) { check(false, `slot ${s.slot} bbox 없음`); continue; }
  const tag = `slot '${s.slot}' bbox=[${x},${y},${w},${h}]`;
  check(x >= zone.x[0] - 0.5, `${tag} 좌측 세이프존(${zone.x[0]}) 침범`);
  check(x + w <= zone.x[1] + 0.5, `${tag} 우측 세이프존(${zone.x[1]}) 침범`);
  check(y >= zone.y[0] - 0.5, `${tag} 상단 세이프존(${zone.y[0]}) 침범`);
  check(y + h <= zone.y[1] + 0.5, `${tag} 하단 세이프존(${zone.y[1]}) 침범`);
}
done(`G11 overflow (${format})`);
