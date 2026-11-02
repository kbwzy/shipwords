# Atomic initial payment settlement

`grantCredits` accepts optional `initialRevoke` for a refund or dispute already present on the first payment snapshot. The grant, initial revocation, allocations, account debt, payment counters and order status commit in one D1 batch under their respective idempotency keys. Only net credits repay existing debt or become available. The billing caller checks that the payment refund/dispute snapshot is unchanged within the batch and retries with a fresh snapshot on conflict. Existing calls without this option retain their prior behavior.

The Waffo provider keeps billing fail-closed in production unless
`WAFFO_ENVIRONMENT=prod` and `WAFFO_BILLING_ENABLED=true` are both set. The three
one-time packs (Starter/Studio/Pro) are published on Waffo; the production
webhook (`e02b5be5-2ee9-4544-8c73-f81e920bc8b1`) is created. Pose generation
spends one credit per accepted task for signed-in users (`spend:pose:<key>`)
and refunds it on a confirmed failure (`refund:pose:<key>`). Billing and ledger
changes still require independent review before enabling live checkout.
