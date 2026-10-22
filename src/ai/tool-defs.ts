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
  | 'insert_template'
  | 'check_drawing'
  | 'export_drawing'
  | 'undo';

/** Railway object kinds of the catalogue (src/railway/catalogue.ts; a test keeps them equal). */
export const AI_KIND_IDS = ['signal', 'balise', 'baliseGroup', 'track', 'trackSection', 'points', 'levelCrossing', 'bufferStop', 'rbc', 'leu', 'axleCounter', 'train', 'route'] as const;

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
const num = (description: string): ToolSchema => ({ type: 'number', description, minimum: -1_000_000, maximum: 1_000_000 });

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
      'Sets runtime states (not infrastructure) in ONE undo step. state: sections/tracks/points/routes free|occupied|reserved|overlap|locked|disturbed, level crossings open|closed|disturbed, balises/LEUs/axle counters free|disturbed. aspect: signals stop|proceed|caution|shunt|dark. position: points normal|reverse|moving|outOfControl. A value of "" resets that dimension; reset=true resets the listed objects; resetAll=true resets every object.',
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
    title: 'List templates',
    description: 'Lists diagram templates (built-in ERTMS scenario diagrams such as level transitions, and the user\'s own templates), optionally filtered by words.',
    input_schema: obj({ query: str('Filter words (optional).', 120) }),
    mutating: false,
  },
  {
    name: 'insert_template',
    title: 'Insert template',
    description: 'Inserts a template (id from list_templates) into the active tab centred on x/y (default: the view centre) in ONE undo step, or opens it as a new tab with newTab=true.',
    input_schema: obj({ id: str('Template id.', 80), x: num('Centre x.'), y: num('Centre y.'), newTab: { type: 'boolean' } }, ['id']),
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
];

export function getToolDef(name: string): AiToolDef | undefined {
  return AI_TOOLS.find((t) => t.name === name);
}
