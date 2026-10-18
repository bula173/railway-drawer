# SharePoint / OneDrive for Business

Railway Drawer can open `.drawio` files from SharePoint document libraries and OneDrive for
Business, save them back (Ctrl+S, with conflict detection), save new files there and create
sharing links. It talks to Microsoft Graph directly from the browser with the signed-in user's
permissions (delegated access); there is no server component.

The feature is **off until an administrator registers an app in Microsoft Entra ID** and the app is
built with its client id. Without it the Share dialog shows "SharePoint — Not configured" and no
Microsoft code is built into the app or loaded.

Sharing without any account (link with the diagram in the URL, `.drawio`/PNG/SVG downloads) always
works and is unaffected by this setup.

## 1. Register the app in Microsoft Entra ID

You need a role that can register applications (by default every member can; otherwise
*Application Developer*), and for step 4 possibly a *Cloud Application Administrator* or
*Global Administrator*.

1. Open <https://entra.microsoft.com> → **Identity → Applications → App registrations → New registration**.
2. **Name**: `Railway Drawer`.
3. **Supported account types**: *Accounts in this organizational directory only* (single tenant) is
   the usual choice. Pick *Accounts in any organizational directory* only if people from other
   companies' tenants should use your deployment.
4. **Redirect URI**: platform **Single-page application (SPA)**, URI
   `https://railwaydrawer.mksystemdesign.org/`. Click **Register**.
5. On the new app's **Authentication** page, under *Single-page application*, add the local
   development URI `http://localhost:3000/` (Entra accepts `http://` only for `localhost`).
   Add any other HTTPS host you deploy to, always with the trailing `/` (the redirect URI is the
   directory the app is served from, e.g. `https://example.com/railway-drawer/`).
   Leave *Implicit grant* (access/ID tokens) **unchecked**: the app uses the authorization code
   flow with PKCE (MSAL.js), which needs no secret and no implicit grant.
6. Copy the **Application (client) ID** and the **Directory (tenant) ID** from the *Overview* page.

### API permissions

**API permissions → Add a permission → Microsoft Graph → Delegated permissions**:

| Permission | Why |
| --- | --- |
| `User.Read` | Sign-in, the account name shown in the dialogs (added by default). |
| `Sites.Read.All` | Search sites, list followed sites, list a site's document libraries and folders. |
| `Files.ReadWrite.All` | Read and write files in any library/OneDrive the user can access, create sharing links and invitations. |

Why these and not others:

- `Files.ReadWrite` (without `.All`) only covers the user's own OneDrive, not SharePoint sites.
- `Sites.ReadWrite.All` would also allow changing lists and list items; writing files only needs
  `Files.ReadWrite.All`.
- Delegated permissions never exceed what the user can do in SharePoint: a user still only sees
  and changes what SharePoint already allows them to.
- The app requests scopes incrementally: plain sign-in asks for `User.Read`, browsing asks for
  `Sites.Read.All`, opening/saving/sharing asks for `Files.ReadWrite.All`.
- `Sites.Selected` (access to explicitly granted sites only) is not supported: it needs a per-site
  grant by an administrator through Graph and does not allow site search.

### Admin consent

None of these delegated permissions requires admin consent by Microsoft's definition, so in a
tenant that allows user consent every user consents on first sign-in. Many organisations disable
user consent; then users see *"Need admin approval"*. An administrator fixes that once with
**API permissions → Grant admin consent for &lt;tenant&gt;** (or approves the request in
*Enterprise applications → Admin consent requests*).

"Anyone with the link" sharing works only when the SharePoint tenant (and the site) allows
anonymous links; otherwise Graph answers 403 and the app suggests "People in your organization"
or "Specific people" instead.

## 2. Configure the build

The values are read **at build time** (Vite environment variables):

| Variable | Required | Value |
| --- | --- | --- |
| `VITE_MSAL_CLIENT_ID` | yes | Application (client) ID. Unset = feature off. |
| `VITE_MSAL_TENANT_ID` | no | Directory (tenant) ID or domain (`contoso.onmicrosoft.com`). Default `organizations` (any work/school account; use your tenant id for a single-tenant app). |
| `VITE_SHAREPOINT_DEFAULT_SITE` | no | A site listed first in the browser, as `hostname:/sites/Name`, e.g. `contoso.sharepoint.com:/sites/Railway`. |

These are not secrets (a SPA client id is public); `.env.local` is git-ignored anyway.

### Local development

Create `.env.local` in the project root:

```bash
VITE_MSAL_CLIENT_ID=00000000-0000-0000-0000-000000000000
VITE_MSAL_TENANT_ID=11111111-1111-1111-1111-111111111111
# VITE_SHAREPOINT_DEFAULT_SITE=contoso.sharepoint.com:/sites/Railway
```

Then `npm run dev` and open <http://localhost:3000/> (exactly this origin: it must match the
registered redirect URI; `http://127.0.0.1:3000/` or another port will be rejected by Entra unless
registered too).

