# 커스텀 톤티어 생성 런북

card-shorts 기본 3티어(`luxury`/`character`/`brand`) 외에, 사용자의 기업 BI 또는 인터뷰 답변으로부터
**커스텀 4번째 티어**(`references/tiers/custom-<name>.json`)를 만드는 절차. 에이전트가 이 문서를 그대로
따라 실행한다. 경로A(BI 인제스트)와 경로B(인터뷰) 둘 다 같은 "공통: 구성 규칙"으로 수렴한다.

트리거: SKILL.md의 "커스텀 티어" 섹션 참조.

---

## 경로 A — BI 자료 인제스트

### A1. 입력 수집
사용자에게(또는 제공된 파일에서) 아래를 모은다. 전부 필수는 아님 — 있는 만큼 활용.
- 브랜드 컬러 hex(있으면 최우선 — 팔레트 추출보다 신뢰도 높음)
- 로고 이미지 파일(PNG/JPG)
- 브랜드 가이드 문서 스크린샷(컬러 칩·타이포 명세 페이지 등)
- 제품/서비스 레퍼런스 이미지 3~5장

### A2. 팔레트 추출
```bash
python3 \
  scripts/tiers/palette_extract.py \
  <로고.png> <가이드스샷.png> <레퍼런스1.png> ...
```
출력 JSON:
- `dominant`: 전 이미지 평균 점유율 상위 8개 hex.
- `per_image.<path>.colors`: 이미지별 점유율순 색.
- `per_image.<path>.extremes`: `near_white`/`near_black`로 표기된 극단 무채색(순백/순흑 근방) —
  이 값들은 surface `bg`/`hairline` 후보로 그대로 쓰기보다, 아래 A3에서 브랜드 유채색 기반으로
  다시 만든 중성색으로 대체하는 것을 권장(로고 배경이 흰색이라고 티어 bg를 무조건 흰색으로 고정하지 말 것).
- 사용자가 hex를 직접 준 경우 `dominant`보다 그 hex를 우선(더 정확한 브랜드 신호).

`dominant`에서 채도(chroma)가 가장 뚜렷한 1~2개를 **accent 후보**로, 나머지 저채도/무채색을
**surface 후보**로 분류한다(판단 기준은 A3의 chroma 공식과 동일).

### A3. surface_set / accent_set 직교 구성 규칙
스키마는 `references/tiers/luxury.json`(§공통 필드 설명 참조) 구조를 그대로 따른다. **핵심 제약(G3 게이트가 강제)**:
1. **직교성**: `accent_set` 원소는 `ink`/`ink_body` 등 텍스트색을 정의하지 않는다(팝 컬러는 강조 전용).
   `surface_set` 원소의 `bg/ink/ink_body/ink_muted/ink_faint/hairline/tint`는 전부 **chroma ≤ 15%**
   (`chroma = (max(R,G,B) - min(R,G,B)) / 255`). 즉 surface는 무조건 저채도 중성색.
2. **surface 만드는 법(명도 조정 절차)**:
   - 브랜드 accent 후보 hex를 HSL로 변환, **Hue만 유지**하고 채도를 15% 이하로 낮춰 "브랜드 틴트가 살짝
     도는 중성색" 만든다(완전 무채색 회색보다 브랜드 정체성이 남음).
   - `bg`: 밝은 톤이면 L 92~97%(라이트 페이퍼), 어두운 톤이면 L 6~10%(다크 노이르)로 설정. 사용자가
     "라이트/다크" 중 택했다면 그대로 따름.
   - `ink`: `bg`와 반대 극단의 명도(밝은 bg면 L 8~15%, 어두운 bg면 L 92~97%), 같은 Hue 유지.
   - `ink_body`: `ink`에서 `bg` 방향으로 L을 25~30%p 이동.
   - `ink_muted`: `bg`에서 L을 45~55%p 이동(= ink_body보다 bg에 더 가까움). **중요**: L4/L5 타이포(28~36px,
     48px 미만)는 `ink_muted`류 색을 쓰는 경우가 많고 G6(렌더 PNG 픽셀 실측)가 48px 미만 텍스트에
     **4.5:1**을 하드 요구하므로, G3 스키마 기준(3.0)만 통과시키지 말고 **처음부터 4.5:1을 목표로** 잡는다.
   - `ink_faint`: `bg`에서 L을 60~70%p 이동. 이 색은 **텍스트에 쓰지 않음**(장식선/캡션 배경 등 비텍스트
     전용)이므로 목표는 3.0:1(G3 기준)이면 충분.
   - `hairline`/`tint`: `bg`에서 L을 3~6%p만 이동한 극근접 중성색(구분선/카드 배경용, 대비 요건 없음).
