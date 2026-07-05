#!/usr/bin/env bash
# 티어 폰트 woff2 번들 재생성 — Fontsource korean 서브셋(한글 완전 커버). OFL만.
set -u
OUT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/assets/fonts}"
mkdir -p "$OUT"
declare -A F=(
  [NotoSerifKR-Black]="noto-serif-kr@latest/korean-900-normal.woff2"
  [Jua]="jua@latest/korean-400-normal.woff2"
  [GowunDodum]="gowun-dodum@latest/korean-400-normal.woff2"
  [Gaegu-Bold]="gaegu@latest/korean-700-normal.woff2"
  [BlackHanSans]="black-han-sans@latest/korean-400-normal.woff2"
  [DoHyeon]="do-hyeon@latest/korean-400-normal.woff2"
)
for k in "${!F[@]}"; do
  curl -sL -o "$OUT/$k.woff2" "https://cdn.jsdelivr.net/fontsource/fonts/${F[$k]}"
  echo "$k: $(wc -c <"$OUT/$k.woff2") bytes"
done
# Pretendard local (OFL)
for w in Regular Bold Black; do
  cp "$HOME/.fonts/pretendard-pkg/web/static/woff2/Pretendard-$w.woff2" "$OUT/" 2>/dev/null && echo "Pretendard-$w (local)"
done
echo "bundle → $OUT"
