# HyperFrames 카드뉴스→쇼츠 렌더 레시피 (스킬 즉시 사용용)

카드뉴스 캐러셀 → 9:16 MP4. 스킬이 바로 붙여 쓰는 체크리스트 + 코드 스니펫 + 커맨드.

---

## STEP 0 — 사전 준비 (1회)

```bash
# 렌더 환경 (render/validate/inspect/snapshot 전에 매번, 세션당 1회 export)
export LD_LIBRARY_PATH=$CARDSHORTS_CHROME_LIBS:$LD_LIBRARY_PATH

# 스캐폴드 (에이전트/비TTY는 --non-interactive + --example 필수)
npx hyperframes init cardnews-short --non-interactive --example blank --resolution portrait
cd cardnews-short

# 한글 폰트 shipping (렌더머신엔 폰트 0개 → 반드시 프로젝트에 복사)
mkdir -p assets/fonts assets/bg assets/cutouts assets/audio vendor
cp $HOME/.fonts/pretendard-pkg/web/variable/woff2/PretendardVariable.woff2 assets/fonts/
# gsap도 로컬 번들 (CDN 금지)
```

---

## STEP 1 — index.html 템플릿 (시간구간 방식, 3장 예시)

```html
<!doctype html>
<html>
<head><meta charset="UTF-8"></head>
<body>
<style>
  @font-face{
    font-family:"Pretendard";
    src:url("./assets/fonts/PretendardVariable.woff2") format("woff2");
    font-weight:100 900; font-style:normal; font-display:block;
  }
  #root{ position:relative; width:1080px; height:1920px; overflow:hidden;
         font-family:"Pretendard","Noto Sans KR",sans-serif; }
  .layer{ position:absolute; inset:0; box-sizing:border-box; }
  .bg{ z-index:0; overflow:hidden; }
  .bg img{ width:100%; height:100%; object-fit:cover; object-position:50% 42%; }
  .card{ z-index:10; display:flex; flex-direction:column; justify-content:center;
         padding:180px 84px 260px; gap:28px; }
  .cutout{ z-index:20; object-fit:contain; pointer-events:none; transform-origin:50% 82%;
           filter:drop-shadow(0 24px 48px rgba(0,0,0,.35)); }
  .caption{ z-index:30; pointer-events:none; }
  .kicker{ font-size:40px; font-weight:700; color:#ff5a3c; letter-spacing:0; }
  .headline{ font-size:96px; font-weight:800; line-height:1.14; color:#111;
             word-break:keep-all; overflow-wrap:anywhere; }
  .bullet{ font-size:50px; font-weight:500; line-height:1.35; color:#222;
           word-break:keep-all; overflow-wrap:anywhere; }
  .source{ font-size:30px; color:#666; }
</style>

<div id="root" data-composition-id="cardnews-short"
     data-width="1080" data-height="1920" data-duration="14.4" data-fps="30">

  <!-- ===== CARD 01 (0.0~4.8) ===== -->
  <div id="bg-01" class="clip layer bg" data-start="0" data-duration="4.8" data-track-index="0">
    <img src="./assets/bg/bg-01.webp" alt="">
  </div>
  <img id="cutout-01" class="clip layer cutout"
       src="./assets/cutouts/person-01.webp" alt=""
       data-start="0.2" data-duration="4.4" data-track-index="2"
       style="width:620px; height:auto; right:40px; bottom:0; left:auto; top:auto;">
  <section id="card-01" class="clip layer card" data-start="0" data-duration="4.8" data-track-index="1">
    <div class="kicker">7월 정책</div>
    <div class="headline">7월부터 달라지는 지원금</div>
    <div class="bullet">· 신청 기간은 2주</div>
    <div class="bullet">· 소득 기준 확인 필요</div>
  </section>

  <!-- ===== CARD 02 (4.8~9.6) — 겹침 없으면 같은 track 재사용 ===== -->
  <div id="bg-02" class="clip layer bg" data-start="4.8" data-duration="4.8" data-track-index="0">
    <img src="./assets/bg/bg-02.webp" alt=""></div>
  <section id="card-02" class="clip layer card" data-start="4.8" data-duration="4.8" data-track-index="1">
    <div class="headline">누가 받을 수 있나</div>
    <div class="bullet">· 만 19~34세</div>
    <div class="bullet">· 중위소득 150% 이하</div>
  </section>

  <!-- ===== CARD 03 (9.6~14.4) — 출처 카드 ===== -->
  <div id="bg-03" class="clip layer bg" data-start="9.6" data-duration="4.8" data-track-index="0">
    <img src="./assets/bg/bg-03.webp" alt=""></div>
  <section id="card-03" class="clip layer card" data-start="9.6" data-duration="4.8" data-track-index="1">
    <div class="headline">지금 신청하세요</div>
    <div class="source">출처: 고용노동부 보도자료 · 2026-07-01</div>
  </section>

  <!-- ===== AUDIO (host root 직속, class="clip" 없음) ===== -->
  <audio id="bgm" src="./assets/audio/bgm.m4a"
         data-start="0" data-duration="14.4" data-track-index="10" data-volume="0.35"></audio>
  <audio id="vo" src="./assets/audio/vo-ko.wav"
         data-start="0.4" data-duration="13.6" data-track-index="11" data-volume="1"></audio>
</div>

<script src="./vendor/gsap.min.js"></script>
<script>
  window.__timelines = window.__timelines || {};
  const root = document.querySelector("[data-composition-id]");
  const tl = gsap.timeline({ paused:true, defaults:{ duration:0.5, ease:"power2.out" } });

  const pad = n => String(n).padStart(2,"0");
  function addCard(i, start, opts={}){
    const c = `#card-${pad(i)}`, bg = `#bg-${pad(i)}`, cut = `#cutout-${pad(i)}`;
    tl.addLabel(`card-${i}`, start);
    // 1) 배경 먼저 (느린 scale)
    tl.fromTo(`${bg} img`, {scale:1.06, opacity:0}, {scale:1.0, opacity:1, duration:0.65, ease:"sine.out"}, `card-${i}`);
    // 2) 카드 surface
    tl.fromTo(c, {y:64, opacity:0}, {y:0, opacity:1, duration:0.50, ease:"power3.out"}, `card-${i}+=0.08`);
    // 3) 텍스트 위계: kicker → headline → bullets(stagger)
    tl.fromTo(`${c} .kicker`,   {y:20, opacity:0}, {y:0, opacity:1, duration:0.30}, `card-${i}+=0.22`);
    tl.fromTo(`${c} .headline`, {y:36, opacity:0}, {y:0, opacity:1, duration:0.50, ease:"power4.out"}, `card-${i}+=0.34`);
    tl.fromTo(`${c} .bullet`,   {y:24, opacity:0}, {y:0, opacity:1, duration:0.38, stagger:0.08}, `card-${i}+=0.72`);
    // 4) 컷아웃 (있으면)
    if(opts.cutout) tl.fromTo(cut, {x:38, scale:0.98, opacity:0}, {x:0, scale:1, opacity:1, duration:0.55, ease:"power3.out"}, `card-${i}+=0.28`);
  }

  addCard(1, 0.0,  {cutout:true});
  addCard(2, 4.8);
  addCard(3, 9.6);

  // BGM 아웃트로 페이드 (볼륨은 타임라인에서만)
  tl.to("#bgm", {volume:0, duration:0.8}, 13.6);

  window.__timelines[root.dataset.compositionId] = tl;   // key = data-composition-id
