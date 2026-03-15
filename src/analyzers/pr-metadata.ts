import * as core from '@actions/core';
import type { Signal, PRContext } from '../types';
import { SIGNALS } from '../scoring/signals';

/**
 * Analyze PR metadata: source branch, honeypot terms, negative reactions,
 * and language mismatch.
 */
export async function analyzePrMetadata(ctx: PRContext): Promise<Signal[]> {
  const signals: Signal[] = [];

  checkSourceBranch(ctx, signals);
  checkHoneypot(ctx, signals);
  await checkNegativeReactions(ctx, signals);
  await checkLanguageMismatch(ctx, signals);

  return signals;
}

// ---------------------------------------------------------------------------
// Source Branch Check
// ---------------------------------------------------------------------------

function checkSourceBranch(ctx: PRContext, signals: Signal[]): void {
  const blocked = ctx.config.blockedSourceBranches;
  if (blocked.length === 0) return;

  const head = ctx.headBranch.toLowerCase();
  const match = blocked.find((b) => b.toLowerCase() === head);

  if (match) {
    const def = SIGNALS.BLOCKED_SOURCE_BRANCH;
    signals.push({
      id: def.id,
      category: def.category,
      score: def.defaultScore,
      confidence: 0.9,
      detail: `PR was opened from "${ctx.headBranch}" which is a blocked source branch.`,
      evidence: ctx.headBranch,
    });
  }
}

// ---------------------------------------------------------------------------
// Honeypot Detection
// ---------------------------------------------------------------------------

function checkHoneypot(ctx: PRContext, signals: Signal[]): void {
  const terms = ctx.config.honeypotTerms;
  if (terms.length === 0) return;

  const bodyLower = ctx.body.toLowerCase();
  const found = terms.filter((t) => bodyLower.includes(t.toLowerCase()));

  if (found.length > 0) {
    const def = SIGNALS.HONEYPOT_TRIGGERED;
    signals.push({
      id: def.id,
      category: def.category,
      score: def.defaultScore,
      confidence: 1.0,
      detail: `PR body contains honeypot term(s): ${found.join(', ')}`,
      evidence: found.join(', '),
    });
  }
}

// ---------------------------------------------------------------------------
// Negative Reactions Check
// ---------------------------------------------------------------------------

async function checkNegativeReactions(
  ctx: PRContext,
  signals: Signal[],
): Promise<void> {
  const max = ctx.config.maxNegativeReactions;
  if (max <= 0) return;

  try {
    const { data: pr } = await ctx.octokit.rest.pulls.get({
      owner: ctx.owner,
      repo: ctx.repo,
      pull_number: ctx.number,
    });

    const reactions = (pr as Record<string, unknown>)['reactions'] as
      | Record<string, number>
      | undefined;
    if (!reactions) return;

    const thumbsDown = reactions['-1'] ?? 0;
    const confused = reactions['confused'] ?? 0;
    const total = thumbsDown + confused;

    if (total > max) {
      const def = SIGNALS.COMMUNITY_FLAGGED;
      signals.push({
        id: def.id,
        category: def.category,
        score: def.defaultScore,
        confidence: 0.8,
        detail: `PR has ${total} negative reactions (${thumbsDown} thumbs down, ${confused} confused). Threshold: ${max}.`,
        evidence: `thumbs_down=${thumbsDown}, confused=${confused}`,
      });
    }
  } catch (err) {
    core.debug(`Negative reactions check failed: ${String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Language Mismatch Detection
// ---------------------------------------------------------------------------

/** Extensions considered config/docs — always ignored for language mismatch */
const CONFIG_EXTENSIONS = new Set([
  '.json', '.yml', '.yaml', '.md', '.txt', '.toml', '.cfg',
  '.env', '.gitignore', '.lock', '.ini', '.editorconfig',
  '.prettierrc', '.eslintrc', '.babelrc',
]);

/** Map file extensions to GitHub-style language names */
const EXT_TO_LANGUAGE: Readonly<Record<string, string>> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.py': 'Python',
  '.rb': 'Ruby',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.go': 'Go',
  '.rs': 'Rust',
  '.cs': 'C#',
  '.cpp': 'C++', '.cc': 'C++', '.cxx': 'C++', '.hpp': 'C++',
  '.c': 'C', '.h': 'C',
  '.swift': 'Swift',
  '.php': 'PHP',
  '.scala': 'Scala',
  '.dart': 'Dart',
  '.lua': 'Lua',
  '.r': 'R', '.R': 'R',
  '.ex': 'Elixir', '.exs': 'Elixir',
  '.erl': 'Erlang',
  '.zig': 'Zig',
  '.nim': 'Nim',
  '.sh': 'Shell', '.bash': 'Shell', '.zsh': 'Shell',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
};

function getExtension(filePath: string): string {
  const dot = filePath.lastIndexOf('.');
  return dot === -1 ? '' : filePath.slice(dot).toLowerCase();
}

function isConfigExtension(ext: string): boolean {
  return CONFIG_EXTENSIONS.has(ext);
}

async function checkLanguageMismatch(
  ctx: PRContext,
  signals: Signal[],
): Promise<void> {
  if (!ctx.config.checkLanguageMismatch) return;

  // Only look at added/modified files
  const addedFiles = ctx.diff.files.filter(
    (f) => f.status === 'added' || f.status === 'modified',
  );
  if (addedFiles.length === 0) return;

  // Classify added files by language, ignoring config/doc files
  const langCounts = new Map<string, number>();
  let codedFileCount = 0;

  for (const file of addedFiles) {
    const ext = getExtension(file.newPath);
    if (!ext || isConfigExtension(ext)) continue;

    const lang = EXT_TO_LANGUAGE[ext];
    if (!lang) continue;

    codedFileCount++;
    langCounts.set(lang, (langCounts.get(lang) ?? 0) + 1);
  }

  if (codedFileCount === 0) return;

  // Fetch repo languages from GitHub API
  let repoLanguages: Record<string, number>;
  try {
    const { data } = await ctx.octokit.rest.repos.listLanguages({
      owner: ctx.owner,
      repo: ctx.repo,
    });
    repoLanguages = data;
  } catch (err) {
    core.debug(`Language mismatch check failed: ${String(err)}`);
    return; // fail open
  }

  const totalBytes = Object.values(repoLanguages).reduce((a, b) => a + b, 0);
  if (totalBytes === 0) return;

  // Check if >50% of added code files are in a language <5% of repo
  for (const [lang, count] of langCounts) {
    const proportion = count / codedFileCount;
    if (proportion <= 0.5) continue;

    const repoBytes = repoLanguages[lang] ?? 0;
    const repoPercent = repoBytes / totalBytes;

    if (repoPercent < 0.05) {
      const def = SIGNALS.LANGUAGE_MISMATCH;
      signals.push({
        id: def.id,
        category: def.category,
        score: def.defaultScore,
        confidence: 0.7,
        detail: `${Math.round(proportion * 100)}% of added files are ${lang}, which represents only ${Math.round(repoPercent * 100)}% of this repository.`,
        evidence: `${count}/${codedFileCount} files are ${lang}`,
      });
      break; // one signal is enough
    }
  }
}
