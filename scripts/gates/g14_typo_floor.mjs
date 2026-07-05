// G14 typography-floor (반려축② 글씨 작음 — §7.4 통일표 단일 진실원)
// 사용: node g14_typo_floor.mjs <copy.json> <slotsDir>   (slotsDir에 card-NN.slots.json)
// fail-closed: 미등록 slot·필수 slot 누락·slots.json 결손 = FAIL.
// 하드 fail선: body/subhead=abs_floor 37 · cover.headline=160 · stat.bignum=400. comfortable 미달·max 초과 = WARN(exit2).
// exit 0 pass · 1 fail · 2 warn-only
import { existsSync } from "node:fs";
import { loadJSON, CFG, arg } from "./lib.mjs";
import { join } from "node:path";

const copy = loadJSON(arg(0, "copy.json"));
const slotsDir = arg(1, "out");
const TF = CFG.typo_floor;
const fails = [], warns = [];

const spec = (type, slot, arch) => {
  if (slot === "body") {
    if (type === "cta" || type === "quote" || type === "source") return TF["body.single"];
    const dense = (TF["body.dense"].density || []).includes(arch);
    return dense ? TF["body.dense"] : TF["body.single"];
  }
  if (slot === "headline") {
    if (type === "cover") return TF["cover.headline"];
    return TF["body.headline"]; // body/hook/comparison/timeline/toc/image
  }
  if (slot === "bignum") return TF["stat.bignum"];
  return TF[`*.${slot}`] || null; // subhead/caption/source/supplement — kicker·cta-pill은 하한 없음
};

for (const c of copy.cards || []) {
  const idx = String(c.index).padStart(2, "0");
  const p = join(slotsDir, `card-${idx}.slots.json`);
  if (!existsSync(p)) { fails.push(`card-${idx}: slots.json 결손(미익스포트) — fail-closed`); continue; }
  const slots = loadJSON(p);
  const names = slots.map((s) => s.slot);
  for (const s of slots) {
    if (!TF.slot_vocab.includes(s.slot)) { fails.push(`card-${idx}: 미등록 slot '${s.slot}' — fail-closed(§7.4)`); continue; }
    const sp = spec(c.type, s.slot, c.archetype);
    if (!sp || typeof sp !== "object" || !("hard" in sp)) continue;
    if (s.font_px < sp.hard) fails.push(`card-${idx}.${s.slot} ${s.font_px}px < hard ${sp.hard} (type=${c.type})`);
    else if (s.font_px < sp.warn) warns.push(`card-${idx}.${s.slot} ${s.font_px}px < comfortable ${sp.warn}`);
    if (sp.max && s.font_px > sp.max) warns.push(`card-${idx}.${s.slot} ${s.font_px}px > max ${sp.max}`);
  }
  // stat은 viz별 필수 슬롯 분기: number=bignum / chart=chart (둘 다 fail-closed)
  const reqs = c.type === "stat" && c.viz_kind === "chart" ? ["chart"] : TF.required_slots[c.type] || [];
  for (const req of reqs) {
    if (!names.includes(req)) fails.push(`card-${idx}: 필수 slot '${req}' 누락 (type=${c.type}) — fail-closed`);
  }
  const hl = slots.find((s) => s.slot === "headline"), bd = slots.find((s) => s.slot === "body");
  if (hl && bd && c.type !== "cover") {
    const r = hl.font_px / bd.font_px;
    if (r < TF.hierarchy_ratio_min) fails.push(`card-${idx}: 위계비 ${r.toFixed(2)} < ${TF.hierarchy_ratio_min}`);
  }
}
if (fails.length) { console.log(`✗ G14 typo-floor FAIL (${fails.length}):`); fails.forEach((f) => console.log("   -", f)); warns.forEach((w) => console.log("   ~", w)); process.exit(1); }
if (warns.length) { console.log(`△ G14 typo-floor WARN (${warns.length}):`); warns.forEach((w) => console.log("   ~", w)); process.exit(2); }
console.log(`✓ G14 typo-floor PASS (${(copy.cards || []).length} cards)`); process.exit(0);
