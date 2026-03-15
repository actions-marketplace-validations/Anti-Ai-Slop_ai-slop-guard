# Tuning Guide

## First Week: Warn-Only

Start without auto-close to calibrate thresholds for your project:

```yaml
- uses: Anti-Ai-Slop/ai-slop-guard@v1
  with:
    on-warn: 'label,comment'
    on-close: 'label,comment'  # notice: no 'close'
```

Monitor the signals for a week. Check for false positives.

## Adjusting Thresholds

Default thresholds:
- **Warn** at score `6` (e.g., 3 weak signals or 1 strong + 1 weak)
- **Close** at score `12` (e.g., multiple strong signals)

For conservative projects (low tolerance):
```yaml
slop-score-warn: '4'
slop-score-close: '8'
```

For permissive projects (high tolerance):
```yaml
slop-score-warn: '10'
slop-score-close: '20'
```

## Exempting Users

If certain users (e.g., core team) should bypass checks:

```yaml
exempt-users: 'maintainer1,maintainer2,bot-account'
```

## Exempting with Labels

Any PR/issue with an exempt label is skipped:

```yaml
exempt-labels: 'human-verified,skip-slop-check'
```

## Understanding the Score

```
score = Σ(signal.score × signal.confidence)
```

Each signal contributes its weight (0-5) multiplied by confidence (0.0-1.0).

Example:
- `ai-fluff-language` (score 2, confidence 0.8) = 1.6
- `missing-why` (score 2, confidence 0.75) = 1.5
- `generic-commit-msg` (score 2, confidence 0.7) = 1.4
- **Total: 4.5** → clean (below default warn threshold of 6)

Add one more signal and it crosses the threshold.

## Special Rules

1. **Critical signals**: Any signal with score >= 5 and confidence >= 0.7 forces at least "suspicious" verdict, regardless of total.
2. **Low confidence penalty**: If *all* signals have confidence < 0.6, the verdict is demoted one level (likely-slop → suspicious, suspicious → clean).
