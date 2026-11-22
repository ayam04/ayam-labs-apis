/** Hard limits enforced on every request. Never trust the client for these. */
export const MAX_TEXT_CHARS = 200_000;
/** JSON body ceiling. Anything above this is rejected before analysis. */
export const MAX_BODY_TEXT_CHARS = 500_000;
export const MAX_FINDINGS_OUTPUT = 2000;
export const MAX_PROFANITY_OUTPUT = 100;
export const MAX_FINDING_VALUE_CHARS = 256;
