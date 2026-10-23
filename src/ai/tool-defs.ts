/**
 * @file tool-defs.ts
 * @brief The AI tool set of Railway Drawer: names, descriptions and JSON Schemas of the tools that
 *        operate on the active diagram tab. Pure data (no DOM, no app imports): the in-app chat sends
 *        these to the Messages API, the Worker's remote MCP endpoint and the local MCP server list
 *        them to MCP clients, and every input is checked against `input_schema` (schema-check.ts)
 *        before a tool runs. Executors: tools.ts.
 */
import type { ToolSchema } from './schema-check';

export interface AiToolDef {
  name: AiToolName;
  /** Short title for logs and MCP clients. */
  title: string;
  description: string;
  input_schema: ToolSchema;
  /** The tool changes the drawing (one undo step per call; previewed in "confirm" mode). */
  mutating: boolean;
}

export type AiToolName =
  | 'get_drawing'
  | 'apply_railway_script'
  | 'add_shapes'
  | 'search_shapes'
  | 'delete_cells'
  | 'set_states'
  | 'routes'
  | 'list_templates'
  | 'describe_template'
  | 'insert_template'
  | 'check_drawing'
  | 'export_drawing'
  | 'undo'
  | 'list_scenarios'
  | 'create_scenario'
  | 'update_scenario'
  | 'add_scenario_step'
  | 'update_scenario_step'
  | 'delete_scenario_step'
  | 'reorder_scenario_steps'
  | 'build_scenario'
  | 'view_scenario'
  | 'export_scenario'
  | 'set_title_block'
  | 'export_sheets';

/** Railway object kinds of the catalogue (src/railway/catalogue.ts; a test keeps them equal). */
export const AI_KIND_IDS = ['signal', 'balise', 'baliseGroup', 'track', 'trackSection', 'points', 'levelCrossing', 'bufferStop', 'rbc', 'leu', 'axleCounter', 'insulatedJoint', 'train', 'route'] as const;

/** Largest Railway Script a tool accepts (characters). */
export const MAX_SCRIPT_CHARS = 200_000;
/** Most shapes / edges per add_shapes call. */
export const MAX_SHAPES = 60;
export const MAX_EDGES = 120;

const obj = (properties: Record<string, ToolSchema>, required: string[] = []): ToolSchema => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const str = (description: string, maxLength = 200): ToolSchema => ({ type: 'string', description, maxLength });
/** Most steps per build_scenario call. */
export const MAX_SCENARIO_STEPS = 30;

/** Runtime states of a scenario step (same values as set_states). */
const STEP_STATES: ToolSchema = {
  type: 'array',
  maxItems: 300,
  description: 'Object states of the step: [{id, state|aspect|position}] ("" = back to the default free/stop/normal).',
  items: obj(
    {
      id: str('Railway object id, e.g. TC3, S2, W1.', 80),
      kind: { type: 'string', enum: [...AI_KIND_IDS], description: 'Kind when the id is ambiguous.' },
      state: str('State value or "".', 40),
      aspect: str('Signal aspect or "".', 40),
      position: str('Points position or "".', 40),
    },
    ['id']
  ),
};
const STEP_ROUTES: ToolSchema = {
  type: 'array',
  maxItems: 30,
  description: 'Route actions run before `states`: set (sections reserved, points positioned, entry signal proceed), occupy, release.',
  items: obj({ id: str('Route id, e.g. R1.', 80), action: { type: 'string', enum: ['set', 'occupy', 'release'] } }, ['id', 'action']),
};
const SCENARIO_REF = str('Scenario id or exact name.', 120);
const STEP_REF: ToolSchema = { type: ['integer', 'string'], description: 'Step number (1 = first), step id or step name.', minimum: 1, maxLength: 120 };
const STEP_UML = str('PlantUML source shown beside the drawing (usually a sequence diagram: @startuml … @enduml). Optional.', 20_000);
const STEP_TEXT = str('Markdown text of the step (explanation for the reader). Optional.', 20_000);
const num = (description: string): ToolSchema => ({ type: 'number', description, minimum: -1_000_000, maximum: 1_000_000 });
const TITLE_FIELD = (what: string): ToolSchema => str(what, 300);

