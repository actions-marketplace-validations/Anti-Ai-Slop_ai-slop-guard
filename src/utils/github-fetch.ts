import type { OctokitClient } from '../types';
import { parseStackTrace } from '../parsers/stacktrace-parser';

/**
 * Fetch the contents of files referenced in stack traces from the repo.
 * Fetches up to 10 files to avoid excessive API calls.
 * @param octokit - authenticated Octokit client
 * @param owner - repository owner
 * @param repo - repository name
 * @param issueBody - markdown body of the issue
 * @param repoFiles - list of file paths in the repo
 * @returns map of file path to file content
 */
export async function fetchReferencedFileContents(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  issueBody: string,
  repoFiles: readonly string[],
): Promise<Map<string, string>> {
  const contents = new Map<string, string>();
  const frames = parseStackTrace(issueBody);
  if (frames.length === 0) return contents;

  const repoFileSet = new Set(repoFiles.map((f) => f.toLowerCase()));
  const filesToFetch = [...new Set(
    frames.map((f) => f.filePath).filter((p) => repoFileSet.has(p.toLowerCase())),
  )].slice(0, 10);

  for (const path of filesToFetch) {
    try {
      const { data } = await octokit.rest.repos.getContent({ owner, repo, path });
      if (!Array.isArray(data) && 'content' in data && data.encoding === 'base64') {
        contents.set(path, Buffer.from(data.content, 'base64').toString('utf-8'));
      }
    } catch {
      // File not found or API error — skip
    }
  }

  return contents;
}
