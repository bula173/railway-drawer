# Backlog

Feature ideas agreed with the product owner (2026-10-23) and not scheduled yet. In progress at the time of
writing: interlocking table with route conflicts, rule checks, animated train run, print sheets.

## Railway engineering

- **ETCS balise data.** Edit and export ETCS packets per balise group (5, 12, 21, 27, 41, 44, …); distances
  computed from km and topology.
- **Speed profiles and braking curves.** SSP, gradient and MA charts along a route, computed from the drawing;
  simplified ETCS braking curves to verify overlaps and EoA.

## Scenarios

- **Scenarios as test cases.** Generate a test specification (Given/When/Then) from scenario steps, with linked
  requirements and expected states; export to Excel/PDF or an ALM tool.

## Documentation and collaboration

- **Version comparison.** Diff two `.drawio` files or two GitLab commits on the drawing (added, removed, changed)
  plus a change list for the review record.
- **Comments and approvals.** Comments pinned to objects, review status (to review / accepted / rejected) and
  history, for verification and validation (EN 50128 / EN 50716 style).
- **Real-time collaboration.** Several users editing one drawing; the Worker with Durable Objects already exists.

## Integrations

- **Requirements traceability.** Link objects (signals, routes) to requirement ids in ALM OS, DOORS or Polarion;
  coverage report.
- **DXF/DWG import and export.** CAD background as a tracing layer; schematic export to DXF.
- **Company template and symbol library.** Shared, versioned library (GitLab or server) for the whole team.

## AI

- **AI drawing review.** "Check this plan": list of suspicious places, referencing the rule checks.
- **Documentation generation.** Station technical description, route descriptions, PL↔EN translation of labels
  and documents.
