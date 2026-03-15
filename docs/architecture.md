# Architecture

## Data Flow

```
GitHub Event (PR or Issue)
        │
        ▼
┌─────────────────┐
│   src/index.ts   │  Entry point: reads config, creates context
│   (entry point)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  config/schema   │  Resolve action.yml inputs → GuardConfig
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Exemption Check  │  Bot? Exempt user? Exempt label?
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│   PR   │ │ Issue  │
│Pipeline│ │Pipeline│
└───┬────┘ └───┬────┘
    │          │
    ▼          ▼
┌─────────────────────────────────────────┐
│          Promise.allSettled              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │ Analyzer │ │ Analyzer │ │ Analyzer ││
│  │    1     │ │    2     │ │    3     ││
│  └────┬─────┘ └────┬─────┘ └────┬─────┘│
│       │             │             │      │
│       └─────────────┼─────────────┘      │
│                     │                    │
│               Signal[]                   │
└─────────────────────┬───────────────────┘
                      │
                      ▼
              ┌──────────────┐
              │   Scoring    │  Σ(score × confidence) → SlopScore
              │  calculator  │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │  Thresholds  │  Min rules + confidence penalty
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │  Dispatcher  │  Verdict → Actions
              └──────┬───────┘
                     │
            ┌────────┼────────┐
            ▼        ▼        ▼
         ┌─────┐ ┌───────┐ ┌─────┐
         │Label│ │Comment│ │Close│
         └─────┘ └───────┘ └─────┘
                     │
                     ▼
              ┌──────────────┐
              │   Outputs    │  core.setOutput()
              └──────────────┘
```

## Key Design Decisions

### Why Promise.allSettled?
Analyzers run in parallel. If one crashes, the others continue. A failing check should never block the entire analysis.

### Why no external API calls?
Privacy and speed. All analysis runs on the GitHub Actions runner. No data leaves the CI environment.

### Why neverthrow?
Config parsing can fail. Using `Result<T, E>` instead of try/catch makes error handling explicit and forces callers to handle failures.

### Why fuzzball for fuzzy matching?
Lightweight, pure JavaScript, no native binaries. Works reliably across all runner platforms.

## Module Dependencies

```
types.ts ← everything
signals.ts ← analyzers
patterns.ts ← pr-description, pr-commits, issue-content
text-utils.ts ← pr-description, issue-content, comment
language-detect.ts ← diff-parser
diff-parser.ts ← pr-diff
stacktrace-parser.ts ← issue-stacktrace
```
