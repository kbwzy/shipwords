import { createDb } from '@shipwords/core/db/client';
import { InsufficientCreditsError, refundSpend, spendCredits } from '@shipwords/core/credits/ledger';

export type PoseLedger = {
  /** Charge exactly one credit for one accepted generation. */
  spend(userId: string, requestKey: string, taskId: string): Promise<'ok' | 'insufficient' | 'unavailable'>;
  /** Idempotent refund for a confirmed pre-submit failure; errors must be retried. */
  refund(requestKey: string, taskId: string): Promise<void>;
};

/** Wraps the core credit ledger for pose generation. */
export function poseLedger(db: D1Database): PoseLedger {
  const coreDb = createDb(db);
  return {
    async spend(userId, requestKey, taskId) {
      try {
        // Older deployments used a client-controlled global key. Never charge again
        // when its association with this task cannot be established.
        const legacy = await db.prepare('SELECT id FROM credit_ledger WHERE idem_key = ?').bind(`spend:pose:${requestKey}`).first();
        if (legacy) return 'unavailable';
        await spendCredits(coreDb, {
          userId,
          amount: 1,
          idemKey: `spend:pose:task:${taskId}`,
          ref: 'pose-image',
        });
        return 'ok';
      } catch (error) {
        if (error instanceof InsufficientCreditsError) return 'insufficient';
        return 'unavailable';
      }
    },
    async refund(requestKey, taskId) {
      const taskSpend = await db.prepare('SELECT id FROM credit_ledger WHERE idem_key = ?').bind(`spend:pose:task:${taskId}`).first();
      if (!taskSpend) {
        const legacy = await db.prepare('SELECT id FROM credit_ledger WHERE idem_key = ?').bind(`spend:pose:${requestKey}`).first();
        if (legacy) throw new Error('Legacy pose charge requires manual reconciliation');
        return;
      }
      await refundSpend(coreDb, {
        spendIdemKey: `spend:pose:task:${taskId}`,
        idemKey: `refund:pose:task:${taskId}`,
      });
    },
  };
}
