#!/usr/bin/env python3
"""PoC 1 — birefnet-general 누끼 (저메모리 모드: cpu_mem_arena off + 스레드 제한).
사용: poc1_matte.py <in.png> <out.png> [model]"""
import sys, resource
import onnxruntime as ort
from rembg import remove
from rembg.session_factory import new_session

inp, outp = sys.argv[1], sys.argv[2]
model = sys.argv[3] if len(sys.argv) > 3 else "birefnet-general"

so = ort.SessionOptions()
so.enable_cpu_mem_arena = False          # 아레나 과할당 방지 → 피크 RSS 절감
so.intra_op_num_threads = 2
so.inter_op_num_threads = 1
so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC

# new_session은 sess_opts를 내부 생성하므로 세션 클래스를 직접 인스턴스화
from rembg.session_factory import sessions_class
cls = next(c for c in sessions_class if c.name() == model)
sess = cls(model, so)

out = remove(open(inp, "rb").read(), session=sess, alpha_matting=True,
             alpha_matting_foreground_threshold=240,
             alpha_matting_background_threshold=10,
             alpha_matting_erode_size=10)
open(outp, "wb").write(out)
peak_gb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024 / 1024
print(f"MATTE_OK {outp} peak_rss={peak_gb:.2f}GB model={model}")
