import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { garmentLedger } from './garment-billing.server.ts';
import { createGarmentWorkflowDependencies, runGarmentWorkflow } from './garment-workflow.server.ts';

type GarmentWorkflowEnv = { DB: D1Database; GARMENT_MEDIA: R2Bucket; YIR_API_KEY: string; GARMENT_RESULT_HOSTS: string; GARMENT_UPLOAD_HOSTS: string };

/** Keep actionable non-sensitive error classes while never recording provider URLs or payloads. */
export function safeGarmentWorkflowError(error:unknown):string {
  const message=error instanceof Error?error.message:'';
  if (/^(?:upload_transport_failed|upload_failed:\d{3}|file_response_invalid|file_processing_failed|file_expired|file_wait_timeout|file_id_invalid|upload_source_invalid|upload_plan_invalid|quote_response_invalid|Garment input unavailable or mismatched|Garment quote unavailable or over budget|Garment provider hosts not configured|Yir not configured|Invalid garment upload URL|Invalid result URL|Invalid result response|Invalid result type|Invalid result signature or dimensions|Result too large)$/.test(message))return message;
  if (/^Yir request failed \(\d{3}\)$/.test(message))return message;
  if (/^Garment preparation phase: (?:input|(?:photo|garment):(?:upload_transport_failed|upload_failed:\d{3}|file_response_invalid|file_processing_failed|file_expired|file_wait_timeout|file_id_invalid|upload_source_invalid|upload_plan_invalid|idempotency_key_invalid|file_count_invalid|unknown_field|file_name_invalid|file_media_type_invalid|file_size_invalid|Invalid garment upload URL|Invalid garment reference|Yir request failed \(\d{3}\)|unexpected))$/.test(message))return message;
  return 'unexpected';
}

/** Export this class from the site's Worker entry and bind it before enabling the route. */
export class GarmentWorkflow extends WorkflowEntrypoint<GarmentWorkflowEnv, { jobId: string }> {
  override async run(event: Readonly<WorkflowEvent<{ jobId: string }>>, step: WorkflowStep) {
    const deps = createGarmentWorkflowDependencies(this.env, undefined, undefined, garmentLedger(this.env.DB).refund);
    return runGarmentWorkflow(deps, event.payload.jobId, {
      do: (name, fn) => step.do(name, { retries: { limit: 5, delay: '10 seconds', backoff: 'exponential' } }, async () => {
        try { return await fn(); } catch (error) { throw new Error(`Garment workflow step unavailable: ${safeGarmentWorkflowError(error)}`); }
      }),
      sleep: (name, duration) => step.sleep(name, duration),
    });
  }
}
