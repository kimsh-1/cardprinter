<div align="center">

<!-- HERO: R5 갤러리 확정 후 docs/hero.png로 교체 -->
<img src="docs/hero.png" width="720" alt="CardPrinter"/>

# CardPrinter 🖨️

**주제 한 줄이면 인스타 카드뉴스 캐러셀과 9:16 릴스 영상이 한 번에 — 전자동, 품질 게이트 통과, 디자인 감각 불필요.**

[English](README.md) | **한국어**

[![Stars](https://img.shields.io/github/stars/kimsh-1/cardprinter?style=flat)](https://github.com/kimsh-1/cardprinter/stargazers)
[![License](https://img.shields.io/github/license/kimsh-1/cardprinter?style=flat)](LICENSE)
[![Release](https://img.shields.io/github/v/release/kimsh-1/cardprinter?style=flat)](https://github.com/kimsh-1/cardprinter/releases)
[![Discord](https://img.shields.io/discord/0000000000?style=flat&label=discord)](#)

*Canva 대량생성·Predis.ai·Ocoya의 오픈소스 대안 — 단, 결과물을 감이 아니라 물리적 품질 게이트로 검증한다.*

</div>

---

## 데모

### 캐러셀 (4:5)

| ![](docs/demo-cover.png) | ![](docs/demo-stat.png) | ![](docs/demo-list.png) |
|---|---|---|
| 사진 기사 (`newsprint`) | 번호 롤업 (`newsprint`) | 사진 피처 (`newsprint`) |

*위 히어로: `newsprint` 표지 시스템 — 좋아요 30만급 인스타 캐러셀을 모델로.*

### 릴스 (9:16)

https://github.com/kimsh-1/cardprinter/raw/main/docs/demo-reel.mp4

> 릴스는 캐러셀과 같은 카피 계약에서 파생되므로 두 포맷의 내용이 어긋나지 않는다.
> (위 영상은 실제 파이프라인 산출물이며, GitHub이 `docs/demo-reel.mp4`를 인라인 렌더한다.)

---

## ✨ 기능

- **🗞️ 한 줄 입력** — 주제(또는 뉴스 기사)를 주면 카피 작성·카드 배치·양 포맷 렌더까지 자동.
- **🎨 톤 티어** — `luxury` · `character` · `brand` · `news` · `editorial` · `data`, 그리고 기업 BI 자료나 5문항 인터뷰로 만드는 커스텀 티어.
- **📐 바이럴 시퀀스 템플릿** — 체크리스트 · 리스티클 · 데이터인포 · 포토스토리 · 스토리텔링 · 비교, 각각 조회·저장 실증 기반 슬라이드 흐름(트리플 훅·중반 저장 트리거·엔드 CTA).
- **🛡️ 물리적 품질 게이트** — 대비(WCAG 픽셀 실측)·오버플로(bbox ⊂ 세이프존)·사실충실도(수치 날조 0)·타이포 하한·레이아웃 다양성. 전부 exit-code 하드 게이트이며 권고가 아니다.
- **📊 정직한 차트** — echarts SSR 가로 바 차트, 0기준 축. 독자가 보는 display 문자열이 진실 원천이라 수치 과장이 불가능.
- **🎬 카드뉴스 → 릴스** — 완성된 카드를 1080×1920 타임라인으로 합성 — 줌·진동 없이 아래에서 부드럽게 상승 등장(목차·리스트 항목은 하나씩 순차 노출), 무음 키네틱 자막, 카드별 체류시간은 읽기 속도에서 산출.
- **🏭 양산** — 헤드리스 `codex` 팩토리 러너가 여러 주제를 병렬 생성, 자가치유 루프(실패한 게이트를 되먹여 재생성)로 수렴.

---

## Canva / Predis.ai 대신 이걸 쓰는 이유

| | CardPrinter | SaaS 대량생성 |
|---|---|---|
| 가격 | 무료·오픈소스 | 월 구독 |
| 워터마크 | 없음 | 무료 티어에 있음 |
| 셀프호스팅 | 가능 | 불가 |
| 품질 강제 | 물리적 exit-code 게이트 | 없음(사람 눈) |
| 한 계약에서 릴스+캐러셀 | 가능 | 별도 도구 |
| 수치 날조 방지 | 하드 게이트 | 없음 |

---

## 🚀 빠른 시작

```bash
# 주제 하나 → 캐러셀 + 릴스, 전 게이트 통과
bash scripts/pipeline.sh ./my-project draft
```

`my-project/`에는 `brief.json` + `copy.json` + `tokens.json`이 필요하다(카피 단계가 자동 생성하게 할 수도 있음). [작동 원리](#-작동-원리) 참고.

---

## 🧠 작동 원리

```
주제 ─▶ brief ─▶ copy ─▶ tokens ─▶ [게이트] ─▶ 이미지 ─▶ 카드 HTML ─▶ PNG ─▶ [게이트] ─▶ 릴스 MP4 ─▶ [게이트]
                   │        │                                                       │
               사실 검증   WCAG 안전                                          카드에서 파생
```

각 `[게이트]` 단계는 exit-code 검문소다. 빨간 게이트에서는 아무것도 다음으로 넘어가지 않는다 — 팩토리 러너는 초록이 될 때까지 재생성하거나 정직하게 포기한다(깨진 카드를 '완료'로 내보내지 않는다).

---

## 🏭 양산 (codex 팩토리)

주제 목록을 게이트 통과 카드뉴스 배치로 — 사람 개입 0:

```bash
TOPICS=topics.jsonl OUTROOT=~/out PARALLEL=3 bash scripts/factory/run_factory.sh
```

```jsonl
{"id":"coffee-01","topic":"하루 커피 몇 잔이 적당할까","tier":"brand"}
{"id":"sleep-02","topic":"한국인 수면 실태 — 숫자로 보는 잠","tier":"data"}
```

각 주제는 `codex`로 카피를 쓰고, 전체 렌더+게이트 파이프라인을 돌리며 **자가치유**한다 — 실패한 게이트를
`codex`에 되먹여 재생성(최대 3회). 모든 게이트를 통과한 주제만 `PASS` 마커를 받는다. **전체 가이드 → [docs/FACTORY.md](docs/FACTORY.md).**

---

## 📥 설치

### 요구사항
- Node.js 20+
- Python 3.11+ venv (픽셀 게이트 + `rembg` 누끼용)
- `chrome-headless-shell` (번들 렌더 경로)

### 수동 설치
```bash
git clone https://github.com/kimsh-1/cardprinter
cd cardprinter
# 폰트·venv·chrome 라이브러리 — docs/INSTALL.md 참고
```

---

## 📤 산출물

| 파일 | 규격 |
|---|---|
| `out/card-NN.png` | 1080×1350 (4:5), 슬라이드당 1장 |
| `out/short.mp4` | 1080×1920, 30fps, H.264/AAC, 약 30~60초 |
| `carousel/card-NN.html` | 원본 카드(릴스 씬 소스이기도 함) |

---

## 🗺️ 로드맵

- [x] 톤 티어 6종 + 커스텀 티어 인제스트
- [x] 바이럴 시퀀스 템플릿 6종
- [x] 물리적 게이트 스위트 + 자가치유 팩토리
- [ ] 신문/브러시/책페이지 시각 템플릿
- [ ] 손글씨 템플릿
- [ ] TTS 내레이션(선택, 크레덴셜 필요)

---

## 🤝 기여

PR 환영. 모든 렌더 변경은 `node scripts/gates/run_gates.mjs all <project>`를 통과해야 하며, 새 실패 유형을 만들면 게이트를 함께 추가해야 한다.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=kimsh-1/cardprinter&type=Date)](https://star-history.com/#kimsh-1/cardprinter&Date)

## 📝 라이선스

코드: MIT. 번들 폰트는 각자의 OFL/Apache 라이선스를 따른다 — [docs/FONT-LICENSES.md](docs/FONT-LICENSES.md) 참고.
