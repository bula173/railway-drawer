# GitLab (gitlab.com or self-hosted)

Railway Drawer can open and save `.drawio` files directly in GitLab repositories: every save is a
commit, you can work on branches, open merge requests and share links to a file. It works with
**gitlab.com** and with a **self-hosted GitLab** (also one on the LAN over plain `http://`).

The app talks to the GitLab REST API v4 from the browser with an OAuth token of the signed-in user.
There is no server component and no client secret.

Until it is configured, *Share → GitLab* shows **Not configured** with a link to this page, and no
GitLab code is downloaded.

## 1. Create the OAuth application in GitLab

Any of these works; choose by who should manage it:

| Where | Path in GitLab | Notes |
| --- | --- | --- |
| Instance-wide (self-hosted, administrator) | **Admin area → Applications → Add new application** (`/admin/applications`) | Can be marked *Trusted* (users are not asked to authorize it). |
| A group | **Group → Settings → Applications** | Owned by the group, survives people leaving. |
| Your user | **User settings → Applications** (`/-/user_settings/applications`; older versions `/-/profile/applications`) | Needs *"Allow users to register any application to use GitLab as an OAuth provider"* (Admin → Settings → General → Account and limit) on self-hosted instances. |

Fill in:

- **Name**: `Railway Drawer`
- **Redirect URI** (one per line, exactly as below, *with* the trailing slash):

  ```
  https://railwaydrawer.mksystemdesign.org/
  http://192.168.10.22/railway-drawer/
  http://localhost:3000/
  ```

  The redirect URI is the app's own directory URL (`origin + path up to the last /`). Add any other
  address you serve the app from (e.g. `http://localhost/` for `E2E_PORT=80`). GitLab, unlike
  Microsoft Entra ID, accepts `http://` redirect URIs, so the LAN deployment works.
- **Confidential**: **off** (unchecked). The app is a public client (a browser app cannot keep a
  secret); it proves itself with PKCE (S256) instead.
- **Scopes**: **`api`** only.

  `api` is the smallest scope that allows what the app does: reading projects, branches and files,
  **committing files through the REST API** (repository files API) and **creating merge
  requests**. `read_api` is read-only, and `write_repository` only grants `git push` over HTTP, not
  the REST endpoints, so `read_api + write_repository` cannot save a file or open a merge request.
  The token is limited to what the signed-in user may do in GitLab anyway.

Save, and copy the **Application ID** (the *Secret* is not used anywhere).

## 2. Configure Railway Drawer

Two ways; build-time values are the defaults, runtime settings override them per browser.

### a) At runtime, in the browser (no rebuild)

*Share → GitLab → GitLab settings*:

- **GitLab URL**: `https://gitlab.com`, `http://gitlab.local`, `https://git.example.com/gitlab`
  (relative URL roots work).
- **OAuth application ID**: the Application ID from step 1.
- **Default project** (optional): `group/project` or a numeric id, listed first when browsing.
- **Stay signed in on this computer** (see *Tokens* below).

The values are stored in this browser's `localStorage` (`rd.gitlab.settings`); only values that
differ from the build-time defaults are stored. *Reset to defaults* removes them (and the
tokens). The form also shows the redirect URI to register for the address you are using.

### b) At build time

| Variable | Example | Meaning |
| --- | --- | --- |
| `VITE_GITLAB_URL` | `https://gitlab.com` / `http://gitlab.local` | GitLab base URL |
| `VITE_GITLAB_CLIENT_ID` | `4f1c…` | Application ID (public, not a secret) |
| `VITE_GITLAB_DEFAULT_PROJECT` | `railway/ertms-diagrams` | optional, listed first |

**Local development**: `.env.local` in the project root (git-ignored):

```
VITE_GITLAB_URL=https://gitlab.com
VITE_GITLAB_CLIENT_ID=your-application-id
# VITE_GITLAB_DEFAULT_PROJECT=railway/ertms-diagrams
```

then `npm run dev` (restart after changing it).

**Cloudflare Workers Builds (production)**: Cloudflare dashboard → *Workers & Pages →
railway-drawer → Settings → Build → Variables and secrets* (build variables, not the Worker's
runtime variables): add the variables above and redeploy (push or *Retry build*). `vite.config.ts`
reads them with `loadEnv` (which includes `process.env`). For `npm run deploy` / `./deploy.sh` from
a machine, `.env.local` or exported variables are used.

### Which combinations work

