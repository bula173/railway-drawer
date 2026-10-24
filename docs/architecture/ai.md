# AI assistant

- One tool core for the in-app chat and MCP: `tool-defs.ts` (23 tools, JSON Schemas, `additionalProperties: false`),
  `schema-check.ts` (strict validator, also used by the Worker / local server), `tools.ts` `executeAiTool(target, name,
  input)` (never throws; at most ONE undoable edit per call, edits reported for "Undo AI turn"), `target.ts` `AiTarget`
  (graph, undo, Railway Script store/session, optional catalogue/templates/render/download), `app-target.ts` (the ACTIVE
  tab, resolved per call), `shape-search.ts`, `system-prompt.ts` (Railway Script reference generated from catalogue +
  language tables + `SCRIPT_TEMPLATES`, the "templates first" workflow, the scenario workflow and a PL -> EN railway
  vocabulary; deterministic for caching). Executors are split: `tools.ts` (drawing tools + dispatch), `tool-kit.ts`
  (outcome type, ToolError, id helpers), `step-actions.ts` (state/route resolution: everything checked before anything
  changes, unknown ids listed with the valid ones), `template-tools.ts` (list_templates: derived summary/ETCS level/
  counts/signal ids/size, PL/EN keyword ranking via `SYNONYMS` stems + stopwords; describe_template = generated Railway
  Script of the template; insert_template newTab|intoTab with `renamed` id map via `insertTemplate(..., onRenamed)`),
  `scenario-tools.ts` (list/create/update scenarios, add/update/delete/reorder steps, build_scenario, view_scenario,
  export_scenario on `AiTarget.scenarios()` = the tab's ScenarioSet; steps incremental, `resetStates` makes one absolute,
  build_scenario resets before step 1 by default, `restoreDrawing` optional). Scenario undo: ONE model edit per call =
  drawing changes + `ScenarioSetChange` (execute() swaps `ScenarioSet.captureState/restoreState` of the touched scenarios;
  others, e.g. made in the panel meanwhile, stay), so Ctrl+Z, Undo AI turn and confirm Discard revert both. App target:
  `scenariosChanged` flushes the tab cache, `showScenario`/`exportScenario` via `installedScenarios()` (install-scenarios
  `exportScenarioFile`: no dialog). `train-run-tool.ts` `simulate_train_run` (train run events, optional scenario in one
  undoable edit via `scenarioEdit`; [train-run.md](train-run.md)). Headless MCP: scenarios from/to the step pages. Pure modules (no DOM at import): tool-defs,
  schema-check, system-prompt, bridge/protocol, bridge/relay, mcp/* — keep them so (the Worker bundles them).
- Panel UX: the empty chat shows "Try:" example chips (`ai-example`, `AI_EXAMPLE_PROMPTS`) that fill the message box; the
  key privacy note is behind the "About your key" disclosure (`ai-about-key`); opening the panel focuses the message box,
  never the key field.
- Chat: right panel view `ai` (`index.html` `[data-right-panel="ai"]` -> `#ai-panel`; `install-ai.ts` in the main chunk
  lazy-loads `ai-panel.ts` with `@anthropic-ai/sdk`). `chat/chat-loop.ts` `ChatSession`: manual streaming loop on
  `client.beta.messages.stream` (user's key, `dangerouslyAllowBrowser`), adaptive thinking (summarized), effort, top-level
  `cache_control`, `eager_input_streaming` tools, `fallbacks: "default"` for models that support it, append-only history,
  30 tool rounds, Stop closes open tool_use blocks. `chat/settings.ts`: localStorage `rd.ai.settings` (key, model default
  `claude-opus-5-5`, effort, confirmChanges). Confirm mode applies, shows a diffSnapshots summary and waits Keep/Discard
  (Discard = `undoOwnEdits`). Assistant Markdown via scenarios/markdown.ts, images removed (no exfiltration via URLs).
- Bridge/MCP: `bridge/protocol.ts` (token `rdp1.<session>.<secret>`, SHA-256 hash via the pure-JS sha256 of gitlab/pkce.ts,
  frames, limits), `bridge/relay.ts` `BridgeRelay` (hello/claim, constant-time auth, expiry <= 12 h, one browser,
  60 calls/min, 180 s timeout), `bridge/client.ts` (browser WebSocket, sequential calls, backoff), `bridge/pairing.ts`
  (sessionStorage `rd.ai.pairing`, localStorage `rd.ai.local`, client configs), `mcp/mcp-server.ts`
  (`@modelcontextprotocol/server` McpServer, JSON Schemas as Standard Schema), `mcp/http.ts` (stateless `createMcpHandler`,
  Bearer preferred, `?pair=` only for header-less clients — never logged, `redactUrl`, stripped before the handler; 512 KB
  cap), `mcp/guard.ts` (per-IP + global `/mcp` rate limits via Workers Rate Limiting bindings before any DO, 10 s hello
  timeout, unpaired sockets capped separately, API security headers). Remote MCP edits ask Keep / Discard by default
  (`confirmRemoteChanges`, source `mcp-remote`); the chat and the local bridge keep `confirmChanges`. Worker: `worker/index.ts` (`/mcp`, `/api/ai-bridge/<session>/ws` same-origin only,
  else ASSETS), `worker/ai-bridge.ts` Durable Object `AiBridge` (hibernation API, pairing in storage, alarm cleanup).
  Local: `tools/mcp-local/src` (`main.ts` stdio, `bridge-server.ts` ws on 127.0.0.1 with origin allow-list,
  `headless*.ts` jsdom + tool core on a `.drawio` file).
- Tests: `src/ai/__tests__/` (tools on a jsdom tab, `scenario-tools.test.ts` (scenario tools, undo, errors, template
  analysis/ranking PL/EN, id mapping), system prompt, chat loop against a fake SSE Messages API incl. the template-first
  flow, protocol/relay, MCP endpoint over HTTP (tool list), local bridge + headless file incl. scenarios),
  `tests/e2e/ai.spec.ts`, `tests/e2e/ai-scenarios.spec.ts`; the AI panel is in theme-contrast.
- Print sheets: `set_title_block` / `export_sheets` run on `AiTarget.setTitleBlock` / `exportSheets` (app-target.ts -> lazy `src/print/ui/ai-sheets.ts`); see [print-sheets.md](print-sheets.md).