</script>
</body></html>
```

핵심 규칙(어기면 silent 버그):
- 배경은 `#root` 배경이 아니라 **자식 `.bg` 레이어**(root 배경 → 검정 프레임).
- 보이는 timed 요소 전부 `class="clip"` + **root direct child**(wrapper 금지).
- 컷아웃/카드는 CSS `z-index`로 앞뒤. track-index는 시간겹침 lane일 뿐.
- 같은 track(1) 카드끼리 시간 안 겹치면 재사용 OK. crossfade 필요하면 다른 track.
- `<audio>`는 root 직속, `class="clip"` 없음.
- root `data-duration`은 총합(14.4)과 일치. script로 못 바꿈.

---

## STEP 2 — GSAP 전환 패턴 변형

```js
// [Crossfade] 두 카드를 다른 track에 두고 opacity 교차 (겹침 → track 분리 필수)
tl.to(`#card-${pad(i-1)}`, {opacity:0, duration:0.35}, start);
tl.fromTo(`#card-${pad(i)}`, {opacity:0}, {opacity:1, duration:0.35}, start);

// [Push/slide] 캐러셀 원본성
tl.to(`#card-${pad(i-1)}`, {xPercent:-14, opacity:0, duration:0.45}, start);
tl.fromTo(`#card-${pad(i)}`, {xPercent:12, opacity:0}, {xPercent:0, opacity:1, duration:0.45, ease:"power3.out"}, start);

// [Mask/wipe] 수치 강조 — transform 기반(clip-path보다 저비용). wrapper overflow:hidden
// .wipe{overflow:hidden} .wipe-bar{display:block; width:100%; height:100%; transform-origin:left}
tl.fromTo(`${c} .wipe-bar`, {scaleX:0}, {scaleX:1, duration:0.5, ease:"power2.out"}, `card-${i}+=0.3`);

// [숫자 카운터] innerText 직접 tween (정수 유지)
tl.to("#stat", {innerText:150, snap:{innerText:1}, duration:1.2, ease:"power1.out"}, `card-${i}+=0.4`);

