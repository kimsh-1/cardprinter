// G8 mp4-valid: ffprobe로 h264 & 1080x1920 & fps~30 & duration>0
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { CFG, check, done, arg, fail } from "./lib.mjs";
const mp4 = arg(0, "out/short.mp4");
if (!existsSync(mp4)) fail(`MP4 없음: ${mp4}`);
let info;
try {
  const out = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=codec_name,width,height,avg_frame_rate,duration",
    "-show_entries", "format=duration", "-of", "json", mp4], { encoding: "utf8" });
  info = JSON.parse(out);
} catch (e) { fail(`ffprobe 실패: ${e.message}`); }
const s = (info.streams || [])[0] || {};
const V = CFG.video;
check(s.codec_name === V.codec, `코덱 ${s.codec_name} != ${V.codec}`);
check(+s.width === V.width && +s.height === V.height, `해상도 ${s.width}x${s.height} != ${V.width}x${V.height}`);
const [n, d] = String(s.avg_frame_rate || "0/1").split("/").map(Number);
const fps = d ? n / d : 0;
check(Math.abs(fps - V.fps) <= 1.5, `fps ${fps.toFixed(2)} != ~${V.fps}`);
const dur = parseFloat(s.duration || (info.format && info.format.duration) || "0");
check(dur > 0.5, `duration ${dur}s 비정상`);
done("G8 mp4-valid");