| App served from | GitLab | Works? |
| --- | --- | --- |
| `https://railwaydrawer.mksystemdesign.org` | `https://gitlab.com` or any https GitLab | yes |
| `https://…` | `http://gitlab.local` (plain http) | **no**: the browser blocks mixed content; the Share dialog says so. Use the LAN deployment, or give the GitLab HTTPS. |
| `http://192.168.10.22/railway-drawer/` | `http://gitlab.local` or https GitLab | yes |
| `http://localhost:3000/` | anything | yes |

A self-hosted GitLab with a self-signed certificate works only once the browser trusts the
certificate (open the GitLab URL once and accept it, or install the CA).

## 3. Using it

- **File → Open from GitLab…** / *Share → Open from GitLab…*: projects (default project, starred
  projects, then your projects by last activity; search box) → branch (default branch first) →
  folders → a `.drawio`, `.xml` or `.railwaydrawer` file. It opens in a new tab.
- **File → Save to GitLab…**: choose project → branch → folder and a file name; optional
  - **Commit message** (default *"Add <file> from Railway Drawer"*),
  - **New branch**: created from the branch you are in, the file is committed there,
  - **Create a merge request** into the default branch (only when the target branch is not the
    default branch). The merge request opens in a dialog with its link.
  - If the name exists: ask / replace / keep both (`name (2).drawio`).
- A tab opened from or saved to GitLab is **bound** to the file. The status bar shows
  *Stored in: GitLab: group/project › branch › path/file.drawio*. **Ctrl+S / File → Save** asks for
  the commit message (default *"Update <file> from Railway Drawer"*; on a non-default branch also
  *Create a merge request*) and commits with `last_commit_id`.
- **Conflicts**: if someone committed to the file since you opened it, GitLab refuses the commit
  (*"You are attempting to update a file that has changed since you started editing it."*). You
  choose:
  - **Overwrite**: commit anyway (their version stays in the history),
  - **Save as copy**: a new file next to it,
  - **Save to new branch**: a new branch from the commit you started from, your version committed
    there, optionally with a merge request into the file's branch, where GitLab shows both
    changes,
  - **Cancel**.
- **Share → Sharing link…** (bound tab):
  - *Railway Drawer link*: `https://<app>/?gitlab=<group/project>:<branch>:<path>` (each part
    percent-encoded). Opening it starts the app, asks the recipient to sign in to GitLab if
    needed, and opens the file in a new bound tab through the normal loader.
  - *GitLab link*: the file page in GitLab (`<GitLab>/<group/project>/-/blob/<branch>/<path>`).
  - Both links are given in the dialog.
- File → Save As… still downloads a file. Bindings live for the browser tab session only.

### Permissions

GitLab permissions apply to every request; links do not grant access.

- To **open** a file (or a sharing link) the user signs in to the same GitLab and needs read access
  to the project's repository: *Reporter* or higher on private projects; on internal/public
  projects any signed-in user who can see the repository.
- To **save** (commit) they need *Developer* (or a role allowed to push to that branch). Protected
  branches (often the default branch) may refuse direct commits: save to a new branch and open a
  merge request instead.
- Creating branches and merge requests needs *Developer*.
- If a link points to a GitLab the recipient's browser is not configured for, the app says so; after
  entering the GitLab settings (*Share → GitLab*), the file opens.

### Sign-in and tokens

- OAuth 2.0 **authorization code flow with PKCE (S256)**, public client: `GET {GitLab}/oauth/authorize`
  in a popup; `POST {GitLab}/oauth/token` (form-encoded) exchanges the code with the
  `code_verifier`. The `state` (prefix `rdgl-`) is checked. If the popup is blocked, the app falls
  back to a full-page redirect (unsaved changes are flushed to the browser cache first) and
  finishes the sign-in when it comes back.
- GitLab access tokens expire after **2 hours**; the app refreshes them with the refresh token one
  minute early (and after a 401), so you stay signed in while the tab is open. If refreshing fails
  you are asked to sign in again.
- **Storage**: by default the tokens are in `sessionStorage` (this browser tab only; closing the
  tab signs you out). With **Stay signed in on this computer** they are in `localStorage` and
  survive restarts. Risk: anyone using this browser profile, and any script that runs on the
  app's origin (e.g. through a future XSS bug or a malicious browser extension), could use the
  token with the `api` scope until it expires or is revoked. Leave it off on shared computers.
- **Sign out** (in the browse dialog) revokes the token at GitLab (`/oauth/revoke`) and deletes
  it from the browser. It does not end your GitLab web session. You can also revoke the app any
  time in GitLab: *User settings → Applications → Authorized applications*.
