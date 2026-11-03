# OnModel Photos

- **Status**: In development
- **Domain**: onmodelphotos.com
- **Target keyword**: AI on-model photos; turn flat-lay garment product shots into e-commerce model images for clothing sellers.
- **Reference products**: Botika and OnModel.ai (per-SKU pricing, subscription-locked). This site competes with one-time credit packs and a free daily trial tier.
- **Stack**: Shipwords, TanStack Start and Cloudflare Workers.
- **Launch scope**: garment studio (garment photo + optional model reference → one on-model shot), free daily trial, one-time Stripe credit packs. Video generation is not enabled.
- **Image provenance**: the four garment tiles and five model tiles in `public/garments/` are cropped from the validated research runs in `sites/aiposegallery/research/garment-fidelity-2026-11-03/` (generated with the Yir `gpt-image-2.5-sunburst` model). `public/garment-edit-example.jpg` is the g1 standing-pair result.
- **Validation**: three gates recorded under `sites/aiposegallery/research/` — pose benchmark 50/50 ($0.4315), garment fidelity 20/20 ($0.17, text/logo/pattern/fabric faithful), keyword SERP review (zero giants, SMB language; volume unverified).
- **Tests**: `pnpm --filter "./sites/onmodelphotos" test` runs the pure-function pipeline suite (`scripts/*.test.mjs`) with node --test.
- **Before deploy**: move demo guides out of the deployable tree, check `site.config.ts` analytics (no GA ID yet), run the deploy-time demo-content check, and confirm the D1/R2/Workflow bindings exist in the target account. Production deploys from main only, with explicit confirmation.
- **Pipeline notes**: references upload garment-then-model to match the prompt's declared roles; guest quota is 3/day per device and 30/day site-wide, each task hard-capped at $0.30 upstream cost with a $0.15 quote admission threshold.

## How this site differs from competitors

Two-reference garment fidelity instead of text-only prompts: the garment is reproduced (logo, pattern, fabric) from the seller's own product photo, with an optional model reference for body type and skin tone. Credit packs instead of subscriptions, and the trial runs without an account.

## Log

- 2026-11-03 Created from templates/ai-site. Three validation gates passed the same day; studio, gallery and brand pages built on the validated pipeline.
