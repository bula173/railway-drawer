/**
 * Hand (left / right) of points, read from the TOE: standing at the switch toe (blade tips) and
 * looking towards the frog, the diverging leg goes to the left = left-hand points, to the right =
 * right-hand points. One helper for every place that derives or uses the hand (railML export and
 * import layout, Railway Script layout, palette inserts, library data tests); the library
 * generators (scripts/ertms-library, scripts/railway-libraries) mirror it as
 * `hand_from_geometry`.
 *
 * Screen coordinates: x grows to the right, y grows DOWNWARDS. So with the toe on the left
 * (travelling right), a leg going up is a left-hand leg; with the toe on the right (travelling
 * left), a leg going down is a left-hand leg.
 */

export type Hand = 'left' | 'right';

interface Vec {
  x: number;
  y: number;
}

/**
 * Hand from geometry at the junction: `toe` = direction from the junction towards the toe (the
 * straight piece behind the blade tips), `leg` = direction from the junction along the diverging
 * leg. Neither has to be a unit vector.
 */
export function handFromGeometry(toe: Vec, leg: Vec): Hand {
  // travel direction = -toe; screen y is down, so "left of travel" has a negative cross product
  // travel x leg < 0  <=>  toe x leg > 0
  return toe.x * leg.y - toe.y * leg.x > 0 ? 'left' : 'right';
}

/**
 * Hand of a straight diverging leg drawn as a line between two parallel horizontal tracks
 * (ERTMS "Point" edges, crossover legs): both of its ends give the same hand, so it does not
 * matter which end is the switch. Rising to the right = left-hand, falling to the right = right-hand.
 */
export function handOfLeg(a: Vec, b: Vec): Hand {
  const [l, r] = a.x <= b.x ? [a, b] : [b, a];
  return handFromGeometry({ x: -1, y: 0 }, { x: r.x - l.x, y: r.y - l.y });
}

/**
 * Inverse for layouts: the side (+1 = below / next lane down, -1 = above) a diverging track of
 * points with `hand` lies on when its leg heads in x direction `legDx` (> 0 right, < 0 left).
 */
export function legSide(hand: Hand, legDx: number): 1 | -1 {
  const s = legDx < 0 ? -1 : 1;
  return handFromGeometry({ x: -s, y: 0 }, { x: s, y: 1 }) === hand ? 1 : -1;
}

/** Hand of a points leg drawn as a free edge (its source/target points), or null (no edge / no points). */
export function handOfLegCell(cell: { isEdge(): boolean; getGeometry(): { sourcePoint: Vec | null; targetPoint: Vec | null } | null }): Hand | null {
  const g = cell.isEdge() ? cell.getGeometry() : null;
  if (!g?.sourcePoint || !g.targetPoint) return null;
  if (g.sourcePoint.y === g.targetPoint.y) return null;
  return handOfLeg(g.sourcePoint, g.targetPoint);
}
