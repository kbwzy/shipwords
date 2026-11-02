# Yir image test — 2026-10-29

This is a direct provider test, not a site generation or billing acceptance test.
The public model catalog remains empty.

- Model: `google/nano-banana-pro`, text-to-image, 1K, 1:1, one output.
- Contract schema: `v1`, catalog version `c4fb9e365ec446ec926a04c815402a4a54cd8d2c60e3f5cdac3028960a5ec94a`.
- Quote: $0.020; job budget cap: $0.300; final settled charge: $0.020.
- Result: `pose-sheet.jpg`, JPEG, 1024 × 1024, 433,623 bytes; SHA-256 `4dabcaad1c708af04e953995ae42e5b0ac6ed5e854f3ea042d26988048921731`.
- Visual review: six full-body mannequin panels; the first two standing poses are similar. One sample cannot establish the planned 8/10 usable-output threshold.
- The request was submitted directly to Yir, not through site authentication, moderation, credits, Workflow, R2, or Waffo. Those paths remain unverified. The design's PNG output claim also needs implementation or revision: this provider returned JPEG.
