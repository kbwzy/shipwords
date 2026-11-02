# Pose edit example, 2026-10-29

This is one manual edit made using the built-in image generation tool. Both inputs are AI-generated images created for this project and were downloaded from the local gallery. It is not a Yir API call, a user-photo test, a website generation job or a payment test.

- `person-source.png`: adult fashion figure, green top and terracotta trousers, standing and looking over the shoulder.
- `pose-reference.png`: separate figure sitting upright on a chair with hands on knees.
- `edit-result.png`: the tool was asked to keep the person, hair, clothing and shoes from the first image, and use the seated body position and chair of the second image. No words or watermark requested.
- Manual visual assessment: the result adopts the seated pose and retains broadly similar hair, facial appearance, clothing colors and trousers. The top's neckline changes and facial details are not identical. Hands and feet are visible, though small inconsistencies are possible. The standing-to-front view requires reconstructing details hidden in the source.
- This single sample cannot establish identity preservation, pose accuracy, success rate, cost, latency or performance on real user photos. No direct per-job cost or provider model identifier was returned by this tool.

Prompt: “Edit the first image for a pose-change product quality test. Keep the person from image 1 identifiable: same facial features, dark wavy hair, skin tone, sage long-sleeved fitted top, terracotta wide-leg trousers and beige heels. Change only her body pose to match image 2: sit upright facing forward on a simple wooden chair, hands resting on knees, feet on the floor. Use image 2 only as a guide for pose and chair; do not copy its person or clothing. Full body and feet visible with space around them, warm neutral studio background, photographic realism. No text, no watermark.”

## Yir local tests, 2026-10-29

The Yir wallet returned $10.024002 available before these tests. The current `openai/gpt-image-2.5-sunburst` contract supports at least two `reference_image` inputs; an image request using `1K`, `3:4`, `medium`, `n=1` quoted $0.0085. Each job was capped at $0.30; actual settled charges were $0.0085 per job.

- `yir-result.png`: one direct SDK test using `person-source.png` and `pose-reference.png`. The person was seated in the target pose, with similar hair and clothing colors; the top neckline and facial details changed.
- `local-workspace-result.png`: one browser-to-local-service test using the same two images. It was returned by the local workbench and downloaded. The output follows the seated pose and broadly retains hair and clothing colors, but alters the top neckline and facial details.
- `local-no-photo-result.png`: one browser-to-local-service test using only the “Sitting upright” gallery pose. The output depicts a different person in a seated pose and was returned and downloaded.

These three jobs settled at $0.0085 each, $0.0255 total. All source images were generated for this project, not uploaded by a user. This is not a 50-case benchmark, a production deployment, a Waffo payment test, or proof of real-person identity preservation. The local service stores results in process memory temporarily and uploads inputs to Yir only after the user opts in; Yir's retention terms have not been independently verified here.
