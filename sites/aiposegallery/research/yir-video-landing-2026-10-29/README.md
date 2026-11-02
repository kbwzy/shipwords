# Yir homepage video test — 2026-10-29

Result: unavailable. A single direct Yir video submission was rejected with HTTP 402 `YIR_INSUFFICIENT_BALANCE` (wallet balance insufficient). No job ID or generated video was returned. No second submission was made. There is no job billing record or `settled` result to report; a final charge cannot be verified from a job that was not created.

- Model: `google/veo-3.1-fast-generate-001`, text-to-video; 4 seconds, 720p, 16:9, audio disabled, one output.
- Live pre-submit quote: **$0.256 USD**, supply available. The quote is an estimate, not a charge. See `quote.json` for the provider response and expiry.
- Maximum job cost in submitted request: **$0.60 USD**. The quote endpoint says it ignores this field; it was included in the generation request.
- `request.json` contains the full prompt and parameters; `submission.json` records the same request and its idempotency key. These contain no API credential.
- Prompt specifies a stationary wide shot, one complete adult figure, generous floor and headroom, both feet always visible, modest sage clothing, gentle pose changes, and a warm beige studio.
- No file was generated or downloaded, so technical media inspection and frame-by-frame visual review were impossible. Full-body framing, foot visibility, motion quality and homepage suitability are unverified.
- This was a direct provider call only; no site code, production deployment, site payment flow, or site billing was changed or tested.
