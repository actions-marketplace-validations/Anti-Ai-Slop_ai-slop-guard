import * as core from '@actions/core';
import type { SlopScore, ActionType } from '../types';

/**
 * Set GitHub Action outputs so downstream steps can use the results.
 * @param score - calculated slop score
 * @param actionsTaken - list of actions that were executed
 */
export function setOutputs(
  score: SlopScore,
  actionsTaken: readonly ActionType[],
): void {
  core.setOutput('slop-score', score.total.toString());
  core.setOutput('verdict', score.verdict);
  core.setOutput(
    'signals',
    JSON.stringify(score.signals.map((s) => s.id)),
  );
  core.setOutput('actions-taken', actionsTaken.join(','));
}
