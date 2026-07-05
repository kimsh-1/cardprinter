# G17 — 레퍼런스 판정 루브릭 (판정 에이전트 프로토콜, §7.7)

L1 결정론 게이트(G13~G16) 통과분만 진입. 판정 에이전트(격리 서브에이전트)가 이 문서대로 5축 0~4 정수 채점 후 `judge-report.json`을 산출한다. **채점만 정성이고 진행·판정식은 결정론.**

## 절차
1. `brief.json`의 `genre`·`tier` 로드. genre 미지정이면 **abort**(블로커 리포트).
2. `references/ref-anchors.json`에서 genre의 anchor sets 선택. tier가 `tier_hint`와 어긋나면 가장 가까운 세트를 유지하되 톤 차이를 채점 근거에 명시.
3. 앵커 이미지: `/mnt/d/2026-07-CARDNEWS/00_research/deep-design/D5_real-accounts/refs/` 아래 `{set}_N.jpg`. 세트당 2~3장을 실제로 읽어 기준선으로 삼는다.
4. 결과물 `out/card-*.png` 전장 로드.
5. 각 축 0~4 정수 + 1문장 근거(카드번호 + 대비한 ref 파일명 인용 필수).

## 5축 루브릭 (0=반려 파일럿 · 2=보통 · 4=레퍼런스 수준)
| 축 | 0 | 2 | 4 |
|---|---|---|---|
| **A1 image** | 전카드 CSS 색면 | 절반만, 통짜 스크림 없음 | A~G 리듬 혼합, 컷아웃 그림자·스크림 정확 |
| **A2 typo** | 표지 84~116px, 위계 평평 | 표지 크나 본문도 커 위계 약함 | 표지 160+, 본문 하한 준수, 위계비 뚜렷 |
| **A3 hierarchy** | 전카드 1~2층 | 3층 있으나 강조 산발 | 역할별 차등, 강조 1~2, 출처 무강조 |
| **A4 diversity** | 한 아키타입 반복 | 2~3종, 밀도웨이브 없음 | 아키타입 4+, 스파이크↔밸리, 색·폰트 고정 |
| **A5 signature** | 서명·정지력 없음 | 로고만, 훅 약함 | 브랜드밴드/마스코트/author bar + 저장각 |

## 판정식 (결정론)
```
PASS ⟺ min(A1..A5) ≥ 3 AND sum ≥ 17/20
WARN ⟺ min ≥ 2 AND sum ≥ 14 → A/B 두 안 렌더 후 사용자 선택
FAIL ⟺ any ≤ 1 OR sum < 14 → 최저축 역매핑 재큐:
  A1↓→§4 이미지 재생성 · A2↓→§3 타이포토큰 · A3↓→§3/§5 조판 · A4↓→§2 아키타입 재배분 · A5↓→§5 조판에 브랜드밴드/author-bar/로고 추가
```

## 출력 스키마 (`judge-report.json`, 프로젝트 루트에 기록)
```json
{ "tier": "...", "genre": "...", "anchor_sets": ["..."],
  "scores": { "image": 0, "typo": 0, "hierarchy": 0, "diversity": 0, "signature": 0 },
  "sum": 0, "verdict": "PASS|WARN|FAIL",
  "evidence": { "image": "card-N ... — {ref파일} 대비 ...", "typo": "...", "hierarchy": "...", "diversity": "...", "signature": "..." },
  "reroute": "verdict≠PASS일 때 최저축 → 단계 지시" }
```

주의: 내용(사실·수치) 판정 금지 — 시각 품질만. 점수 인플레 금지: 앵커와 나란히 놓고 정말 그 수준인지로 판정.
