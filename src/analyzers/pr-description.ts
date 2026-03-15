import * as core from '@actions/core';
import type { Signal, PRContext } from '../types';
import { SIGNALS } from '../scoring/signals';
import {
  countFluffWords,
  hasAiOpener,
  hasMissingWhy,
  countSelfPraise,
} from '../utils/patterns';
import { countConsecutiveBullets, countEmojis } from '../utils/text-utils';

/**
 * Analyze a PR description for AI-slop language patterns.
 * @param ctx - PR analysis context
 * @returns array of detected signals
 */
export async function analyzePrDescription(
  ctx: PRContext,
): Promise<Signal[]> {
  const signals: Signal[] = [];
  const text = `${ctx.title}\n${ctx.body}`;

  if (!text.trim()) return signals;

  const checks: Array<() => Signal | null> = [
    () => checkFluffLanguage(text),
    () => checkMissingWhy(ctx.body),
    () => checkTemplateIgnored(ctx.body),
    () => checkOverExplained(ctx.body),
    () => checkEmojiAbuse(text),
    () => checkBulletVomit(ctx.body),
    () => checkSelfPraise(text),
  ];

  for (const check of checks) {
    try {
      const result = check();
      if (result) signals.push(result);
    } catch (err) {
      core.warning(`pr-description check failed: ${String(err)}`);
    }
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkFluffLanguage(text: string): Signal | null {
  const count = countFluffWords(text);
  const hasOpener = hasAiOpener(text);

  // Need at least 3 fluff words OR 2 fluff words + AI opener
  if (count < 3 && !(count >= 2 && hasOpener)) return null;

  // AI opener + fluff is a stronger signal
  const score = hasOpener
    ? SIGNALS.AI_FLUFF_LANGUAGE.defaultScore + 1
    : SIGNALS.AI_FLUFF_LANGUAGE.defaultScore;
  const confidence = Math.min(
    0.5 + count * 0.1 + (hasOpener ? 0.1 : 0),
    0.95,
  );

  return {
    id: SIGNALS.AI_FLUFF_LANGUAGE.id,
    category: SIGNALS.AI_FLUFF_LANGUAGE.category,
    score,
    confidence,
    detail: `${count} overused filler words detected${hasOpener ? ' with typical AI opener' : ''}.`,
    evidence: `${count} fluff words`,
  };
}

function checkMissingWhy(body: string): Signal | null {
  if (!body || body.length < 20) return null;
  if (!hasMissingWhy(body)) return null;

  return {
    id: SIGNALS.MISSING_WHY.id,
    category: SIGNALS.MISSING_WHY.category,
    score: SIGNALS.MISSING_WHY.defaultScore,
    confidence: 0.75,
    detail: 'Description explains what changed but not why.',
  };
}

function checkTemplateIgnored(body: string): Signal | null {
  // Detect PR template sections
  const templateHeaders =
    /^#{1,3}\s*(?:description|motivation|changes|testing|checklist|context)/gim;
  const headers = body.match(templateHeaders);

  if (!headers || headers.length < 2) return null;

  // Check if sections are empty (header followed by another header or end)
  const sections = body.split(/^#{1,3}\s+/m).filter(Boolean);
  const emptySections = sections.filter((s) => s.trim().length < 10);

  if (emptySections.length < 2) return null;

  return {
    id: SIGNALS.TEMPLATE_IGNORED.id,
    category: SIGNALS.TEMPLATE_IGNORED.category,
    score: SIGNALS.TEMPLATE_IGNORED.defaultScore,
    confidence: 0.85,
    detail: `PR template has ${emptySections.length} empty sections.`,
    evidence: `${emptySections.length}/${sections.length} sections empty`,
  };
}

function checkOverExplained(body: string): Signal | null {
  if (!body || body.length <= 800) return null;

  return {
    id: SIGNALS.OVER_EXPLAINED.id,
    category: SIGNALS.OVER_EXPLAINED.category,
    score: SIGNALS.OVER_EXPLAINED.defaultScore,
    confidence: 0.6,
    detail: `Description is ${body.length} characters (>${800} threshold).`,
  };
}

function checkEmojiAbuse(text: string): Signal | null {
  const count = countEmojis(text);
  if (count < 5) return null;

  return {
    id: SIGNALS.EMOJI_ABUSE.id,
    category: SIGNALS.EMOJI_ABUSE.category,
    score: SIGNALS.EMOJI_ABUSE.defaultScore,
    confidence: 0.8,
    detail: `${count} emoji found in the description.`,
  };
}

function checkBulletVomit(body: string): Signal | null {
  const maxBullets = countConsecutiveBullets(body);
  if (maxBullets < 8) return null;

  return {
    id: SIGNALS.BULLET_VOMIT.id,
    category: SIGNALS.BULLET_VOMIT.category,
    score: SIGNALS.BULLET_VOMIT.defaultScore,
    confidence: 0.8,
    detail: `${maxBullets} consecutive bullet points found.`,
  };
}

function checkSelfPraise(text: string): Signal | null {
  const count = countSelfPraise(text);
  if (count < 1) return null;

  return {
    id: SIGNALS.SELF_PRAISE.id,
    category: SIGNALS.SELF_PRAISE.category,
    score: SIGNALS.SELF_PRAISE.defaultScore,
    confidence: 0.8,
    detail: `${count} self-praising phrase(s) found.`,
  };
}
