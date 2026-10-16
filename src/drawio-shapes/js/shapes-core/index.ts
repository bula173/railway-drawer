/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd
 * Copyright (c) 2006-2025, draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Registration of the vertex shapes and perimeters ported from jgraph/drawio v32.4.1
 * src/main/webapp/js/grapheditor/Shapes.js. Shape names are exactly draw.io's, so files keep
 * opening 1:1 in draw.io. Both functions are idempotent.
 */

import { CellRenderer, Perimeter, StyleRegistry, type Shape } from '@maxgraph/core';
import { BasicRect2Shape } from './basic-rect2';
import { SHAPES_CORE_PERIMETERS, SHAPES_CORE_PERIMETER_PROPERTY } from './perimeters';
import {
  CalloutShape,
  CardShape,
  CollateShape,
  CornerShape,
  CrossShape,
  CrossbarShape,
  CubeShape,
  CurlyBracketShape,
  CylinderShape3,
  DataStorageShape,
  DataStoreShape,
  DelayShape,
  DisplayShape,
  DocumentShape,
  DoubleArrowShape,
  ExtendedShape,
  GitTagShape,
  HexagonShape,
  InternalStorageShape,
  IsoCubeShape2,
  IsoRectangleShape,
  LineEllipseShape,
  LoopLimitShape,
  ManualInputShape,
  MermaidPersonShape,
  MermaidUsecaseActorShape,
  MessageShape,
  MindmapBangShape,
  NoteShape,
  OffPageConnectorShape,
  OrEllipseShape,
  OrShape,
  ParallelogramShape,
  ProcessShape,
  SingleArrowShape,
  SmileyFaceShape,
  SortShape,
  StepShape,
  SumEllipseShape,
  SwitchShape,
  TapeDataShape,
  TapeShape,
  TeeShape,
  TrapezoidShape,
  UmlActorShape,
  WaypointShape,
  WedgeCalloutShape,
  XorShape,
} from './shapes';

export * from './shapes';
export * from './perimeters';
export { BasicRect2Shape, BASIC_RECT2_CUSTOM_PROPERTIES, type Rect2Overrides } from './basic-rect2';
export {
  DrawioActor,
  DrawioCylinder,
  DrawioEllipse,
  DrawioRectangle,
  DrawioRhombus,
  DrawioShape,
  getDrawioConnectionConstraints,
  type DrawioConstrainedShape,
} from './base';

/** draw.io shape name -> constructor (registerShape line in Shapes.js@v32.4.1). */
export const SHAPES_CORE: Readonly<Record<string, typeof Shape>> = Object.freeze({
  process: ProcessShape, // 2526
  parallelogram: ParallelogramShape, // 2070
  hexagon: HexagonShape, // 2807, overrides maxGraph's core hexagon as draw.io does
  cylinder3: CylinderShape3, // 1491
  document: DocumentShape, // 1924
  internalStorage: InternalStorageShape, // 4815
  cube: CubeShape, // 1054
  step: StepShape, // 2779
  trapezoid: TrapezoidShape, // 2100
  tape: TapeShape, // 1886
  note: NoteShape, // 1321
  card: CardShape, // 1831
  callout: CalloutShape, // 2590
  wedgeCallout: WedgeCalloutShape, // 2749
  umlActor: UmlActorShape, // 3148
  xor: XorShape, // 5037
  or: OrShape, // 5017
  dataStorage: DataStorageShape, // 4998
  isoCube2: IsoCubeShape2, // 1382
  isoRectangle: IsoRectangleShape, // 1159
  curlyBracket: CurlyBracketShape, // 2123
  crossbar: CrossbarShape, // 4872
  waypoint: WaypointShape, // 1133
  ext: ExtendedShape, // 3080
  tapeData: TapeDataShape, // 5109
  manualInput: ManualInputShape, // 4768
  loopLimit: LoopLimitShape, // 5063
  offPageConnector: OffPageConnectorShape, // 5088
  delay: DelayShape, // 5410
  display: DisplayShape, // 5474
  singleArrow: SingleArrowShape, // 4939
  doubleArrow: DoubleArrowShape, // 4969
  cross: CrossShape, // 5447
  corner: CornerShape, // 4847
  tee: TeeShape, // 4906
  datastore: DataStoreShape, // 1265
  orEllipse: OrEllipseShape, // 5137
  sumEllipse: SumEllipseShape, // 5166
  lineEllipse: LineEllipseShape, // 5388
  sortShape: SortShape, // 5188
  collate: CollateShape, // 5215
  switch: SwitchShape, // 1512
  smileyFace: SmileyFaceShape, // 1805
  message: MessageShape, // 3109
  mindmapBang: MindmapBangShape, // 8637
  gitTag: GitTagShape, // 8484
  mermaidPerson: MermaidPersonShape, // 8764
  mermaidUsecaseActor: MermaidUsecaseActorShape, // 8890
  'mxgraph.basic.rect': BasicRect2Shape, // 6973
});

/**
 * Registers every shape of this unit with CellRenderer under its draw.io name and returns the
 * names. Safe to call repeatedly (re-registering the same constructor is a no-op).
 */
export function registerShapesCoreShapes(): string[] {
  const names = Object.keys(SHAPES_CORE);

  for (const name of names) {
    CellRenderer.registerShape(name, SHAPES_CORE[name]);
  }

  return names;
}

/**
 * Registers the perimeters with StyleRegistry under their draw.io style names (e.g.
 * `perimeter=parallelogramPerimeter`) and adds them to Perimeter under the mxPerimeter
 * property name (Perimeter.ParallelogramPerimeter) and the style name. Idempotent.
 */
export function registerShapesCorePerimeters(): string[] {
  const perimeter = Perimeter as unknown as Record<string, unknown>;
  const names = Object.keys(SHAPES_CORE_PERIMETERS);

  for (const name of names) {
    const fn = SHAPES_CORE_PERIMETERS[name];
    StyleRegistry.putValue(name, fn);
    perimeter[SHAPES_CORE_PERIMETER_PROPERTY[name]] = fn;
    perimeter[name] = fn;
  }

  return names;
}
