import { createAndUploadFile, createYirClient, type Quote, type YirClient, type YirTransport } from '@yir-ai/sdk/server';
import { validImageDimensions } from './private-media.server.ts';
import { buildGarmentQuoteRequest, buildGarmentSubmitRequest, garmentQuoteAllowed } from './garment-provider.server.ts';

/** A direct transport deliberately does not retry submits. Never log keys, bodies, or provider URLs. */
export function createGarmentYirClient(apiKey: string, fetcher: typeof fetch = fetch): YirClient {
  if (!apiKey) throw new Error('Yir not configured');
  const transport: YirTransport = async <ResponseType>({method, path, headers, body, signal, holdMs}: Parameters<YirTransport>[0]) => {
    if (!path.startsWith('/v1/')) throw new Error('Invalid Yir path');
    const response = await fetcher(`https://gateway.yir.ai${path}`, {
      method, headers: { Authorization: `Bearer ${apiKey}`, ...(body === undefined ? {} : {'Content-Type':'application/json'}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body), redirect:'manual', signal:signal ?? AbortSignal.timeout(45_000 + (holdMs ?? 0)),
    });
    if (!response.ok) throw new Error(`Yir request failed (${response.status})`);
    return await response.json() as ResponseType;
  };
  return createYirClient(transport);
}

/** Input bytes must come from owner-checked private storage. Upload keys are fixed per task and role. */
export async function uploadGarmentReference(client: YirClient, input: {
  taskId: string; role: 'model' | 'garment'; bytes: Uint8Array<ArrayBuffer>; mediaType: string; fetcher?: typeof fetch;
}) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.taskId) || input.bytes.length === 0 || input.bytes.length > 10 * 1024 * 1024 || !validImageDimensions(input.bytes, input.mediaType)) throw new Error('Invalid garment reference');
  const extension = input.mediaType === 'image/jpeg' ? 'jpg' : input.mediaType.split('/')[1];
  const file = await createAndUploadFile(client, {name:`${input.role}.${extension}`,media_type:input.mediaType,size:input.bytes.length}, new Blob([input.bytes],{type:input.mediaType}), `garment-${input.taskId}-${input.role}`, input.fetcher ? {fetch:input.fetcher} : undefined);
  if (file.status !== 'ready' || !/^file_[A-Za-z0-9_-]{1,160}$/.test(file.id)) throw new Error('Garment reference is not ready');
  return file.id;
}

/** Caller must persist the exact request and mark the task submitting before calling submitGarment. */
export async function quoteGarment(client: YirClient, input: {garmentFileId?: string; modelFileId?: string; instructions: string}) {
  const request = buildGarmentQuoteRequest(input);
  const quote = await client.quoteImage(request);
  if (!garmentQuoteAllowed(quote)) throw new Error('Garment quote unavailable or over budget');
  return {request, quote};
}

/** A submit error is always uncertain here; the caller must preserve and reconcile the same task/key. */
export async function submitGarment(client: YirClient, input: {taskId:string; request:ReturnType<typeof buildGarmentQuoteRequest>; quote:Quote}) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.taskId)) throw new Error('Invalid task ID');
  if (!garmentQuoteAllowed(input.quote)) throw new Error('Garment quote unavailable or over budget');
  try {
    const job = await client.submitImage(buildGarmentSubmitRequest(input.request), `garment-${input.taskId}`);
    if (!job.id || !/^[A-Za-z0-9_-]{1,200}$/.test(job.id)) throw new Error('Missing job ID');
    return { upstreamJobId:job.id };
  } catch { throw new Error('Garment submission outcome unknown'); }
}
