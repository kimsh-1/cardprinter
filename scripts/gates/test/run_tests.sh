#!/usr/bin/env bash
# Gate unit tests — 합격/불합격 픽스처로 exit-code 검증. Phase 3 DoD.
set -u
[ -n "${CARDSHORTS_CHROME_LIBS:-}" ] && export LD_LIBRARY_PATH="$CARDSHORTS_CHROME_LIBS:${LD_LIBRARY_PATH:-}"
G="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY="${CARDSHORTS_PY:-python3}"
T=$(mktemp -d)
pass=0; fail=0
assert() { # <desc> <expected_exit> <actual_exit>
  if [ "$2" = "$3" ]; then echo "  ✓ $1 (exit $3)"; pass=$((pass+1));
  else echo "  ✗ $1 — expected exit $2, got $3"; fail=$((fail+1)); fi
}
run() { "$@" >/dev/null 2>&1; echo $?; }

echo "=== fixtures ==="
mkdir -p "$T/out" "$T/assets/fonts"
cp "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)/assets/fonts/Pretendard-Regular.woff2" "$T/assets/fonts/" 2>/dev/null

# brief
cat > "$T/brief.json" <<'JSON'
{"topic":"테스트","tier":"luxury","options":{"png_ratio":"4:5","card_count":8},
 "facts":[{"id":"f1","claim":"물가 상승","number":"3.5%","source":"통계청"},
          {"id":"f2","claim":"금리 동결","number":"3.5","source":"한은"}]}
JSON
# GOOD copy (8 cards, lengths ok, facts ok)
cat > "$T/copy_good.json" <<'JSON'
{"card_count":8,"cards":[
 {"index":1,"type":"cover","headline":"물가 3.5% 올랐다","subhead":"당신의 지갑에 무슨 일이","fact_refs":["f1"]},
 {"index":2,"type":"hook","body":"1초 만에 이해하는 물가","fact_refs":[]},
 {"index":3,"type":"body","body":"소비자물가가 3.5% 상승했다","fact_refs":["f1"]},
 {"index":4,"type":"stat","body":"금리는 3.5 수준 동결","fact_refs":["f2"]},
 {"index":5,"type":"body","body":"장바구니 부담이 커진다","fact_refs":[]},
 {"index":6,"type":"comparison","body":"작년보다 오른 품목들","fact_refs":[]},
 {"index":7,"type":"source","body":"자료 통계청 한국은행","fact_refs":["f1","f2"]},
 {"index":8,"type":"cta","headline":"저장하세요","body":"핵심만 다시 보기"}]}
JSON
# BAD copy: wrong count(2), headline too long(>24), fabricated number(9.9%)
cat > "$T/copy_bad.json" <<'JSON'
{"card_count":8,"cards":[
 {"index":1,"type":"cover","headline":"이것은 스물네글자를 훌쩍 넘어가는 아주 긴 표지 헤드라인입니다 진짜로","fact_refs":["f1"]},
 {"index":2,"type":"body","body":"물가가 무려 9.9% 폭등했다는 충격","fact_refs":["f1"]}]}
JSON
# tokens good/bad
cat > "$T/tokens_good.json" <<JSON
{"tier":"luxury","palette":{"bg":"#0E0F12","fg":"#F6F1E8","accent":"#C8B08A"},
 "fonts":{"title":{"family":"Pretendard","woff2":"assets/fonts/Pretendard-Regular.woff2"},
          "body":{"family":"Pretendard","woff2":"assets/fonts/Pretendard-Regular.woff2"}},
 "grid":{"margin_px":120}}
JSON
cat > "$T/tokens_bad.json" <<'JSON'
{"tier":"x","palette":{"bg":"#000000","fg":"#111111","accent":"#222222"},
 "fonts":{"title":{"family":"Ghost","woff2":"assets/fonts/DOES-NOT-EXIST.woff2"},"body":{"family":"Pretendard"}},
 "grid":{}}
JSON
# storyboard good/bad
cat > "$T/storyboard_good.json" <<'JSON'
{"scenes":[{"card":3,"caption":{"text":"소비자물가가 3.5% 상승했다"}},{"card":8,"caption":{"text":"핵심만 다시 보기"}}]}
JSON
cat > "$T/storyboard_bad.json" <<'JSON'
{"scenes":[{"card":3,"caption":{"text":"완전히 다른 자막 텍스트 이중소스"}}]}
JSON
# slots good (inside 4:5 safe) / bad (overflow)
cat > "$T/out/card-01.slots.json" <<'JSON'
[{"slot":"headline","bbox":[120,700,840,180],"fg":"#F6F1E8","font_px":120}]
JSON
cat > "$T/slots_overflow.json" <<'JSON'
[{"slot":"headline","bbox":[40,700,1010,180],"fg":"#F6F1E8","font_px":120}]
JSON