3. **검증 명령으로 실측하고, 미달 시 명도 보정**: 계산이 아니라 아래 A5 루프의 `contrastRatio` 실측
   결과로 판단한다. 미달이면 해당 색의 L을 `bg`에서 더 멀어지는 방향으로 ±4%p씩 조정 후 재검증
   (최대 3회, A5 참조).
4. **accent 만드는 법**: `acc`는 브랜드 accent 후보 hex를 거의 그대로 사용(채도 제한 없음 — accent는
   포인트컬러이므로 강렬해도 됨). `on_acc`(=pill/배지 위에 얹는 텍스트색, 보통 흑 또는 백 중 대비 높은
   쪽)와 `acc` 사이 대비 ≥ 4.5:1 필수(G3 하드). `hl`은 보통 `acc`와 동일 또는 더 옅은 톤, `hl_alpha`는
   0.4(브랜드/미니멀)~0.7(파스텔/캐주얼) 사이에서 무드에 맞게.

### A4. 폰트 매핑 — 브랜드 무드 → 보유 폰트 9종
보유 woff2(`assets/fonts/`): `BlackHanSans` · `DoHyeon` · `Gaegu-Bold` · `GowunDodum` · `Jua` ·
`NotoSerifKR-Black` · `Pretendard-Regular` · `Pretendard-Bold` · `Pretendard-Black`.

| 브랜드 무드 | title | body | accent |
|---|---|---|---|
| 고급/신뢰(세리프, luxury류) | NotoSerifKR-Black | Pretendard-Regular | Pretendard-Bold |
| 임팩트/강렬(쇼츠 훅 톤) | BlackHanSans | Pretendard-Regular | Pretendard-Black |
| 심플/미니멀 BI(스위스·바우하우스) | DoHyeon (또는 Gmarket Sans 확보 시 그쪽 우선) | Pretendard-Regular | Pretendard-Black |
| 둥근/친근/캐주얼 | Jua | GowunDodum | Gaegu-Bold |
| 감성/손글씨/다정 | Gaegu-Bold | GowunDodum | Pretendard-Bold |

**hangul_glyphs 주의**: `character.json` 기준 Jua=2515음절, Gaegu-Bold=2499음절, GowunDodum=11552음절(완전),
NotoSerifKR-Black=11541음절(거의 완전) — 이 스킬 내에 실측 기록이 있다. **BlackHanSans/DoHyeon은 이
스킬 내 실측 기록이 없음** — `hangul_glyphs` 필드를 넣을 거면 직접 실측 후 넣고, 실측 못 했으면
필드를 아예 생략하지 말고 **안전측으로 `fallback_family: "Pretendard"` + 해당 weight의
`fallback_woff2`를 항상 지정**한다(2515/2499처럼 11172 미만일 가능성을 배제할 수 없으므로). 완전 커버가
실측 확인된 폰트(GowunDodum, NotoSerifKR-Black, Pretendard 전 weight)만 fallback 생략 가능.

