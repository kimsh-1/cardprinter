#!/usr/bin/env bash
# 원커맨드 파이프라인 — brief.json+copy.json+tokens.json+storyboard.json이 있는 프로젝트 디렉토리를
# S3게이트→S5카드빌드→S6PNG익스포트+게이트→S7쇼츠빌드+렌더+게이트 까지 관통.
# S1(brief)·S2(copy)는 LLM(Claude/codex)이 먼저 작성. 이 스크립트는 결정론 구간(S3~S7)+게이트를 담당.
# 사용: pipeline.sh <projectDir> [draft|high]
set -uo pipefail
SK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJ="$(cd "$1" && pwd)"; Q="${2:-draft}"
G="$SK/gates"; PY="${CARDSHORTS_PY:-python3}"
[ -n "${CARDSHORTS_CHROME_LIBS:-}" ] && export LD_LIBRARY_PATH="$CARDSHORTS_CHROME_LIBS:${LD_LIBRARY_PATH:-}"
fail=0; step(){ echo; echo "━━ $* ━━"; }
gate(){ "$@" || { echo "  ⛔ GATE FAIL — 파이프라인 정지"; fail=1; }; }

step "S2 게이트 (copy)"
gate node "$G/g01_copy_count.mjs" "$PROJ/copy.json" "$PROJ/brief.json"
gate node "$G/g02_copy_len.mjs" "$PROJ/copy.json"
gate node "$G/g10_fact_fidelity.mjs" "$PROJ/copy.json" "$PROJ/brief.json"
[ $fail = 0 ] || exit 1

step "S3 게이트 (tokens + glyph)"
gate node "$G/g03_tokens_schema.mjs" "$PROJ/tokens.json" "$PROJ"
gate "$PY" "$G/g09_glyph_coverage.py" "$PROJ/copy.json" "$PROJ/tokens.json" "$PROJ"
[ $fail = 0 ] || exit 1

step "S5→S6 캐러셀 빌드 + 익스포트"
node "$SK/render/build_carousel.mjs" "$PROJ" || exit 1
mkdir -p "$PROJ/out"
for h in "$PROJ"/carousel/card-*.html; do
  b=$(basename "$h" .html); node "$SK/render/export_card.mjs" "$h" "$PROJ/out/$b.png" 1080 1350 || fail=1
done
step "S6 게이트 (PNG·대비·오버플로)"
node "$G/run_gates.mjs" carousel "$PROJ" || fail=1

step "S7 쇼츠 빌드 + 렌더 ($Q) + 게이트"
if [ -f "$PROJ/storyboard.json" ]; then
  node "$SK/render/build_shorts.mjs" "$PROJ" || fail=1
  bash "$SK/render/render_shorts.sh" "$PROJ" "$Q" || fail=1
  gate node "$G/g08_mp4_valid.mjs" "$PROJ/out/short.mp4"
  gate node "$G/g12_caption_match.mjs" "$PROJ/storyboard.json" "$PROJ/copy.json"
else echo "  (storyboard.json 없음 — 쇼츠 스킵)"; fi

echo; echo "════════════════════════"
if [ $fail = 0 ]; then echo "✅ 파이프라인 완주 — $PROJ/out/ (card-*.png + short.mp4)"; else echo "⛔ 일부 게이트 실패 — 위 로그 확인"; fi
exit $fail
