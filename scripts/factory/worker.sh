#!/usr/bin/env bash
# worker.sh — card-shorts factory 워커: 주제 1건 전 파이프라인(codex S1/S2 → 결정론 렌더 → 게이트 → PASS/FAIL)
# 사용: bash worker.sh <topicJsonFile> <workdir>
#   topicJsonFile: {"id":"...", "topic":"...", "tier":"news|character|brand|luxury|editorial|data"} 1건짜리 JSON 파일
# 종료코드: 0=PASS, 1=FAIL(원인은 $workdir/FAIL 또는 factory.log 참조)
#
# v2(2026-07-05): 통합 self-heal 루프 — copy/tokens 뿐 아니라 image/carousel 게이트 실패도 codex에 되먹여 재생성.
#   이미지 생성(비쌈)은 attempt1에만, 이후 재시도는 이미지 재사용(카피/레이아웃 수정용). image 게이트가 실패한
#   경우에만 다음 attempt에서 재생성. carousel-only 실패(G11 넘침·G14·G18 등)는 이미지 유지하고 카피만 재작성.
set -u

SK="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
G="$SK/gates"
PY="${CARDSHORTS_PY:-python3}"
FACTORY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -n "${CARDSHORTS_CHROME_LIBS:-}" ] && export LD_LIBRARY_PATH="$CARDSHORTS_CHROME_LIBS:${LD_LIBRARY_PATH:-}"

TOPIC_FILE="${1:-}"
WORKDIR="${2:-}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-3}"
if [ -z "$TOPIC_FILE" ] || [ -z "$WORKDIR" ]; then
  echo "usage: worker.sh <topicJsonFile> <workdir>" >&2
  exit 2
fi
if [ ! -f "$TOPIC_FILE" ]; then
  echo "✗ topic 파일 없음: $TOPIC_FILE" >&2
  exit 2
fi

mkdir -p "$WORKDIR"
TOPIC_FILE="$(cd "$(dirname "$TOPIC_FILE")" && pwd)/$(basename "$TOPIC_FILE")"
cd "$WORKDIR" || exit 2
rm -f PASS FAIL

TOPIC="$(node -e 'const o=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); process.stdout.write(o.topic||"")' "$TOPIC_FILE")"
TIER="$(node -e 'const o=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); process.stdout.write(o.tier||"news")' "$TOPIC_FILE")"
ID="$(node -e 'const o=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); process.stdout.write(o.id||"item")' "$TOPIC_FILE")"

echo "━━━ worker $ID ━━━"
echo "topic=$TOPIC tier=$TIER workdir=$WORKDIR max_attempts=$MAX_ATTEMPTS"
echo "started=$(date -Iseconds)"

build_prompt() {
  # build_prompt <outfile> <feedbackText>
  local out="$1" feedback="$2"
  node -e '
    const fs = require("fs");
    const [tmpl, out, topic, tier, feedback] = process.argv.slice(1);
    let s = fs.readFileSync(tmpl, "utf8");
    s = s.split("{{TOPIC}}").join(topic)
         .split("{{TIER}}").join(tier)
         .split("{{FEEDBACK_BLOCK}}").join(feedback || "(없음 — 최초 시도)");
    fs.writeFileSync(out, s);
  ' "$FACTORY_DIR/factory_prompt.md" "$out" "$TOPIC" "$TIER" "$feedback"
}

run_codex() {
  # run_codex <promptfile> <logfile>
  local promptfile="$1" logfile="$2"
  timeout 900 codex exec --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox \
    -C "$WORKDIR" - <"$promptfile" >"$logfile" 2>&1
}

