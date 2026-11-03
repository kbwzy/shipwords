# Keyword validation — 2026-11-03

Gate 3 of the enterprise/SMB direction validation. Question: do business buyers search
for AI on-model photos, and who ranks?

Method: seoscout suggest (seeds below) → 119 keywords; seoscout search on the 97-keyword
ecommerce cluster (proxy 127.0.0.1:7890). Scored each keyword's SERP: count of AI-tool
competitors vs. giants/major media. No volume data (suggest-only mining; volumes are
proxy-level unreliable for this niche — treat as directional).

## Seeds

- `ai fashion model photos` → 22 keywords (many off-topic: "list of ai models" etc.)
- `ai clothing model generator`, `ai on-model photos for ecommerce`,
  `flat lay to model photo`, `ghost mannequin to model ai` → 97 keywords, near-zero noise

## Findings

1. **The market exists and is searchable.** 30+ on-target keywords return SERPs filled
   exclusively with dedicated AI fashion-model tools: modelia.ai, koozee.ai, uwear.ai,
   fashn.ai, botika.com, piccopilot.com, claid.ai, thenewblack.ai, on-model.com,
   fashiondiffusion.ai, snappyit.ai, photta.app… — a dozen+ funded competitors and a
   long tail of small sites ranking on head terms.

2. **No giant owns any SERP.** Zero appearances of marketplaces/agencies/major media in
   the top results of on-target keywords. `ghost mannequin ai model` is the only one with
   reference results (Gemini/Perplexity/Wikipedia). Competition is other startups, not
   incumbents — this is beatable by a focused site with better pages.

3. **Head terms are crowded; the long tail is thin.** `ai clothing model generator`,
   `best ai ...`, `... for clothing brand` all have 5–7 AI-tool competitors per SERP.
   The weakest SERPs observed: video variants (`ai fashion model video generator free`)
   and `ghost mannequin ai *` (4 AI tools, several low-quality app directories).
   Content-format gaps (guides, comparisons) appear unoccupied.

4. **Intent is commercial, not enterprise-gated.** Buyers search "for clothing brand",
   "free", "online free", "female ai fashion model" — SMB owner language, consistent
   with the SMB credit-pack strategy, not procurement-speak.

## Risks

- Volume unknown. Suggest reflects demand shape, not size. Next proof is click
  data (GSC after launch) or a paid probe — do not build on assumption of volume.
- "free" intent dominates several head terms; monetization depends on guest-quota
  → paid credits conversion (the existing shipwords rails).
- Video variants rank but our pipeline is image-only.

## Verdict

Gate 3: **conditional pass**. Real, searchable, commercially-motivated demand; no
incumbent lock-in; but head-term crowding by a dozen startups and unverified volume
mean entry should be on long-tail + content gaps, not head terms. Gate 2 (garment
fidelity) is the remaining technical go/no-go.
