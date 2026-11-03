import { garmentPrompt } from './garment-prompt.server.ts';
import { GARMENT_TRIAL_LIMITS } from './garment-limits.server.ts';

const MODEL = 'openai/gpt-image-2.5-sunburst';
const PARAMETERS = Object.freeze({ resolution: '1K', aspect_ratio: '3:4', quality: 'medium', n: 1 });
// Confine real-person inputs to the model developer's official API channel.
const ROUTING = Object.freeze({ only: ['official'], fallback: false, fidelity: 'original' });

/** Only server-created ready Yir file IDs are accepted, garment-then-model order to match the prompt. */
export function buildGarmentQuoteRequest(input: { garmentFileId?: string; modelFileId?: string; instructions: string }) {
  const files = [input.garmentFileId, input.modelFileId].filter((value): value is string => value !== undefined);
  if (files.some((value) => !/^file_[A-Za-z0-9_-]{1,160}$/.test(value)) || input.instructions.length > 2000 || (!input.garmentFileId && !input.instructions.trim())) throw new Error('Invalid garment provider input');
  const prompt = garmentPrompt({ hasModel: !!input.modelFileId, hasGarment: !!input.garmentFileId, instructions: input.instructions });
  return {
    model: MODEL,
    input: files.length ? { type: 'image' as const, prompt, references: files.map((file_id) => ({ role: 'reference_image' as const, file_id })) } : { type: 'text' as const, prompt },
    parameters: PARAMETERS,
    routing: ROUTING,
  };
}

/** Quote currency, expiry and both estimates must fit the server's $0.15 admission threshold. */
export function garmentQuoteAllowed(quote: { currency?: string; supply?: { available?: boolean }; primary?: { amount?: string | null }; expected_amount?: string; expires_at?: number }, nowMs = Date.now()): boolean {
  function withinThreshold(amount: unknown): boolean {
    if (typeof amount !== 'string' || amount.length > 100 || !/^\d+(?:\.\d+)?$/.test(amount)) return false;
    const [whole, fraction = ''] = amount.split('.');
    return BigInt(whole!) === 0n && (fraction + '00').slice(0, 2) <= '15' && ((fraction + '00').slice(0, 2) !== '15' || !/[1-9]/.test(fraction.slice(2)));
  }
  return quote.currency === 'USD' && quote.supply?.available === true && withinThreshold(quote.primary?.amount) && (quote.expected_amount === undefined || withinThreshold(quote.expected_amount)) && Number.isSafeInteger(quote.expires_at) && quote.expires_at! * 1000 > nowMs;
}

/** Submit exactly the request that was quoted with an upstream hard cost cap. */
export function buildGarmentSubmitRequest(quoteRequest: ReturnType<typeof buildGarmentQuoteRequest>) {
  return { ...quoteRequest, max_cost: GARMENT_TRIAL_LIMITS.maxCostUsd };
}
