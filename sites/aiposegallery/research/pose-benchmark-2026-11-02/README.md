# Pose quality benchmark, 2026-11-02

50 combinations: 10 persons × 5 poses, direct Yir calls replicating the production request exactly.

- Model `openai/gpt-image-2.5-sunburst`, `1K`, `3:4`, `medium`, `n=1`; routing `only: ['official']`, no fallback, `fidelity: original`; `max_cost` 0.30 USD per task; per-task quote must be ≤ 0.15 USD (site admission threshold).
- Prompt is the exact production template from `src/site/pose-prompt.server.ts` with `hasPhoto: true, hasPose: true, instructions: ''`, i.e. the request the site sends when a visitor leaves instructions empty.
- Persons: 10 distinct full-body figures cropped from the site's own reference sheets (`inputs.json` records sheet and box for each crop). All are site-generated AI images; no real person's photo is used.
- Poses (site gallery tiles): `standing` = mountain-pose, `seated` = chair-upright, `turn` = fashion-turn-back, `walking` = walking-step, `upper` = upper-1 (chin on hand). The `walking` and `upper` crops match `../pose-edit-2026-10-29/benchmark-3/` so results are comparable with that run.
- Serial execution; per-task durable idempotency record (`<pair>.idempotency.json`) and a `RUN-ONCE.json` one-shot marker are written before any provider call. A task whose outcome is uncertain is never resubmitted by this script; the resume path only skips pairs that already have a settled result file, it does not retry failures.
- Budget guard: the script stops before starting a new task when settled spend would exceed 2.50 USD (expected ≈ 0.43 USD at the 0.0085/task seen in benchmark-3).

## Method

`run.mjs` walks all 50 (person, pose) pairs in order. For each pair it writes the idempotency keys and input digests durably, uploads person then pose (fixed order, as in production), quotes, validates the quote against the 0.15 USD admission threshold, submits with `max_cost 0.30`, polls the same job ID to a terminal state, waits for `billing.status = settled`, records `total_charged_by_yir`, downloads and signature-checks the single result file, and moves on. Events append to `events.jsonl`.

Review happens after the run, output by output, in `SCOREBOARD.md`: pose match, identity carry-over (face shape, hair, skin tone), clothing carry-over, hands/feet integrity, overall completeness. A task passes only if pose and identity are both acceptable. Thresholds pre-registered in `../../POSE-EDIT-VALIDATION.md`: ≥80% of the 50 requests usable overall; identity and clothing each ≥80%.

## Result

(to be filled in after the run; do not write expected numbers here)

| Metric | Value |
| --- | --- |
| Tasks attempted | — |
| Succeeded (image returned) | — |
| Failed / no output | — |
| Total settled spend | — |
| Mean spend per success | — |

## Scoring result

(to be filled in from SCOREBOARD.md after review)
