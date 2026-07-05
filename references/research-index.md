# _INDEX.md — Phase 1 리서치 종합 (스킬이 바로 읽는 프리셋)

> 7축(R1~R7) + 2차조사 종합. 카드뉴스→쇼츠 스킬(`card-shorts`)이 참조하는 **확정 프리셋 단일 진입점**.
> 기계가 읽을 값은 각 축 JSON에, 서술형은 findings.md에. 이 파일은 그 둘을 잇는 인덱스 + 핵심 상수 요약.
> confidence: high(표준앵커/다중수렴) · med(소스편차 최악값) · poc(실주행 확정 대기)

---

## 0. 확정 상수 요약 (criteria.md [TBD] 채움값)

| 키 | 값 | 출처 | conf |
|---|---|---|---|
| 쇼츠 캔버스 | 1080×1920, fps30, H.264/AAC | R2 | high |
| 캐러셀 PNG 규격 | **4:5 = 1080×1350** (1:1 대안) | R1 | high(사용자확인) |
| 기본 슬라이드 수 | **8장** (속보4~6·뉴스6~8·체크7~10·심층10~12) | R1 | high |
| 표지 헤드라인 | **≤24자** (권장12~22), 서브헤드≤34, CTA메인≤14 | R1 | high |
| 본문 카드 | **≤90자/카드** (권장35~65, 한줄12~18자) | R1 | high |
| 세이프존(criteria D) | 핵심 콘텐츠 **x[90,950] y[220,1520]** (top220/bot400/left90/right130 최악값) | R2 | med |
| 훅 | 첫 **3초**(1초내 가치전달), 이탈 50~60% 첫3초 | R2 | high |
| 쇼츠 길이 | min15/**권장30**/max60초 | R2 | high |
| 카드 dwell(영상) | 2~4초(권장3)+연속모션(Ken Burns 3~8%) | R2 | high |
| 카드 dwell(자막 CPS 환산) | **자수÷8~9 +1초, floor≥1초** (한국어 자막 Netflix 12CPS 안전계수). 40자→3~5s | 2차(Netflix 표준) | high |
| 자막 | 세로 55~78%(y>1500 금지), min48px/권장64~90px, 줄당2~4단어, 볼드헤비산스+외곽선 | R2·R3 | high |
| 본문 최소 폰트(카드) | 42px+(권장48~56), 타이틀84~140 | R3 | high |
| 조판 | 자간 헤드라인-0.02~-0.03em/본문-0.01~0, 행간 타이틀1.15~1.25/본문1.6, word-break:keep-all | R3·R6 | high |
| 텍스트 대비 | WCAG AA 4.5:1(대형3:1) | WCAG2.2 | high |
| 내레이션 기본 | **무음 + 키네틱 자막**(Kokoro 한국어 미지원). TTS는 HeyGen/ElevenLabs 크레덴셜 시 옵션 | R6 | high |
| 저장률 벤치(참고, 게이트 아님) | 도달대비 **2~4% 양호·>4% 바이럴**, 완주율 최종 40~50%(한국 실측%는 미확보) | 2차(SocialInsider 등) | med |
| 캐러셀 최대장수 | **20장**(2024 H2 10→20, 2026 유지) — 실무 권장 5~10 | 2차(4소스) | high |

---

## 1. 카피 (R1) → S2 · 게이트 G1/G2
- **파일**: `R1_content-copy/templates/copy-formulas.md` (훅H1~H10 + 본문 + CTA + 뉴스변환6룰), `findings.md`, `refs/reference-accounts.md`.
- **훅 10종**: H1숫자·H2손실회피·H3질문·H4방법·H5반전·H6금지·H7징후·H8전후·H9타겟·H10호기심갭 + 금지훅(F) 목록.
- **뉴스→카드 규칙**: 독자질문 7순서 재구성 · 사실/해석/전망/미확인 라벨분리 · 숫자엔 단위·기준일 · 1슬라이드=1메시지(하드).
- **CTA**: 끝장 1장 필수(한국형 "요약+저장유도" 최적), 게시물당 메인CTA 1개.
- **슬롯 매핑(R7 카탈로그와 1:1)**: cover / hook / body / stat / quote / comparison / timeline / cta / source.

## 2. 모션·세이프존 (R2) → S7 · criteria D · 게이트 G8
- **파일**: `R2_shorts-motion/specs.json` (기계계약), `findings.md`.
- **전환**: hard-cut-on-beat(기본)/push/zoom-through/whip-pan/wipe/cut-out-pop. **강조**: Ken Burns 줌+팬(모든 정지카드 필수 서브모션 — 프리즈프레임 금지).
- **등장**: fade-in/slide-in/scale-pop/typewriter/blur-to-focus.

