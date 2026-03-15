# ai-slop-guard vs anti-slop

These tools are **complementary**, not competitors.

## Approach Comparison

| Aspect | ai-slop-guard | anti-slop |
|--------|--------------|-----------|
| **What it analyzes** | Content (diffs, descriptions, stack traces) | Metadata (account age, profile, behavior) |
| **Detection method** | Pattern matching + heuristics | Behavioral signals |
| **Runs as** | GitHub Action | GitHub App |
| **External calls** | None (runs entirely on the runner) | GitHub API for user metadata |
| **LLM usage** | Optional (local Ollama only) | None |
| **False positive handling** | Label exemption (`human-verified`) | Allowlist |

## When to Use Which

**Use ai-slop-guard when:**
- You want to analyze the actual *content* of contributions
- You need to run without external API calls
- You want educational feedback on PR/issue quality
- You want to detect hallucinated stack traces

**Use anti-slop when:**
- You want to flag suspicious *accounts* (new accounts, no prior contributions)
- You want behavioral pattern detection
- You need a managed GitHub App experience

## Using Both Together

```yaml
name: Quality Guard
on:
  pull_request_target:
    types: [opened, reopened]
  issues:
    types: [opened]

jobs:
  content-check:
    runs-on: ubuntu-latest
    steps:
      - uses: Anti-Ai-Slop/ai-slop-guard@v1
        with:
          slop-score-warn: '6'
          slop-score-close: '12'

  # anti-slop runs as a GitHub App — no workflow config needed
```

The two tools cover different angles. A contribution might pass ai-slop-guard (good content) but fail anti-slop (suspicious account), or vice versa.
