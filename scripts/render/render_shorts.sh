#!/usr/bin/env bash
# S7 렌더 래퍼 — shorts/index.html을 HyperFrames로 9:16 MP4 렌더. 자체 LD_LIBRARY_PATH 주입.
# 사용: render_shorts.sh <projectDir> [draft|high]
set -euo pipefail
[ -n "${CARDSHORTS_CHROME_LIBS:-}" ] && export LD_LIBRARY_PATH="$CARDSHORTS_CHROME_LIBS:${LD_LIBRARY_PATH:-}"
PROJ="$(cd "$1" && pwd)"
QUALITY="${2:-draft}"
SHORTS="$PROJ/shorts"
TPL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/hf-template"
[ -f "$SHORTS/index.html" ] || { echo "shorts/index.html 없음 — build_shorts.mjs 먼저 실행"; exit 1; }

# 스캐폴드 파일 보장
for f in hyperframes.json package.json; do [ -f "$SHORTS/$f" ] || cp "$TPL/$f" "$SHORTS/"; done
[ -f "$SHORTS/meta.json" ] || printf '{"id":"shorts","name":"card-shorts","createdAt":"2026-01-01T00:00:00.000Z"}\n' > "$SHORTS/meta.json"

cd "$SHORTS"
OUT="$PROJ/out"; mkdir -p "$OUT"
echo "── lint ──";     npx hyperframes lint
echo "── validate ──"; npx hyperframes validate
echo "── render ($QUALITY) ──"
npx hyperframes render --quality "$QUALITY" --fps 30 --output "$OUT/short.mp4"
echo "── ffprobe ──"
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,avg_frame_rate,duration -of default=noprint_wrappers=1 "$OUT/short.mp4"
echo "✓ rendered $OUT/short.mp4"