## 3. 폰트·타이포 (R3) → S3 tokens · assets/fonts · 게이트 G6
- **파일**: `R3_fonts-typo/fonts.json` (14폰트·4페어링·타이포), `findings.md`.
- **본문 공용**: Pretendard(로컬 OFL, `~/.fonts/pretendard-pkg/web/static/woff2/`).
- **톤별**: 럭셔리 title=Noto Serif KR · 캐릭터 title=Jua/body=Gowun Dodum/accent=Gaegu · BI title=Gmarket Sans · 쇼츠훅=Black Han Sans.
- **번들 규칙**: OFL만 woff2 동봉. 잘난체=재배포금지→CDN @import만. Gmarket/Cafe24/에스코어드림=fonttools woff2 변환(빌드 단계).

## 4. 3티어 디자인 (R4) → S3/S5 · tiers/*.json · criteria C/E
- **파일**: `R4_design-tiers/tiers.json` (팔레트HEX·그리드·radius·shadow·mood·design_skill_ref), `findings.md`, `refs/refs.md`(20 URL).
- **럭셔리**: Noir Editorial bg#0E0F12/fg#F6F1E8/accent#C8B08A · 여백45~55% · radius0~8 · → design-apple.
- **캐릭터**: Peach Mint bg#FFF5EC/fg#4A3B32/accent#7FD6B0 · radius24~32 클레이 · → design-notion. (fg 다크브라운 강제 = WCAG 통과)
- **BI**: Swiss Mono bg#FFF/fg#111/accent#E5482F · radius0 헤어라인 · → design-vercel(라이트)/design-linear(다크).

## 5. 이미지+누끼 (R5) → S4 · 게이트 G5(OCR clean)
- **파일**: `R5_image-pipeline/image-strategy.md`, `cutout-pipeline.md`.
- **누끼**: `pip install "rembg[cpu,cli]"` → `rembg i -m birefnet-general -a in.png out.png`. 캐릭터소품=birefnet-portrait, 대량=isnet-general-use, 영상=hyperframes remove-background.
- **생성**: gpt-image-2 투명 미지원 → 불투명 클린배경 생성 → 외부 누끼. "글자없는 배경"=긍정형 밴드문법(`empty title band`). 그림자=CSS drop-shadow. 텍스트=HTML레이어(래스터 합성 금지).
- **톤 매핑**: 럭셔리=C11/L1 통짜 · 캐릭터=C10/L7 클린 마스코트(필수 컷아웃) · BI=C4/L3 미니멀 제품 · 커버=C7 sns_cover.

## 6. 렌더 (R6) → S7 · 게이트 G8/G9
- **파일**: `R6_hyperframes-spec/render-recipe.md` (템플릿+스니펫+커맨드), `findings.md`.
- **필수 선행**: `export LD_LIBRARY_PATH=$CARDSHORTS_CHROME_LIBS:$LD_LIBRARY_PATH`.
- **시퀀스**: init(portrait)→lint→validate→inspect→snapshot→preview(승인)→render draft→**render --quality high --fps 30 --output**→ffprobe→feedback. 렌더=유저게이트(자동렌더 금지).
- **카드 3층**: full-bleed .bg img(track0/z0) + 투명PNG 컷아웃(track2/z20) + 텍스트 DOM(z10~30). root 1080×1920, data-duration 컴파일락, 단일 gsap.timeline paused→__timelines[id].
- **모션 6패턴**: fade-up·crossfade·push/slide·mask-wipe·counter·finite-pulse. allowlist 속성만, repeat:-1/display/layout tween 금지.
- **함정**: root background금지(검정), 렌더타임 네트워크금지(에셋 pre-bundle), CJK번들=일본어뿐→한국어 woff2 필수, `<br>` 금지 word-break:keep-all.

## 7. OSS·아키텍처 (R7) → Phase 2
- **파일**: `R7_oss-competitor/findings.md`.
- **차용 6**: ①타입드 슬라이드 HTML 카탈로그 ②Playwright 감사→자동수정 루프(max3, self-heal 게이트) ③TTS-driven duration+forced align(TTS모드만) ④팩트 그라운딩(source→claim→number, content-fidelity 인풋) ⑤다축 스타일 토큰(font×surface×accent×purpose) ⑥phase 독립실행(재개, codex-spawn 정합).
- **차별화**: 한국어 카드뉴스덱→9:16 쇼츠 end-to-end = OSS 0건(우리 웨지). DOM 렌더러라 design-* HTML·한글CSS 손실없이 렌더(canvas계 불가).
- **파이프라인 검증**: JSON 스토리보드→타입드 슬라이드 HTML→렌더→감사 자동수정→PNG/MP4.

---

## 열린 결정 (아침 리포트 → 사용자)
1. 캐러셀 PNG 규격: **4:5(1080×1350)** 기본 vs 1:1. (R1 권장 4:5)
2. 내레이션: **무음+키네틱자막** 기본 vs TTS(크레덴셜 필요).
3. 스킬 이름: `card-shorts` (조정 가능).
4. (옵션) design-stripe 그라데이션 톤을 4번째 톤으로 추가할지.

## 미해결(PoC유예 → Phase 4 실측)
birefnet 배경 명도차 A/B · HyperFrames 60초 렌더시간/실패율 · `--quality high` ffmpeg flag · 컷아웃 drop-shadow bake vs CSS.
