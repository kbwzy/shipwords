/** References must be uploaded and passed to Yir in the same person-then-pose order. */
export function posePrompt({ hasPhoto, hasPose, instructions }: { hasPhoto: boolean; hasPose: boolean; instructions: string }): string {
  let role: string;
  if (hasPhoto && hasPose) role = 'The first reference is the person photo: preserve that person’s identity, face, and clothing. The second reference is the pose reference: use only its body pose and composition, not its person, identity, face, or clothing.';
  else if (hasPhoto) role = 'The only reference is the person photo: preserve that person’s identity, face, and clothing while following the requested pose.';
  else if (hasPose) role = 'The only reference is a pose reference: use its body pose and composition only. Create a new person; do not copy the reference person’s identity, face, or clothing.';
  else role = 'Create a new person based on the requested pose.';
  return `${role}\nCreate one portrait-oriented image. User instructions: ${instructions.trim() || 'Use the reference pose.'}`;
}

// Card networks treat two-person intimate generation as deepfake risk. The
// product is intentionally single-person, so reject multi-person instructions
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

export function isUnsupportedMultiPersonPrompt(prompt: string): boolean {
  if (SINGLE_PERSON_EXCEPTIONS.some((pattern) => pattern.test(prompt))) return false;
  return MULTI_PERSON_PATTERNS.some((pattern) => pattern.test(prompt));
}
