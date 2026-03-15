import type { AnalysisContext } from '../types';

/**
 * Close a PR or issue via the GitHub API.
 * @param ctx - analysis context
 */
export async function closeItem(ctx: AnalysisContext): Promise<void> {
  const { octokit, owner, repo, number } = ctx;

  // issues.update works for both issues and PRs
  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: number,
    state: 'closed',
  });
}
