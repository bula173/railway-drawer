/**
 * @file index.ts
 * @brief Legacy draw.io arrows2 shape exports.
 *
 * The 18 hand-written ports that used to live here are replaced by the full
 * port of draw.io shapes/mxArrows.js (jgraph/drawio v32.4.1) in
 * src/drawio-shapes/js/mx-libs/arrows2. The old class names stay exported as
 * aliases of the new implementations so existing imports keep working.
 */

export {
  mxShapeArrows2Arrow as Arrows2ArrowShape,
  mxShapeArrows2TwoWayArrow as Arrows2TwoWayArrowShape,
  mxShapeArrows2StylisedArrow as Arrows2StylisedArrowShape,
  mxShapeArrows2SharpArrow as Arrows2SharpArrowShape,
  mxShapeArrows2SharpArrow2 as Arrows2SharpArrow2Shape,
  mxShapeArrows2CalloutArrow as Arrows2CalloutArrowShape,
  mxShapeArrows2BendArrow as Arrows2BendArrowShape,
  mxShapeArrows2BendDoubleArrow as Arrows2BendDoubleArrowShape,
  mxShapeArrows2CalloutDoubleArrow as Arrows2CalloutDoubleArrowShape,
  mxShapeArrows2CalloutQuadArrow as Arrows2CalloutQuadArrowShape,
  mxShapeArrows2CalloutDouble90Arrow as Arrows2CalloutDouble90ArrowShape,
  mxShapeArrows2QuadArrow as Arrows2QuadArrowShape,
  mxShapeArrows2TriadArrow as Arrows2TriadArrowShape,
  mxShapeArrows2TailedArrow as Arrows2TailedArrowShape,
  mxShapeArrows2TailedNotchedArrow as Arrows2TailedNotchedArrowShape,
  mxShapeArrows2StripedArrow as Arrows2StripedArrowShape,
  mxShapeArrows2JumpInArrow as Arrows2JumpInArrowShape,
  mxShapeArrows2UTurnArrow as Arrows2UTurnArrowShape,
} from '../../drawio-shapes/js/mx-libs/arrows2/index.js';
