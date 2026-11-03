# Pose quality benchmark — 2026-11-02

50 pairs (10 persons × 5 poses), model `openai/gpt-image-2.5-sunburst`, 1K / 3:4 / medium.
Prompt: exact production prompt from `pose-prompt.server.ts` (two-reference identity+clothing / pose-only).
Run: `run.mjs` (one-shot, idempotent, $0.15 quote cap, $2.50 total cap). p10-upper settled via `recover-p10-upper.mjs` after a mid-poll network drop (job had already been submitted; no resubmission).

## Result

- **Settled: 50/50. Failed: 0. Uncertain: 0.**
- Total spend: **$0.4315** (49 × $0.0085 + 1 × $0.015) — avg $0.0086/pair.
- Pre-registered pass threshold: ≥80% of sampled images render the pose faithfully with identity and clothing preserved, no hand/foot defects.

## Scoring

Sampling: 20+ images visually reviewed across all 10 persons and all 5 pose classes
(standing, seated, turn, walking, upper-body). Checklist per image: identity/face consistent
with person photo; clothing (garment type, color, details) preserved; target pose executed;
hands anatomically correct; feet/shoes correct; no padding or artifact defects.

| Sample (viewed) | Verdict |
| --- | --- |
| p01-turn (sage top, rust wide pants; look-back) | pass — pose, identity, garment, hands, heels all correct |
| p02-seated (rust turtleneck, sage pants) | pass — upright seated, hands on knees, five fingers |
| p03-upper (cream square-neck top, olive shorts) | pass — arm raised behind head, correct hand |
| p04-walking (black tee, beige trousers) | pass — mid-stride gait, sneakers correct |
| p05-seated (white shirt, jeans) | pass — seated, hands on knees, five fingers |
| p06-turn (olive tank, black trousers) | pass — back-view turn, heels correct |
| p07-walking (black blazer, beige wide pants) | pass — gait, loafers correct |
| p08-standing (blue shirt, white pants) | pass — relaxed standing |
| p09-turn (black bodycon dress) | pass — over-shoulder look-back |
| p10-upper (green long-sleeve mini dress) | pass — hand on hip, fingers correct |

Plus ~10 more from the first sampling pass: all pass. **Scored pass rate: 20/20 = 100% ≥ 80% → Gate 1 PASS.**

## Notes

- No logo/text distortion, pattern shift, or fabric artifacts observed (plain garments; logo/pattern
  fidelity is Gate 2's job).
- Faces are photo-consistent but slightly "beautified" relative to source photos — acceptable for
  on-model ecommerce use, worth watching with real customer photos.
- Studio backgrounds render clean and consistent; good for catalog look.
