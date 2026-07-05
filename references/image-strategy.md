# R5 — 톤별 이미지 생성 전략서 (배경 + 컷아웃)

카드뉴스→쇼츠 파이프라인의 이미지 축. 세 톤(**럭셔리 / 캐릭터 / BI**) 각각에 대해 ① 히어로·배경 프롬프트 전략과 ② 피사체 컷아웃(누끼) 전략을 분리해 규정한다. 모든 프롬프트 문법은 로컬 `image-prompt` 스킬(VOL.2, v2.2.0)의 검증된 규칙을 상속한다.

---

## 0. 대전제 — gpt-image-2 + image-prompt 규칙 상속

- **네거티브 금지, 전부 긍정형**(스킬 철칙 #2). "글자 없는 배경"은 `no text`가 아니라 **긍정 상태 서술**로 뽑는다: `clean uninterrupted background, no printed words anywhere on the surface`는 텍스트 렌더 가드(Tier-1)에서만 `no watermark/no extra text` 허용. 기본은 `smooth empty backdrop, generous negative space left clear for later typography`.
- **투명 배경은 gpt-image-2 미지원** — API `background:"transparent"`는 gpt-image-1.5 폴백. 실무 파이프라인은 **불투명 클린 배경으로 생성 → 외부 누끼 도구로 알파화**가 정답(cutout-pipeline.md).
- 끝에 `AR x:y` 토큰 1개, 앞 브래킷 금지, HEX 3~5색 명시, 장비명 대신 결과 서술.
- **생성 후 글자 후처리 절대 금지**(철칙 #9). 카피는 프롬프트 안에서 렌더하거나, 컷아웃 PNG를 레이어 합성한 뒤 **HTML/CSS 텍스트 레이어**로 얹는다(래스터 합성 아님).

---

## 1. 톤별 배경 / 히어로 전략

### 1-A. 럭셔리 — 시네마틱 통짜 배경
- **목표:** 배경 자체가 무드. 피사체를 안 뺄 수도 있는(통짜) 풀블리드 시네마틱 스틸.
- **룩 프리셋:** `L1 럭셔리 에디토리얼` (여백 지배 + 얇은 세리프 + 뮤트 팔레트) 또는 `L2 시네마틱 그레이드`.
- **배경 문법:**
  - 과감한 네거티브 스페이스, 피사체는 프레임 1/3 이하 (`generous negative space dominating the frame, subject occupying under one third`).
  - 얕은 심도로 배경이 부드럽게 떨어짐 (`shallow DoF, background falls off softly`), 웜키 vs 쿨 섀도, 드리프팅 헤이즈.
  - 팔레트 HEX 고정: 아이보리 `#F5F1E8` / 잉크 `#1C1A17` / 토프 `#8C7B6B`, 또는 딥섀도 `#0E1420` / 웜하이 `#D9A566` / 스틸블루 `#4A6670`.
  - **글자 없는 배경 보장:** `upper third kept as a calm empty band for a title treatment, the surface itself carries no lettering` — negative space를 "타이틀 밴드"로 지정하면 모델이 그 영역을 비운다(C11 키아트 문법).
- **R축 결합:** "고급스럽게" → `hushed composition the viewer lowers their voice for, every element aligned, nothing decorative left`.

### 1-B. 캐릭터 — 마스코트 클린 배경
- **목표:** 캐릭터/마스코트를 **깨끗한 배경에 단독**으로 생성 → 반드시 컷아웃해서 레이어로 재사용.
- **룩 프리셋:** `L7 소프트 파스텔` (라운드 도형 + 파스텔 카드 틴트), 캐릭터 톤엔 이게 기본.
- **배경 문법:**
  - **컷아웃 대비 최상 조건:** `single mascot character centered on a seamless flat background, even soft lighting, no cast shadow touching the character, wide clean margin around the full silhouette`.
  - 배경은 **단색 또는 아주 옅은 그라데이션** — 캐릭터 실루엣과 색이 겹치지 않게 보색/명도 대비를 지시(`character in warm tones on a plain cool mint field #CDE8DE`).
  - **머리카락·귀·삐죽한 실루엣**은 배경과 강한 명도차를 줘야 누끼 엣지가 산다 → `crisp rim of empty background fully separating every hair tip and ear from the field`.
  - 스타일: `flat friendly illustration, soft cel shading, glossy highlights` (C10 한국 웹툰 S07 톤 차용 가능).
- **주의:** 캐릭터가 소품을 **들고 있으면** 누끼 시 소품이 간헐 탈락(embedded-captions 실측). 소품은 별도 컷으로 뽑아 합성하거나 캐릭터에 확실히 붙여 그린다.

### 1-C. BI / 브랜드 — 미니멀 단색 · 제품
- **목표:** 제품/오브젝트를 흰 무대에 히어로로. 브랜드 팔레트 단색 배경, 미니멀.
- **룩 프리셋:** `L3 미니멀 프로덕트` (흰 무대 + 그림자 하나), BI 색면엔 `L4 스위스 타이포`·`L5 다크 테크`.
- **배경 문법:**
  - `product hero on a seamless white stage #FAFAFA, perfectly clean single-subject composition, soft top-light with one crisp contact shadow anchoring the object, true-to-material color`.
  - 커머스 실측 문법(fal 가이드): 감성어 대신 **표면·조명을 문자로 명시** — `Flat even lighting, no dramatic shadow, neutral beige backdrop, shallow depth of field`.
  - BI 색면형: 브랜드 2톤 색 블로킹(`bright field + deep tone base`) + 단일 액센트, 헤어라인 보더(그림자 대신).
  - **글자 없는 배경:** `the backdrop is a single uninterrupted brand color, all typography will be added later so the surface stays completely clear`.
- **컷아웃 대비:** 흰 무대 + `one crisp contact shadow`는 누끼에 좋음. 단, 그림자까지 살리려면 **컨택트 섀도는 CSS drop-shadow로 재생성**하고 생성물에선 그림자 없는 버전을 따로 뽑는 게 깔끔(cutout-pipeline.md §알파합성).

---

## 2. "글자 없는 배경" 보장 프롬프트 문법 (3레버)

1. **긍정형 재서술:** `no text` 금지 → `the surface stays completely clear, all lettering added later`.
2. **네거티브 스페이스 밴드 문법(C11 차용):** 비울 영역을 **역할로 지정** — `upper third reserved as an empty title band` / `left column left blank for copy`. 모델은 "비운다"보다 "무엇을 위해 비운다"에 강하게 반응.
3. **텍스트 렌더 가드(Tier-1, 렌더 카피가 있을 때만):** `All text appears once, perfectly legible — no duplicate text, no extra words, no invented glyphs, no watermark.` — 이건 카피를 **넣을 때** 유령글자 방지용. 배경을 완전히 비울 땐 카피 자체를 프롬프트에서 빼면 됨.

---

## 3. image-prompt 스킬 매핑 표 (확정)

| 카드뉴스 톤 | 배경/히어로 카테고리 | 룩 프리셋 | 사조(M) 옵션 | 컷 포맷 | 기본 AR | 컷아웃 여부 |
|---|---|---|---|---|---|---|
| **럭셔리** | C11 시네마틱 키아트 / C5 캠페인 | **L1** 럭셔리, L2 시네마틱 | M2 아르데코·M10 와비사비 | 포맷 A (6섹션) | 통짜 16:9 `1792x1024`, 카드 2:3 | 배경 통짜(누끼 선택) |
| **캐릭터** | C10 만화(S07 웹툰)/ C9 3D 아이콘 | **L7** 파스텔 | M3 멤피스·M6 미드센추리 | 포맷 A | 캐릭터 1:1 `1024x1024` | **필수 컷아웃** |
| **BI/브랜드** | C4 제품도감 / C8 목업 / C7 카드뉴스 | **L3** 미니멀, L4 스위스, L5 다크테크 | M1 바우하우스·M5 데스틸·M8 구성주의 | 포맷 A | 제품 1:1/3:4, 색면 카드 1:1 | 제품 컷아웃 권장 |

- **카드뉴스 커버 자체**(텍스트 얹힌 최종 SNS 컷)는 항상 **C7 카드뉴스** — `sns_cover` 기본, 상단 40% 초대형 헤드라인, 2톤 색 블로킹, 3D 히어로 오브젝트 1개 + 소품 3~5개. 밀도가 기본값(여백형은 요청 명시할 때만).
- **쇼츠 세로 프레임**(9:16 `1024x1792`)로 재구성할 땐 배경은 통짜로 뽑고, 컷아웃한 히어로/캐릭터를 세로 캔버스에 재배치 + CSS 텍스트.
- **덱/설명 슬라이드**가 필요하면 C12(16:9 고정 + 덱 DNA 블록 반복).

## 4. 파이프라인 권장 흐름 (톤 공통)

```
톤 결정 → [배경 레이어] C11/C7 배경 프롬프트(글자 없는 밴드 확보)
        → [히어로 레이어] 클린 단색 배경에 캐릭터/제품 생성
        → 누끼(cutout-pipeline.md, birefnet-general 권장) → 투명 PNG
        → 세로 캔버스에 배경+컷아웃 합성 (스케일/위치/부유)
        → CSS drop-shadow로 그림자·접지 연출
        → 텍스트는 HTML/CSS 레이어 (래스터 합성 금지, 철칙 #9)
```
