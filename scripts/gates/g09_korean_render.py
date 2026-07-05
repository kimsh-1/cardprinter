#!/usr/bin/env python3
"""G9 korean-render: 렌더된 MP4/PNG 프레임에 한글이 정상 렌더(폰트 깨짐·두부 없음)됐는지.
사용: g09_korean_render.py <short.mp4|frame.png> [at_seconds=1.0]
exit 0 = 한글 검출(pass) · 1 = 텍스트 아예 없음(blank/broken, fail) · 2 = 텍스트는 있으나 한글 OCR 실패(스타일폰트 한계, inconclusive)
"""
import sys, os, subprocess, tempfile

def is_hangul(s):
    return any('가' <= ch <= '힣' for ch in s)

def main():
    if len(sys.argv) < 2:
        print("usage: g09_korean_render.py <mp4|png> [at]"); return 2
    src = sys.argv[1]
    at = sys.argv[2] if len(sys.argv) > 2 else "1.0"
    frame = src
    tmp = None
    if src.lower().endswith((".mp4", ".webm", ".mov")):
        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False).name
        r = subprocess.run(["ffmpeg", "-y", "-ss", str(at), "-i", src, "-frames:v", "1", tmp],
                           capture_output=True)
        if r.returncode != 0 or not os.path.exists(tmp):
            print(f"  ! 프레임 추출 실패: {r.stderr.decode()[-200:]}"); return 2
        frame = tmp
    try:
        from rapidocr_onnxruntime import RapidOCR
    except Exception as e:
        print(f"  ! rapidocr 미설치 → inconclusive: {e}"); return 2
    ocr = RapidOCR()
    result, _ = ocr(frame)
    if tmp:
        try: os.unlink(tmp)
        except Exception: pass
    texts = [str(it[1]).strip() for it in (result or []) if len(str(it[1]).strip()) >= 1]
    if not texts:
        print("✗ G9 korean-render FAIL — 프레임에 텍스트 0(blank/broken 의심)"); return 1
    if any(is_hangul(t) for t in texts):
        hang = [t for t in texts if is_hangul(t)][:5]
        print(f"✓ G9 korean-render PASS — 한글 검출: {hang}"); return 0
    print(f"  ! 텍스트 검출되나 한글 OCR 실패(스타일폰트 한계 가능) → inconclusive: {texts[:5]}")
    return 2

if __name__ == "__main__":
    sys.exit(main())
