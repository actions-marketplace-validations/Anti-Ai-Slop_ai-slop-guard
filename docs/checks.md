# Signal Reference

Every signal ai-slop-guard can produce, with detailed explanations.

## PR — Diff Structure

### `cosmetic-only-diff` (score: 3)
**What:** All changes are whitespace or formatting only — no functional impact.
**Why it matters:** Cosmetic-only PRs waste reviewer time and add noise to git history.
**How to fix:** Add functional changes or explain why the formatting change matters.

### `massive-unfocused-diff` (score: 4)
**What:** >500 lines changed across >10 files in many directories.
**Why it matters:** Unfocused PRs are hard to review and likely to introduce bugs.
**How to fix:** Split into smaller, focused pull requests.

### `dead-code-injection` (score: 3)
**What:** Functions are defined but never called anywhere in the diff.
**Why it matters:** Dead code bloats the codebase without adding value.
**How to fix:** Remove unused functions or add code that calls them.

### `import-tsunami` (score: 3)
**What:** Many imports added but barely any non-import code changes.
**Why it matters:** Unused imports are a hallmark of AI code dumps.
**How to fix:** Remove unused imports.

### `suspicious-dependency` (score: 4)
**What:** A dependency was added to package.json but not used in the diff.
**Why it matters:** Unused dependencies increase attack surface and bundle size.
**How to fix:** Remove the dependency or add code that uses it.

### `config-churn` (score: 2)
**What:** Only config files were changed without functional code changes.
**Why it matters:** Config-only changes without context are suspicious.
**How to fix:** Explain why the config change is needed.

## PR — Diff Quality

### `test-free-feature` (score: 2)
**What:** New code was added without corresponding tests.
**Why it matters:** Untested code is likely to break.
**How to fix:** Add tests for the new behavior.

### `inconsistent-style` (score: 1)
**What:** Added code mixes tabs and spaces for indentation.
**Why it matters:** Inconsistent style makes code harder to read.
**How to fix:** Use the project's configured indentation style.

### `duplicate-code-in-diff` (score: 3)
**What:** Blocks of identical code appear multiple times in the diff.
**Why it matters:** Duplicated code leads to maintenance burden.
**How to fix:** Extract shared logic into a helper function.

### `high-comment-ratio` (score: 2)
**What:** >40% of added lines are comments.
**Why it matters:** Excessive comments often indicate AI-generated code that over-explains.
**How to fix:** Let the code speak for itself. Comment only non-obvious logic.

## PR — Description

### `ai-fluff-language` (score: 2)
**What:** Description contains many overused filler words (comprehensive, robust, streamlined, etc.).
**Why it matters:** These words are used 5-10x more by AI than by humans.
**How to fix:** Rewrite the description in plain, concrete language.

### `missing-why` (score: 2)
**What:** Description explains what changed but not why.
**Why it matters:** Reviewers need context to evaluate the change.
**How to fix:** Add a sentence explaining the motivation.

### `template-ignored` (score: 3)
**What:** PR template has sections but they're left empty.
**Why it matters:** Templates exist to ensure important context is provided.
**How to fix:** Fill out the template sections.

### `over-explained` (score: 1)
**What:** Description exceeds 800 characters.
**Why it matters:** Excessively long descriptions are often AI dumps.
**How to fix:** Trim to essentials.

### `emoji-abuse` (score: 1)
**What:** 5+ emoji in the description.
**How to fix:** Reduce emoji usage.

### `bullet-vomit` (score: 2)
**What:** 8+ consecutive bullet points.
**How to fix:** Consolidate into prose or group logically.

### `self-praise` (score: 2)
**What:** Phrases like "elegant solution" or "clean implementation".
**How to fix:** Let reviewers judge quality.

## PR — Commits

### `generic-commit-msg` (score: 2)
**What:** Commit messages like "update", "fix", "improve" without specifics.
**How to fix:** Write descriptive messages: "fix: handle null user in auth flow".

### `single-commit-dump` (score: 2)
**What:** Entire PR in one large commit (200+ line changes).
**How to fix:** Break into logical commits.

### `author-mismatch` (score: 1)
**What:** Majority of commits authored by someone other than the PR author.

## Issue — Stack Trace

### `hallucinated-file` (score: 5)
**What:** Stack trace references files that don't exist in the repository.
**Why it matters:** This is a strong indicator the stack trace was fabricated.
**How to fix:** Reproduce the issue and paste the real stack trace.

### `hallucinated-function` (score: 5)
**What:** Referenced function doesn't exist in the file.

### `hallucinated-line` (score: 4)
**What:** Line number exceeds the file's actual length.

## Issue — Content

### `no-reproduction-steps` (score: 3)
**What:** Bug report without steps to reproduce.
**How to fix:** Add numbered steps to reproduce the issue.

### `version-mismatch` (score: 4)
**What:** Referenced version doesn't exist in releases.

### `overly-formal-issue` (score: 2)
**What:** Issue written in press-release tone with excessive formal language.

### `duplicate-issue` (score: 3)
**What:** >85% similar to an existing open issue.
**How to fix:** Search existing issues before opening a new one.

## Semantic (Optional)

### `no-functional-value` (score: 4)
**What:** LLM analysis determines the PR adds no functional value.
**Requires:** `semantic-analysis: true` and a configured LLM provider (Ollama, Anthropic, OpenAI, OpenRouter, or custom).
