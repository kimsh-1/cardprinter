// G7 png-export: 파일 존재 & PNG 시그니처 & 해상도 == 규격
import { readFileSync, existsSync } from "node:fs";
import { CFG, check, done, arg, fail } from "./lib.mjs";
const png = arg(0);
const ratio = arg(1, CFG.png.default_ratio);
if (!png) fail("usage: g07 <card.png> [ratio 4:5|1:1]");
if (!existsSync(png)) fail(`PNG 없음: ${png}`);
const buf = readFileSync(png);
const sig = [0x89, 0x50, 0x4e, 0x47];
check(sig.every((b, i) => buf[i] === b), `PNG 시그니처 아님`);
// IHDR: width @16..20, height @20..24 (big-endian)
const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
const [ew, eh] = CFG.png.ratios[ratio] || [];
check(w === ew && h === eh, `해상도 ${w}x${h} != 규격 ${ratio} ${ew}x${eh}`);
check(buf.length > 1000, `PNG 크기 비정상(${buf.length}B) — 손상 의심`);
done("G7 png-export");
