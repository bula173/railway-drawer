# PlantUML

Two product features use PlantUML text. They have different jobs and different pipelines; there is
no third one (the earlier "generic" canvas fallback and the renderers' unused non-group `render()`
methods were dead and are removed).

| Feature | Input | Output | Pipeline |
|---|---|---|---|
| **PlantUML editor** (left panel tab "PlantUML", Extras > PlantUML Editor) | PlantUML text typed in the tab | editable maxGraph cells in a PlantUML group on the canvas | `services/plantuml-parser.ts` -> `services/{sequence,class,state,activity,component}-diagram-renderer.ts` (`renderIntoGroup`) |
| **Scenario step UML** (step editor, step view, scenario HTML / PDF / slides export) | the `uml` text of a scenario step (`rdStepUml`) | a read-only SVG picture | `scenarios/step-uml.ts` `renderStepUml` -> `services/plantuml-sequence-svg.ts` (local, offline) or `services/plantuml-server.ts` (only when the user configured a server) |

## PlantUML editor -> canvas

- `ui/plantuml-editor.ts` `PlantUmlEditorController`: one view for the app (TabManager's session views,
  `ui/session.ts`): the tab's panel is built once, it renders into and follows the selection of the active
  tab's graph. Render: `PlantUmlParser.parse(text)` detects the type (`sequence` when no other is named:
  `class`, `state`, `activity`, `component`) and parses elements + connections with regular expressions; the
  renderer of that type draws them into a group cell (`plantuml-group-manager.ts` `createPlantUmlGroup`), one
  undoable model edit. Selecting such a group loads its source back into the editor; Render then replaces the
  group's children (`updatePlantUmlSource`).
- The source is stored on the group cell: style key `rdPlantUml` (base64 JSON, written / read by
  `services/drawio-xml.ts`, survives a re-save in draw.io) plus, for earlier app versions, the
  `PLANTUML_METADATA_UTF8` comment after the model (`document/diagram-document.ts` embeds / restores it;
  the legacy Latin-1 `PLANTUML_METADATA` comment is still read).
- Scope: participants / plain messages / one-line notes for sequence diagrams, classes and relations,
  states and transitions, activities, components. Editable cells are the point; fidelity to PlantUML's
  own layout is not.

## Scenario step UML -> SVG

- `scenarios/step-uml.ts` `renderStepUml(source)`: sequence diagrams (`isSequenceDiagram`) are rendered by
  `services/plantuml-sequence-svg.ts` (a lazy chunk, loaded on the first rendering): a fuller sequence
  parser (all participant kinds, arrows, notes, refs, groups, activations, dividers, delays, autonumber) and
  a PlantUML-like layout; unknown lines become warnings; all text escaped, colours validated.
- Other diagram types go to a PlantUML server only when the user set one (`rd.plantuml.server`, no default;
  GET `<server>/svg/<encoded>`, PlantUML's deflate + base64 text encoding, credentials omitted, 15 s
  timeout); the answer is sanitized (`security/sanitize.ts` `sanitizeSvgMarkup`) and cached per
  server + text. Without a server the step shows how to enable it. Nothing is sent anywhere otherwise
  (`tests/e2e/scenario-uml-text.spec.ts` fails on any PlantUML server request).
- The same results feed the step view's side panel and the scenario exports (HTML, PDF, slides).

## Why two parsers

The canvas editor needs elements it can turn into editable cells for five diagram types; the step UML needs
a faithful, offline picture of the sequence-diagram subset scenarios use. Merging them would change what the
editor draws (a behaviour change), so they stay separate, each with one job. Tests:
`src/__tests__/services/plantuml-scenario.test.ts` (sequence parser / SVG, server encoding, no request
without a server), `src/__tests__/ui/plantuml-editor-panel.test.ts` (editor panel), the e2e specs above.
