#!/usr/bin/env node
// 게이트 훅 디스패처 — 계약 파일이 쓰이면 해당 게이트를 자동 실행하고 실패 시 차단.
// Claude Code PostToolUse 훅: stdin에 {tool_input:{file_path}} JSON. 실패 시 exit 2(차단 신호).
// 사용(수동): echo '{"tool_input":{"file_path":"/proj/copy.json"}}' | node gate_hook.mjs
import { execFileSync } from "node:child_process";
import { dirname, join, basename, resolve } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GATES = resolve(ROOT, "scripts/gates");
let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  let fp = "";
  try { fp = JSON.parse(raw || "{}").tool_input?.file_path || ""; } catch {}
  if (!fp) process.exit(0);
  const proj = dirname(fp);
  const name = basename(fp);
  const runs = [];
  if (name === "copy.json") {
    runs.push(["node", [join(GATES, "g01_copy_count.mjs"), fp, join(proj, "brief.json")]]);
    runs.push(["node", [join(GATES, "g02_copy_len.mjs"), fp]]);
    if (existsSync(join(proj, "brief.json"))) runs.push(["node", [join(GATES, "g10_fact_fidelity.mjs"), fp, join(proj, "brief.json")]]);
  } else if (name === "tokens.json") {
    runs.push(["node", [join(GATES, "g03_tokens_schema.mjs"), fp, proj]]);
  } else if (name === "storyboard.json" && existsSync(join(proj, "copy.json"))) {
    runs.push(["node", [join(GATES, "g12_caption_match.mjs"), fp, join(proj, "copy.json")]]);
  }
  if (!runs.length) process.exit(0);
  let failed = false;
  for (const [cmd, args] of runs) {
    try { process.stderr.write(execFileSync(cmd, args, { encoding: "utf8" })); }
    catch (e) { process.stderr.write((e.stdout || "") + (e.stderr || "")); failed = true; }
  }
  if (failed) { process.stderr.write("\n[card-shorts] 게이트 실패 — 해당 계약 파일을 수정하세요.\n"); process.exit(2); }
  process.exit(0);
});
