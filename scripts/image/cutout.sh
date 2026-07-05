#!/usr/bin/env bash
# S4 누끼 — rembg(venv)로 클린배경 생성 이미지에서 피사체 컷아웃(투명 PNG).
# 사용: cutout.sh <in.png> <out.png> [model]  (model: birefnet-general|birefnet-portrait|isnet-general-use)
set -euo pipefail
REMBG="${CARDSHORTS_REMBG:-rembg}"
IN="$1"; OUT="$2"; MODEL="${3:-birefnet-general}"
[ -f "$IN" ] || { echo "입력 없음: $IN"; exit 1; }
# -a: alpha matting (엣지 품질↑). 실패 시 alpha matting 없이 폴백.
"$REMBG" i -m "$MODEL" -a "$IN" "$OUT" 2>/dev/null || "$REMBG" i -m "$MODEL" "$IN" "$OUT"
# 알파 검증: 투명 픽셀 존재해야 컷아웃 성공
"${CARDSHORTS_PY:-python3}" - "$OUT" <<'PY'
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGBA")
alpha = im.getchannel("A")
mn, mx = alpha.getextrema()
if mn == 255:
    print(f"✗ cutout FAIL — 투명 픽셀 없음(배경제거 실패): {sys.argv[1]}"); sys.exit(1)
print(f"✓ cutout OK — alpha range [{mn},{mx}] {sys.argv[1]}")
PY
