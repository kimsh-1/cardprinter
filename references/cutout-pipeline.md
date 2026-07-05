# R5 — 누끼(배경제거) 파이프라인 + 알파 합성 규칙

클린 배경에 생성한 캐릭터·제품을 **투명 PNG**로 뽑고, 배경 레이어 위에 합성하는 절차. gpt-image-2는 투명 배경 미지원이므로 **불투명 생성 → 외부 누끼**가 표준.

---

## 1. 도구 비교

| 도구 / 모델 | 알파 품질 | 머리카락/엣지 | 크기 | 라이선스 | 비고 |
|---|---|---|---|---|---|
| **rembg · u2net** | 좋음(기본) | 보통 | 176MB | MIT | 범용 기본, 첫 실행 자동 다운로드 |
| **rembg · u2netp** | 보통 | 약함 | 4MB | MIT | 경량/모바일 |
| **rembg · isnet-general-use** | 매우 좋음 | 보통(백라이트 헤어 약함) | 176MB | 범용 신모델 | u2net보다 형태 정확 |
| **rembg · u2net_human_seg** | 좋음(인물) | 인물 특화 | — | MIT | 사람만; 소품 간헐 탈락 |
| **rembg · birefnet-general** | **최상** | **머리카락 최강** | ~400MB | 상용 가능 | **제품·캐릭터 권장 1순위** |
| **rembg · birefnet-portrait** | 최상(의미적) | 소품 유지+가구 제거 | ~928MB | MIT | 느림(~7s/frame CPU), 품질 티어 |
| **BiRefNet(원본)** | 최상 | 최강 | — | MIT/상용 | 오픈소스 SOTA, ComfyUI/ONNX 다수 래퍼 |
| **hyperframes remove-background** | 좋음 | 인물 | 자동(~168MB) | Apache-2.0(u2net_human_seg) | 영상 누끼(VP9 알파/ProRes)에 강함, 단일 이미지도 PNG |

**실측 근거(로컬 embedded-captions A/B, 5모델×6장면):** `birefnet-portrait`가 의미적으로 최강(소품 유지+가구 제거)이나 928MB·CPU 7s/frame으로 느림. `isnet-general-use`는 백라이트 머리카락에서 붕괴. `u2net_human_seg`는 얇은 오프셋 물체(마이크붐) 제외에 강하나 들고 있는 소품 간헐 탈락. CoreML EP는 mixed-precision 파티셔닝이 얼굴 알파를 망가뜨려 **매팅엔 금지**(CPU 권장).

---

## 2. 추천 (1개) + 설치

### 추천: **rembg + birefnet-general** (정지 이미지 카드뉴스 기준)
머리카락/삐죽한 실루엣/제품 엣지에서 가장 안정적이고, 상용 가능하며, CLI·Python 양쪽으로 배치가 쉽다. 캐릭터가 소품을 들면 `birefnet-portrait`로 승격, 대량·경량이면 `isnet-general-use`.

```bash
# 설치 (CPU + CLI). GPU면 [gpu,cli], AMD면 [rocm,cli]
pip install "rembg[cpu,cli]"

# 단일 파일 (모델 첫 실행 시 ~/.u2net/ 로 자동 다운로드)
rembg i -m birefnet-general input.png output.png

# 알파 매팅 켜기 (엣지 부드럽게 — 머리카락/반투명에 유효)
rembg i -m birefnet-general -a input.png output.png

# 마스크만 출력 (합성 커스텀용)
rembg i -om -m birefnet-general input.png mask.png

# 폴더 배치
rembg p -m birefnet-general ./in_dir ./out_dir
```

### Python 배치 (세션 재사용 = 대량 처리 필수)
```python
from pathlib import Path
from rembg import remove, new_session

session = new_session("birefnet-general")   # 모델 1회 로드 후 재사용
for f in Path("in").glob("*.png"):
    data = f.read_bytes()
    out = remove(
        data,
        session=session,
        alpha_matting=True,               # 엣지 개선
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=10,
    )
    (Path("out") / f"{f.stem}.png").write_bytes(out)
```

