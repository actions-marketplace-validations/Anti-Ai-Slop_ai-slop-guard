# Contributing to ai-slop-guard

## Development Setup

```bash
git clone https://github.com/Anti-Ai-Slop/ai-slop-guard.git
cd ai-slop-guard
npm install
```

## Commands

```bash
npm run typecheck   # TypeScript strict mode check
npm run lint        # ESLint
npm test            # Run all tests
npm run test:watch  # Watch mode
npm run build       # Bundle to dist/index.js
```

## Adding a New Check

1. Define the signal in `src/scoring/signals.ts`
2. Add the signal ID to the appropriate category
3. Implement the check function in the relevant analyzer (`src/analyzers/`)
4. Add tests in `tests/unit/analyzers/`
5. Add a fixture in `tests/fixtures/`
6. Document in `docs/checks.md`

### Check Function Pattern

```typescript
function checkYourSignal(ctx: PRContext): Signal | null {
  // Your detection logic
  if (!detected) return null;

  return {
    id: SIGNALS.YOUR_SIGNAL.id,
    category: SIGNALS.YOUR_SIGNAL.category,
    score: SIGNALS.YOUR_SIGNAL.defaultScore,
    confidence: 0.8, // 0.0-1.0
    detail: 'Human-readable explanation',
    evidence: 'Short evidence snippet',
  };
}
```

## Code Standards

- TypeScript strict mode, no `any`
- Max 40 lines per function
- Max 250 lines per file
- Every public function has JSDoc
- Every public function has a test
- Use `Result<T, E>` from neverthrow instead of throwing
- Conventional Commits for commit messages

## Pull Request Guidelines

- Fill out all template sections
- Include tests for new behavior
- Explain *why*, not just *what*
- Keep PRs focused — one concern per PR
