// G4 prompt-check: image-prompt 스킬의 check_prompt.mjs 위임(Tier-0 긍정형·앞브래킷 금지·끝 AR토큰·사이즈락)
// CARDSHORTS_PROMPT_CHECKER 미설정 시 외부 검사기가 없다는 뜻 — SKIP(exit 0)으로 취급.
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { arg, fail } from "./lib.mjs";
const CHECKER = process.env.CARDSHORTS_PROMPT_CHECKER || "";
const file = arg(0);
if (!file) fail("usage: g04_prompt_check <prompt-file>");
if (!CHECKER || !existsSync(CHECKER)) {
  console.log("[G4] prompt-check skipped (CARDSHORTS_PROMPT_CHECKER unset)");
  process.exit(0);
}
try {
  const out = execFileSync("node", [CHECKER, file], { encoding: "utf8" });
  process.stdout.write(out);
  console.log("✓ G4 prompt-check PASS");
} catch (e) {
  process.stdout.write(e.stdout || "");
  process.stderr.write(e.stderr || "");
  console.error("✗ G4 prompt-check FAIL");
  process.exit(1);
}
