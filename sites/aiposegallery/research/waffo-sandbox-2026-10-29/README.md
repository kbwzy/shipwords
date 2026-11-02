# Waffo sandbox readiness, 2026-10-29

The AI Pose Gallery store's dashboard states that production is not enabled and business verification is required. The three pre-existing production products are inactive and describe the superseded pose-sheet product; they are not suitable evidence for the current image-editing offer.

A clearly labelled **test-only** one-time product was created with the test API key for USD 1.00. The test GraphQL API confirms it is active in test mode and has no production version. One authenticated test checkout session was created; no card details were entered and no payment was submitted. Checkout URLs and tokens are not stored here. The one-shot scripts persist their idempotency keys and stop on ambiguity; inspect sandbox state before retrying.

The store currently has one test-mode HTTP webhook subscribed to `order.completed`, `refund.succeeded`, and `refund.failed`; it targets the production domain. Do not submit a test transaction until a separate test callback and isolated database are configured, because test events would otherwise reach the production application. Checkout session creation does not validate webhook signatures, order attribution, credit grants, replay protection or refunds. Those require a separately isolated sandbox end-to-end test.

The production product catalog remains empty in site configuration. Before live charging, confirm the final prices and entitlements, approve the actual image-editing business with Waffo, create/verify appropriate products and production credentials, and pass checkout, webhook and refund tests.