### Cloudflare Workers Builds (production)

Cloudflare dashboard → **Workers & Pages → railway-drawer → Settings → Build → Variables and
secrets** (build variables, *not* the Worker's runtime variables): add `VITE_MSAL_CLIENT_ID`,
optionally `VITE_MSAL_TENANT_ID` and `VITE_SHAREPOINT_DEFAULT_SITE`, then redeploy (push or
*Retry build*). `vite.config.ts` reads them from the build environment (`loadEnv`, which includes
`process.env`).

For `npm run deploy` from a machine, `.env.local` (or exported variables) is used.

### The LAN deployment (`http://192.168.0.22/railway-drawer/`)

Entra ID does not accept `http://` redirect URIs other than `localhost`, so SharePoint cannot work
there. The Share dialog shows *"SharePoint requires HTTPS — use
https://railwaydrawer.mksystemdesign.org"*. Serving the LAN host over HTTPS (with a certificate the
browsers trust) and registering its URL would make it work.

## 3. Using it

- **File → Open from SharePoint…** / **Share → Open from SharePoint…**: *My files (OneDrive)*, the
  default site, followed sites, or search sites → document library → folders → a `.drawio`,
  `.xml` or `.railwaydrawer` file. It opens in a new tab.
- **File → Save to SharePoint…**: choose a library/folder and a name; if the name exists:
  ask / replace / keep both (Graph `conflictBehavior` fail / replace / rename).
- A tab opened from or saved to SharePoint is **bound** to that file: the status bar shows
  *Stored in: SharePoint: Site › Library › Folder › file.drawio*, and **Ctrl+S / File → Save**
  upload back to it with `If-Match: <eTag>`. If someone changed the file meanwhile (HTTP 412) you
  choose *Overwrite* (their version stays in the SharePoint version history), *Save as copy*, or
  *Cancel*. File → Save As… still downloads a file. Bindings are kept for the browser session only
  (a reload restores the diagram from the browser cache but not its SharePoint binding: open it
  from SharePoint again to save back).
- **Share → Sharing link…** (for a bound tab): *Can view / Can edit* for *People in your
  organization*, *Specific people* (e-mail invitation via `/invite`) or *Anyone with the link*
  (if allowed). The link is copied to the clipboard.
- Sign-in uses a popup; if the browser blocks it the app falls back to a full-page redirect
  (unsaved changes are flushed to the browser cache first). Tokens are cached in `localStorage`
  by MSAL; *Sign out* in the browser dialog removes them from this browser.

Files up to 4 MB are uploaded with one request, larger ones through an upload session in
3.2 MB chunks. Files over 50 MB are not opened.

## 4. Content Security Policy

The app ships no CSP today. If you add one (e.g. a `public/_headers` file for Cloudflare, or the
web server config of the LAN host), allow:

```
connect-src 'self' https://login.microsoftonline.com https://graph.microsoft.com https://*.sharepoint.com;
frame-src   https://login.microsoftonline.com;
```

- `login.microsoftonline.com`: token requests (MSAL `fetch`) and the hidden iframe MSAL uses for
  silent token renewal.
- `graph.microsoft.com`: the Graph API.
- `*.sharepoint.com`: file downloads redirect there, and large-file upload sessions upload there.
- If you use a sovereign cloud, adjust the hosts (e.g. `login.microsoftonline.us`,
  `graph.microsoft.us`); the app currently targets the global cloud only.

Popups need `window.open` to work for this origin (no `Cross-Origin-Opener-Policy: same-origin`
on the app pages, or use `same-origin-allow-popups`).

## How it works (for developers)

- `src/share/providers/types.ts`: provider-neutral `StorageProvider` interface (browse, open,
  save with expected version, save as, sharing links) and the always-loaded
  `StorageProviderDescriptor`.
- `src/share/providers/sharepoint/config.ts`: env parsing, availability (not configured / HTTPS).
- `src/share/providers/sharepoint/index.ts`: descriptor; `load()` is a dynamic import that only
  exists in builds with `VITE_MSAL_CLIENT_ID` (vite.config.ts `define`s the variables, so the
  condition is a build-time constant and unconfigured builds contain no MSAL code).
- `sharepoint-loader.ts` → `msal-auth.ts` (`@azure/msal-browser` 5, pinned) +
  `graph-client.ts` (fetch, pagination, retries, upload sessions, eTag conflicts) +
  `sharepoint-provider.ts`.
- `auth-bridge.ts`: msal-browser 5 needs the redirect page to call `broadcastResponseToMainFrame`.
  The redirect URI is the app itself, so `src/main.ts` detects an auth response in the URL
  (`state` + `code`/`error`) and runs the bridge instead of starting the editor.
- `src/share/remote-session.ts`: per-tab bindings, Ctrl+S save-back, conflicts, status bar.
