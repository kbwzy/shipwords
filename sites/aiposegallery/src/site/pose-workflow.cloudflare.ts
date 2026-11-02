import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { poseLedger } from './pose-billing.server.ts';
import { createPoseWorkflowDependencies, runPoseWorkflow } from './pose-workflow.server.ts';

type PoseWorkflowEnv = { DB: D1Database; POSE_MEDIA: R2Bucket; YIR_API_KEY: string; POSE_RESULT_HOSTS: string; POSE_UPLOAD_HOSTS: string };

/** Keep actionable non-sensitive error classes while never recording provider URLs or payloads. */
export function safePoseWorkflowError(error:unknown):string {
  const message=error instanceof Error?error.message:'';
  if (/^(?:upload_transport_failed|upload_failed:\d{3}|file_response_invalid|file_processing_failed|file_expired|file_wait_timeout|file_id_invalid|upload_source_invalid|upload_plan_invalid|quote_response_invalid|Pose input unavailable or mismatched|Pose quote unavailable or over budget|Pose provider hosts not configured|Yir not configured|Invalid pose upload URL|Invalid result URL|Invalid result response|Invalid result type|Invalid result signature or dimensions|Result too large)$/.test(message))return message;
  if (/^Yir request failed \(\d{3}\)$/.test(message))return message;
  if (/^Pose preparation phase: (?:input|(?:photo|pose):(?:upload_transport_failed|upload_failed:\d{3}|file_response_invalid|file_processing_failed|file_expired|file_wait_timeout|file_id_invalid|upload_source_invalid|upload_plan_invalid|idempotency_key_invalid|file_count_invalid|unknown_field|file_name_invalid|file_media_type_invalid|file_size_invalid|Invalid pose upload URL|Invalid pose reference|Yir request failed \(\d{3}\)|unexpected))$/.test(message))return message;
  return 'unexpected';
}

/** Export this class from the site's Worker entry and bind it before enabling the route. */
export class PoseWorkflow extends WorkflowEntrypoint<PoseWorkflowEnv, { jobId: string }> {
  override async run(event: Readonly<WorkflowEvent<{ jobId: string }>>, step: WorkflowStep) {
    const deps = createPoseWorkflowDependencies(this.env, undefined, undefined, poseLedger(this.env.DB).refund);
    return runPoseWorkflow(deps, event.payload.jobId, {
      do: (name, fn) => step.do(name, { retries: { limit: 5, delay: '10 seconds', backoff: 'exponential' } }, async () => {
        try { return await fn(); } catch (error) { throw new Error(`Pose workflow step unavailable: ${safePoseWorkflowError(error)}`); }
      }),
      sleep: (name, duration) => step.sleep(name, duration),
    });
  }
}
