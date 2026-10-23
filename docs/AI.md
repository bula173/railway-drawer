# AI assistant (in-app chat + MCP)

Describe what the drawing should show and have it drawn in the active diagram tab — either in the
app's own **AI** panel with your own Anthropic API key, or from an MCP client (Claude Desktop,
Claude Code, a claude.ai custom connector) paired with your open browser tab.

```
                         ┌──────────────────────────── browser tab (railwaydrawer.mksystemdesign.org) ───────────────────────────┐
 you ── prompt ──► AI panel (src/ai/ai-panel.ts, lazy chunk)                                                                     │
                   │  ChatSession (chat-loop.ts) ── HTTPS, your key ──► api.anthropic.com /v1/messages (stream, tools)          │
                   │        ▲ tool_use / tool_result                                                                             │
                   │        ▼                                                                                                    │
                   │  runTool (confirm mode, turn undo) ──► executeAiTool (tools.ts) ──► ACTIVE TAB: graph, undo, Railway Script │
                   │        ▲                                                                                                    │
                   │  BridgeClient (bridge/client.ts) ◄── WebSocket ───────────────────┐                                        │
                   └───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────┘
                                                                                        │ wss://<site>/api/ai-bridge/<session>/ws (same origin)
 Claude Desktop / Code / claude.ai ── MCP Streamable HTTP ──► Worker /mcp (worker/index.ts, src/ai/mcp/http.ts)
                                       pairing token            │  validate input (JSON Schema) ─► RPC relayCall()
                                                                ▼
                                                   Durable Object AiBridge (worker/ai-bridge.ts) ── BridgeRelay (src/ai/bridge/relay.ts)

 Claude Desktop / Code ── stdio ──► tools/mcp-local (Node) ── ws://127.0.0.1:7391/bridge ◄── BridgeClient (same page)
                                     └─ no browser connected + RAILWAY_DRAWER_FILE: edits a .drawio file headless (jsdom)
```

One tool core (`src/ai/tools.ts`, definitions in `src/ai/tool-defs.ts`) serves all three paths: the
chat runs it in the page, MCP calls are relayed to the page and run there, the local server's
headless mode runs it in Node.

## Tools

Every tool: JSON Schema (`additionalProperties: false`), input validated before it runs
(`schema-check.ts`; MCP inputs are validated in the Worker / local server too), at most **one undo
step** per call, compact JSON result + a one-line summary for the visible log.

| Tool | What it does |
|---|---|
| `get_drawing` | The tab's Railway Script (stored, or generated from the drawing), railway object counts, other cells (id, label, shape, bounds). |
| `apply_railway_script` | Replaces the tab's Railway Script and redraws what it owns (one undo step). Errors come back with `line:col`; nothing changes then. |
| `add_shapes` | Generic draw.io shapes (catalogue name, title, or style string) + connectors, placed at x/y. ERTMS symbols get their railway kind and ID. |
| `search_shapes` | Searches the draw.io palettes, the ERTMS library and user libraries. |
| `delete_cells` | By cell id or railway object id, or everything. |
| `set_states` | `state` / `aspect` / `position` per object (docs/STATES.md), reset, reset all. |
| `routes` | list / find / add / set / occupy / release on the drawn topology. |
| `list_templates` | ERTMS + user templates ranked for `query` (English or Polish words; PL stems → EN terms, e.g. "wjazd" → entry/entrance/route, "przejście poziomu" → level transition). Per template: id, display + original name, summary (topic, ETCS level, counts of tracks/signals/sections/points/balise groups, signal ids), size, score. No match → all names. |
| `describe_template` | One template as a Railway Script generated from its drawing (ids, kinds, tracks, km) + ids by kind + its other labels, to plan edits. |
| `insert_template` | `mode: newTab` (default where tabs exist: opens it as a new, now active, tab; ids unchanged) or `intoTab` (one undo step, at `at` or the view centre; taken ids renumbered, returned as `renamed` template id → new id). Returns the object ids by kind. |
| `check_drawing` | The railway data checks (Checks panel). |
| `export_drawing` | png (returned as an image so the model can look at the drawing), svg, drawio, railML 3.2, Railway Script YAML/JSON; optional download. |
| `undo` | Undo n steps of the tab. |
| `list_scenarios` | The tab's scenarios (Scenarios panel): ids, names, descriptions, steps (number, id, name, has UML / text). |
| `create_scenario`, `update_scenario` | Create; rename / describe / `delete: true`. |
| `add_scenario_step` | `{scenario, name, description?, uml?, text?, states?: [{id, state\|aspect\|position}], routes?: [{id, action: set\|occupy\|release}], resetStates?, captureDrawing = true, position?}`: reset (optional) → route actions → states on the drawing, then the drawing is captured exactly like the panel's "+ Add step". Returns the changes from the previous step (`TC3: free → occupied`). |
| `update_scenario_step`, `delete_scenario_step`, `reorder_scenario_steps` | Edit name/description/UML/text, or apply states/routes to the current drawing and recapture (`recapture: true` without changes); delete; move `step` to `to` or a full `order`. Steps are addressed by number, id or name; scenarios by id or name. |
| `build_scenario` | `{name, description?, resetStates = true, restoreDrawing = false, steps: [...]}` (≤ 30 steps): creates the scenario and every step in ONE call / undo step. |
| `view_scenario` | Opens the read-only scenario view at a step for the user (not in headless mode). |
| `export_scenario` | `pdf` / `slides` / `html` (+ `orientation`, `showChanges`), saved in the browser without the options dialog (not in headless mode). |
| `set_title_block` | Title block fields (project, title, drawing number, designed / checked / approved, date, revision, company, status, `lang` pl/en), the revision table, and with `sheet` the shown page's sheet (A0–A4, orientation, `scale` n of 1:n or 0 = fit, sheet title / number). |
| `export_sheets` | The drawing sheets as one PDF (frame, title block, revisions, legend), saved in the browser; `pages` = 1-based page numbers (default all). |