- `crypto.subtle` is unavailable on plain-http pages (LAN); the app then computes SHA-256 for the
  PKCE challenge in JavaScript.

### Large files and encoding

- File content is sent and received as base64 of the UTF-8 bytes, so Polish (and any other)
  characters survive byte-exact.
- GitLab rejects file API requests over **300 MB** by default (requests over 20 MB are rate
  limited to 3 per 30 s; reading blobs over 10 MB to 5 per minute; see GitLab's *Repository files
  API* docs). Railway Drawer itself opens/saves files up to **50 MB** and reports larger ones
  without sending them. A `413` (e.g. a reverse proxy's `client_max_body_size`) or a "too large"
  answer is shown as *"GitLab rejected the file as too large"* with what to do.

## 4. CORS, CSP and old GitLab versions

- **API**: GitLab allows cross-origin requests to `/api/*` from any origin **without cookies**
  (`credentials: false`), with any headers and methods, and exposes the paging headers (`Link`,
  `X-Next-Page`, …) and the file headers (`X-Gitlab-Last-Commit-Id`, …). Bearer tokens therefore
  work from the browser on gitlab.com and self-hosted GitLab (Rack::Cors in GitLab's
  `config/application.rb`).
- **Token endpoint**: the same file allows any origin for `POST /oauth/token` and
  `/oauth/revoke` ("Cross-origin requests must be enabled for the Authorization code with PKCE
  OAuth flow when used from a browser"). This was added in **GitLab 13.9** (commit *"Allow CORS on
  /oauth/token"*, January 2021); current versions allow `/oauth/revoke` by the same rule. Verified on gitlab.com:
  `OPTIONS /oauth/token` answers `Access-Control-Allow-Origin: *`. The app sends the token request
  form-encoded without custom headers (a CORS *simple request*), so no preflight is needed.
- **GitLab older than 13.9**: the browser blocks reading the token response; sign-in fails with
  *"Could not reach …/oauth/token … (CORS)"*. Options: upgrade GitLab (recommended; 13.9 is from
  2021), or let the reverse proxy in front of GitLab add `Access-Control-Allow-Origin: <app
  origin>` (and `Access-Control-Allow-Methods: POST, OPTIONS`) for `/oauth/token` and
  `/oauth/revoke`. There is no in-app fallback: the implicit flow is deprecated and personal
  access tokens pasted into a web page are worse.
- A reverse proxy that strips or overrides GitLab's CORS headers breaks the API calls the same way.
- **CSP**: the app ships none. If you add one, allow the GitLab origin:
  `connect-src 'self' https://gitlab.com` (or your GitLab URL).
- The popup needs `window.open` for the app origin (no `Cross-Origin-Opener-Policy: same-origin`
  on the app pages, or `same-origin-allow-popups`). GitLab's sign-in page itself sends
  `Cross-Origin-Opener-Policy: same-origin`, which severs `window.opener`; the redirect page hands
  the answer to the app over a `BroadcastChannel` instead.

## How it works (for developers)

- `src/share/providers/gitlab/config.ts` (main bundle, tiny): env + runtime settings, availability
  (not configured / invalid URL / mixed content), redirect URI, `isGitLabAuthResponseUrl`
  (`state=rdgl-…`; checked in `main.ts` before the SharePoint bridge), `?gitlab=` links.
- `index.ts`: the descriptor (settings form, incoming links, lazy `import('./gitlab-loader')`).
  Unlike SharePoint the chunk is always built, because a LAN GitLab can be configured at runtime;
  it is only downloaded when GitLab is configured and used.
- `oauth.ts`: PKCE flow, popup (BroadcastChannel) / redirect, token store, single-flight refresh.
  `pkce.ts`: verifier, S256 challenge, JS SHA-256 fallback. `auth-bridge.ts`: the redirect page.
- `gitlab-client.ts`: typed REST v4 client (pagination, 401 → refresh → retry, conflict / too-large
  errors, UTF-8 base64). `gitlab-provider.ts`: the `StorageProvider` (browse, open, save with
  `last_commit_id`, save as with new branch, merge requests, conflict action, links).
- Generic additions used by GitLab: `saveFields` (extra inputs of a save), `conflictActions` /
  `resolveConflict`, `openRef` + descriptor `incomingLink`, descriptor `settings`, `SaveResult`
  `note`/`link`.
- Tests: `src/share/__tests__/gitlab.test.ts`, `gitlab-session.test.ts` (mocked fetch, no
  network), `tests/e2e/gitlab.spec.ts` (settings → sign-in button; requests to the configured
  GitLab are intercepted and must not happen).
