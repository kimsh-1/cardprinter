#!/usr/bin/env python3
# codex_imagegen_runner.py — codex exec를 자동 스케일링 병렬 스폰 → 레이스-세이프 회수
# 실행: PROMPTS=prompts.jsonl OUTDIR=./out python3 codex_imagegen_runner.py
#   PARALLEL=auto(기본) : 작업 수에 맞춰 워커 자동 산정 + 헬시하면 상한까지 램프업
#   PARALLEL=8          : 수동 고정.   MAX=12 : 자동 상한 override.   START=3 : 시작 워커.
import json, os, subprocess, sys, time, threading, shutil
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

PROMPTS  = Path(os.environ.get("PROMPTS", "prompts.jsonl"))
OUTDIR   = Path(os.environ.get("OUTDIR", "./out"))
PARALLEL = os.environ.get("PARALLEL", "auto")
TIMEOUT  = int(os.environ.get("TIMEOUT", "240"))
RAMP_EVERY = int(os.environ.get("RAMP_EVERY", "5"))   # 성공 N건마다 워커 +1
CODEX_IMG = Path.home() / ".codex" / "generated_images"

def auto_target(todo):
    """작업 수 → 목표 워커. codex exec는 I/O 바운드(이미지 API 대기 ~30-45s)라 CPU가
    아니라 RAM·계정(250 IPM)이 한도 → 여유 RAM 기반 캡(HARD_CAP 천장 32). MAX로 직접 고정.
    예: 여유 6GB·0.4GB/proc → ~15. 큰 머신이면 HARD_CAP까지. 계정은 보통 헤드룸 큼."""
    cap = int(os.environ.get("MAX", "0"))
    if not cap:
        try:
            free_gb = os.sysconf("SC_AVPHYS_PAGES") * os.sysconf("SC_PAGE_SIZE") / 1e9
            per = float(os.environ.get("RAM_PER_PROC_GB", "0.4"))
            cap = max(2, int(free_gb / per))
        except (ValueError, OSError, AttributeError):
            cap = (os.cpu_count() or 4) * 2          # 비리눅스 폴백(I/O 바운드라 코어×2)
        cap = min(int(os.environ.get("HARD_CAP", "32")), cap)
    return max(1, min(todo, cap))

class AutoScaler:
    """start 워커로 시작해 헬시하면 RAMP_EVERY 성공마다 +1, target까지. 스로틀 시 성장 정지."""
    def __init__(self, target):
        self.target = target
        self.permits = max(1, min(int(os.environ.get("START", "3")), target))
        self.sem = threading.Semaphore(self.permits)
        self.lock = threading.Lock()
        self.ok = 0
    def __enter__(self): self.sem.acquire(); return self
    def __exit__(self, *a): self.sem.release()
    def live(self): return self.permits
    def success(self):
        with self.lock:
            if self.permits < self.target:
                self.ok += 1
                if self.ok >= RAMP_EVERY:
                    self.ok = 0; self.permits += 1; self.sem.release()  # 천장 +1
    def throttle(self):
        with self.lock:
            self.ok = 0  # 429 보이면 성장 일시정지(개별 호출은 codex가 백오프)

_lock = threading.Lock()
_claimed = set()   # 이미 회수한 png 경로 — 레이스 방지 핵심
def newest_unclaimed(after_ts):
    with _lock:
        best = None
        if CODEX_IMG.exists():
            for sess in CODEX_IMG.iterdir():
                if not sess.is_dir(): continue
                for png in sess.glob("ig_*.png"):
                    p = str(png)
                    if p in _claimed: continue
                    try: m = png.stat().st_mtime
                    except OSError: continue
                    if m > after_ts and (best is None or m > best[1]): best = (png, m)
        if best:
            _claimed.add(str(best[0])); return best[0]
        return None

def _is_throttle(err):
    e = (err or "").lower()
    return "429" in e or "rate limit" in e or "too many requests" in e

def run_one(item, scaler):
    pid = item["id"]; out = OUTDIR / item["output_path"]
    if out.exists(): return (pid, "skip", 0)   # resume
    instr = (f"Use $imagegen to generate ONE image.\n"
             f"Aspect ratio: {item.get('ar','1:1')}\n"
             f"Size: {item.get('size','1024x1536')}\n"
             f"Prompt: {item['prompt']}\n"
             f"After generation, do NOT run any shell commands. Just generate and end your turn.")
    with scaler:                               # 동시 실행 슬롯(천장은 스케일러가 조절)
        before = time.time() - 1
        try:
            r = subprocess.run(
                ["codex","exec","--skip-git-repo-check","--dangerously-bypass-approvals-and-sandbox", instr],
                stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                timeout=TIMEOUT, text=True)
        except subprocess.TimeoutExpired:
            return (pid, "timeout", time.time()-before)
        if _is_throttle(r.stderr): scaler.throttle()
        deadline = time.time() + 30; src = None
        while time.time() < deadline:
            src = newest_unclaimed(before)
            if src: break
            time.sleep(1)
    if not src:
        return (pid, "rejected/no-image", time.time()-before)   # 대개 모더레이션 거부
    out.parent.mkdir(parents=True, exist_ok=True); shutil.move(str(src), str(out))
    scaler.success()
    return (pid, "ok", time.time()-before)

def main():
    items = [json.loads(l) for l in PROMPTS.read_text().splitlines() if l.strip()]
    items = [it for it in items if not (OUTDIR/it["output_path"]).exists()]   # resume
    todo = len(items)
    if PARALLEL.isdigit():
        target = max(1, int(PARALLEL)); mode = f"manual={target}"
    else:
        target = auto_target(todo); mode = f"auto→{target}(RAM기반)"
    if not todo: print("[done] 처리할 작업 없음."); return 0
    scaler = AutoScaler(target)
    print(f"[spawn] todo={todo} workers={mode} start={scaler.live()} ramp=+1/{RAMP_EVERY}ok", flush=True)
    ok=fail=0; t0=time.time()
    with ThreadPoolExecutor(max_workers=target) as ex:
        futs={ex.submit(run_one,it,scaler):it["id"] for it in items}
        for f in as_completed(futs):
            pid,status,el=f.result()
            if status=="ok":
                ok+=1
                if ok%10==0:
                    rate=ok/max(time.time()-t0,1)*60
                    print(f"[progress] {ok}/{todo} ok · {rate:.1f}/min · 워커 {scaler.live()}/{target}", flush=True)
            elif status!="skip":
                fail+=1; print(f"[fail#{fail}] {pid} ({el:.0f}s) {status}", flush=True)
    print(f"\n=== done: {ok} ok / {fail} fail / {(time.time()-t0)/60:.1f}min · peak 워커 {scaler.live()}/{target} ===")
    return 0 if fail==0 else 1

if __name__=="__main__":
    sys.exit(main())
