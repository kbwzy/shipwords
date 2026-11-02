# Pose image generation: production pipeline review

Review date: 2026-10-29. Scope is the current local checkout; the public site's generation endpoints remain closed. This review does not assess Waffo checkout or change the frontend being edited separately.

## Findings before enabling production

1. **Private input and output access:** `packages/jobs/src/handlers.ts` returns uploads at random `/files/uploads/...` URLs and serves both uploads and successful outputs without an owner check, with `public, max-age=31536000, immutable`. It also accepts reference paths by format without checking who owns them. Random URLs do not provide authenticated ownership. The separate `src/site/private-media.server.ts` primitives are not connected to these routes, authentication, or the workflow.
2. **Provider input transfer:** `packages/jobs/src/yir.ts` sends references as URL values. A private owner-only URL cannot be fetched by Yir in this form. The pose pipeline needs authenticated server-side upload to Yir's Files API and `file_id` references, preserving person-first, pose-second ordering. Do not expose an unsigned personal-image URL as a workaround.
3. **Request deduplication and budget:** the local test API has per-request idempotency, a process-wide lock, a quote threshold and a maximum upstream cost. These controls exist only in the local Node process and cannot be used as distributed production controls. `packages/jobs/src/handlers.ts` assigns a new job ID for each create request; upstream submission uses that job ID as its key, which does not deduplicate repeated client requests. Add owner-scoped durable request idempotency and an atomic site-wide budget cap before exposing free generation.
4. **Result validation and recovery:** `packages/jobs/src/runner.ts` streams upstream output to R2 without a size limit, type/signature validation or an explicit redirect policy. Its generic fallback marks a task failed if storage retries exhaust, even if the provider has already generated an output. The pose pipeline needs bounded and validated output copying, and a recoverable state for a successful provider result whose transfer failed.
5. **Input validation and data lifecycle:** `pose-request.server.ts` bounds request bytes and verifies declared types; `private-media.server.ts` checks signatures. Neither fully decodes images, enforces pixel/dimension limits, authenticates a caller, deletes expired files automatically, or provides a connected generation route. Provider-side processing and retention must be disclosed and checked for the chosen model channel.

## Independent verification run

`node --test sites/aiposegallery/scripts/private-media.test.mjs sites/aiposegallery/scripts/pose-request.test.mjs sites/aiposegallery/scripts/pose-prompt.test.mjs sites/aiposegallery/scripts/local-pose-api.test.mjs`: **11/11 passed**. The tests use mocks and a local server; they do not establish production ownership enforcement, distributed budget safety, provider privacy, or real-person generation quality.

## Suggested acceptance cases

- Two identities cannot read, delete, attach or recover each other's source images, outputs or jobs; denied responses are not publicly cached.
- A repeated or concurrently submitted client key creates at most one chargeable provider job; a response lost before job-ID delivery can be recovered without a new key or a blind retry.
- Requests that hit device, IP or site-wide budget limits cannot create paid upstream jobs, including concurrent requests. Unknown provider outcomes must not automatically free the budget for another paid attempt.
- Inputs and provider results reject invalid signatures, malformed images, excessive dimensions and byte sizes; results with bad types, redirects or expired URLs fail safely.
- Provider success followed by storage failure remains recoverable; upstream failure, explicit rejection, timeout and partial writes are reconciled without duplicate submission.
- Verify consent, provider/channel data handling, deletion and retention with an authorized test image before public access. Enable payment separately after merchant approval and verified checkout and refund flows.
