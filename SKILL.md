---
name: card-shorts
description: 뉴스·주제 한 줄을 ① 바이럴 카드뉴스 기획·카피 → ② 3티어 톤(럭셔리/귀여운캐릭터/브랜드BI) 이미지 → ③ 업로드용 캐러셀 PNG(4:5) + 9:16 쇼츠 MP4까지 자동 생성하는 개인 전용 스킬. 중간 단계마다 계약 파일(brief/copy/tokens/storyboard)을 남겨 사람이 수정·재실행 가능. 물리적 하드게이트(G1~G12)·컨텍스트 격리 스웜·품질 루프로 제품급 보장. 트리거 — "카드뉴스 만들어", "카드뉴스 쇼츠", "뉴스 주제로 카드뉴스", "인스타 캐러셀 만들어", "쇼츠 카드뉴스", "card-shorts", 뉴스 주제 한 줄 입력. 후속 — "카피만 다시", "톤 바꿔서", "이 카드만 수정", "쇼츠로 만들어", "A/B로".
---

# card-shorts — 카드뉴스 → 쇼츠 생성

뉴스/주제 → **캐러셀 PNG(4:5 1080×1350) + 9:16 쇼츠 MP4(1080×1920)**. 단계별 계약 파일을 남겨 수정·재실행 가능. 엔진=HyperFrames(로컬 결정론 렌더), 이미지=gpt-image-2, 누끼=rembg(birefnet), 폰트=번들 woff2(무음+키네틱 자막 기본; 한국어 로컬 TTS 부재).

## 원칙 (soft 지시 아님 — 코드가 강제)
1. **하드게이트**: 각 단계는 `scripts/gates/`의 exit-code 게이트를 통과해야 다음으로. 실패 시 그 단계만 재큐(self-heal max3).
2. **컨텍스트 격리 스웜**: 코디네이터는 계약 JSON만 보유. 카드별/단계별 격리 서브에이전트. 워커는 **조판만**(copy 텍스트 편집 금지 — 하면 G10 재감사).
3. **품질 루프**: 판정 에이전트가 레퍼런스 대비 5축 채점(criteria §1). 애매하면 A/B 둘 다.
4. **팩트 무결**: 카피는 brief.facts만 사용(날조 0, G10). 생성 이미지 위 코드 글자 합성 금지 — 텍스트는 항상 HTML 레이어.

## 파이프라인 (단일 진실 = copy/tokens/assets 계약, HTML은 포맷 어댑터)

| 단계 | 산출(수정지점) | 도구 | 게이트 |
|---|---|---|---|
| **S1** 입력·리서치 | `brief.json` (팩트·티어·옵션) | Claude + insane-search/firecrawl | — |
| **S2** 카피 | `copy.json` (타입드 슬라이드 N장) | Claude + `references/copy-formulas.md` | G1,G2,G10 |
| **S3** 디자인 스펙 | `tokens.json` | 결정론(`references/tiers/<tier>.json`) | G3,G9(glyph) |
| **S4** 이미지+누끼 | `assets/bg/*.png`+`assets/cutout/*.png`+`image-manifest.json` | codex-imagegen(gpt-image-2) + rembg venv | G4,G5 |
| **S5** 캐러셀 카드 | `carousel/card-NN.html` (4:5, 3레이어) | Claude 조판(티어 CSS) | — |
| **S6** PNG 익스포트 | `out/card-NN.png` + `.slots.json` ★캐러셀 | `scripts/render/export_card.mjs` | G6,G7,G11 |
| **S7** 쇼츠 | `shorts/index.html`→`out/short.mp4` ★쇼츠 | `scripts/render/build_shorts.mjs`+`render_shorts.sh` | G8,G9,G12 |
| **S8** 수정 루프 | 임의 계약 파일 편집 후 downstream 재실행 | — | 해당 게이트 |

