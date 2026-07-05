# card-shorts factory 작업 지시서 — S1(brief)+S2(copy) 단독 작성

당신은 지금 사람 개입 없이(무인 배치) 카드뉴스 1건의 **brief.json + copy.json**만 작성합니다.
주제: **{{TOPIC}}**
티어: **{{TIER}}**

## 필수 사전 확인 (쓰기 전에 반드시 Read로 먼저 열어볼 것)
1. 완성 실물 예시(계약 파일의 정답지) — 필드 구조·문체·fact_refs 사용법을 그대로 따르세요:
   - `examples/sample/brief.json`
   - `examples/sample/copy.json`
2. 카피 공식 라이브러리: `references/copy-formulas.md`
3. 게이트 수치 SSOT(글자수·카드수·타입·아키타입 — 아래 요약은 참고용이며 이 파일이 최종 근거):
   `scripts/gates/gate-config.json`
4. archetype ↔ image_pattern 라우팅표(직접 수정 금지, 참고만): `references/routing.json`
5. **바이럴 캐러셀 템플릿(시퀀스 프리셋)**: `references/carousel-templates.json`
   — 주제에 맞는 템플릿 1개를 `auto_pick.rules`로 고르고, 그 `sequence[]`를 카드 스캐폴드로 삼으세요.
   `cross_cutting_boosters`(트리플 훅·저장 트리거 슬롯·엔드 CTA·해시태그 최소)는 전 템플릿 공통 필수입니다.

## 산출물 — 현재 작업 디렉토리에 상대경로로 직접 저장
- `./brief.json`
- `./copy.json`
다른 파일은 만들지 말고, 셸 명령도 실행하지 마세요. 두 파일을 쓰고 나면 즉시 종료하세요.

## brief.json 요구사항
- 필드: `topic`, `genre`, `tier`(="{{TIER}}" 그대로), `card_count`(4~20, 권장 6~12), `selection_rationale`, `facts`, `image_subject`
- `facts`: 배열. 각 항목 `{id, claim, number, source}`.
  **당신은 웹 접근이 불가능할 수 있습니다. 확실히 아는 사실·통계만 쓰고, 수치가 불확실하면 그 수치 자체를 쓰지 마세요.**
  추측·날조 절대 금지 — copy.json에 등장하는 모든 숫자는 반드시 이 facts 중 하나에 그대로 존재해야
  통과하는 하드게이트(G10 fact-fidelity)가 있습니다. 출처가 불명확하면 `source`에 "일반 상식/통념" 등으로 정직하게 표기하고,
  아예 불확실한 통계 카드 자체를 넣지 않는 편이 안전합니다.
- `image_subject.bg`: 영어로 된 사진 배경 소재 한 문장(사람 얼굴 클로즈업 금지, 텍스트 없음, no people in focus 권장).

## copy.json 요구사항
- `cards` 배열 — `brief.json.card_count`와 개수가 정확히 일치해야 함(G1).
- `cards[0].type` = `"cover"`, `cards[last].type` = `"cta"` (고정슬롯, G1 하드 FAIL).
- 각 카드에 `index`, `type`(cover/hook/body/stat/quote/comparison/timeline/cta/toc/image 중), `archetype`(A1~A14 — routing.json 참고),
  그리고 `headline`/`body`/`blocks` 중 최소 하나.
- `fact_refs`: 그 카드 텍스트가 참조하는 `brief.facts[].id` 배열. **카드 텍스트(headline/body/blocks/chart 라벨)에 등장하는 모든 숫자는
  fact_refs로 연결된 fact의 claim 또는 number 안에 그대로(콤마 제거 기준) 존재해야 합니다.** 아니면 G10 FAIL.
- 글자수 한도(gate-config.json이 최종 근거, 요약):
  - 표지 headline ≤24자(줄당 ≤18자) · subhead ≤34자 · CTA headline ≤14자
  - 본문/블록 문단(body_max) ≤90자 · bullets 항목 ≤48자(2~5개) · callout ≤70자(label ≤10자)
- archetype 시퀀스 다양성(G16): 동일 archetype 4연속 금지, 카드 수 대비 서로 다른 archetype을 충분히 섞을 것.
- 통계 카드(`type:"stat"`)를 넣을 경우 `viz_kind`를 `"number"`(dispnum) 또는 `"chart"`로 명시.
  - **빅넘버(viz_kind:"number")는 `dispnum:{value,unit}`로 큰 수치를 넣고, `headline`(또는 `kicker`)은 그 위 라벨로 쓰세요.**
    예: `{"type":"stat","viz_kind":"number","dispnum":{"value":"400","unit":"mg"},"headline":"건강한 성인 하루 기준"}`.
    빅넘버로 실제 렌더되는 값은 `dispnum.value`이며 **3자 이내를 강력 권장**합니다(4자+는 폰트가 축소돼 임팩트·채움이 약해짐).
    **긴 raw 숫자는 한국형 compact 단위로 축약하세요**: "57000"→`{"value":"5.7","unit":"만 명"}`, "1000억"→`{"value":"1000","unit":"억"}`는 4자라 비권장 → 가능하면 "1조"·"5.7만"처럼 3자 이내로. 4~5자리 비교는 dispnum 대신 **차트**로.
    긴 서술을 headline에 넣고 빅넘버를 비워두면 라벨이 480px로 렌더돼 넘칩니다 — 반드시 dispnum에 숫자를, headline에 라벨을.
  - 차트(viz_kind:"chart")는 `chart:{kind:"bar", items:[{label, display}]}` (2~5개). display는 독자가 보는 문자열("48%","7시간 41분","97.1GW").
    - **차트는 같은 단위의 크기 비교용입니다.** 모든 items의 display 단위를 통일하세요("48%" vs "62%" ○ / "-8분" vs "+4.6%p" ✗ — 단위 혼합·증감 델타는 막대 비교가 무의미).
    - 증감/변화(±) 하나만 강조하려면 차트 대신 빅넘버(dispnum) 카드를 쓰세요. 막대는 0에서 뻗는 절대 크기 비교입니다.

## 이전 게이트 실패 로그 (있으면 그 실패 사유를 전부 해소하도록 재작성)
{{FEEDBACK_BLOCK}}

위 로그가 있다면 부분 수정이 아니라 **brief.json/copy.json 전체를 다시 써서 덮어쓰기**로 저장하세요.

## 완료 조건
`./brief.json`, `./copy.json` 두 파일을 저장하면 그걸로 끝입니다. 추가 설명·커밋·다른 명령 불필요.
