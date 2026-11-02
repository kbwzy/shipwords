# Yir video test, 2026-10-29

This was a direct Yir provider test, not an end-to-end site generation or payment test.

- Model: `google/veo-3.1-fast-generate-001`, text-to-video, 4 seconds, 720p, 16:9, no audio requested.
- Quote: $0.256; total spending cap: $0.60; settled charge: $0.255998.
- Output: `yoga-test.mp4`, H.264, 1280 x 720, 24 fps, 4 seconds, 599,271 bytes; SHA-256 `dd5d45a7d4a84d5ed22d16665a97995479e54ce16ee154d8d5af3405aa977ea0`.
- Visual review: the subject's supporting foot is cut off in the middle of the clip, despite the request to show the full body. This test does not meet the intended pose reference standard.
- The provider result was downloaded locally. Authentication, moderation, credits, Workflow, R2, Waffo and failure recovery were not tested by this direct call.