### A5. tiers/custom-\<name>.json 작성 + 검증 루프
1. `references/tiers/luxury.json` 또는 `brand.json`을 템플릿으로 복사, `tier`/`label`을 커스텀명으로 변경,
   surface_set(2~3개)·accent_set(2~3개)·fonts·grid·typography·d3·compose_mode·image·motion을 A3/A4 규칙대로 채워
   `references/tiers/custom-<name>.json`으로 저장.
2. 검증 루프(최대 3회 재시도):
   ```bash
   mkdir -p /tmp/tier-verify-<name>
   node scripts/render/compile_tokens.mjs \
     /tmp/tier-verify-<name> custom-<name> <surfaceId> <accentId>
   node scripts/gates/g03_tokens_schema.mjs \
     /tmp/tier-verify-<name>/tokens.json /tmp/tier-verify-<name>
   ```
   - `compile_tokens.mjs <projectDir> [tier] [surfaceId] [accentId]` — tier 인자로 `custom-<name>`을 주면
     `references/tiers/custom-<name>.json`을 읽어 `<projectDir>/tokens.json`을 만든다.
   - `g03_tokens_schema.mjs <tokens.json> <baseDir>` — schema_version 2.0이면 직교 위반·WCAG·D3예산·
     폰트 하드캡·클래스 충돌·글리프 폴백까지 7항 전부 체크.
   - **WCAG 전조합 커버**: surface_set × accent_set 각 조합을 전부 한 번씩 `surfaceId`/`accentId`로
     지정해 위 두 명령을 반복 실행한다(하나의 조합만 통과하고 넘어가지 않는다).
   - 실패 시: 에러 메시지의 대비 미달 색(`surface ink_muted/bg 대비 X < 4.5` 등)을 A3-2 절차대로
     L을 ±4%p 조정 → 재실행. 3회 재시도해도 미달이면 해당 surface를 무채색 쪽(chroma 낮춤)으로
     더 이동시키거나, 그 surface를 티어에서 제외하고 통과한 조합만 남긴다.
3. 전 조합 통과 후 A5-2 임시 검증 디렉토리(`/tmp/tier-verify-<name>`)는 삭제해도 무방(진짜 프로젝트는
   S3 단계에서 다시 `compile_tokens.mjs <실제 projectDir> custom-<name>`으로 생성됨).

---

## 경로 B — 인터뷰

BI 자료가 없을 때, 사용자에게 아래 5개 질문으로 짧게 인터뷰한다. 한 번에 다 물어도 되고, 답이
모호하면 예시를 들어 재확인.

1. **무드**: 고급 / 친근 / 신뢰 / 힙 / 감성 — 이 중 어디에 가장 가깝나요? (복수 선택 가능, 우선순위 표시)
2. **배경 밝기**: 라이트(밝은 배경) / 다크(어두운 배경) 중 어느 쪽이 브랜드에 맞나요?
3. **포인트 색**: hex 코드가 있으면 그대로, 없으면 "네이비", "민트", "버건디" 같은 말로 설명해주세요.
4. **폰트 느낌**: 임팩트(굵고 강함) / 둥근(부드러움) / 세리프(전통·고급) / 중립(정갈한 산스) 중 선택.
5. **레퍼런스 계정**: 참고하고 싶은 인스타/브랜드 계정이 있으면 알려주세요(있으면 그 계정 게시물
   스크린샷을 받아 경로A의 A2(팔레트 추출)를 보조로 함께 돌린다 — 인터뷰와 BI 인제스트는 배타적이지
   않고 섞어 쓸 수 있다).

답변 → 구성 규칙 매핑:
- Q1(무드) → A4 폰트 매핑 표의 행 선택 + d3.emphasis_budget/pace 톤(고급=절제, 힙/친근=풍부) 결정.
- Q2(배경 밝기) → A3-2의 `bg` L값(라이트 92~97% vs 다크 6~10%) 결정.
- Q3(포인트 색) → hex면 그대로 accent 후보, 색이름이면 대표 hex로 변환(예: "네이비"→`#1B2A4A` 계열)
  후 A3-4 accent 구성 규칙 적용.
