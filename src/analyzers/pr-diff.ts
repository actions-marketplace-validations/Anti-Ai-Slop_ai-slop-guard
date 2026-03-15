import * as core from '@actions/core';
import type { Signal, PRContext, DiffFile } from '../types';
import { SIGNALS } from '../scoring/signals';
import {
  checkTestFreeFeature,
  checkInconsistentStyle,
  checkDuplicateCode,
  checkHighCommentRatio,
} from './pr-diff-quality';

/**
 * Analyze a PR diff for structural and quality issues.
 * @param ctx - PR analysis context with parsed diff
 * @returns array of detected signals
 */
export async function analyzePrDiff(ctx: PRContext): Promise<Signal[]> {
  const signals: Signal[] = [];

  const checks: Array<() => Signal | null> = [
    () => checkCosmeticOnly(ctx.diff.files),
    () => checkMassiveUnfocused(ctx),
    () => checkDeadCodeInjection(ctx.diff.files),
    () => checkImportTsunami(ctx.diff.files),
    () => checkSuspiciousDependency(ctx.diff.files),
    () => checkConfigChurn(ctx.diff.files),
    () => checkTestFreeFeature(ctx.diff.files),
    () => checkInconsistentStyle(ctx.diff.files),
    () => checkDuplicateCode(ctx.diff.files),
    () => checkHighCommentRatio(ctx.diff.files),
  ];

  for (const check of checks) {
    try {
      const result = check();
      if (result) signals.push(result);
    } catch (err) {
      core.warning(`pr-diff check failed: ${String(err)}`);
    }
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Structural checks (quality checks in pr-diff-quality.ts)
// ---------------------------------------------------------------------------

function checkCosmeticOnly(files: readonly DiffFile[]): Signal | null {
  const nonBinaryFiles = files.filter((f) => !f.isBinary);
  if (nonBinaryFiles.length === 0) return null;

  const allCosmetic = nonBinaryFiles.every((f) => {
    const addedContent = f.additions.map((l) => l.content.trim());
    const deletedContent = f.deletions.map((l) => l.content.trim());
    if (addedContent.length !== deletedContent.length) return false;
    return addedContent.every((line, i) => line === deletedContent[i]);
  });

  if (!allCosmetic) return null;

  return {
    id: SIGNALS.COSMETIC_ONLY_DIFF.id,
    category: SIGNALS.COSMETIC_ONLY_DIFF.category,
    score: SIGNALS.COSMETIC_ONLY_DIFF.defaultScore,
    confidence: 0.9,
    detail: 'All changes are whitespace or formatting only.',
    evidence: `${files.length} files changed, all cosmetic`,
  };
}

function checkMassiveUnfocused(ctx: PRContext): Signal | null {
  const { diff } = ctx;
  const totalChanges = diff.totalAdditions + diff.totalDeletions;
  if (totalChanges <= 500 || diff.totalFilesChanged <= 10) return null;

  const dirs = new Set(
    diff.files.map((f) => {
      const path = f.newPath || f.oldPath;
      const lastSlash = path.lastIndexOf('/');
      return lastSlash > 0 ? path.slice(0, lastSlash) : '.';
    }),
  );

  // Many dirs = clearly unfocused; few dirs but many files = still suspicious
  const confidence = dirs.size > 3 ? 0.85 : 0.7;

  return {
    id: SIGNALS.MASSIVE_UNFOCUSED_DIFF.id,
    category: SIGNALS.MASSIVE_UNFOCUSED_DIFF.category,
    score: SIGNALS.MASSIVE_UNFOCUSED_DIFF.defaultScore,
    confidence,
    detail: `${totalChanges} lines across ${diff.totalFilesChanged} files in ${dirs.size} dirs.`,
    evidence: `+${diff.totalAdditions}/-${diff.totalDeletions}`,
  };
}

function checkDeadCodeInjection(files: readonly DiffFile[]): Signal | null {
  const funcDefPattern =
    /(?:function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*\{)/;

  const definedFuncs: string[] = [];
  const allAddedContent: string[] = [];

  for (const file of files) {
    for (const line of file.additions) {
      allAddedContent.push(line.content);
      const match = line.content.match(funcDefPattern);
      const name = match?.[1] ?? match?.[2] ?? match?.[3];
      if (name && name.length > 2) definedFuncs.push(name);
    }
  }

  const joined = allAddedContent.join('\n');
  const unused = definedFuncs.filter((name) => {
    const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, 'g');
    const matches = joined.match(regex);
    return matches !== null && matches.length <= 1;
  });

  if (unused.length < 2) return null;

  return {
    id: SIGNALS.DEAD_CODE_INJECTION.id,
    category: SIGNALS.DEAD_CODE_INJECTION.category,
    score: SIGNALS.DEAD_CODE_INJECTION.defaultScore,
    confidence: 0.7,
    detail: `${unused.length} functions defined but never called.`,
    evidence: unused.slice(0, 3).join(', '),
  };
}

function checkImportTsunami(files: readonly DiffFile[]): Signal | null {
  const importPattern =
    /(?:import\s+.*\s+from\s+['"](.+)['"]|require\(\s*['"](.+)['"]\s*\))/;

  let addedImports = 0;
  const importNames: string[] = [];

  for (const file of files) {
    if (file.isConfig || file.isTest) continue;
    for (const line of file.additions) {
      const match = line.content.match(importPattern);
      if (match) {
        addedImports++;
        importNames.push(match[1] ?? match[2] ?? '');
      }
    }
  }

  const nonImportAdditions = files.reduce((sum, f) => {
    if (f.isConfig || f.isTest) return sum;
    return sum + f.additions.filter((l) => !importPattern.test(l.content)).length;
  }, 0);

  if (addedImports < 5 || nonImportAdditions >= addedImports) return null;

  return {
    id: SIGNALS.IMPORT_TSUNAMI.id,
    category: SIGNALS.IMPORT_TSUNAMI.category,
    score: SIGNALS.IMPORT_TSUNAMI.defaultScore,
    confidence: 0.75,
    detail: `${addedImports} imports added, only ${nonImportAdditions} code lines.`,
    evidence: importNames.slice(0, 3).join(', '),
  };
}

function checkSuspiciousDependency(files: readonly DiffFile[]): Signal | null {
  const pkgFile = files.find(
    (f) => f.newPath === 'package.json' || f.oldPath === 'package.json',
  );
  if (!pkgFile) return null;

  const depPattern = /"([^"]+)":\s*"[^"]+"/;
  const addedDeps: string[] = [];

  for (const line of pkgFile.additions) {
    const match = line.content.match(depPattern);
    if (match?.[1] && !match[1].startsWith('@types/')) {
      addedDeps.push(match[1]);
    }
  }
  if (addedDeps.length === 0) return null;

  const otherFiles = files.filter((f) => f.newPath !== 'package.json' && !f.isConfig);
  const allCode = otherFiles.flatMap((f) => f.additions.map((l) => l.content)).join('\n');
  const unusedDeps = addedDeps.filter((dep) => !allCode.includes(dep.replace(/^@[^/]+\//, '')));

  if (unusedDeps.length === 0) return null;

  return {
    id: SIGNALS.SUSPICIOUS_DEPENDENCY.id,
    category: SIGNALS.SUSPICIOUS_DEPENDENCY.category,
    score: SIGNALS.SUSPICIOUS_DEPENDENCY.defaultScore,
    confidence: 0.7,
    detail: `Unused deps: ${unusedDeps.join(', ')}`,
    evidence: unusedDeps.slice(0, 3).join(', '),
  };
}

function checkConfigChurn(files: readonly DiffFile[]): Signal | null {
  const configFiles = files.filter((f) => f.isConfig);
  const nonConfigFiles = files.filter((f) => !f.isConfig && !f.isTest);

  if (configFiles.length === 0 || nonConfigFiles.length > 0) return null;

  return {
    id: SIGNALS.CONFIG_CHURN.id,
    category: SIGNALS.CONFIG_CHURN.category,
    score: SIGNALS.CONFIG_CHURN.defaultScore,
    confidence: 0.7,
    detail: 'Only config files changed without functional code changes.',
    evidence: configFiles.map((f) => f.newPath || f.oldPath).join(', '),
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
