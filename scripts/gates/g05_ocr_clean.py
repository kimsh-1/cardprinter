#!/usr/bin/env python3
"""G5 ocr-clean: 생성 배경 PNG에 잔여 글자 0 확인(글자 없는 배경 보장).
사용: g05_ocr_clean.py <bg.png> [conf_threshold=0.5]
exit 0 = 글자 없음(pass) · 1 = 글자 검출(fail) · 2 = OCR 불가(inconclusive)
"""
import sys

def main():
    if len(sys.argv) < 2:
        print("usage: g05_ocr_clean.py <bg.png> [conf]"); return 2
    img = sys.argv[1]
    conf_th = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5
    try:
        from rapidocr_onnxruntime import RapidOCR
    except Exception as e:
        print(f"  ! rapidocr 미설치 → inconclusive: {e}"); return 2
    ocr = RapidOCR()
    result, _ = ocr(img)
    hits = []
    for item in (result or []):
        # item = [box, text, score]
        text = str(item[1]).strip()
        score = float(item[2]) if len(item) > 2 else 1.0
        # 노이즈/단일 기호 무시: 2자 이상 & 신뢰도 임계 이상
        if score >= conf_th and len(text) >= 2 and any(ch.isalnum() for ch in text):
            hits.append((text, round(score, 2)))
    if hits:
        print(f"✗ G5 ocr-clean FAIL — 배경에 글자 {len(hits)}개 검출: {hits[:8]}")
        return 1
    print("✓ G5 ocr-clean PASS — 배경 글자 없음")
    return 0

if __name__ == "__main__":
    sys.exit(main())