export const AI_TOOLS: readonly AiToolDef[] = [
  {
    name: 'get_drawing',
    title: 'Read the drawing',
    description:
      'Reads the active diagram tab: its Railway Script (the stored script, or one generated from the railway objects of the drawing when the tab has none), counts of railway objects by kind, and a summary of the other (non-railway) cells with ids, labels, shapes and bounds. Call this first, then edit the returned script and apply it with apply_railway_script.',
    input_schema: obj({
      includeScript: { type: 'boolean', description: 'Include the Railway Script text (default true).' },
      maxCells: { type: 'integer', minimum: 0, maximum: 300, description: 'Most non-railway cells to list (default 80).' },
    }),
    mutating: false,
  },
  {
    name: 'apply_railway_script',
    title: 'Apply Railway Script',
    description:
      'Replaces the Railway Script of the active tab with `script` (YAML or JSON, railwayScript: 1) and redraws the railway layout from it in ONE undo step: objects that are gone are removed, new ones added, changed ones updated; cells the script does not own stay. Send the COMPLETE script every time (not a fragment). With errors nothing changes and the errors are returned with line:col; fix them and call again.',
    input_schema: obj({ script: { type: 'string', minLength: 1, maxLength: MAX_SCRIPT_CHARS, description: 'The complete Railway Script (YAML preferred).' } }, ['script']),
    mutating: true,
  },
  {
    name: 'add_shapes',
    title: 'Add shapes',
    description:
      'Adds generic draw.io shapes (not railway layout: use apply_railway_script for tracks, points, signals, balises, routes...) and connectors in ONE undo step. `shape` is a name from search_shapes (e.g. "general-0-rectangle"), a shape title ("Rectangle", "Ellipse", "Text", "Cylinder"), or a draw.io style string ("shape=hexagon;fillColor=#dae8fc;"). x/y are the top-left corner in drawing units (the railway layout starts at about x=40, y=80; lanes are 80 apart). Edges connect `key`s of shapes of this call or ids of existing cells.',
    input_schema: obj(
      {
        shapes: {
          type: 'array',
          maxItems: MAX_SHAPES,
          items: obj(
            {
              key: str('Local name to connect edges to (optional).', 60),
              shape: str('Shape name, title or draw.io style.', 400),
              label: str('Text of the shape (optional).', 2000),
              x: num('Left (drawing units).'),
              y: num('Top (drawing units).'),
              width: { type: 'number', minimum: 1, maximum: 5000 },
              height: { type: 'number', minimum: 1, maximum: 5000 },
              style: str('Extra draw.io style keys, e.g. "fillColor=#fff2cc;strokeColor=#d6b656;rounded=1;" (optional).', 400),
            },
            ['shape', 'x', 'y']
          ),
        },
        edges: {
          type: 'array',
          maxItems: MAX_EDGES,
          items: obj(
            {
              from: str('Shape key of this call or an existing cell id.', 80),
              to: str('Shape key of this call or an existing cell id.', 80),
              label: str('Edge label (optional).', 500),
              style: str('draw.io edge style (optional), e.g. "edgeStyle=orthogonalEdgeStyle;dashed=1;".', 400),
            },
            ['from', 'to']
          ),
        },
      },
      []
    ),
    mutating: true,
  },
  {
    name: 'search_shapes',
    title: 'Search shapes',
    description: 'Searches the shape catalogue (draw.io palettes, the ERTMS library, user libraries) by words. Returns names usable as add_shapes `shape`.',
    input_schema: obj({ query: str('Search words, e.g. "cylinder", "cloud", "signal".', 120), limit: { type: 'integer', minimum: 1, maximum: 30 } }, ['query']),
    mutating: false,
  },
  {
    name: 'delete_cells',
    title: 'Delete cells',
    description: 'Deletes cells by cell id or railway object id (e.g. "S1"), or everything with all=true, in ONE undo step. Railway objects owned by the Railway Script come back on the next apply unless removed from the script too.',
    input_schema: obj({
      ids: { type: 'array', maxItems: 500, items: str('Cell id or railway object id.', 80) },
      all: { type: 'boolean', description: 'Delete every cell of the tab (and clear its Railway Script).' },
    }),
    mutating: true,
  },
  {
    name: 'set_states',
    title: 'Set object states',
    description:
      'Sets runtime states (not infrastructure) in ONE undo step. state: sections/tracks/points/routes free|occupied|reserved|overlap|locked|disturbed, level crossings open|closed|disturbed, balises/LEUs/axle counters/joints free|disturbed. aspect: signals stop|proceed|caution|shunt|dark. position: points normal|reverse|moving|outOfControl. A value of "" resets that dimension; reset=true resets the listed objects; resetAll=true resets every object.',
    input_schema: obj({
      items: {
        type: 'array',
        maxItems: 300,
        items: obj(
          {
            id: str('Railway object id, e.g. TC2, S1, W1, R1.', 80),
            kind: { type: 'string', enum: [...AI_KIND_IDS], description: 'Kind when the id is ambiguous.' },
            state: str('State value or "".', 40),
            aspect: str('Signal aspect or "".', 40),
            position: str('Points position or "".', 40),
            reset: { type: 'boolean' },
          },
          ['id']
        ),
      },
      resetAll: { type: 'boolean' },
    }),
    mutating: true,
  },
  {
    name: 'routes',
    title: 'Routes',
    description:
      'Route operations on the drawn topology. list: routes with entry/exit, points, sections, conflicts. find: possible paths from signal `from` to signal `to` (in the signal direction). add: creates route `id` (default R<n>) along path index `path` (default 0) of find. set|occupy|release: sets the route (sections reserved, points positioned, entry signal proceed), occupies or releases it (runtime states). Routes can also be written in the Railway Script `routes` list.',
    input_schema: obj(
      {
        action: { type: 'string', enum: ['list', 'find', 'add', 'set', 'occupy', 'release'] },
        from: str('Entry signal id (find/add).', 80),
        to: str('Exit signal id (find/add).', 80),
        id: str('Route id (add/set/occupy/release).', 80),
        path: { type: 'integer', minimum: 0, maximum: 7 },
      },
      ['action']
    ),
    mutating: true,
  },
  {
    name: 'list_templates',
    title: 'Search templates',
    description:
      'Searches the diagram templates (built-in ERTMS/ETCS scenario layouts such as level transitions, station entry/exit routes, end of authority, temporary speed restrictions, section timers…, and the user\'s own templates) and ranks them for `query` (English or Polish words, e.g. "level transition L2", "wjazd na stację", "ograniczenie prędkości"). Each result: id, display name, original name, summary (topic, ETCS level, object counts with signal ids), size. Use this FIRST when asked to prepare or draw a layout or scenario.',
    input_schema: obj({ query: str('Search words (EN/PL); empty = all templates.', 200), limit: { type: 'integer', minimum: 1, maximum: 60, description: 'Most results (default 20).' } }),
    mutating: false,
  },
  {
    name: 'describe_template',
    title: 'Describe template',
    description:
      'Describes one template before or after inserting it: its railway objects as a Railway Script generated from the template drawing (ids, kinds, tracks, km), the object ids by kind and its other labels, so you can plan what to move, rename, add, remove or set.',
    input_schema: obj({ id: str('Template id (from list_templates) or exact name.', 120) }, ['id']),
    mutating: false,
  },
  {
    name: 'insert_template',
    title: 'Insert template',
    description:
      'Inserts a template. mode newTab (default where tabs exist): opens it as a NEW diagram tab, which becomes the active tab for all later tool calls; object ids stay as in the template. mode intoTab: inserts it into the active tab in ONE undo step, centred on `at` (default: the view centre); ids already used in the drawing are renumbered and returned in `renamed` (template id -> new id). Returns the object ids by kind.',
    input_schema: obj(
      {
        id: str('Template id (from list_templates) or exact name.', 120),
        mode: { type: 'string', enum: ['newTab', 'intoTab'] },
        at: obj({ x: num('Centre x.'), y: num('Centre y.') }, ['x', 'y']),
      },
      ['id']
    ),
    mutating: true,
  },
  {
    name: 'check_drawing',
    title: 'Run checks',
    description: 'Runs the railway data checks (duplicate/missing ids and references, balises without group, signals off track, km order, route endpoints/paths/points) and returns the issues.',
    input_schema: obj({}),
    mutating: false,
  },
  {
    name: 'export_drawing',
    title: 'Export',
    description:
      'Exports the active tab. png: returns an image of the drawing (use it to look at the result). svg | drawio | railml | railway-script-yaml | railway-script-json: returns the text (cut at 100 000 characters). download=true also saves the file in the user\'s browser.',
    input_schema: obj({ format: { type: 'string', enum: ['png', 'svg', 'drawio', 'railml', 'railway-script-yaml', 'railway-script-json'] }, download: { type: 'boolean' } }, ['format']),
    mutating: false,
  },
  {
    name: 'undo',
    title: 'Undo',
    description: 'Undoes the last `steps` edits of the active tab (default 1; each tool call that changed the drawing is one step).',
    input_schema: obj({ steps: { type: 'integer', minimum: 1, maximum: 20 } }),
    mutating: true,
  },
  {
    name: 'list_scenarios',
    title: 'List scenarios',
    description: 'Lists the scenarios of the active tab (right panel › Scenarios): ids, names, descriptions and steps (number, id, name, whether it has UML / text).',
    input_schema: obj({ scenario: SCENARIO_REF }),
    mutating: false,
  },
  {
    name: 'create_scenario',
    title: 'Create scenario',
    description: 'Creates an empty scenario in the active tab (then add steps with add_scenario_step). To create a scenario with all its steps at once use build_scenario.',
    input_schema: obj({ name: str('Scenario name.', 80), description: str('Short description (optional).', 200) }, ['name']),
    mutating: true,
  },
  {
    name: 'update_scenario',
    title: 'Update scenario',
    description: 'Renames a scenario, changes its description, or deletes it (delete=true) in ONE undo step.',
    input_schema: obj({ scenario: SCENARIO_REF, name: str('New name.', 80), description: str('New description.', 200), delete: { type: 'boolean' } }, ['scenario']),
    mutating: true,
  },
  {
    name: 'add_scenario_step',
    title: 'Add scenario step',
    description:
      'Adds a step to a scenario in ONE undo step: first resets all states if resetStates=true, runs the route actions and sets the object states on the drawing, then captures the whole drawing as the step snapshot (exactly like the panel\'s "+ Add step"). States are INCREMENTAL: the drawing keeps the states of earlier steps; list only what changes. Unknown ids change nothing and the error lists the valid ids. captureDrawing=false makes a text/UML-only step that reuses the previous step\'s drawing.',
    input_schema: obj(
      {
        scenario: SCENARIO_REF,
        name: str('Step name, e.g. "Train enters TC3".', 80),
        description: str('Short description (optional).', 200),
        uml: STEP_UML,
        text: STEP_TEXT,
        states: STEP_STATES,
        routes: STEP_ROUTES,
        resetStates: { type: 'boolean', description: 'Reset every object to free/stop/normal before this step\'s routes and states (makes the step absolute).' },
        captureDrawing: { type: 'boolean', description: 'Capture the drawing (default true).' },
        position: { type: 'integer', minimum: 1, maximum: 1000, description: 'Insert at this step number (default: at the end).' },
      },
      ['scenario', 'name']
    ),
    mutating: true,
  },
  {
    name: 'update_scenario_step',
    title: 'Update scenario step',
    description:
      'Changes a step in ONE undo step: name, description, uml, text; with states/routes/resetStates they are applied to the CURRENT drawing and the step\'s snapshot is replaced by it (recapture=true recaptures without changes). Note the current drawing may show another step\'s states.',
    input_schema: obj(
      {
        scenario: SCENARIO_REF,
        step: STEP_REF,
        name: str('New name.', 80),
        description: str('New description.', 200),
        uml: STEP_UML,
        text: STEP_TEXT,
        states: STEP_STATES,
        routes: STEP_ROUTES,
        resetStates: { type: 'boolean' },
        recapture: { type: 'boolean', description: 'Replace the step drawing with the current drawing.' },
      },
      ['scenario', 'step']
    ),
    mutating: true,
  },
  {
    name: 'delete_scenario_step',
    title: 'Delete scenario step',
    description: 'Deletes one step of a scenario in ONE undo step.',
    input_schema: obj({ scenario: SCENARIO_REF, step: STEP_REF }, ['scenario', 'step']),
    mutating: true,
  },
  {
    name: 'reorder_scenario_steps',
    title: 'Reorder scenario steps',
    description: 'Moves step `step` to position `to`, or puts all steps in `order` (every step number once, e.g. [2, 1, 3]), in ONE undo step.',
    input_schema: obj(
      {
        scenario: SCENARIO_REF,
        step: STEP_REF,
        to: { type: 'integer', minimum: 1, maximum: 1000 },
        order: { type: 'array', maxItems: 1000, items: { type: 'integer', minimum: 1, maximum: 1000 } },
      },
      ['scenario']
    ),
    mutating: true,
  },
  {
    name: 'build_scenario',
    title: 'Build scenario',
    description:
      'Creates a scenario with all its steps in ONE call and ONE undo step. For each step in order: optional reset, route actions, object states, then the drawing is captured as that step. Semantics: steps are INCREMENTAL (cumulative) — each step starts from the previous step\'s drawing and changes only what it lists ("" = back to default); resetStates (top level, default true) resets every object to free/stop/normal before step 1, so the scenario starts from the drawing as drawn; resetStates on a step resets before that step (an absolute step). restoreDrawing=true puts the object states back afterwards (default: the drawing shows the last step). All ids are checked first: an unknown id changes nothing and the error lists the valid ids.',
    input_schema: obj(
      {
        name: str('Scenario name.', 80),
        description: str('Short description.', 200),
        resetStates: { type: 'boolean', description: 'Reset all states before step 1 (default true).' },
        restoreDrawing: { type: 'boolean', description: 'Put the object states back after capturing (default false).' },
        steps: {
          type: 'array',
          minItems: 1,
          maxItems: MAX_SCENARIO_STEPS,
          items: obj(
            {
              name: str('Step name.', 80),
              description: str('Short description (optional).', 200),
              uml: STEP_UML,
              text: STEP_TEXT,
              states: STEP_STATES,
              routes: STEP_ROUTES,
              resetStates: { type: 'boolean', description: 'Reset every object before this step.' },
            },
            ['name']
          ),
        },
      },
      ['name', 'steps']
    ),
    mutating: true,
  },
  {
    name: 'view_scenario',
    title: 'Show scenario',
    description: 'Opens the read-only scenario view for the user at a step (default 1): drawing, UML and text of the step with Prev/Next. Does not change anything.',
    input_schema: obj({ scenario: SCENARIO_REF, step: STEP_REF }, ['scenario']),
    mutating: false,
  },
  {
    name: 'export_scenario',
    title: 'Export scenario',
    description: 'Exports a scenario as a document and saves it in the user\'s browser: pdf (A4, one page per step), slides (HTML slideshow) or html (one page). showChanges highlights the changes between steps.',
    input_schema: obj(
      {
        scenario: SCENARIO_REF,
        format: { type: 'string', enum: ['pdf', 'slides', 'html'] },
        orientation: { type: 'string', enum: ['portrait', 'landscape'] },
        showChanges: { type: 'boolean' },
      },
      ['format']
    ),
    mutating: false,
  },
  {
    name: 'set_title_block',
    title: 'Set title block',
    description:
      'Sets the title block (tabliczka rysunkowa) printed on every sheet, the revision table and, with `sheet`, the sheet setup of the SHOWN page (A0-A4, portrait/landscape, fixed scale 1:n or fit, this page\'s sheet title / number). Only the given fields change; "" clears one. Labels print in Polish (lang pl, default) or English. Returns the values now set. Export the sheets with export_sheets.',
    input_schema: obj({
      project: TITLE_FIELD('Project name.'),
      title: TITLE_FIELD('Drawing title.'),
      drawingNumber: TITLE_FIELD('Drawing number.'),
      scale: TITLE_FIELD('Scale text ("" = from the sheet setup: 1:n or "bez skali").'),
      designed: TITLE_FIELD('Designed by / author.'),
      checked: TITLE_FIELD('Checked by.'),
      approved: TITLE_FIELD('Approved by.'),
      date: TITLE_FIELD('Date, e.g. 2026-10-24.'),
      revision: TITLE_FIELD('Revision ("" = the last row of the revision table).'),
      company: TITLE_FIELD('Company name.'),
      status: TITLE_FIELD('Status, e.g. "Do uzgodnień".'),
      lang: { type: 'string', enum: ['pl', 'en'] },
      revisions: {
        type: 'array',
        maxItems: 50,
        description: 'Replaces the revision table (oldest first).',
        items: obj({ rev: str('Revision, e.g. A.', 20), date: str('Date.', 40), description: str('What changed.', 300), author: str('Author.', 80), checked: str('Checked by.', 80) }, ['rev']),
      },
      sheet: obj({
        format: { type: 'string', enum: ['A0', 'A1', 'A2', 'A3', 'A4'] },
        orientation: { type: 'string', enum: ['portrait', 'landscape'] },
        scale: { type: 'number', minimum: 0, maximum: 1000, description: 'n of a fixed scale 1:n; 0 = fit the drawing to the sheet.' },
        sheetTitle: str('This page\'s sheet title ("" = the document title).', 300),
        sheetNumber: str('This page\'s sheet number ("" = its position).', 20),
        showBorder: { type: 'boolean', description: 'Show the sheet border on the canvas (default true).' },
      }),
    }),
    mutating: true,
  },
  {
    name: 'export_sheets',
    title: 'Export sheets (PDF)',
    description: 'Saves the drawing sheets as one PDF in the user\'s browser: one page per drawing page in its paper size, with frame, title block, revision table and legend. pages: 1-based page numbers (default all).',
    input_schema: obj({ pages: { type: 'array', maxItems: 200, items: { type: 'integer', minimum: 1, maximum: 1000 } } }),
    mutating: false,
  },
];

export function getToolDef(name: string): AiToolDef | undefined {
  return AI_TOOLS.find((t) => t.name === name);
}