**Scenario semantics.** Step states are *incremental*: a step starts from the drawing as the previous
step left it and changes only the listed objects (`""` = back to the default of that dimension).
`resetStates` on a step resets every object (free / stop / normal) first, which makes that step
*absolute*; `build_scenario` resets once before step 1 by default (the scenario starts from the drawing
as drawn) and leaves the drawing at the last step unless `restoreDrawing: true`. Chosen over
"absolute by default" because railway scenarios are told as a sequence of changes (route set → train
enters TC2 → TC1 released) and listing every object in every step would be long and error-prone.
All ids of a call are checked first: an unknown id changes nothing and the error names it together
with the valid ids by kind (or says that the drawing has no routes yet).

**Undo.** A scenario call records ONE undoable edit on the tab's model: the drawing changes (states,
routes) plus a `ScenarioSetChange` (`scenario-tools.ts`) that swaps the touched scenarios with their
earlier copies (`ScenarioSet.captureState/restoreState`; scenarios changed in the panel meanwhile stay).
So Ctrl+Z / redo, "Undo AI turn" and Discard in confirm mode revert scenario data and states together.
The app writes the tab cache right after a scenario change (like the panel). Headless MCP: scenarios
are read from and written to the file's step pages (`scenario-format.ts`).

The system prompt (`system-prompt.ts`) teaches the Railway Script from the same sources as its JSON
Schema (catalogue fields, aliases, state keys, nested lists, joints), the three built-in examples and
the conventions (km chainage, nominal = increasing km = left to right, signals on the right of their
direction, ETCS NID_C/NID_BG/RBC, ID prefixes). It is deterministic, so it is cached.

It also prescribes **templates first**: for "prepare / draw a layout or scenario" requests the model
searches the templates with the user's keywords, picks the closest, inserts it (new tab unless asked
otherwise), inspects and adapts it (move/rename/add/remove objects, routes, states), builds from
scratch only when nothing fits, and tells the user which template it used. It teaches the scenario
workflow (states → step, `build_scenario` for a whole scenario, typical train movement steps, PlantUML
message sequences) and a Polish → English railway vocabulary (rozjazd = points, odcinek izolowany =
track section, przebieg = route, wjazd/wyjazd = entry/exit, zajęty/wolny = occupied/free, …).

## In-app chat

Right panel **AI** (`[data-right-panel="ai"]`; the chunk with the Anthropic SDK loads on first show).

- **Settings**: API key (password field, Show/Hide, Save, Remove; shown masked `sk-ant-…abcd`),
  model (default **Claude Opus 5.5**, also Sonnet 5.5, Haiku 5.5, Fable 5.1 or any model id), effort
  (default high), **Confirm each change**.
- **Prompt box**: Enter sends, Shift+Enter new line, Esc stops while running. The answer streams;
  the model's summarized thinking is in a collapsed "Thinking" line; Markdown is rendered (images are
  never loaded).
