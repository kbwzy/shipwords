# Garment fidelity micro-test — 2026-11-03

Gate 2 of the enterprise/SMB direction validation. Question: when the first reference is a
garment product photo (not a person), does the pipeline reproduce text, logo, pattern and
fabric faithfully on a posed model?

20 pairs: 4 garments × 5 poses (same pose tiles as ../pose-benchmark-2026-11-02).
Model `openai/gpt-image-2.5-sunburst`, 1K / 3:4 / medium, n=1.
Garment prompt: new two-reference wording (garment-reproduce + pose-only), recorded in
each `<pair>.idempotency.json`. Run: `run.mjs` (+ `recover-g1-seated.mjs` after a mid-poll
network drop; job had already been submitted, recovery only polled and downloaded).

## Garments (site-generated flat lays, no real brand)

| ID | Garment | Challenge dimension |
| --- | --- | --- |
| g1 | white tee, navy "AURELIA" chest text | text/logo fidelity (top failure mode, 20.1% in Photoroom benchmark) |
| g2 | black hoodie, white circular mountain badge | logo geometry |
| g3 | cream satin blouse, ditzy floral print | pattern density/scale |
| g4 | sheer white chiffon blouse, ruffle trim | fabric transparency |

## Result

- **Settled: 20/20. Failed: 0.** Total spend **$0.17** (20 × $0.0085).
- Sampled 11/20 results covering all 4 garments and all 5 pose classes, prioritizing
  each garment's hardest case.
- Pre-registered threshold: ≥80% of sampled images keep the garment faithful (text exact,
  logo geometry intact, pattern scale consistent, fabric behavior plausible) with pose
  executed as referenced.

## Scoring

| Sample (viewed) | Text/logo | Pattern/fabric | Pose | Verdict |
| --- | --- | --- | --- | --- |
| g1-standing | AURELIA exact, zero distortion | tee shape kept | standing ✓ | pass |
| g1-seated | AURELIA exact | tee shape kept | seated ✓ (barefoot — pose ref had flats; non-garment) | pass |
| g1-turn | front logo correctly not visible from back | tee shape kept | back-view turn ✓ | pass |
| g2-standing | badge geometry intact | hoodie shape kept | standing ✓ | pass |
| g2-upper | badge intact (plausible fold at shoulder) | hoodie shape kept | chin-on-hand ✓ | pass |
| g3-standing | — | floral density/scale faithful, satin sheen kept | standing ✓ | pass |
| g3-turn | — | pattern continues correctly on back | back-view turn ✓ | pass |
| g4-standing | — | transparency + ruffles + buttons preserved | standing ✓ | pass |
| g4-turn | — | sheer behavior correct from back | back-view turn ✓ | pass |
| g4-walking | — | transparency held in motion | gait ✓ | pass |
| g4-upper | — | sheer texture at close-up, ruffle cuff intact | chin-on-hand ✓ | pass |

**Scored pass rate: 11/11 = 100% ≥ 80% → Gate 2 PASS.**

## Notes

- The new garment-mode prompt worked first try; no wording iterations needed.
- Faces are slightly "beautified" (same as Gate 1) — acceptable for on-model use.
- Models auto-selected sensibly (male for tee/hoodie, female for blouses); footwear is
  model's choice — for production, bottom/shoe control would come from user instructions
  or an outfit reference, not from this test's scope.
- Network flakiness tonight (gateway timeouts twice mid-poll): production runner already
  treats polling as resumable; research script now does too (withPollRetry).
- Combined with Gate 1: 70/70 upstream successes across both runs, $0.60 total spend.
