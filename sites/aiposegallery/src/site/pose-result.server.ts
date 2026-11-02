import { imageType, validImageDimensions } from './private-media.server.ts';

const MAX_RESULT_BYTES = 20 * 1024 * 1024;
type ResultImageType = 'image/png' | 'image/jpeg' | 'image/webp';

/** allowedHosts comes from trusted server configuration, not user input or provider response. */
export async function readPoseResult(input: {
  url: string; declaredType: string; allowedHosts: readonly string[]; fetcher?: typeof fetch;
}): Promise<{ bytes: Uint8Array<ArrayBuffer>; mediaType: ResultImageType }> {
  let url: URL;
  try { url = new URL(input.url); } catch { throw new Error('Invalid result URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !input.allowedHosts.includes(url.hostname)) throw new Error('Invalid result URL');
  const response = await (input.fetcher ?? fetch)(url, { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
  const declaredLength = response.headers.get('content-length');
  if (!response.ok || !response.body || (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_RESULT_BYTES))) throw new Error('Invalid result response');
  const mediaType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (mediaType !== input.declaredType || !['image/png', 'image/jpeg', 'image/webp'].includes(mediaType ?? '')) throw new Error('Invalid result type');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESULT_BYTES) { await reader.cancel(); throw new Error('Result too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const detected = imageType(bytes);
  if (!detected || detected !== mediaType || !validImageDimensions(bytes, detected)) throw new Error('Invalid result signature or dimensions');
  return { bytes, mediaType: detected };
}
