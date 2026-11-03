/**
 * Two modes map to the two reference slots. `garment+model` is the product's core:
 * reproduce the garment product photo faithfully on a posed model. `garment` alone
 * generates a model around the product. `model` alone restyles what the model wears
 * toward the instructions while keeping identity — the e-commerce persona case.
 */
export type GarmentReferenceMode = 'garment+model' | 'garment' | 'model';

/** References must be uploaded and passed to Yir in the same garment-then-model order. */
export function garmentPrompt({ hasGarment, hasModel, instructions }: { hasGarment: boolean; hasModel: boolean; instructions: string }): string {
  const mode: GarmentReferenceMode = hasGarment && hasModel ? 'garment+model' : hasGarment ? 'garment' : 'model';
  let role: string;
  if (mode === 'garment+model') role = 'The first reference is a garment product photo: reproduce this exact garment faithfully — its shape, color, print pattern, logo, text, and fabric — worn by a model. Do not alter, restyle, or embellish the garment. The second reference is a model reference: use only its body type, skin tone, and hair as the person wearing the garment; do not copy its clothing.';
  else if (mode === 'garment') role = 'The only reference is a garment product photo: reproduce this exact garment faithfully — its shape, color, print pattern, logo, text, and fabric — worn by a new model. Do not alter, restyle, or embellish the garment.';
  else role = 'The only reference is a model photo: preserve that person’s identity, face, and body while dressing them per the requested instructions.';
  return `${role}\nCreate one portrait-oriented e-commerce photo of the model on a clean studio background. User instructions: ${instructions.trim() || 'Show the garment on the model in a natural standing pose.'}`;
}

// Card networks treat intimate generation as deepfake risk, and this product is a
// clothing catalog tool: reject swimwear/lingerie and multi-person instructions
// before anything reaches an upstream provider.
const MULTI_PERSON_PATTERNS: readonly RegExp[] = [
  /\bcouple\b/i,
  /\bpartners?\b/i,
  /\bwith a partner\b/i,
  /\btwo (?:fully clothed )?(?:people|adults|women|men|persons?|models|figures)\b/i,
  /\ba pair of (?:people|adults|women|men|models|figures)\b/i,
  /\beach other\b/i,
  /\bboth of them\b/i,
  /\bembrace(?:s|ing|d)?\b/i,
  /\bhug(?:ging|s)? each other\b/i,
  /\bcuddl(?:e|ing|es|ed)\b/i,
  /\bmaking out\b/i,
  /\bkiss(?:es|ing)? (?:each other|her|him)\b/i,
  /\bromantic\b/i,
  /\bhold(?:ing)? hands with\b/i,
  /\bhand in hand\b/i,
  /\b(?:stand|sit|walk|danc|lie|sleep|lay) together\b/i,
];
const SINGLE_PERSON_EXCEPTIONS: readonly RegExp[] = [
  /\bblow(?:ing)? a kiss\b/i,
];
// Swimwear/underwear requests are out of product scope (card-network risk surface),
// not a moral judgment about the words themselves.
const INTIMATE_GARMENT_PATTERNS: readonly RegExp[] = [
  /\b(?:bikini|swimsuit|swimwear|bathing suit|lingerie|underwear|underwear set|bras?|panties|boxers?|briefs|thong|lingerie set|sleepwear|nightwear|pajama(?:s)?(?: set)?)\b/i,
  /\b(?:topless|nude|naked|shirtless)\b/i,
];

export function isUnsupportedMultiPersonPrompt(prompt: string): boolean {
  if (SINGLE_PERSON_EXCEPTIONS.some((pattern) => pattern.test(prompt))) return false;
  return MULTI_PERSON_PATTERNS.some((pattern) => pattern.test(prompt));
}

export function isOutOfScopeGarmentPrompt(prompt: string): boolean {
  return INTIMATE_GARMENT_PATTERNS.some((pattern) => pattern.test(prompt));
}