- **Tool log**: one line per call, e.g. `✓ Applied Railway Script: 1 track, 2 points, 5 signals`,
  `✓ Inserted template "Level transition L1 → L2" as new tab (S2, S4_Exit, S6)` (into a tab: the renamed
  ids, `S2→S7, TC1→TC5 …`), `✓ Added step 2 "Train enters TC3" to scenario "Wjazd"`,
  `✓ Built scenario "Wjazd" with 3 steps`; errors show the first `line:col` problems.
- **Confirm mode**: each change is applied, shown on the canvas with a summary (`3 added, 1 changed`)
  and waits for **Keep** / **Discard**; Discard undoes it and tells the model. Scenario tools add the
  line "Scenarios: changed (Discard removes this change too)"; Discard reverts the scenario data with
  the states (same undo step).
- **Stop** aborts the stream or the waiting tool; unanswered tool calls are closed properly.
- **Undo AI turn** undoes every edit of the last turn (only while they are still the newest edits of
  their tab; later manual edits are kept and reported).
- **New conversation** forgets the history (the drawing stays).

API details (claude-api skill): `client.beta.messages.stream` (official SDK `@anthropic-ai/sdk`,
`dangerouslyAllowBrowser: true`), `max_tokens` 64000, adaptive thinking with summarized display,
`output_config.effort`, top-level `cache_control` (tools + system + history cached), tools with
`eager_input_streaming` (inputs are validated before running; `max_tokens`/`refusal` stops never run
tools), server-side refusal fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`)
for models that support it, append-only history (thinking blocks sent back unchanged), at most 30
tool rounds per turn.

### Security of the key

- Stored only in this browser: localStorage `rd.ai.settings`. Never in the diagram cache, files,
  share links or any Railway Drawer server; never logged. Sent only to `api.anthropic.com`.
- The browser calls the API directly; the SDK marks this with the header
  `anthropic-dangerous-direct-browser-access: true`. Anyone who can run script in this page
  (an XSS, a malicious browser extension) or use this browser profile can read the key. Use a key
  with a spending limit (Console > Limits), don't use shared computers, press Remove when done.
- What the model receives: your prompts and the tool results (the active tab's script, cell
  summaries, exports you ask for). Tools never send data anywhere else; assistant Markdown is
  sanitized and images in it are not loaded (no exfiltration through image URLs).
- No CSP `connect-src` is set by the site (index.html / Worker); if one is added, allow
  `https://api.anthropic.com` (and `wss:` same origin for the bridge).

## MCP

### Remote (production site)

1. Open the app, right panel **AI** > **Connect to AI assistant (MCP)** > **Create pairing code**.
   The panel shows the status (Connected / Connecting), the Claude Code command, the bare pairing
   code `rdp1.<session>.<secret>` (send it as `Authorization: Bearer`) and, last, the MCP URL with the
   code in it. Keep the tab open (calls run in it, on the active
   tab). The code is valid while you keep it, at most 12 hours; **New code** / **Disconnect** revoke it.
2. Configure the client. Prefer the **Bearer header**: `?pair=` puts the code into the URL, which
   clients, proxies and request logs (Cloudflare's own included) may keep. The URL form is only for
   clients that cannot send headers; the code expires after at most 12 h and **New code** revokes it.
   The app never logs URLs with the code (`redactUrl`), and the MCP handler gets the request without it.
   - **claude.ai** (Settings > Connectors > Add custom connector) or **Claude Desktop** (Settings >
     Connectors > Add custom connector): URL =
     `https://railwaydrawer.mksystemdesign.org/mcp?pair=rdp1.<session>.<secret>`, no OAuth.
   - **Claude Code**:
     `claude mcp add --transport http railway-drawer https://railwaydrawer.mksystemdesign.org/mcp --header "Authorization: Bearer rdp1.<session>.<secret>"`
   - Any client config JSON (e.g. `.mcp.json`):
     ```json
     { "mcpServers": { "railway-drawer": { "type": "http", "url": "https://railwaydrawer.mksystemdesign.org/mcp",
       "headers": { "Authorization": "Bearer rdp1.<session>.<secret>" } } } }
     ```
3. Ask: "Draw a station with two points and four signals in Railway Drawer". The calls appear in the
   AI panel log as `MCP · ✓ …`. Changes from REMOTE MCP clients wait for Keep / Discard by default
   (AI settings > **Confirm changes from remote MCP clients**, on unless turned off; the in-app chat
   and the local bridge follow **Confirm each change**). The MCP call waits up to 3 minutes; an
   undecided change is discarded 10 s before that, so the drawing never keeps a change the client was
   told failed.

Abuse limits (`src/ai/mcp/guard.ts`, applied by the Worker): `/mcp` is rate limited per client IP
(120/min) and globally (1200/min) with the Workers Rate Limiting binding (`ratelimits` in
`wrangler.jsonc`; counters are per Cloudflare location, a cheap first gate) BEFORE a Durable Object is
addressed; the per-pairing relay limit (60 calls/min) stays. Only well-formed session ids reach a
Durable Object; a DO cannot be looked up without creating it, so a random well-formed id still
instantiates an empty object that answers "unknown pairing" — the rate limits bound how many (a
registry of live sessions in KV would need a write per pairing and is not worth it). Browser sockets:
a socket must send a valid hello within 10 s or is closed; sockets waiting for their hello are capped
(4) separately from paired ones, so unauthenticated sockets cannot lock the real tab out. The
Worker's own answers carry `API_SECURITY_HEADERS` (CSP `default-src 'none'`, nosniff, no-referrer,
no-store).