echo "=== G1 copy-count ==="
assert "good copy passes" 0 "$(run node $G/g01_copy_count.mjs $T/copy_good.json $T/brief.json)"
assert "bad copy(count) fails" 1 "$(run node $G/g01_copy_count.mjs $T/copy_bad.json $T/brief.json)"
echo "=== G2 copy-len ==="
assert "good len passes" 0 "$(run node $G/g02_copy_len.mjs $T/copy_good.json)"
assert "long headline fails" 1 "$(run node $G/g02_copy_len.mjs $T/copy_bad.json)"
echo "=== G3 tokens ==="
assert "good tokens pass" 0 "$(run node $G/g03_tokens_schema.mjs $T/tokens_good.json $T)"
assert "bad tokens fail" 1 "$(run node $G/g03_tokens_schema.mjs $T/tokens_bad.json $T)"
echo "=== G10 fact-fidelity ==="
assert "good facts pass" 0 "$(run node $G/g10_fact_fidelity.mjs $T/copy_good.json $T/brief.json)"
assert "fabricated number fails" 1 "$(run node $G/g10_fact_fidelity.mjs $T/copy_bad.json $T/brief.json)"
echo "=== G12 caption-match ==="
assert "derived caption passes" 0 "$(run node $G/g12_caption_match.mjs $T/storyboard_good.json $T/copy_good.json)"
assert "independent caption fails" 1 "$(run node $G/g12_caption_match.mjs $T/storyboard_bad.json $T/copy_good.json)"
echo "=== G11 overflow ==="
assert "inside safe passes" 0 "$(run node $G/g11_overflow.mjs $T/out/card-01.slots.json carousel_4_5)"
assert "overflow fails" 1 "$(run node $G/g11_overflow.mjs $T/slots_overflow.json carousel_4_5)"

echo "=== G8 mp4-valid (phase0 smoke) ==="
SMOKE=/mnt/d/2026-07-CARDNEWS/01_plan/phase0-smoke.mp4
[ -f "$SMOKE" ] && assert "phase0 smoke mp4 valid" 0 "$(run node $G/g08_mp4_valid.mjs $SMOKE)" || echo "  (smoke mp4 없음, 스킵)"

echo "=== G7 png-export (generate test pngs) ==="
ffmpeg -y -f lavfi -i color=c=black:s=1080x1350 -frames:v 1 "$T/out/card-01.png" >/dev/null 2>&1
ffmpeg -y -f lavfi -i color=c=black:s=1080x1920 -frames:v 1 "$T/out/card-02.png" >/dev/null 2>&1
assert "1080x1350 4:5 passes" 0 "$(run node $G/g07_png_export.mjs $T/out/card-01.png 4:5)"
assert "1080x1920 as 4:5 fails" 1 "$(run node $G/g07_png_export.mjs $T/out/card-02.png 4:5)"

echo "=== G9 glyph-coverage (결정론 두부 방지, 하드) ==="
# good: copy_good chars in Pretendard; bad: rare hanja not in font
assert "covered text passes" 0 "$(run $PY $G/g09_glyph_coverage.py $T/copy_good.json $T/tokens_good.json $T)"
cat > "$T/copy_tofu.json" <<'JSON'
{"card_count":1,"cards":[{"index":1,"type":"cover","headline":"𠀀 희귀한자","body":"정상"}]}
JSON
assert "uncovered glyph fails" 1 "$(run $PY $G/g09_glyph_coverage.py $T/copy_tofu.json $T/tokens_good.json $T)"

echo "=== G5 ocr-clean (det) & G9b render-OCR (non-blocking) ==="
ffmpeg -y -f lavfi -i color=c=0x1C1A17:s=1080x1350 -frames:v 1 "$T/clean.png" >/dev/null 2>&1
e=$(run $PY $G/g05_ocr_clean.py "$T/clean.png"); assert "clean bg no-text passes" 0 "$e"
# render-OCR은 한국어 인식모델 부재로 0(검출) 또는 2(inconclusive) 모두 허용 — 비차단 확인
G9SRC=/mnt/d/2026-07-CARDNEWS/01_plan/phase0-smoke-korean.png
if [ -f "$G9SRC" ]; then e=$(run $PY $G/g09_korean_render.py "$G9SRC");
  if [ "$e" = 0 ] || [ "$e" = 2 ]; then echo "  ✓ render-OCR non-blocking (exit $e ok)"; pass=$((pass+1)); else echo "  ✗ render-OCR unexpected exit $e"; fail=$((fail+1)); fi
fi

echo ""
echo "════ RESULT: $pass passed, $fail failed ════"
rm -rf "$T"
[ "$fail" = 0 ] && exit 0 || exit 1
