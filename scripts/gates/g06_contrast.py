#!/usr/bin/env python3
"""G6+ contrast: 렌더 PNG 텍스트 슬롯 bbox 배경 픽셀 실측 대비 (§4.9① 최악픽셀 하드닝).
종전(밝기합 정렬 중앙값) → 대비-퍼센타일 이중조건: median ≥ 4.5(대형 3.0) AND p10 ≥ 3.0.
사진 배경의 국소 고휘도(밝은 구름 뒤 흰 글자)가 중앙값을 통과해도 p10이 잡는다.
사용: g06_contrast.py <rendered.png> <slots.json>
exit 0 pass · 1 fail (입력 결손 fail-closed=1 · Pillow 미설치만 2)
"""
import sys, json, os

def rel_lum(rgb):
    def f(c):
        c = c / 255.0
        return c/12.92 if c <= 0.03928 else ((c+0.055)/1.055)**2.4
    r, g, b = rgb[:3]
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)

def contrast(a, b):
    L = sorted([rel_lum(a), rel_lum(b)], reverse=True)
    return (L[0]+0.05)/(L[1]+0.05)

def hex2rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def main():
    if len(sys.argv) < 3:
        print("usage: g06_contrast.py <png> <slots.json>"); return 2
    png, slots_path = sys.argv[1], sys.argv[2]
    try:
        from PIL import Image
    except Exception as e:
        print(f"  ! Pillow 미설치 → inconclusive: {e}"); return 2
    if not (os.path.exists(png) and os.path.exists(slots_path)):
        print(f"✗ G6 입력 결손(fail-closed): {png} / {slots_path}"); return 1
    slots = json.load(open(slots_path))
    slots = slots if isinstance(slots, list) else slots.get("slots", [])
    im = Image.open(png).convert("RGB")
    W, H = im.size
    px = im.load()
    fails, normal_min, large_min, p10_min = [], 4.5, 3.0, 3.0
    for s in slots:
        if "fg" not in s or "bbox" not in s:
            continue
        if s.get("slot") == "chart":
            continue  # 그래픽 컨테이너 — 바/트랙 색을 텍스트 배경으로 오인(p10 왜곡). 라벨 대비는 render_chart 계약(토큰 ink 라벨 + 투명배경)이 보증

        fg = hex2rgb(s["fg"])
        x, y, w, h = [int(round(v)) for v in s["bbox"]]
        x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x+w), min(H, y+h)
        if x1 <= x0 or y1 <= y0:
            continue
        bg_pix = []
        step = max(1, (x1-x0)//60)
        for yy in range(y0, y1, step):
            for xx in range(x0, x1, step):
                p = px[xx, yy]
                d = sum(abs(p[i]-fg[i]) for i in range(3))
                if d > 120:  # 텍스트 획 제외 → 배경 후보
                    bg_pix.append(p)
        if not bg_pix:
            fails.append(f"slot {s.get('slot')} 배경 샘플 없음(bg≈fg 극저대비 or 텍스트 꽉 참) — fail-closed"); continue
        crs = sorted(contrast(fg, p) for p in bg_pix)          # 픽셀별 대비 오름차순(§4.9①)
        cr_med = crs[len(crs)//2]
        cr_p10 = crs[max(0, int(len(crs)*0.10))]
        need = large_min if s.get("font_px", 0) >= 48 else normal_min
        if cr_med < need or cr_p10 < p10_min:
            fails.append(f"slot {s.get('slot')} median {cr_med:.2f}/p10 {cr_p10:.2f} < {need}/{p10_min} (fg={s['fg']})")
    if fails:
        print(f"✗ G6+ contrast FAIL ({len(fails)}):")
        for f in fails: print("   -", f)
        return 1
    print(f"✓ G6+ contrast PASS ({len(slots)} slots, median+p10)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
