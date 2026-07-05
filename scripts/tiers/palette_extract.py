#!/usr/bin/env python3
"""palette_extract.py — BI 이미지(로고/브랜드 가이드 스크린샷/제품 사진)에서 지배 색상 추출.

용도: card-shorts 커스텀 티어 생성(경로A, BI 인제스트)의 첫 단계.
      references/custom-tier-guide.md 경로A 절차에서 호출됨.

사용:
    python3 palette_extract.py <이미지1> [이미지2...]

출력(stdout, JSON):
{
  "dominant": ["#RRGGBB", ...]     최대 8개, 여러 이미지에 걸친 점유율 평균 내림차순
  "per_image": {
    "<파일경로>": {
      "colors": [{"hex": "#RRGGBB", "share": 0.xx}, ...]   해당 이미지 내 점유율순(최대 8)
      "extremes": [{"hex": "#RRGGBB", "type": "near_white"|"near_black", "share": 0.xx}, ...]
    }, ...
  }
}

극단 무채색(순백 근방 RGB 전 채널 >=245, 순흑 근방 전 채널 <=10)은 dominant/colors에도 포함하되
extremes에 별도 표기한다 — surface bg/hairline 후보로 그대로 오인되는 것을 막기 위함(§custom-tier-guide 경로A).

의존성: Pillow만 사용(venv에 Pillow 12 설치됨). quantize(MEDIANCUT)로 대표색 추출 후 픽셀 카운트로 점유율 산출.
"""
import json
import sys
from pathlib import Path

from PIL import Image

RESIZE_MAX = 300          # 리사이즈 후 최장변(px) — 속도용, 색 분포엔 영향 미미
QUANTIZE_COLORS = 32      # 1차 양자화 팔레트 크기(대표색 후보 폭)
TOP_N = 8                 # 이미지당/전체 상위 몇 개 색을 남길지
WHITE_THRESHOLD = 245     # 이 값 이상(RGB 전 채널)이면 near_white
BLACK_THRESHOLD = 10      # 이 값 이하(RGB 전 채널)이면 near_black


def classify_extreme(r, g, b):
    if r >= WHITE_THRESHOLD and g >= WHITE_THRESHOLD and b >= WHITE_THRESHOLD:
        return "near_white"
    if r <= BLACK_THRESHOLD and g <= BLACK_THRESHOLD and b <= BLACK_THRESHOLD:
        return "near_black"
    return None


def extract_colors(path):
    img = Image.open(path).convert("RGB")
    img.thumbnail((RESIZE_MAX, RESIZE_MAX))
    total_px = img.width * img.height
    if total_px == 0:
        return []

    quant = img.quantize(colors=QUANTIZE_COLORS, method=Image.MEDIANCUT)
    palette = quant.getpalette()
    counts = quant.getcolors(maxcolors=QUANTIZE_COLORS) or []
    counts.sort(key=lambda c: -c[0])

    results = []
    for count, idx in counts[:TOP_N]:
        r, g, b = palette[idx * 3], palette[idx * 3 + 1], palette[idx * 3 + 2]
        results.append({
            "hex": "#{:02X}{:02X}{:02X}".format(r, g, b),
            "share": round(count / total_px, 4),
            "_extreme": classify_extreme(r, g, b),
        })
    return results


def main():
    if len(sys.argv) < 2:
        print("사용: palette_extract.py <이미지1> [이미지2...]", file=sys.stderr)
        sys.exit(1)

    per_image = {}
    agg_share = {}   # hex -> 누적 share (이미지 수로 나눠 평균)
    n_images = 0

    for arg in sys.argv[1:]:
        path = Path(arg)
        if not path.exists():
            print(f"✗ 파일 없음: {arg}", file=sys.stderr)
            sys.exit(1)
        try:
            colors = extract_colors(path)
        except Exception as e:
            print(f"✗ 처리 실패 ({arg}): {e}", file=sys.stderr)
            sys.exit(1)

        n_images += 1
        extremes = [
            {"hex": c["hex"], "type": c["_extreme"], "share": c["share"]}
            for c in colors if c["_extreme"]
        ]
        per_image[str(path)] = {
            "colors": [{"hex": c["hex"], "share": c["share"]} for c in colors],
            "extremes": extremes,
        }
        for c in colors:
            agg_share[c["hex"]] = agg_share.get(c["hex"], 0.0) + c["share"]

    dominant_sorted = sorted(
        ((h, s / n_images) for h, s in agg_share.items()),
        key=lambda kv: -kv[1],
    )
    dominant = [h for h, _ in dominant_sorted[:TOP_N]]

    print(json.dumps({"dominant": dominant, "per_image": per_image}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
