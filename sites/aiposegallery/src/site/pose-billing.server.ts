import { createDb } from '@shipwords/core/db/client';
import { InsufficientCreditsError, refundSpend, spendCredits } from '@shipwords/core/credits/ledger';

export type PoseLedger = {
  /** Charge exactly one credit for one accepted generation. */
  spend(userId: string, requestKey: string): Promise<'ok' | 'insufficient' | 'unavailable'>;
  /** Best-effort refund for a confirmed failure; no-ops when the spend does not exist. */
  refund(requestKey: string): Promise<void>;
};

/** Wraps the core credit ledger for pose generation. */
export function poseLedger(db: D1Database): PoseLedger {
  const coreDb = createDb(db);
  return {
    async spend(userId, requestKey) {
      try {
        await spendCredits(coreDb, {
          userId,
          amount: 1,
          idemKey: `spend:pose:${requestKey}`,
          ref: 'pose-image',
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
          spendIdemKey: `spend:pose:${requestKey}`,
          idemKey: `refund:pose:${requestKey}`,
        });
      } catch {
        // Best effort: the spend may not exist, or the user already spent the refunded credit.
      }
    },
  };
}
