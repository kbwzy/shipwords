type Status = 'accepted' | 'preparing' | 'quoted' | 'submitting' | 'submitted' | 'result_pending' | 'succeeded' | 'failed' | 'unknown';
const ALLOWED: Readonly<Record<Status, readonly Status[]>> = {
  accepted: ['preparing', 'failed'],
  preparing: ['quoted', 'failed'],
  quoted: ['submitting', 'failed'],
  submitting: ['submitted', 'unknown', 'failed'],
  unknown: ['submitted', 'failed'],
  submitted: ['result_pending', 'failed', 'unknown'],
  result_pending: ['succeeded'],
  succeeded: [],
  failed: [],
};

/** Each transition has a conditional write. Only a confirmed upstream rejection may fail a submitting or unknown request; transfer errors stay result_pending. */
export async function transitionGarmentRequest(db: D1Database, input: {
  id: string; from: Status; to: Status; nowMs: number;
  upstreamJobId?: string; outputKey?: string; errorCode?: string;
}): Promise<boolean> {
  if (!ALLOWED[input.from]?.includes(input.to) || !/^[0-9a-f-]{36}$/.test(input.id) || !Number.isSafeInteger(input.nowMs) || input.nowMs < 0) throw new Error('Invalid garment transition');
  if ((input.to === 'submitted') !== (input.upstreamJobId !== undefined) || (input.upstreamJobId !== undefined && !/^[A-Za-z0-9_-]{1,200}$/.test(input.upstreamJobId))) throw new Error('Upstream job ID required only for submitted');
  if ((input.to === 'succeeded') !== (input.outputKey !== undefined) || (input.outputKey !== undefined && !/^garment-media\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.outputKey))) throw new Error('Private output key required only for succeeded');
  if (input.errorCode !== undefined && !/^[A-Za-z0-9_-]{1,80}$/.test(input.errorCode)) throw new Error('Invalid error code');
  const row = await db.prepare(`UPDATE garment_requests SET status = ?, updated_at = ?,
    upstream_job_id = COALESCE(?, upstream_job_id), output_key = COALESCE(?, output_key), error_code = ?
    WHERE id = ? AND status = ? AND (upstream_job_id IS NULL OR ? IS NULL OR upstream_job_id = ?) RETURNING id`).bind(input.to, input.nowMs, input.upstreamJobId ?? null, input.outputKey ?? null, input.errorCode ?? null, input.id, input.from, input.upstreamJobId ?? null, input.upstreamJobId ?? null).first<{id:string}>();
  return !!row;
}