How it works: `/mcp` is a stateless Streamable HTTP MCP endpoint (official SDK
`@modelcontextprotocol/server`, `createMcpHandler`, JSON responses). The pairing token comes from
`Authorization: Bearer` or `?pair=`; tool inputs are validated against the schemas, then relayed by
RPC to the Durable Object `AiBridge` named by the session. The browser connected to that DO with
`wss://<site>/api/ai-bridge/<session>/ws` and registered SHA-256(secret); the DO compares in constant
time, forwards the call over the WebSocket, waits for the result (180 s) and returns it (PNG exports as
MCP image content). The DO uses the WebSocket Hibernation API, keeps only `{hash, expiry}` in its
storage and deletes it with an alarm at the expiry.

Decision: the Worker uses `@modelcontextprotocol/server`'s `createMcpHandler` directly instead of
the Agents SDK `McpAgent` — the Agents docs mark `McpAgent` deprecated in favour of
`createMcpHandler`, the server needs no per-MCP-session state (all state is the pairing, held by our
own Durable Object), and the `agents` package would add a large dependency tree (esbuild, babel,
rolldown plugins) to the build for nothing.

### Local (offline / LAN, `tools/mcp-local`)

```bash
npm ci
npm run build:mcp-local          # -> tools/mcp-local/dist/railway-drawer-mcp.mjs
```

