# card-shorts factory — codex 양산 러너

사람 개입 0으로 주제 목록 → codex 헤드리스 병렬 → 카드뉴스 캐러셀(PNG) 양산, 게이트 통과분만 회수.

```bash
TOPICS=topics.jsonl OUTROOT=~/cardnews-work/factory PARALLEL=3 bash run_factory.sh
```

- `topics.jsonl` 한 줄 = 한 건: `{"id":"coffee-01","topic":"하루 커피 몇 잔이 적당할까","tier":"brand"}`
- 결과: `$OUTROOT/<id>/{PASS|FAIL, out/card-*.png, summary.json, factory.log, gate-*.log}`. `PASS` 파일이 있으면 통과, 없으면 `FAIL` 파일에 실패 스테이지·게이트 원문.
- 단건 재실행/디버그: `bash worker.sh <workdir>/topic.json <workdir>`
- 실패건 재큐: 해당 `<id>` 디렉토리를 지우고(또는 `PASS`/`FAIL` 마커만 지우고) 같은 `id`로 topics.jsonl을 다시 돌리면 재시도(자산 재사용 없음 — 처음부터 재생성).