### 대안: **hyperframes remove-background** (쇼츠가 영상 컷아웃을 필요로 할 때)
```bash
npx hyperframes remove-background portrait.jpg -o cutout.png        # 단일 이미지
npx hyperframes remove-background subject.mp4  -o transparent.webm  # 영상: VP9+알파
npx hyperframes remove-background subject.mp4  -o subject.webm \
  --background-output plate.webm                                    # 전경/배경 2레이어 1패스
```
u2net_human_seg 자동 다운로드(~168MB, `~/.cache/hyperframes/`), CPU 권장. 카드뉴스가 **정지 히어로**면 rembg, **말하는 캐릭터/영상 오버레이**면 hyperframes.

---

## 3. 알파 합성 규칙 (투명 PNG → 레이어)

### 3-A. 그림자 — 생성 말고 CSS로
- **원칙:** 히어로는 **그림자 없이** 생성(누끼가 깔끔), 그림자는 합성 단계에서 만든다.
- **`filter: drop-shadow()` 사용** (box-shadow 아님): drop-shadow는 요소의 **알파 마스크**를 따라 그림자를 그려 투명 PNG의 실제 실루엣에 붙는다. box-shadow는 사각 바운딩박스에 붙어 컷아웃엔 틀림.
  ```css
  .hero { filter: drop-shadow(0 24px 32px rgba(0,0,0,.28)); }
  ```
- drop-shadow는 GPU 가속되어 box-shadow보다 성능도 유리. 접지(그림자) + 부유(공중) 둘 다 이걸로.
- **컨택트 섀도(바닥 접지):** 별도 타원 그라데이션 div를 발밑에 깔고 `blur` — drop-shadow만으론 바닥 앵커가 약할 때 보강.

### 3-B. 위치 / 스케일
- 세로 쇼츠(9:16)에서 히어로는 **하단 45~60% 존**에 배치, 상단은 헤드라인 밴드(image-strategy §1 배경 밴드와 정합).
- 컷아웃은 원본 해상도로 뽑고 **다운스케일만** 허용(업스케일 시 엣지 뭉개짐). 생성은 큰 캔버스(2048)로.
- 실루엣 여백을 넉넉히 남겨 생성(§image-strategy 캐릭터 배경 문법)해야 스케일·크롭 자유도 확보.

### 3-C. 부유(floating) 연출
- 히어로를 살짝 위로 띄우고(`transform: translateY(-6%)`) 발밑 그림자를 **더 흐리고 넓게** → 공중 부양감.
- 부유 애니메이션: `translateY` ±8px 사인파 루프 + 그림자 blur/opacity 역위상(가까우면 진하고 좁게). HyperFrames면 GSAP 단일 타임라인.
- **레이어 순서(쇼츠 3레이어):** z1 배경(통짜/plate) → z2 텍스트(HTML/CSS) → z3 히어로 컷아웃. 텍스트를 피사체 뒤에 두려면 이 순서(embedded-captions plate 패턴).

### 3-D. 금지
- **래스터 글자 합성 금지**(PIL/ImageMagick로 PNG 위 글자 굽기) — 철칙 #9. 텍스트는 항상 CSS/HTML 레이어.
- CoreML로 매팅 금지(얼굴 알파 손상). 매팅은 CPU.
- 컷아웃을 **자기 원본 위**에 올리기 금지(이중 실루엣). 배경은 반드시 다른 레이어.

---

## 4. 톤별 도구 선택 요약
| 톤 | 피사체 | 추천 모델 | 그림자 |
|---|---|---|---|
| 럭셔리 | 통짜 배경(누끼 선택) | birefnet-general (필요 시) | 생성물 유지 or drop-shadow |
| 캐릭터 | 마스코트(소품 有→portrait) | birefnet-general / birefnet-portrait | CSS drop-shadow + 컨택트 타원 |
| BI/제품 | 제품 히어로 | birefnet-general | 그림자 없이 생성 → CSS 재생성 |
