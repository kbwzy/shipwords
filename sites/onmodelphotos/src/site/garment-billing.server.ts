import { createDb } from '@shipwords/core/db/client';
import { InsufficientCreditsError, refundSpend, spendCredits } from '@shipwords/core/credits/ledger';

export type GarmentLedger = {
  /** Charge exactly one credit for one accepted generation. */
  spend(userId: string, requestKey: string): Promise<'ok' | 'insufficient' | 'unavailable'>;
  /** Best-effort refund for a confirmed failure; no-ops when the spend does not exist. */
  refund(requestKey: string): Promise<void>;
};

/** Wraps the core credit ledger for garment generation. */
export function garmentLedger(db: D1Database): GarmentLedger {
  const coreDb = createDb(db);
  return {
    async spend(userId, requestKey) {
      try {
        await spendCredits(coreDb, {
          userId,
          amount: 1,
          idemKey: `spend:garment:${requestKey}`,
          ref: 'garment-image',
        });
        return 'ok';
      } catch (error) {
        if (error instanceof InsufficientCreditsError) return 'insufficient';
        return 'unavailable';
      }
    },
    async refund(requestKey) {
      try {
        await refundSpend(coreDb, {
          spendIdemKey: `spend:garment:${requestKey}`,
          idemKey: `refund:garment:${requestKey}`,
        });
      } catch {
        // Best effort: the spend may not exist, or the user already spent the refunded credit.
      }
    },
  };
}
