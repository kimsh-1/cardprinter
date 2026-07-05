#!/usr/bin/env python3
"""G6+ occlusion (§4.9②): z20 컷아웃 알파가 텍스트 슬롯 bbox를 덮는 비율 실측.
rendered.png는 평탄화라 알파 복원 불가 → cutouts.json의 src 원본 알파를 frame_bbox로 리샘플해 재배치 계산.
occ_ratio = (슬롯 bbox ∩ 알파>threshold 픽셀) / 슬롯 면적. max > 0.08 → FAIL.
입력(슬롯/컷아웃 JSON·src PNG) 결손 = exit 1 (fail-closed, exit 2 아님 — §4.9).
컷아웃 없는 카드는 cutouts.json 자체가 없어도 됨 → 호출측이 존재 시에만 호출하거나 --allow-missing.
사용: g06plus_occlusion.py <slots.json> <cutouts.json> [--max=0.08]
exit 0 pass · 1 fail
"""
import sys, json, os

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = dict(a.lstrip("-").split("=") for a in sys.argv[1:] if a.startswith("--") and "=" in a)
    if len(args) < 2:
        print("usage: g06plus_occlusion.py <slots.json> <cutouts.json>"); return 1
    slots_path, cut_path = args
    max_ratio = float(opts.get("max", 0.08))
    for p in (slots_path, cut_path):
        if not os.path.exists(p):
            print(f"✗ occlusion 입력 결손(fail-closed): {p}"); return 1
    try:
        from PIL import Image
    except Exception:
        print("✗ Pillow 미설치 — fail-closed"); return 1
    slots = json.load(open(slots_path))
    slots = slots if isinstance(slots, list) else slots.get("slots", [])
    doc = json.load(open(cut_path))
    cw, ch = doc.get("canvas", [1080, 1350])
    fails = []
    base = os.path.dirname(os.path.abspath(cut_path))
    for cut in doc.get("cutouts", []):
        src = cut["src"]
        # src는 카드 HTML 기준 상대경로 — cutouts.json(out/) 기준·프로젝트 루트·carousel/ 순으로 해석
        cands = [src] if os.path.isabs(src) else [
            os.path.normpath(os.path.join(base, src)),
            os.path.normpath(os.path.join(base, "..", src)),
            os.path.normpath(os.path.join(base, "..", "carousel", src)),
        ]
        src_abs = next((p for p in cands if os.path.exists(p)), None)
        if not src_abs:
            print(f"✗ cutout src 결손(fail-closed): {cands}"); return 1
        x0, y0, x1, y1 = [int(round(v)) for v in cut["frame_bbox"]]
        bw, bh = max(1, x1 - x0), max(1, y1 - y0)
        thr = int(cut.get("alpha_threshold", 32))
        alpha = Image.open(src_abs).convert("RGBA").getchannel("A").resize((bw, bh))
        ap = alpha.load()
        for s in slots:
            if "bbox" not in s: continue
            sx, sy, sw, sh = [int(round(v)) for v in s["bbox"]]
            ix0, iy0 = max(sx, x0), max(sy, y0)
            ix1, iy1 = min(sx + sw, x1), min(sy + sh, y1)
            if ix1 <= ix0 or iy1 <= iy0: continue
            step = max(1, (ix1 - ix0) // 80) or 1
            hit = total = 0
            for yy in range(iy0, iy1, step):
                for xx in range(ix0, ix1, step):
                    total += 1
                    if ap[xx - x0, yy - y0] > thr: hit += 1
            # 교집합 표본 히트율 × (교집합/슬롯 면적) = 슬롯 대비 가림 비율
            occ = (hit / total if total else 0) * ((ix1 - ix0) * (iy1 - iy0)) / max(1, sw * sh)
            if occ > max_ratio:
                fails.append(f"slot {s.get('slot')} occ {occ:.3f} > {max_ratio} (cutout z{cut.get('z')})")
    if fails:
        print(f"✗ G6+ occlusion FAIL ({len(fails)}):")
        for f in fails: print("   -", f)
        return 1
    print(f"✓ G6+ occlusion PASS ({len(doc.get('cutouts', []))} cutouts × {len(slots)} slots)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
