# Mass Production with the `codex` Factory

CardPrinter ships a headless factory runner that turns a **list of topics** into a batch of
finished, gate-passed carousels — zero human touch. It drives the [`codex`](https://github.com/openai/codex)
CLI to write the copy, then runs the full deterministic render + gate pipeline, and **self-heals**:
when a gate fails, the failure log is fed back to `codex` and the topic is regenerated (up to 3 attempts).

> **Why a factory?** One `codex` call = one topic's `brief.json` + `copy.json`. The factory fans that out
> across many topics in parallel and only keeps the ones that pass every physical gate. It's how you go
> from "one nice card" to "40 on-brand carousels overnight."

---

## 1. Write a topic list

`topics.jsonl` — one JSON object per line:

```jsonl
{"id":"coffee-01","topic":"하루 커피 몇 잔이 적당할까 — 카페인 과학","tier":"brand"}
{"id":"sleep-02","topic":"한국인 수면 실태 — 숫자로 보는 잠","tier":"data"}
{"id":"news-03","topic":"이번 주 놓치면 안 되는 경제 뉴스 3가지","tier":"news"}
```

| field | required | notes |
|---|---|---|
| `id` | yes | unique; becomes the output subdirectory name |
| `topic` | yes | one line; the copy writer expands it into a full carousel |
| `tier` | yes | `luxury` · `character` · `brand` · `news` · `editorial` · `data` (or a custom tier id) |

The copy writer auto-picks a viral **sequence template** (checklist / listicle / data-infographic /
photo-story / storytelling / versus) from the topic — see `references/carousel-templates.json`.

---

## 2. Run the batch

```bash
TOPICS=topics.jsonl \
OUTROOT=~/cardnews-work/factory \
PARALLEL=3 \
bash scripts/factory/run_factory.sh
```

| env var | default | meaning |
|---|---|---|
| `TOPICS` | *(required)* | path to your `topics.jsonl` |
| `OUTROOT` | *(required)* | output root; each topic gets `OUTROOT/<id>/` |
| `PARALLEL` | `3` | topics generated concurrently (a FIFO semaphore caps it) |
| `MAX_ATTEMPTS` | `3` | self-heal attempts per topic before giving up |

---

## 3. What each topic does (self-heal loop)

```
for attempt in 1..MAX_ATTEMPTS:
  codex → brief.json + copy.json     (feedback = previous attempt's gate log)
  compile tokens
  ├─ copy/tokens gates fail?  → feed back, regenerate
  ├─ image gates fail?        → feed back, regenerate images next attempt
  └─ carousel gates fail?     → feed back, rewrite copy (images reused — cheap)
  all gates green → PASS ✅
```

Key behavior:
- **Images are generated once** (attempt 1). A carousel-only failure (text overflow, dead space, etc.)
  reuses the existing images and only rewrites the copy — so retries are cheap.
- If the **image** gate itself fails (e.g. a generated background has stray text), images are regenerated
  on the next attempt.
- If all attempts are exhausted, the topic is marked `FAIL` with the last gate log — it is **never**
  shipped as a broken "done".

---

## 4. Read the results

```
OUTROOT/<id>/
├── PASS                 # marker: this topic passed every gate  (or)
├── FAIL                 # marker: exhausted attempts; contains the failing gate log
├── summary.json         # {id, topic, tier, cards, gates, ts}   (PASS only)
├── out/card-01.png …    # the finished 1080×1350 carousel
├── carousel/card-*.html # source cards (also the Reels scene source)
├── brief.json / copy.json / tokens.json
└── gate-attempt-N.log   # per-attempt copy+image+carousel gate output
```

Collect the winners:

```bash
for d in "$OUTROOT"/*/; do [ -f "$d/PASS" ] && echo "✅ $(basename "$d")"; done
```

Then turn any passing carousel into a 9:16 Reel:

```bash
node scripts/render/build_shorts.mjs "$OUTROOT/<id>"          # cards → 1080×1920 timeline
bash scripts/render/render_shorts.sh "$OUTROOT/<id>" high     # timeline → MP4
```

---

## 5. Debug / re-run a single topic

```bash
# one topic, verbose, in its own workdir
echo '{"id":"x","topic":"...","tier":"data"}' > /tmp/x.json
bash scripts/factory/worker.sh /tmp/x.json ~/cardnews-work/factory/x

# re-queue a failed topic: delete its dir (or just its PASS/FAIL marker) and re-run the batch
rm -rf "$OUTROOT/<id>" && TOPICS=topics.jsonl OUTROOT=... bash scripts/factory/run_factory.sh
```

---

## 6. Tips

- **Numbers must be real.** Every number in the copy has to trace back to a fact the copy writer declared
  (`brief.facts`) — the fact-fidelity gate rejects fabricated figures. If `codex` has no web access, it will
  (and should) only use figures it is certain of, or omit the stat card.
- **Big numbers stay short.** A bignum renders at a fixed large size; keep it to ~3 characters
  (`5.7만`, `3.2%`, `9배`) — the copy gate nudges `codex` toward compact units and steers 4–5 digit raw
  numbers into charts instead.
- **Scale `PARALLEL` to your machine and API limits.** Image generation is the slow, rate-limited step.
- **Custom tiers work here too** — build one from a brand's BI deck or a short interview
  (see the tone-tier docs), then use its id in `topics.jsonl`.
