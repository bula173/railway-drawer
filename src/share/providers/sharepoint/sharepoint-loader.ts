/**
 * @file sharepoint-loader.ts
 * @brief Entry of the SharePoint chunk (dynamic import from ./index.ts): MSAL sign-in + Graph
 *        client + provider. Never imported statically.
 */
import { sharePointRedirectUri } from './config';
import type { SharePointConfig } from './config';
import { GraphClient } from './graph-client';
import { MsalAuth } from './msal-auth';
import { SharePointProvider } from './sharepoint-provider';

export async function createSharePointProvider(
  config: SharePointConfig,
  opts: { beforeRedirect?: () => void } = {}
): Promise<SharePointProvider> {
  const auth = await MsalAuth.create({ config, redirectUri: sharePointRedirectUri(), beforeRedirect: opts.beforeRedirect });
  const client = new GraphClient({ getToken: (scopes) => auth.getToken(scopes) });
  return new SharePointProvider({
    client,
    defaultSite: config.defaultSite,
    auth: {
      account: () => {
        const account = auth.account();
        return account ? { name: account.name, username: account.username } : null;
      },
      signIn: async () => {
        const account = await auth.signIn();
        return { name: account.name, username: account.username };
      },
      signOut: () => auth.signOut(),
    },
  });
}
