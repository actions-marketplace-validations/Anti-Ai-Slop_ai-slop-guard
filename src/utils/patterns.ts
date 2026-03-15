// ---------------------------------------------------------------------------
// Centralized regex patterns for detecting AI-generated slop
// ---------------------------------------------------------------------------

/**
 * Words that LLMs overuse 5-10x compared to human-written text.
 * Each pattern uses word boundaries to avoid partial matches.
 */
export const FLUFF_WORDS: readonly RegExp[] = [
  /\bcomprehensive\b/i,
  /\brobust\b/i,
  /\bstreamline[ds]?\b/i,
  /\bleverag(?:e[ds]?|ing)\b/i,
  /\benhance(?:ment|s|d)?\b/i,
  /\beleva(?:te[ds]?|ting)\b/i,
  /\butiliz(?:e[ds]?|ation|ing)\b/i,
  /\bseamless(?:ly)?\b/i,
  /\bholistic(?:ally)?\b/i,
  /\bcutting[- ]edge\b/i,
  /\bstate[- ]of[- ]the[- ]art\b/i,
  /\bindustry[- ]best[- ]practice\b/i,
  /\bempower(?:s|ing|ed)?\b/i,
  /\bfoster(?:s|ing|ed)?\b/i,
  /\bsynerg(?:y|ies|istic)\b/i,
  /\bparadigm\b/i,
  /\becosystem\b/i,
  /\bdelv(?:e[ds]?|ing)\b/i,
  /\bpivotal\b/i,
  /\bparamount\b/i,
  /\bfurthermore\b/i,
  /\bmoreover\b/i,
  /\badditionally\b/i,
  /\bconsequently\b/i,
  /\bindispensable\b/i,
];

/**
 * Typical AI-generated PR/commit opening phrases.
 */
export const AI_OPENER_PATTERN =
  /^(?:This (?:PR|pull request|change|commit|patch)) (?:adds?|implements?|introduces?|enhances?|improves?|updates?|refactors?|creates?|streamlines?|leverages?|optimizes?|elevates?)\b/im;

/**
 * Hedging language often found in AI-generated text.
 */
export const HEDGING_PHRASES: readonly RegExp[] = [
  /\bit'?s worth noting\b/i,
  /\bmight want to consider\b/i,
  /\bcould potentially\b/i,
  /\bas an added benefit\b/i,
  /\bit should be noted\b/i,
  /\bit bears mentioning\b/i,
];

/**
 * Self-praise patterns in descriptions.
 */
export const SELF_PRAISE_PATTERNS: readonly RegExp[] = [
  /\belegant solutions?\b/i,
  /\bclean implementations?\b/i,
  /\bmodern approach(?:es)?\b/i,
  /\befficient design\b/i,
  /\bwell[- ]structured\b/i,
  /\bmaintainable architecture\b/i,
  /\bbest[- ]in[- ]class\b/i,
  /\bproduction[- ]ready\b/i,
  /\bhighly (?:scalable|performant|optimized)\b/i,
];

/**
 * Generic commit messages that lack specifics.
 */
export const GENERIC_COMMIT_PATTERN =
  /^(?:update|fix|improve|refactor|enhance|change|add|remove|clean ?up|misc|wip)(?:\s|$)/i;

/**
 * Pattern to detect consecutive bullet points (8+).
 */
export const BULLET_VOMIT_PATTERN = /(?:^[ \t]*[-*][ \t]+.+\n){8,}/m;

/**
 * Unicode emoji pattern for counting emoji usage.
 */
export const EMOJI_PATTERN =
  // eslint-disable-next-line no-misleading-character-class
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu;

/**
 * Patterns that indicate reproduction steps in an issue body.
 */
export const REPRODUCTION_PATTERN =
  /\b(?:steps? to reproduce|how to reproduce|reproduction|repro steps)\b/i;

/**
 * Template section headers in PR/issue bodies.
 */
export const TEMPLATE_SECTION_PATTERN =
  /^#{1,3}\s*(?:description|bug|expected|actual|steps|environment|version|context|motivation|changes|testing)/im;

/**
 * Count how many fluff words appear in the text.
 * @param text - text to analyze
 * @returns number of fluff word matches
 */
export function countFluffWords(text: string): number {
  let count = 0;
  for (const pattern of FLUFF_WORDS) {
    const matches = text.match(new RegExp(pattern.source, 'gi'));
    if (matches) count += matches.length;
  }
  return count;
}

/**
 * Check if the text starts with a typical AI opener.
 */
export function hasAiOpener(text: string): boolean {
  return AI_OPENER_PATTERN.test(text);
}

/**
 * Count hedging phrases in text.
 */
export function countHedgingPhrases(text: string): number {
  let count = 0;
  for (const pattern of HEDGING_PHRASES) {
    if (pattern.test(text)) count++;
  }
  return count;
}

/**
 * Count self-praise patterns in text.
 */
export function countSelfPraise(text: string): number {
  let count = 0;
  for (const pattern of SELF_PRAISE_PATTERNS) {
    if (pattern.test(text)) count++;
  }
  return count;
}

/**
 * Check if text has a "what" but no "why" explanation.
 */
export function hasMissingWhy(text: string): boolean {
  const hasWhat =
    /\b(?:This (?:PR|pull request|change|commit|patch)|(?:I|We) (?:added|updated|fixed|changed|removed|implemented))\b/i.test(
      text,
    );
  const hasWhy =
    /\b(?:because|since|due to|to (?:fix|resolve|address|prevent)|fixes? #\d+|closes? #\d+|in order to|so that)\b/i.test(
      text,
    );
  return hasWhat && !hasWhy;
}

/**
 * Formal/bureaucratic phrases typical of AI-generated issues.
 */
export const FORMAL_PHRASES: readonly RegExp[] = [
  /\bDear (?:\w+ )?(?:Maintainers?|Developers?|Team|Sir|Madam)/i,
  /\bBest regards\b/i,
  /\bKind regards\b/i,
  /\bSincerely\b/i,
  /\bI would (?:like to|strongly recommend)\b/i,
  /\bit is imperative\b/i,
  /\bwarrants? (?:immediate|urgent)\b/i,
  /\butmost (?:urgency|importance)\b/i,
  /\besteemed\b/i,
  /\bremediation\b/i,
  /\bpertains? to\b/i,
  /\bwith respect to\b/i,
  /\bin accordance with\b/i,
  /\bI have (?:identified|discovered|observed)\b/i,
  /\bsecurity posture\b/i,
  /\bprompt (?:response|attention|resolution)\b/i,
  /\bmalicious actors?\b/i,
  /\bunauthorized access\b/i,
  /\barchitectural concern\b/i,
  /\bapplication ecosystem\b/i,
];

/**
 * Count formal/bureaucratic phrases in text.
 * @param text - text to analyze
 * @returns number of formal phrase matches
 */
export function countFormalPhrases(text: string): number {
  let count = 0;
  for (const pattern of FORMAL_PHRASES) {
    if (pattern.test(text)) count++;
  }
  return count;
}

/**
 * Check if a commit message is generic (lacks specifics).
 */
export function isGenericCommitMessage(message: string): boolean {
  return GENERIC_COMMIT_PATTERN.test(message.trim());
}
