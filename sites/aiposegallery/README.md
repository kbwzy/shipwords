# AI Pose Gallery

- **Status**: Live
- **Domain**: aiposegallery.com
- **Target keyword**: AI pose gallery; searchable pose references for artists and image creators.
- **Reference products**: the original POSE-DB-01 and PoseGen's gallery. The local design uses an independently generated yoga set with searchable categories and pose-specific descriptions.
- **Stack**: Shipwords, TanStack Start and Cloudflare Workers.
- **Launch scope**: live gallery, Google sign-in, image generation with a free daily tier and one-time Waffo credit packs. Video generation and email-code login are not enabled yet.
- **Image provenance**: the contact sheet in `public/pose-reference-sheet.png` was created for this project with the built-in image generation tool on 2026-10-29. It was reviewed as nine independent pose studies.
- **Yoga image provenance**: `public/yoga-reference-sheet.png` was generated for this project with the built-in image generation tool on 2026-10-29. Prompt: nine distinct adult women in modest athletic clothing performing full-body yoga poses in a 3-by-3 neutral studio reference sheet. It is a visual reference, not yoga instruction.
- **Fashion image provenance**: `public/fashion-reference-sheet.png` was generated for this project on 2026-10-29 using the built-in image tool. Four adult fashion models in fully clothed studio poses; each reference is cropped from a 2-by-2 sheet. A more suggestive first attempt was rejected by the image provider's safety system.
- **Additional pose studies**: `public/seated-extra.png`, `public/movement-extra.png`, and `public/fashion-extra.png` were generated for this project with the built-in image tool. Each contains nine separate AI-generated full-body pose studies in a 3-by-3 sheet. The collection labels describe the resulting images; downloads crop individual cells.
- **Additional series**: `public/upper-extra.png` and `public/expressive-extra.png` were generated for this project with the built-in image tool. They are not the linked repository's images.
- **Local-only generation test**: run `node sites/aiposegallery/scripts/local-pose-api.mjs` from the repository root alongside the local preview (`pnpm dev` serves this site on the dev-port-derived port 6043). The image workbench can then send opted-in inputs to Yir; see `scripts/local-pose-api.md` for limits and recovery. The service is never deployed, stores results in memory for 30 minutes, and is not production billing or account infrastructure. When it is absent, the page remains a local preview.
- **Motion sample**: `public/motion-preview.mp4` is the existing direct Yir video test in `research/yir-video-2026-10-29/`. The frame crops a supporting foot; it is a clearly labeled experimental preview, not an accepted full-body sample or evidence that site generation is live.
- **Before launch**: verify domain routing and the support mailbox; run the site check and exercise search, filters, detail, copy and download on desktop and mobile.
- **Pose-edit MVP**: see `POSE-EDIT-VALIDATION.md` for the current photo-edit workflow and quality gates. `GENERATION-AND-BILLING.md` is a superseded pose-sheet proposal; its pricing and model are not approved for the current product.
