# Official-channel pose edit test, 2026-10-29

One direct Yir job used two project-generated AI images: `../pose-edit-2026-10-29/person-source.png` as the person, and `../pose-edit-2026-10-29/benchmark-3/pose-seated.png` as the pose. No real person's image was used. It used `openai/gpt-image-2.5-sunburst`, `1K`, `3:4`, `medium`, one image, and routing restricted to the official channel with fallback disabled and `fidelity: original`. The input was uploaded through Yir Files and submitted by private file ID.

- Quote: expected USD 0.0367; submission cap USD 0.30.
- Outcome: succeeded; Yir billing status settled, USD 0.024297.
- Output: [result.png](result.png). A visually identifiable front-facing seated pose, hands on knees and feet visible; dark hair, green top and rust trousers are broadly similar to the source. The source face and front of the clothes are partly hidden, so identity and front garment detail cannot be strictly verified.
- This direct provider test is not a production site workflow, payment test, privacy audit, or evidence of accuracy on real users. One image cannot establish a success rate.

`run-once.mjs` creates a durable one-shot marker and idempotency record before calling the provider; do not remove those files or rerun it to bypass duplicate-charge protection. The records contain no API key or signed result URL. Further work should inspect provider state before retrying any request whose outcome is uncertain.
