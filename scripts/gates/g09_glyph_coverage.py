#!/usr/bin/env python3
"""G9 glyph-coverage (결정론적 tofu 방지): copy.json 텍스트의 모든 글자가
선택 폰트(tokens.json woff2)의 cmap에 존재하는지 빌드타임 검증.
OCR로 출력물을 읽는 것보다 신뢰도 높음(한국어 OCR 모델 불필요).
사용: g09_glyph_coverage.py <copy.json> <tokens.json> [baseDir]
exit 0 pass · 1 fail(누락 글자=렌더 시 두부) · 2 inconclusive(폰트 로드 불가)
"""
import sys, json, os

def load_cmap(woff2):
    from fontTools.ttLib import TTFont
    return set(TTFont(woff2).getBestCmap().keys())

def main():
    if len(sys.argv) < 3:
        print("usage: g09_glyph_coverage.py <copy.json> <tokens.json> [baseDir]"); return 2
    copy = json.load(open(sys.argv[1]))
    tok = json.load(open(sys.argv[2]))
    base = sys.argv[3] if len(sys.argv) > 3 else os.path.dirname(os.path.abspath(sys.argv[2]))
    fonts = tok.get("fonts", {})
    SKILL_FONTS = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "assets", "fonts")
    def resolve(role):
        f = fonts.get(role) or {}
        w = f.get("woff2") or f.get("woff2_fallback")
        if not w: return None
        p = w if os.path.isabs(w) else os.path.join(base, w)
        if os.path.exists(p): return p
        # 폴백: 스킬 번들에서 basename으로 탐색
        alt = os.path.join(SKILL_FONTS, os.path.basename(w))
        return alt if os.path.exists(alt) else p
    try:
        cmaps = {}
        for role in ("title", "body", "accent"):
            p = resolve(role)
            if p and os.path.exists(p):
                cmaps[role] = load_cmap(p)
    except Exception as e:
        print(f"  ! 폰트 로드 실패 → inconclusive: {e}"); return 2
    if not cmaps:
        print("  ! cmap 없음 → inconclusive"); return 2
    body_cm = cmaps.get("body") or next(iter(cmaps.values()))
    title_cm = cmaps.get("title") or body_cm
    # 폰트 스택은 항상 번들 body 폰트(Pretendard)로 폴백한다(build_carousel stack()).
    # 따라서 슬롯 폰트에 없어도 body 폰트에 있으면 폴백으로 정상 렌더 — 두부(□) 아님.
    # 실측: 미들닷 '·'(U+00B7)은 Do Hyeon/Black Han Sans에 없지만 Pretendard에 있어 폴백 렌더됨.
    ignore = set(" \n\t\r")
    missing = []
    for c in copy.get("cards", []):
        for field, cm, cmname in [("headline", title_cm, "title"), ("subhead", body_cm, "body"), ("body", body_cm, "body")]:
            s = c.get(field)
            if not s: continue
            for ch in s:
                if ch in ignore: continue
                # 슬롯 폰트 OR 번들 body 폰트(폴백) 어디에도 없을 때만 두부 위험.
                if ord(ch) not in cm and ord(ch) not in body_cm:
                    missing.append(f"카드[{c.get('index')}].{field} '{ch}'(U+{ord(ch):04X}) — 번들 폰트 어디에도 없음(두부 위험)")
    if missing:
        print(f"✗ G9 glyph-coverage FAIL — 폰트 미포함 글자 {len(missing)}개(렌더 시 두부□):")
        for m in missing[:12]: print("   -", m)
        return 1
    print("✓ G9 glyph-coverage PASS — 모든 글자 폰트 cmap 포함")
    return 0

if __name__ == "__main__":
    sys.exit(main())