- Q4(폰트 느낌) → A4 표에서 무드와 별개로 폰트 자체를 직접 선택(무드 매핑보다 사용자 명시가 우선).
- Q5(레퍼런스) → 있으면 A2 팔레트 추출을 보조 신호로 병행, dominant 색과 Q3 답변이 크게 다르면
  사용자에게 확인.

이후 절차는 경로A의 A3(surface/accent 구성)~A5(작성+검증 루프)와 동일하게 수렴한다.

---

## 공통 — 티어 JSON 스키마 필드 설명 (`references/tiers/luxury.json` 구조 기준)

| 필드 | 설명 |
|---|---|
| `tier` | 파일명과 동일한 식별자(예: `custom-acme`) |
| `schema_version` | `"2.0"` 고정 — g03의 7항 확장 검사를 받으려면 필수 |
| `label` | 사람이 읽는 티어 설명 |
| `design_skill_ref` | 참고한 디자인 스킬(design-apple/design-vercel 등, 선택) |
| `surface_set[]` | `id/bg/ink/ink_body/ink_muted/ink_faint/hairline/tint` — 배경·텍스트 계층. 저채도 강제 |
| `accent_set[]` | `id/acc/on_acc/hl/hl_alpha/pill_bg/pill_ink` — 포인트색. ink류 필드 정의 금지 |
| `default_surface`/`default_accent` | surface_set/accent_set 중 기본 id |
| `fonts.{title,body,accent}` | `family/weight/woff2/license`(+ 부분커버 시 `hangul_glyphs`,`fallback_family`,`fallback_woff2`) |
| `grid` | `margin_px/cols/whitespace_ratio/safe_card_y` |
| `radius_px` | 카드/버튼 라운드(0=각짐, 999=완전 pill) |
| `typography` | `title_px/body_px/l0~l5_px/line_height_*/letter_spacing_*` — 밴드는 `[min,max]` |
| `d3` | 강조 장치 예산(`emphasis_budget≤2`,`tier_max_layers≤5`), 룰선 두께, pill/kicker 스펙 |
| `compose_mode` | 이미지 합성 방식(통짜 배경 / 누끼+배경 / 그리드+누끼 등) |
| `image` | `playbook/look/sajo/bg_prompt_hint`(+`cutout_prompt_hint`) — image-prompt 스킬 연동 힌트 |
| `motion` | `character/entrance/emphasis/transition/pace` — 쇼츠 모션 톤 |

### 검증 명령어 (재확인용)
```bash
node scripts/render/compile_tokens.mjs <projectDir> [tier] [surfaceId] [accentId]
node scripts/gates/g03_tokens_schema.mjs <tokens.json> [baseDir]
# 전체 게이트 자가검증
bash scripts/gates/test/run_tests.sh
```

### WCAG 함정 체크리스트
- `ink_muted`는 스키마 기준(G3, `≥3.0`)만 보고 넘어가지 말 것 — 실제 렌더에서 L4/L5(48px 미만)에
  쓰이면 G6 픽셀 실측이 **4.5:1**을 요구한다. 처음부터 4.5:1을 목표로 만든다.
- `ink_faint`는 **비텍스트 전용**(장식선·캡션 뒷배경 등)이라는 전제 하에 3.0:1이면 충분 — 실수로
  본문/캡션 텍스트에 `ink_faint`를 쓰면 안 됨.
- `accent_set`에 `ink`/`ink_body` 필드를 넣으면 즉시 직교 위반(G3 ①)으로 fail.
- `surface_set`의 아무 색이든 chroma > 15%면 fail(G3 ①) — "브랜드 컬러라서 살짝 채도를 남기고 싶다"는
  유혹이 있어도 surface는 무조건 저채도, 채도는 accent에서만.
- 폰트 패밀리 총 3종 초과 금지(G3 ⑤), woff2 경로는 실재 파일이어야 함(존재 확인은 g03이 자동 수행).
