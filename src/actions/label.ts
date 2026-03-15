import type { AnalysisContext } from '../types';

const WARN_COLOR = 'E8A317'; // orange
const SLOP_COLOR = 'D93F0B'; // red

/**
 * Add a label to the PR/issue. Creates the label if it doesn't exist.
 * @param ctx - analysis context
 * @param labelName - label to add
 */
export async function addLabel(
  ctx: AnalysisContext,
  labelName: string,
): Promise<void> {
  const { octokit, owner, repo, number } = ctx;
  const color =
    labelName === ctx.config.slopLabel ? SLOP_COLOR : WARN_COLOR;

  // Ensure label exists
  try {
    await octokit.rest.issues.getLabel({ owner, repo, name: labelName });
  } catch {
    await octokit.rest.issues.createLabel({
      owner,
      repo,
      name: labelName,
      color,
      description: 'Applied by ai-slop-guard',
    });
  }

  await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: number,
    labels: [labelName],
  });
}
