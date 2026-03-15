import { describe, it, expect } from 'vitest';
import { buildSemanticPrompt, parseSemanticResponse } from '@/llm/prompts';

describe('buildSemanticPrompt', () => {
  it('returns LLMRequest with jsonMode true', () => {
    const request = buildSemanticPrompt('+ const x = 1;', 'Add feature', 'This adds x');
    expect(request.jsonMode).toBe(true);
    expect(request.systemPrompt).toContain('senior code reviewer');
    expect(request.userPrompt).toContain('Add feature');
    expect(request.userPrompt).toContain('const x = 1');
  });

  it('truncates long diffs', () => {
    const longDiff = 'x'.repeat(10000);
    const request = buildSemanticPrompt(longDiff, 'Title', 'Body');
    expect(request.userPrompt.length).toBeLessThan(10000);
  });
});

describe('parseSemanticResponse', () => {
  it('parses valid JSON response', () => {
    const raw = '{"adds_functionality": true, "fixes_bug": false, "is_cosmetic_only": false, "confidence": 0.9, "reason": "adds real feature"}';
    const result = parseSemanticResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.adds_functionality).toBe(true);
    expect(result!.confidence).toBe(0.9);
  });

  it('extracts JSON from surrounding text', () => {
    const raw = 'Here is my analysis:\n{"adds_functionality": false, "fixes_bug": false, "is_cosmetic_only": true, "confidence": 0.8, "reason": "cosmetic"}\nDone.';
    const result = parseSemanticResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.is_cosmetic_only).toBe(true);
  });

  it('returns null for invalid JSON', () => {
    expect(parseSemanticResponse('not json')).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    expect(parseSemanticResponse('{"fixes_bug": true}')).toBeNull();
  });

  it('clamps confidence to 0-1 range', () => {
    const raw = '{"adds_functionality": true, "confidence": 1.5}';
    const result = parseSemanticResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe(1);
  });
});