// [유한 repeat] 절대 -1 금지. floor로 data-duration 안에
const reps = Math.max(0, Math.floor(cardDur / cycle) - 1);
tl.to(`${c} .pulse`, {scale:1.06, yoyo:true, repeat:reps, duration:cycle/2}, `card-${i}`);
```

모션 패턴 6종: fade-up(기본) · crossfade · push/slide · mask/wipe · counter · finite-pulse.
허용 속성만: `opacity,x,y,scale,scaleX/Y,rotation,skewX/Y,transformOrigin,color,backgroundColor,borderColor,borderRadius,CSS var,volume,innerText`.
금지: `display/visibility`(→autoAlpha), `width/height/top/left/margin/padding`(→scaleX/Y+transformOrigin), `repeat:-1`.
톤: 정책/금융/의료 → `power2/3.out`,`sine.inOut`(elastic·과한 back 금지). 커머스/연예 → `back.out(1.2–1.8)` OK.

---

## STEP 3 — 오디오 / 자막 (⚠ Kokoro 로컬은 한국어 미지원)

```bash
# 로그인 상태 먼저 표시 (한국어 TTS는 크레덴셜 필요 — Kokoro는 ko 없음!)
npx hyperframes auth status

# (A) HeyGen 크레덴셜 있으면: 한국어 VO + 네이티브 word timestamp
node <MEDIA_DIR>/scripts/heygen-tts.mjs --text "7월부터 지원금이 달라집니다" \
  --output assets/audio/vo-ko.wav --words vo.words.json
# (B) 크레덴셜 없으면: 외부 한국어 TTS로 wav 생성 후 → whisper 자막
npx hyperframes transcribe assets/audio/vo-ko.wav --model small --language ko
#   ⚠ .en 모델 금지(한국어→영어 번역). 출력: [{id,text,start,end}] flat word array
```
- 캡션 폰트도 Pretendard woff2 `@font-face` 필수(렌더머신 폰트 0개 → 미선언 시 fallback 뭉개짐).
- BGM ≈ -14 LUFS, SFX ≈ volume 0.35. 볼륨 페이드는 타임라인 `tl.to("#bgm",{volume:0,...})`.

---

## STEP 4 — 렌더 커맨드 시퀀스 (확정)

```bash
export LD_LIBRARY_PATH=$CARDSHORTS_CHROME_LIBS:$LD_LIBRARY_PATH

npx hyperframes lint                          # track 겹침·미등록 타임라인·id 누락
grep -nE '<(video|audio)\b' compositions/*.html   # sub-comp 쓸 때만: 매치 0 이어야
npx hyperframes validate                      # JS 에러·네트워크·WCAG 대비
npx hyperframes inspect --samples 15          # 텍스트 박스 이탈·캔버스 밖 (+*.motion.json)
npx hyperframes snapshot --frames 9           # 카드별 눈검사: blank/겹침/검정프레임
npx hyperframes preview --port 3017           # 승인: http://localhost:3017/#project/cardnews-short
npx hyperframes render --quality draft --output renders/draft.mp4    # 모션 확인
npx hyperframes render --quality high --fps 30 --output renders/final.mp4
ffprobe renders/final.mp4                     # duration/fps/codec/pix_fmt/0byte 확인
npx hyperframes feedback --rating 5 --comment "cardnews 9:16 파이프라인"
```
재현성: `npx hyperframes render --docker --strict --quality high --fps 30 --output renders/final.mp4`
render 플래그: `--fps 24|30|60`(기본30) · `--quality draft|standard|high` · `--crf 0-51`(또는 배타적 `--video-bitrate 10M`) · `--resolution portrait|portrait-4k` · `--format mp4|webm|mov|gif|png-sequence` · `--workers auto` · `--strict`(lint 에러 시 실패).

---

## STEP 5 — 최종 QA 체크 (렌더 직전)

- [ ] `export LD_LIBRARY_PATH` 완료.
- [ ] root 배경 자체 아님 → `.bg` 자식 레이어(검정프레임 방지).
- [ ] root·상위 명시 px 크기(1080×1920).
- [ ] 보이는 timed 전부 `class="clip"` + root direct child.
- [ ] 같은 track 시간겹침 0. 앞뒤 z-index로.
- [ ] Pretendard woff2 `assets/fonts/`에 존재 + `@font-face` 선언.
- [ ] 폰트·이미지·오디오·gsap 전부 로컬(렌더타임 네트워크 0).
- [ ] clocks/random/hover/timer 모션 0. `display/visibility/width/height` tween 0. `repeat:-1` 0.
- [ ] `<audio>` host root 직속.
- [ ] `transcribe --model small --language ko`(.en 금지).
- [ ] `<br>` 강제 줄바꿈 0. `word-break:keep-all`.
- [ ] lint/validate/inspect/snapshot 통과 + preview 사용자 승인.
