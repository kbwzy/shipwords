import { imageSize } from 'image-size';

/** Private media primitives for the future garment-edit pipeline. No public route uses these yet. */
const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const MAX_RESULT_BYTES = 20 * 1024 * 1024;
const MEDIA_KEY = /^garment-media\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type ImageType = 'image/png' | 'image/jpeg' | 'image/webp';
type MediaKind = 'input' | 'result';
const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } });

export function imageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

/** Header and dimension validation is not a substitute for full image decoding or moderation. */
export function validImageDimensions(bytes: Uint8Array, declaredType: string): boolean {
  if (imageType(bytes) !== declaredType) return false;
  try {
    const image = imageSize(bytes);
    return image.type === (declaredType === 'image/jpeg' ? 'jpg' : declaredType.slice(6)) && Number.isSafeInteger(image.width) && Number.isSafeInteger(image.height) && image.width! > 0 && image.height! > 0 && image.width! <= 8192 && image.height! <= 8192 && image.width! * image.height! <= 25_000_000;
  } catch { return false; }
}

/** The caller must derive ownerId from an authenticated server session, never from the request body. */
export async function putPrivateImage(bucket: R2Bucket, ownerId: string, kind: MediaKind, bytes: Uint8Array, declaredType: string): Promise<string> {
  if (!ownerId || !['input', 'result'].includes(kind)) throw new Error('Invalid media owner or kind');
  if (bytes.length === 0 || bytes.length > (kind === 'input' ? MAX_INPUT_BYTES : MAX_RESULT_BYTES) || !validImageDimensions(bytes, declaredType)) throw new Error('Invalid image');
  const key = `garment-media/${crypto.randomUUID()}`;
  await bucket.put(key, bytes, { httpMetadata: { contentType: declaredType }, customMetadata: { ownerId, kind } });
  return key;
}

/** Missing and other users' media produce the same response. Never cache personal images. */
export async function getPrivateImage(bucket: R2Bucket, ownerId: string, key: string): Promise<Response> {
  if (!ownerId || !MEDIA_KEY.test(key)) return notFound();
  const object = await bucket.get(key);
  if (!object || object.customMetadata?.ownerId !== ownerId || !['input', 'result'].includes(object.customMetadata?.kind ?? '')) return notFound();
  const type = object.httpMetadata?.contentType;
  if (!type || !['image/png', 'image/jpeg', 'image/webp'].includes(type)) return notFound();
  return new Response(object.body, { headers: { 'Content-Type': type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' } });
}

export async function deletePrivateImage(bucket: R2Bucket, ownerId: string, key: string): Promise<boolean> {
  if (!ownerId || !MEDIA_KEY.test(key)) return false;
  const object = await bucket.head(key);
  if (!object || object.customMetadata?.ownerId !== ownerId || !['input', 'result'].includes(object.customMetadata?.kind ?? '')) return false;
  await bucket.delete(key);
  return true;
}
