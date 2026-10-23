# Deploy, security headers, LAN

- Production: **Cloudflare Workers Builds** on push (configured in the Cloudflare dashboard; reads
  `wrangler.jsonc`: Worker `worker/index.ts` + static assets `./dist` with SPA not-found handling; `run_worker_first` only
  for `/mcp` and `/api/ai-bridge/*`, every other path is served from the assets as before; Durable Object `AiBridge`,
  migration `v1` sqlite). The site is behind Cloudflare Access: `/mcp` needs its own Bypass application (docs/AI.md). `npm run deploy`
  (= build + `wrangler deploy`) does the same from a local machine; `npm run preview:cf` runs it in `wrangler dev`.
  **Top-bar Access user** (`src/ui/access-identity.ts`, wired by `boot/features.ts` bootSharing): after boot (never delays first paint),
  only on https and not localhost / LAN IP / `.local`, one same-origin `fetch('/cdn-cgi/access/get-identity',
  {credentials: 'same-origin'})`; JSON with `email` -> `.rd-access-user` first in `.top-bar-right`: user icon + email
  (max 220 px, ellipsis, tooltip "Signed in as ..."), `button.rd-access-logout` "Log out" (aria-label "Log out (<email>)")
  -> `/cdn-cgi/access/logout`, with a themed `confirmDialog` first when tabs have changes not saved to their remote
  provider (`SharingHandle.unsavedRemoteTabs`; confirmed -> `allowLeave()` skips the browser's leave prompt); below
  900 px email hidden, icon-only button. Failure / 404 / HTML / no email: nothing shown, nothing logged. `/cdn-cgi/*`
  is answered by Cloudflare's edge (the Worker only runs first for /mcp and /api/ai-bridge and does not route
  `/cdn-cgi`). Dev-only localStorage `rd.accessProbe` = '1' forces the request (e2e).
- **Security headers / CSP**: `public/_headers` is the one source (Cloudflare static assets apply it): CSP
  `script-src 'self'` (no inline scripts: the theme bootstrap is `public/theme-init.js`), `style-src 'unsafe-inline'`
  (maxGraph), `connect-src 'self' https: wss: ws://127.0.0.1:* …` (GitLab / PlantUML / library URLs are user-configured),
  nosniff, Referrer-Policy, Permissions-Policy, frame-ancestors none. vite.config.ts `securityHeaders` sends it from
  the dev server (plus `'unsafe-eval'` for the e2e harness, with the exact policy as Report-Only) and preview, collects
  violation reports (`/__rd-csp-reports`; `tests/e2e/csp-teardown.ts` fails the e2e run on any), and writes
  `dist/.htaccess` (LAN variant: `http:` allowed too) for Apache. `RD_NO_CSP=1` disables it in dev. Tests:
  `src/config/__tests__/security-headers.test.ts`, `tests/e2e/csp.spec.ts`; `npm run test:e2e:preview` (after `npm run
  build`) runs the specs without dev-module imports against `vite preview` under the exact production policy.
  maxGraph's eval paths (`StylesheetCodec` / `ObjectCodec` / `StencilShape.allowEval`) are switched off in
  `registerDrawioCodecs` (files are untrusted).
- LAN: `./deploy.sh` -> `npm ci`, `npm run build`, timestamped backup of
  `root@192.168.0.22:/var/www/html/railway-drawer`, scp `dist/`, verify. Served at
  `http://192.168.0.22/railway-drawer/`. Override the host with `SERVER_HOST=<ip> ./deploy.sh`. The security headers
  come from `dist/.htaccess`: Apache needs `a2enmod headers` and `AllowOverride FileInfo` (or All) for the directory,
  otherwise the file is ignored (or a 500 without mod_headers is avoided by its `<IfModule>`).
