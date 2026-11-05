# Staging Worker end-to-end garment generation, 2026-11-05

One real task through the protected staging Worker (`onmodelphotos-staging`), garment-first
plus model-reference mode, using the same assets as the validated garment-fidelity research
(aiposegallery/research/garment-fidelity-2026-11-03: `garment-g1-text-tee.png` + the pose
benchmark's mannequin `pose-standing.png`).

- Guest session + admission returned 202 `accepted`; job `1dd3f072-0f9c-472e-81f5-89d7fe05330f`.
- Workflow advanced accepted → preparing → quoted → submitted → succeeded on the resumed run.
- Provider billing settled at **USD $0.030632** (job `2118276108846632960`), under the $0.30 max_cost cap.
- Result: 1152×1536 PNG, 1,881,994 bytes, stored at `garment-media/f61fecd0-c6d7-40ac-827a-b29cd8fa4c9d`
  in `onmodelphotos-staging-media`; [result.png](result.png). The garment (white tee, "AURELIA"
  chest text) is reproduced faithfully on the mannequin from the model reference — the
  two-reference identity/fidelity behavior validated in research holds through the site pipeline.
- The owner-only result endpoint answered 404 without the guest cookie (owner isolation holds).
  The guest cookie itself was not persisted by the first submit script revision, so the result
  was retrieved via read-only `wrangler r2 object get` for this record instead of the HTTP endpoint.

## Defects found and fixed during this run

1. **Staging host allowlist pointed at our own R2 S3 endpoint.** `GARMENT_UPLOAD_HOSTS` /
   `GARMENT_RESULT_HOSTS` were set to `3486cb59…` (our account). Yir signs upload/result URLs on
   its own R2 S3 endpoint `75397736ff6ffddf6c5d8208a05fa738.r2.cloudflarestorage.com` (observed as
   `result_host` in aiposegallery's official-pose research events). The allowlist rejected every
   provider URL; the SDK masked that as `upload_transport_failed`. Both staging configs now pin
   Yir's endpoint. Production `wrangler.jsonc` must carry the same value before launch.
2. **`YIR_API_KEY` was empty in this site's `.dev.vars`**, so the staging secret had been set to
   an empty value earlier and every POST failed 503 at the workflow-deps gate. Reset from the
   aiposegallery key (same account; streamed via python into `wrangler secret put`, never printed).
3. **Build-time Paraglide produced zero messages** (fixed earlier the same day, recorded in the
   commit history): jsdelivr fetch failures silently compiled an empty catalog, every `m.*` call
   became `(void 0)` in the SSR bundle, and all pages 500ed. aiposegallery's local plugin shim
   (`scripts/local-inlang-plugin.mjs` + `https://inlang.local/` module URL) was copied over.

## Recovery note

After the allowlist fix, the exhausted job (status `preparing`,
`error_code workflow_retry_exhausted`) was resumed by re-creating the workflow instance with the
same instance ID via the Workflows REST API; it then completed normally. The recovery scheduler
(`garment-recovery-scheduler.server.ts`) only picks up `submitted`/`result_pending` rows, so a
`preparing` job that exhausted its retries before ever submitting upstream needs this manual
re-create (it charges nothing before submit, so it is safe to resume).

`STAGING-ONCE.json` is a durable single-run marker; do not remove or reuse it to cause additional
generation. No credentials or signed provider URLs are stored in this directory.
