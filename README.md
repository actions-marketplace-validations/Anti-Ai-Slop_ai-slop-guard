# ai-slop-guard

Catches junk PRs and issues before they waste your time.

Not anti-AI. Anti-slop. Good AI-assisted contributions pass through fine.
Lazy, unreviewed AI dumps get flagged.

[![CI](https://github.com/Anti-Ai-Slop/ai-slop-guard/actions/workflows/ci.yml/badge.svg)](https://github.com/Anti-Ai-Slop/ai-slop-guard/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What it does

Analyzes the **actual content** of pull requests and issues:

- **PR diffs** — flags cosmetic-only changes, dead code, unused imports, missing tests
- **PR descriptions** — detects fluff language, missing motivation, template violations
- **Commit messages** — catches generic "update"/"fix" messages, single-commit dumps
- **Issue stack traces** — validates file paths and line numbers against the real repo
- **Issue content** — flags missing reproduction steps, duplicate detection

Each check produces a signal with a score. Signals are summed into a slop score. Based on thresholds you set, the action can label, post an educational comment, or close.

No AI required. 27 deterministic checks. Optional LLM layer if you want it.

## Quick start

```yaml
name: Slop Guard
on:
  pull_request_target:
    types: [opened, reopened]
  issues:
    types: [opened]

permissions:
  contents: read
  issues: write
  pull-requests: write

jobs:
  guard:
    runs-on: ubuntu-latest
    steps:
      - uses: Anti-Ai-Slop/ai-slop-guard@v1
```

That's it. Default thresholds (warn at 6, close at 12) work for most projects.

## Configuration

| Input | Default | What it does |
|-------|---------|-------------|
| `slop-score-warn` | `6` | Score to trigger warning (label + comment) |
| `slop-score-close` | `12` | Score to trigger close |
| `on-warn` | `label,comment` | Actions on warning |
| `on-close` | `label,comment,close` | Actions on likely-slop |
| `exempt-users` | `""` | Usernames that bypass all checks |
| `exempt-labels` | `human-verified` | Labels that bypass all checks |
| `check-prs` | `true` | Analyze pull requests |
| `check-issues` | `true` | Analyze issues |

Full configuration reference: [docs/checks.md](docs/checks.md)

## Optional: LLM analysis

You can add an LLM-powered check that asks "does this PR add real value?" Bring your own model — we don't pick one for you.

```yaml
- uses: Anti-Ai-Slop/ai-slop-guard@v1
  with:
    semantic-analysis: true
    llm-provider: ollama          # or: anthropic, openai, openrouter, custom
    llm-model: your-model-here    # you choose — no default
    llm-api-key: ${{ secrets.YOUR_KEY }}  # not needed for local Ollama
```

Works with Ollama (local), Anthropic, OpenAI, OpenRouter, or any OpenAI-compatible endpoint (vLLM, LM Studio, Groq, Together, DeepSeek, etc.)

The LLM adds 1 check out of 28. The other 27 work without any AI.

## How scoring works

Each check returns a signal: `{ score: 0-5, confidence: 0.0-1.0 }`.

Total = sum of (score x confidence) across all signals.

- Score < 6 → **clean** — no action taken
- Score 6-11 → **suspicious** — label + educational comment
- Score >= 12 → **likely-slop** — label + comment + close

The educational comment explains exactly which checks failed and what the contributor can do to fix it. No accusations, no "AI-generated" language — just specific feedback.

## First week: warn-only mode

Start without auto-close to calibrate:

```yaml
- uses: Anti-Ai-Slop/ai-slop-guard@v1
  with:
    on-close: 'label,comment'   # no 'close' — just flag it
```

## Development

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

## License

MIT