## 3티어 (S2 톤 선택 → 일괄 결정)
`references/tiers/{luxury,character,brand}.json`이 팔레트·폰트·그리드·합성모드·이미지룩·모션을 결정.
- **luxury**: Noir 통짜 시네마틱 배경, Noto Serif KR, design-apple, 느린 우아.
- **character**: 파스텔 CSS 배경 + 캐릭터 누끼(필수), Jua/Gowun Dodum, design-notion, 바운시. (fg 다크 강제=WCAG)
- **brand**: 단색/그리드 + 제품 누끼 + 타이포, Gmarket/Do Hyeon, design-vercel/linear, 정확.

### 커스텀 티어 (4번째 티어 생성)
트리거 — "우리 회사 브랜드로", "BI 문서로 톤 만들어", "스타일 인터뷰". 기본 3티어로 안 맞을 때, 사용자
기업 BI 자료 또는 인터뷰로 `references/tiers/custom-<name>.json`을 새로 만든다. 두 경로 모두
`references/custom-tier-guide.md` 런북을 그대로 따라 실행:
- **경로A(BI 인제스트)**: 브랜드 컬러/로고/가이드 이미지 → `scripts/tiers/palette_extract.py`로 색 추출 →
  surface/accent 직교 구성 → 폰트 매핑 → `compile_tokens.mjs`+G3 검증 루프(WCAG 미달 시 명도 보정 재시도).
- **경로B(인터뷰)**: 무드·배경밝기·포인트색·폰트느낌·레퍼런스계정 5문항 → 같은 구성 규칙으로 수렴.
생성된 `custom-<name>` 티어는 이후 S2~S7 파이프라인에서 기존 3티어와 동일하게 `tier` 값으로 사용.

## 실행 커맨드
```bash
# 원커맨드 파이프라인 (brief+copy+tokens+storyboard 준비 후 S3→S7 + 전 게이트)
bash scripts/pipeline.sh <projectDir> [draft|high]
# 게이트(단계별): copy|tokens|image|carousel|shorts|all
node scripts/gates/run_gates.mjs <stage> <projectDir>
# 캐러셀 PNG: 카드 HTML → PNG + slots.json
node scripts/render/export_card.mjs <card.html> <out/card-NN.png> 1080 1350
# 쇼츠: 계약 → 9:16 컴포지션 → MP4 (draft|high)
node scripts/render/build_shorts.mjs <projectDir>
bash scripts/render/render_shorts.sh <projectDir> high
# 누끼: rembg venv
rembg i -m birefnet-general -a in.png out.png
```
- **렌더 env**: chrome-headless-shell 라이브러리 경로는 render 스크립트가 자체 주입(LD_LIBRARY_PATH). 수동 실행 시 필요하면 `export LD_LIBRARY_PATH=$CARDSHORTS_CHROME_LIBS:$LD_LIBRARY_PATH`.
- 렌더는 **유저 게이트** — 최종 `high` 렌더는 사용자 확인 후.

## 게이트 (G1~G12, 전부 exit-code)
G1 카드수 · G2 글자수(표지≤24·본문≤90) · G3 tokens스키마(woff2실재) · G4 프롬프트(image-prompt) · G5 OCR-clean(배경글자0) · G6 대비(렌더PNG 픽셀실측 4.5:1) · G7 PNG규격 · G8 MP4유효 · G9 glyph-coverage(결정론 두부방지)+render-OCR(비차단) · G10 fact-fidelity(날조0) · G11 overflow(bbox⊂세이프존) · G12 caption-match(copy파생). 자가검증: `bash scripts/gates/test/run_tests.sh`.

## 열린 결정 (기본값, 사용자 확인)
PNG 4:5(vs 1:1) · 무음자막(vs TTS 크레덴셜) · 캐릭터 마스코트 일관성(캐릭터시트 고정 권장).

## 참조
`references/`: copy-formulas.md · fonts.json · tiers/*.json · render-recipe.md · image-strategy.md · cutout-pipeline.md · shorts-specs.json · research-index.md(_INDEX). 상세 근거는 `/mnt/d/2026-07-CARDNEWS`.
