import * as core from '@actions/core';
import type { SlopScore, AnalysisContext, ActionType, DispatchOptions } from '../types';
import { addLabel } from './label';
import { postComment, updateCommentToClean } from './comment';
import { closeItem } from './close';
import { removeLabel } from './label';
import { setOutputs } from './report';

/**
 * Dispatch actions based on the analysis verdict.
 * clean → no action, suspicious → onWarn actions, likely-slop → onClose actions.
 * Execution order: label → comment → close.
 * @param score - calculated slop score
 * @param ctx - analysis context
 * @returns list of actions actually executed
 */
export async function dispatchActions(
  score: SlopScore,
  ctx: AnalysisContext,
  options: DispatchOptions = {},
): Promise<ActionType[]> {
  const executed: ActionType[] = [];

  // Always set outputs regardless of verdict
  setOutputs(score, executed);

  if (score.verdict === 'clean') {
    core.info('Verdict: clean — no actions taken.');
    // On re-analysis, if previously flagged, update comment and remove label
    if (options.isReanalysis) {
      try {
        await updateCommentToClean(ctx);
        await removeLabel(ctx, ctx.config.warnLabel);
        await removeLabel(ctx, ctx.config.slopLabel);
        await removeLabel(ctx, 'slop-guard-pending-close');
      } catch (err) {
        core.debug(`Clean-up on re-analysis: ${String(err)}`);
      }
    }
    return executed;
  }

  const actions =
    score.verdict === 'likely-slop'
      ? ctx.config.onClose
      : ctx.config.onWarn;

  const label =
    score.verdict === 'likely-slop'
      ? ctx.config.slopLabel
      : ctx.config.warnLabel;

  // Execute in order: label → comment → close
  if (actions.includes('label')) {
    try {
      await addLabel(ctx, label);
      executed.push('label');
    } catch (err) {
      core.warning(`Failed to add label: ${String(err)}`);
    }
  }

  if (actions.includes('comment')) {
    try {
      await postComment(ctx, score, options);
      executed.push('comment');
    } catch (err) {
      core.warning(`Failed to post comment: ${String(err)}`);
    }
  }

  if (actions.includes('close')) {
    const gracePeriod = ctx.config.gracePeriodHours;
    if (gracePeriod > 0) {
      // Grace period: don't close, add pending label instead
      try {
        await addLabel(ctx, 'slop-guard-pending-close');
        core.info(
          `Grace period active (${gracePeriod}h) — not closing, added pending-close label.`,
        );
      } catch (err) {
        core.warning(`Failed to add pending-close label: ${String(err)}`);
      }
    } else {
      try {
        await closeItem(ctx);
        executed.push('close');
      } catch (err) {
        core.warning(`Failed to close item: ${String(err)}`);
      }
    }
  }

  // Update outputs with actual actions taken
  setOutputs(score, executed);

  return executed;
}
