# Image generation verification, 2026-10-29/30

Two tests used only the site's AI-generated source and pose images, with a $0.30 maximum upstream cost per task. They do not establish identity fidelity for real people.

- The existing localhost service returned a result successfully; [local result](result.png). Its cost was not independently reconciled in this record.
- An isolated staging Worker used a dedicated D1, private R2 and Workflow to submit a single task. After fixing Cloudflare's unsupported `redirect: 'error'` setting, the same task was resumed from `preparing` and reached `succeeded`. The provider's billing record reported USD $0.024282 settled. The owner-only result endpoint returned HTTP 200, `image/png`, `private, no-store`, 2,170,445 bytes; [staging result](staging-result.png).
- The free production image test was deployed on 2026-10-30. An end-to-end browser test with the same AI-generated inputs successfully generated, displayed and downloaded [a production result](production-result.png); provider billing reported USD $0.024222 settled. The production workflow recovery schedule is active every 10 minutes. This does not establish broad real-person quality or payment readiness.
- The staging API is protected by a private token and is not the public product. Its cron was removed to make room for the production recovery schedule. The Waffo payment path remains closed pending sandbox and merchant approval.

`RUN-ONCE.json` and `STAGING-ONCE.json` are durable single-run markers; do not remove or reuse them to cause additional generation. If outcome is uncertain, inspect the existing task before retrying. Never store API credentials or signed provider URLs in this directory.
