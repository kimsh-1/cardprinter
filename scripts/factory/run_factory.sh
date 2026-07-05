#!/usr/bin/env bash
# run_factory.sh — card-shorts codex 양산 러너. 사람 개입 0, 주제 목록 → 병렬 worker.sh → PASS/FAIL 회수.
# 사용: TOPICS=topics.jsonl OUTROOT=~/cardnews-work/factory PARALLEL=3 bash run_factory.sh
#   topics.jsonl 라인: {"id":"...", "topic":"한 줄 주제", "tier":"news|character|brand|luxury|editorial|data"}
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOPICS="${TOPICS:?사용법: TOPICS=topics.jsonl OUTROOT=~/cardnews-work/factory PARALLEL=3 bash run_factory.sh}"
OUTROOT="${OUTROOT:?OUTROOT 미지정 — 출력 루트 디렉토리 필요}"
PARALLEL="${PARALLEL:-3}"

if [ ! -f "$TOPICS" ]; then
  echo "✗ TOPICS 파일 없음: $TOPICS" >&2
  exit 1
fi
mkdir -p "$OUTROOT"

TOTAL=$(grep -c '[^[:space:]]' "$TOPICS" 2>/dev/null || echo 0)
echo "═══ card-shorts factory ═══"
echo "topics=$TOPICS(${TOTAL}건) outroot=$OUTROOT parallel=$PARALLEL"
echo

# FIFO 세마포어 — PARALLEL개 동시 실행, 초과분은 자연 대기(큐)
FIFO="$(mktemp -u "${TMPDIR:-/tmp}/card-shorts-factory.XXXXXX")"
mkfifo "$FIFO"
exec 8<>"$FIFO"
rm -f "$FIFO"
for _ in $(seq 1 "$PARALLEL"); do printf '\n' >&8; done

N=0
PIDS=()
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ""|[[:space:]]*) [ -z "$(printf '%s' "$line" | tr -d '[:space:]')" ] && continue ;; esac
  N=$((N + 1))
  id="$(node -e 'try{const o=JSON.parse(process.argv[1]);process.stdout.write(o.id||"")}catch(e){}' "$line" 2>/dev/null)"
  if [ -z "$id" ]; then
    echo "  ✗ [line $N] id 파싱 실패 — 스킵: $line"
    continue
  fi
  workdir="$OUTROOT/$id"
  mkdir -p "$workdir"
  printf '%s\n' "$line" > "$workdir/topic.json"

  read -r -u8 _tok  # 세마포어 획득(슬롯 없으면 여기서 대기 = 큐)
  (
    bash "$HERE/worker.sh" "$workdir/topic.json" "$workdir" > "$workdir/factory.log" 2>&1
    st=$?
    if [ -f "$workdir/PASS" ]; then
      echo "  ✅ [$id] PASS"
    else
      echo "  ⛔ [$id] FAIL(exit $st) — $workdir/factory.log"
    fi
    printf '\n' >&8  # 세마포어 반납
  ) &
  PIDS+=("$!")
done < "$TOPICS"

for pid in "${PIDS[@]}"; do wait "$pid"; done
exec 8>&- 8<&-

PASS_N=$(find "$OUTROOT" -mindepth 1 -maxdepth 2 -name PASS 2>/dev/null | wc -l | tr -d ' ')
FAIL_N=$(find "$OUTROOT" -mindepth 1 -maxdepth 2 -name FAIL 2>/dev/null | wc -l | tr -d ' ')

echo
echo "═══ 완료: PASS=$PASS_N FAIL=$FAIL_N / total=$N ═══"
[ "$FAIL_N" -eq 0 ]
exit $?