do_imagegen() {
  # 이미지 라우팅 + 생성 + 매팅. 반환: 0=이미지 게이트 통과 or 이미지 불필요, 1=이미지 게이트 FAIL
  local logf="$1"
  echo "── route_images ──"
  node "$SK/render/route_images.mjs" "$WORKDIR" > route_images.log 2>&1 || echo "  ✗ route_images 실패"
  if [ ! -s prompts.jsonl ]; then
    echo "  (prompts.jsonl 없음/빈파일 — 이미지 생성 스킵)"
    return 0
  fi
  echo "── imagegen (PARALLEL=2) ──"
  PROMPTS="$WORKDIR/prompts.jsonl" OUTDIR="$WORKDIR" PARALLEL=2 \
    python3 "$SK/imagegen/codex_imagegen_runner.py" > imagegen.log 2>&1 || echo "  ✗ imagegen 일부 실패 — imagegen.log"
  # 컷아웃 매팅(raw→final) — G13 image 게이트보다 먼저 실행(게이트가 최종 매팅 PNG 유무 검사).
  shopt -s nullglob
  local raws=(assets/cutout/*_raw.png)
  shopt -u nullglob
  if [ "${#raws[@]}" -gt 0 ]; then
    echo "── matte (직렬, ${#raws[@]}건 — flock 전역락) ──"
    mkdir -p "$WORKDIR/.cache/numba"; export NUMBA_CACHE_DIR="$WORKDIR/.cache/numba"
    : > matte.log
    for raw in "${raws[@]}"; do
      out="${raw/_raw.png/.png}"
      flock /tmp/card-shorts-matte.lock "$PY" "$SK/imagegen/lowmem_matte.py" "$raw" "$out" >> matte.log 2>&1 || echo "  ✗ matte 실패: $raw" | tee -a matte.log
    done
  fi
  echo "── run_gates image ──"
  node "$G/run_gates.mjs" image "$WORKDIR" > "$logf" 2>&1
  return $?
}

do_render() {
  # 차트→카드HTML→PNG→G6 remediate→carousel 게이트. 반환: carousel 게이트 rc
  local logf="$1"
  echo "── render_chart ──"
  node "$SK/render/render_chart.mjs" "$WORKDIR" > render_chart.log 2>&1 || echo "  ✗ render_chart 일부 스킵 — render_chart.log"
  echo "── build_carousel ──"
  if ! node "$SK/render/build_carousel.mjs" "$WORKDIR" > build_carousel.log 2>&1; then
    echo "⛔ build_carousel 실패" ; cat build_carousel.log > "$logf" ; return 90
  fi
  mkdir -p out
  echo "── export_card ──"; : > export_card.log
  shopt -s nullglob; local htmls=(carousel/card-*.html); shopt -u nullglob
  for h in "${htmls[@]}"; do
    b="$(basename "$h" .html)"
    node "$SK/render/export_card.mjs" "$h" "out/$b.png" 1080 1350 >> export_card.log 2>&1 || echo "  ✗ export 실패: $h" | tee -a export_card.log
  done
  echo "── G6 사전체크 + remediate ──"; : > remediate.log
  shopt -s nullglob; local pngs=(out/card-*.png); shopt -u nullglob
  for png in "${pngs[@]}"; do
    local slots="${png%.png}.slots.json"; [ -f "$slots" ] || continue
    if ! "$PY" "$G/g06_contrast.py" "$png" "$slots" >> g06-precheck.log 2>&1; then
      local idx; idx="$(basename "$png" .png)"
      node "$G/remediate_contrast.mjs" "carousel/$idx.html" "$png" >> remediate.log 2>&1 || true
    fi
  done
  echo "── run_gates carousel ──"
  node "$G/run_gates.mjs" carousel "$WORKDIR" > "$logf" 2>&1
  return $?
}

# ── 통합 self-heal 루프 ──
PASSED=0
IMAGES_OK=0          # 이미지가 한 번이라도 생성·통과됐는가(재사용 가능)
PREV_IMAGE_FAILED=1  # 첫 attempt는 반드시 이미지 생성
GATE_IMAGE_RC=1
GATE_CAROUSEL_RC=1
for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  echo; echo "════ attempt $attempt/$MAX_ATTEMPTS ════"
  # 되먹임 = 누적 실패 이력(진동 감지) + 직전 attempt 전체 로그
  FEEDBACK=""
  if [ "$attempt" -gt 1 ]; then
    HIST="$(for n in $(seq 1 $((attempt-1))); do
      line="$(grep -hoE '✗ G[0-9]+[^(]*' "gate-attempt-$n.log" 2>/dev/null | sed 's/ *$//' | paste -sd'; ' -)"
      echo "· attempt $n: ${line:-(통과 후 다른 단계 실패)}"
    done)"
    FEEDBACK="### 누적 게이트 실패 이력 (attempt 1..$((attempt-1)))
$HIST

⚠ 위 이력이 길이 관련 게이트를 오간다면(G18 fill=여백 과다/텍스트 너무 짧음 ↔ G11 overflow·G2 copy-len=텍스트 너무 김) 그건 '진동'이다 — 전체를 갈아엎지 말고 문제 카드 하나의 텍스트 길이를 직전 두 시도의 '중간'으로만 국소 조정하라. 같은 게이트가 2회 이상 반복 실패하면 접근 방식(아키타입·카드 분할)을 바꿔라.

### 직전 시도(attempt $((attempt-1))) 전체 게이트 로그 — 아래 실패를 전부 '동시에' 해소하도록 재작성
\`\`\`
$(tail -c 8000 "gate-attempt-$((attempt-1)).log" 2>/dev/null)
\`\`\`"
  fi
  build_prompt "prompt-attempt-$attempt.md" "$FEEDBACK"
  run_codex "prompt-attempt-$attempt.md" "codex-attempt-$attempt.log"
  : > "gate-attempt-$attempt.log"

  if [ ! -f brief.json ] || [ ! -f copy.json ]; then
    echo "  ✗ brief.json/copy.json 미생성" | tee -a "gate-attempt-$attempt.log"; continue
  fi
  if ! node "$SK/render/compile_tokens.mjs" "$WORKDIR" >> "gate-attempt-$attempt.log" 2>&1; then
    echo "  ✗ compile_tokens 실패" | tee -a "gate-attempt-$attempt.log"; continue
  fi
  # copy/tokens 게이트
  node "$G/run_gates.mjs" copy "$WORKDIR" >> "gate-attempt-$attempt.log" 2>&1;   c1=$?
  node "$G/run_gates.mjs" tokens "$WORKDIR" >> "gate-attempt-$attempt.log" 2>&1; c2=$?
  if [ "$c1" -ne 0 ] || [ "$c2" -ne 0 ]; then
    echo "  ✗ copy/tokens FAIL(copy=$c1 tokens=$c2) — 재생성" ; continue
  fi
  echo "  ✓ copy/tokens 통과"

  # 이미지: 최초이거나 직전 이미지 게이트 실패 시에만 (재)생성. carousel-only 실패는 이미지 재사용.
  if [ "$IMAGES_OK" -eq 0 ] || [ "$PREV_IMAGE_FAILED" -eq 1 ]; then
    do_imagegen "gate-image.log"; GATE_IMAGE_RC=$?
    cat gate-image.log >> "gate-attempt-$attempt.log" 2>/dev/null
    if [ "$GATE_IMAGE_RC" -eq 0 ]; then IMAGES_OK=1; PREV_IMAGE_FAILED=0
    else echo "  ✗ image 게이트 FAIL — 다음 시도 이미지 재생성"; PREV_IMAGE_FAILED=1; continue; fi
  else
    echo "  (이미지 재사용 — 직전 통과)"
  fi

  # 렌더 + carousel 게이트
  do_render "gate-carousel.log"; GATE_CAROUSEL_RC=$?
  cat gate-carousel.log >> "gate-attempt-$attempt.log" 2>/dev/null
  if [ "$GATE_CAROUSEL_RC" -eq 0 ]; then
    PASSED=1; echo "  ✅ 전 게이트 통과(attempt $attempt)"; break
  fi
  echo "  ✗ carousel 게이트 FAIL — 카피 재작성(이미지 유지)"
done

echo; echo "finished=$(date -Iseconds)"

if [ "$PASSED" -eq 1 ]; then
  node -e '
    const fs = require("fs");
    const [id, topic, tier] = process.argv.slice(1);
    const copy = JSON.parse(fs.readFileSync("copy.json", "utf8"));
    fs.writeFileSync("summary.json", JSON.stringify({ id, topic, tier,
      cards: (copy.cards || []).length, gates: { image: "pass", carousel: "pass" },
      ts: new Date().toISOString() }, null, 2));
  ' "$ID" "$TOPIC" "$TIER"
  echo "✅ PASS" | tee PASS
  exit 0
else
  {
    echo "stage=self-heal-exhausted"
    echo "attempts=$MAX_ATTEMPTS"
    echo "gate_image_rc=$GATE_IMAGE_RC gate_carousel_rc=$GATE_CAROUSEL_RC"
    echo "--- 마지막 attempt 종합 로그 ---"
    cat "gate-attempt-$MAX_ATTEMPTS.log" 2>/dev/null
  } > FAIL
  echo "⛔ FAIL ($MAX_ATTEMPTS회 소진)"
  exit 1
fi
