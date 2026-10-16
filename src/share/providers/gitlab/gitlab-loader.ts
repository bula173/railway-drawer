/**
 * @file gitlab-loader.ts
 * @brief Entry of the GitLab chunk (dynamic import from ./index.ts): OAuth sign-in + REST client +
 *        provider. Never imported statically. Finishes a redirect sign-in that brought the page back.
 */
import { gitLabRedirectUri } from './config';
import type { GitLabConfig } from './config';
import { GitLabClient } from './gitlab-client';
import { GitLabProvider } from './gitlab-provider';
import { GitLabAuth } from './oauth';

export async function createGitLabProvider(
  config: GitLabConfig,
  opts: { beforeRedirect?: () => void } = {}
): Promise<GitLabProvider> {
  const auth = new GitLabAuth({ config, redirectUri: gitLabRedirectUri(), beforeRedirect: opts.beforeRedirect });
  let redirectError: string | null = null;
  try {
    await auth.completeRedirect();
  } catch (err) {
    redirectError = err instanceof Error ? err.message : String(err);
    console.warn('[GitLab] Redirect sign-in failed:', err);
  }
  const client = new GitLabClient({
    baseUrl: config.url,
    getToken: () => auth.getToken(),
    refreshToken: () => auth.refresh(),
  });
  return new GitLabProvider({ client, auth, defaultProject: config.defaultProject, redirectError });
}
