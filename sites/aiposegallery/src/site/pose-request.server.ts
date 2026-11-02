/** Request validation for a future same-origin image-generation endpoint. */
import { isUnsupportedMultiPersonPrompt } from './pose-prompt.server.ts';

const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_BODY = 2 * MAX_IMAGE + 64 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class PoseRequestError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

async function boundedBody(request: Request): Promise<Uint8Array<ArrayBuffer>> {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY)) throw new PoseRequestError(413, 'Request too large');
  if (!request.body) throw new PoseRequestError(400, 'Missing request body');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY) { await reader.cancel(); throw new PoseRequestError(413, 'Request too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

export async function parsePoseRequest(request: Request, allowedOrigin: string) {
  if (request.method !== 'POST' || request.headers.get('origin') !== allowedOrigin) throw new PoseRequestError(403, 'Forbidden');
  const contentType = request.headers.get('content-type') ?? '';
  if (!/^multipart\/form-data\s*;/i.test(contentType)) throw new PoseRequestError(415, 'Expected multipart form');
  const body = await boundedBody(request);
  let form: FormData;
  try { form = await new Response(body, { headers: { 'content-type': contentType } }).formData(); }
  catch { throw new PoseRequestError(400, 'Invalid multipart form'); }
  for (const name of form.keys()) {
    if (!['photo', 'pose', 'prompt', 'consent'].includes(name) || form.getAll(name).length !== 1) throw new PoseRequestError(400, 'Invalid form field');
  }
  if (form.get('consent') !== 'yes') throw new PoseRequestError(400, 'Consent required');
  const prompt = form.get('prompt') ?? '';
  if (typeof prompt !== 'string' || prompt.length > 2000) throw new PoseRequestError(400, 'Invalid prompt');
  const files: Partial<Record<'photo' | 'pose', File>> = {};
  for (const name of ['photo', 'pose'] as const) {
    const value = form.get(name);
    if (value === null) continue;
    if (typeof value === 'string' || value.size === 0 || value.size > MAX_IMAGE || !TYPES.has(value.type)) throw new PoseRequestError(400, 'Invalid image');
    files[name] = value;
  }
  if (!files.pose && !prompt.trim()) throw new PoseRequestError(400, 'Choose a pose or describe the change');
  if (isUnsupportedMultiPersonPrompt(prompt)) throw new PoseRequestError(400, 'This generator creates one person per request. Rewrite the instructions for a single person.');
  // Call putPrivateImage on both files to check signatures before accepting them.
  return { files, prompt: prompt.trim() };
}
