# Contributing to ai-slop-guard

Thanks for considering a contribution. This project catches low-quality PRs and issues through deterministic content analysis — no AI required for the core checks.

## Development setup

```bash
git clone https://github.com/Anti-Ai-Slop/ai-slop-guard.git
cd ai-slop-guard
npm install
npm test            # should pass before you start
```

## Commands

| Command | What it does |
|---------|-------------|
| `npm test` | Run all tests (vitest) |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run typecheck` | TypeScript strict check |
| `npm run lint` | ESLint |
| `npm run build` | Bundle to `dist/index.js` |

## Project structure

```
src/
├── index.ts                 # Entry point: event → config → pipeline → dispatch
├── types.ts                 # All type definitions
├── config/schema.ts         # Config resolution from action.yml inputs
├── analyzers/               # Content analyzers (each returns Signal[])
│   ├── pr-pipeline.ts       # Orchestrates PR analyzers in parallel
│   ├── pr-diff.ts           # Diff structure + quality checks
│   ├── pr-description.ts    # Description quality checks
│   ├── pr-commits.ts        # Commit message checks
│   ├── pr-metadata.ts       # Source branch, honeypot, reactions, language
│   ├── issue-pipeline.ts    # Orchestrates issue analyzers
│   ├── issue-stacktrace.ts  # Hallucination checks (file, function, line)
│   ├── issue-content.ts     # Bug report quality checks
│   └── duplicate-detector.ts
├── scoring/
│   ├── signals.ts           # Signal registry (32 signals)
│   ├── calculator.ts        # Score = Σ(score × confidence)
│   ├── thresholds.ts        # Min rules + confidence penalty
│   └── contributor.ts       # New contributor multiplier
├── actions/                 # GitHub API actions
│   ├── dispatcher.ts        # Routes verdict → label/comment/close
│   ├── comment.ts           # Educational comment builder
│   ├── label.ts             # Add/remove labels
│   ├── close.ts             # Close PR/issue
│   └── report.ts            # Set GitHub Action outputs
├── llm/                     # Optional semantic analysis
└── utils/                   # Patterns, language detection, text helpers
```

## Adding a new check

1. Define the signal in `src/scoring/signals.ts`
2. Implement the detection in the relevant analyzer under `src/analyzers/`
3. Add a suggestion in `src/actions/comment.ts` (the `SUGGESTIONS` map)
4. Write tests in `tests/unit/analyzers/`
5. Document in `docs/checks.md`
6. Run `npm test && npm run build` — both must pass

### Signal pattern

```typescript
import { SIGNALS } from '../scoring/signals';
import type { Signal } from '../types';

function checkSomething(ctx: PRContext, signals: Signal[]): void {
  // detection logic
  if (!triggered) return;

  const def = SIGNALS.YOUR_SIGNAL;
  signals.push({
    id: def.id,
    category: def.category,
    score: def.defaultScore,
    confidence: 0.8,           // 0.0–1.0
    detail: 'What was found',  // shown in the comment table
    evidence: 'short snippet', // optional
  });
}
```

### Design rules for checks

- **Zero config by default** — if you add an `action.yml` input, it must have a sensible default
- **Fail open** — if an API call fails, skip the check, don't block the pipeline
- **No false accusations** — the comment explains what was found, never says "AI-generated"
- **Deterministic** — same input, same output, no randomness

## Adding a new action.yml input

1. Add the input in `action.yml` with `required: false` and a `default`
2. Parse it in `src/config/schema.ts`
3. Add the field to `GuardConfig` in `src/types.ts`
4. Add the default to `createDefaultConfig()` in `tests/helpers.ts`
5. Use it in the relevant analyzer or action

## Code standards

- TypeScript strict mode — no `any`, no unchecked index access
- Use `core.info()` / `core.debug()` / `core.warning()` — never `console.log`
- Use `Result<T, E>` from neverthrow for config parsing
- Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`)
- Tests for every new signal and every new config option

## Pull request checklist

- [ ] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] New inputs have defaults (zero-config)
- [ ] Tests cover: happy path, edge case, feature disabled
- [ ] `docs/checks.md` updated if adding a signal
- [ ] PR description explains *why*, not just *what*

Note: this repo runs ai-slop-guard on itself. Your PR will be analyzed.