1. In the app: AI panel > Connect to AI assistant > **Local MCP server**: copy the config. It holds a
   long-lived local token (this browser's localStorage `rd.ai.local`; **New local token** rotates it)
   and the port (default 7391).
2. Put it into Claude Desktop (`claude_desktop_config.json`) or Claude Code (`.mcp.json` /
   `claude mcp add-json railway-drawer-local '<json>'`):
   ```json
   { "mcpServers": { "railway-drawer-local": { "command": "node",
       "args": ["/path/to/railway-drawer/tools/mcp-local/dist/railway-drawer-mcp.mjs"],
       "env": { "RAILWAY_DRAWER_TOKEN": "rdp1.<session>.<secret>", "RAILWAY_DRAWER_PORT": "7391" } } } }
   ```
   Optional env: `RAILWAY_DRAWER_FILE=/path/plan.drawio` (headless mode below),
   `RAILWAY_DRAWER_ORIGINS` (comma-separated page origins allowed to connect; default the production
   site, `http://192.168.0.22`, `http://localhost:*`, `http://127.0.0.1:*`).
3. Start the MCP client (it starts the server), then press **Connect local server** in the panel.

Browser rules: an https page may open `ws://127.0.0.1` (localhost is a potentially trustworthy
origin, so it is not mixed content in Chrome, Edge and Firefox; Safari blocks it). Newer Chrome
versions may ask "Allow this site to access devices on your local network" (Local Network Access) —
allow it. The plain-http LAN copy can always connect. The server listens on 127.0.0.1 only, refuses
other page origins, and only the browser that knows the token's secret can attach.

**Headless mode**: when no browser is connected and `RAILWAY_DRAWER_FILE` is set, the server runs the
same tool core in Node (jsdom + maxGraph) on that `.drawio` file: it reads the first page (compressed
pages too) and its Railway Script, runs the tool, and writes the file back after every change (other
pages kept verbatim). Not available there: `export_drawing` png/svg (no rendering engine) — use
drawio / railml / Railway Script. Undo works within the server process.

### Cloudflare: what to do before it works on the domain

Nothing has been changed in the Cloudflare account. After the reviewed push, Workers Builds deploys
the new `wrangler.jsonc` (now a Worker script + the same static assets):

- `main: worker/index.ts`, `assets.binding: ASSETS`, `run_worker_first: ["/mcp", "/mcp/",
  "/api/ai-bridge/*"]` — every other request is served from `dist/` exactly as before (SPA
  not-found handling), without running the script.
- Durable Object binding `AI_BRIDGE` -> class `AiBridge`, migration `v1` with
  `new_sqlite_classes: ["AiBridge"]` (works on the Workers Free plan). The first deploy applies the
  migration automatically; nothing to create by hand.
- Build command stays `npm run build` (Workers Builds runs `npm ci`; `@modelcontextprotocol/server`
  is a regular dependency).

**Cloudflare Access** (the whole site is behind Access, email OTP): MCP clients cannot do the OTP
login, so add one more Access application for the MCP path **before** pairing:

1. Zero Trust > Access > Applications > Add an application > Self-hosted.
2. Name "Railway Drawer MCP"; destinations: `railwaydrawer.mksystemdesign.org` path `mcp`, and the
   workers.dev hostname of the Worker with path `mcp` (Access matches the path and everything below).
3. Policy: **Action Bypass**, Include **Everyone**. Save. (A more specific path wins over the
   site-wide application, so only `/mcp` is opened.)

Why Bypass and not Service Auth: claude.ai custom connectors and the Claude Desktop connector dialog
take only a URL (or OAuth), so they cannot send `CF-Access-Client-Id` / `CF-Access-Client-Secret`
headers; Service Auth would only work with Claude Code (`--header` twice). `/mcp` is protected by the
pairing secret (256 random bits, hashed, constant-time compared, rate limited to 60 calls/min, bodies
<= 512 KB, up to 12 h, revocable), returns nothing without it, and only reaches a drawing while its
owner's tab is open and paired. If you prefer Service Auth anyway (Claude Code only): create a service
token, set the policy action to Service Auth with that token, and add
`--header "CF-Access-Client-Id: <id>" --header "CF-Access-Client-Secret: <secret>"` to the
`claude mcp add` command.

Leave `/api/ai-bridge/*` under the normal Access policy: the browser opens that WebSocket from the
logged-in page (same origin), so the `CF_Authorization` cookie is sent with the upgrade request and
Access validates it like any page request (Access supports WebSockets). The Worker also refuses the
upgrade unless the `Origin` is the site itself. If the bridge shows "Connecting…" forever on the
domain, check the Access logs for the `/api/ai-bridge/` request (an expired Access session needs a
page reload).

## Safety summary

- The chat's key never leaves the browser except to api.anthropic.com; the MCP paths involve no
  Anthropic key at all.
- Tools only read/modify the active diagram and return results to the model that asked; no tool
  makes network requests.
- Pairing: random session + secret, only the hash is sent/stored, constant-time compare, expiry
  (<= 12 h, alarm cleanup), one paired browser window per pairing (a new window replaces the old),
  at most 4 sockets per pairing, same-origin WebSocket only, frames <= 2 MB, MCP bodies <= 512 KB,
  60 tool calls/min, 180 s per call, every input validated against its schema.
- Local server: 127.0.0.1 only, origin allow-list, token secret required, stdout reserved for MCP
  (logs on stderr).

## Files

- `src/ai/tool-defs.ts`, `schema-check.ts`, `tools.ts`, `target.ts`, `shape-search.ts`, `system-prompt.ts`
- `src/ai/app-target.ts` (active tab), `src/ai/ai-panel.ts` + `.css`, `src/ai/install-ai.ts` (main chunk)
- `src/ai/chat/chat-loop.ts`, `chat/settings.ts`
- `src/ai/bridge/protocol.ts`, `relay.ts`, `client.ts`, `pairing.ts`; `src/ai/mcp/mcp-server.ts`, `mcp/http.ts`
- `worker/index.ts`, `worker/ai-bridge.ts`, `worker/env.ts`, `worker/tsconfig.json`; `wrangler.jsonc`
- `tools/mcp-local/` (Node stdio server: `src/main.ts`, `src/bridge-server.ts`, `src/headless.ts`, `vite.config.ts`)
- Tests: `src/ai/__tests__/` (tools on a jsdom tab, system prompt, chat loop with a mocked Messages
  API over SSE, bridge protocol/relay, MCP endpoint, local server), `tests/e2e/ai.spec.ts`.
