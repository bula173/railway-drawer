/**
 * Points hand read from the TOE (railway/hand.ts): looking from the toe (blade tips) towards the
 * frog, the diverging leg to the left = left-hand. Screen y grows downwards.
 */
import { describe, expect, it } from 'vitest';
import { Cell, Geometry, Point } from '@maxgraph/core';
import { handFromGeometry, handOfLeg, handOfLegCell, legSide } from '../hand';

const TOE_LEFT = { x: -1, y: 0 };
const TOE_RIGHT = { x: 1, y: 0 };

describe('handFromGeometry (toe rule)', () => {
  it.each([
    ['toe left, leg up', TOE_LEFT, { x: 1, y: -1 }, 'left'],
    ['toe left, leg down', TOE_LEFT, { x: 1, y: 1 }, 'right'],
    ['toe right, leg up', TOE_RIGHT, { x: -1, y: -1 }, 'right'],
    ['toe right, leg down', TOE_RIGHT, { x: -1, y: 1 }, 'left'],
  ] as const)('%s -> %s', (_name, toe, leg, hand) => {
    expect(handFromGeometry(toe, leg)).toBe(hand);
    // not unit vectors, shallow legs (1:9 turnouts)
    expect(handFromGeometry({ x: toe.x * 37, y: 0 }, { x: leg.x * 90, y: leg.y * 10 })).toBe(hand);
  });

  it('a vertical track: toe below, leg to the right of travel (east while going up) = right', () => {
    expect(handFromGeometry({ x: 0, y: 1 }, { x: 1, y: -3 })).toBe('right');
    expect(handFromGeometry({ x: 0, y: 1 }, { x: -1, y: -3 })).toBe('left');
  });
});

describe('handOfLeg (a leg between two horizontal tracks)', () => {
  it('rising to the right = left, falling to the right = right, either end first', () => {
    expect(handOfLeg({ x: 0, y: 73 }, { x: 53, y: 0 })).toBe('left');
    expect(handOfLeg({ x: 53, y: 0 }, { x: 0, y: 73 })).toBe('left');
    expect(handOfLeg({ x: 0, y: 0 }, { x: 53, y: 73 })).toBe('right');
    expect(handOfLeg({ x: 53, y: 73 }, { x: 0, y: 0 })).toBe('right');
  });

  it('matches both junctions of the leg (toe rule at each end)', () => {
    // falling leg: upper-left end has its toe on the left and the leg going down; lower-right end
    // has its toe on the right and the leg going up: both right-hand
    expect(handFromGeometry(TOE_LEFT, { x: 1, y: 1 })).toBe(handOfLeg({ x: 0, y: 0 }, { x: 10, y: 10 }));
    expect(handFromGeometry(TOE_RIGHT, { x: -1, y: -1 })).toBe(handOfLeg({ x: 0, y: 0 }, { x: 10, y: 10 }));
  });
});

describe('legSide (layouts: lane of the diverging track)', () => {
  it.each([
    ['right', 1, 1],
    ['right', -1, -1],
    ['left', 1, -1],
    ['left', -1, 1],
  ] as const)('%s-hand, leg heading %i -> side %i', (hand, dx, side) => {
    expect(legSide(hand, dx)).toBe(side);
    // round trip with the geometry it produces
    expect(handFromGeometry({ x: -dx, y: 0 }, { x: dx, y: side })).toBe(hand);
  });
});

describe('handOfLegCell', () => {
  const edge = (a: [number, number], b: [number, number]): Cell => {
    const g = new Geometry();
    g.relative = true;
    g.setTerminalPoint(new Point(a[0], a[1]), true);
    g.setTerminalPoint(new Point(b[0], b[1]), false);
    const c = new Cell('', g);
    c.setEdge(true);
    return c;
  };

  it('reads the edge terminal points', () => {
    expect(handOfLegCell(edge([0, 0], [53, 73]))).toBe('right');
    expect(handOfLegCell(edge([0, 74], [53.43, 0]))).toBe('left');
  });

  it('null for vertices, horizontal edges and edges without points', () => {
    const v = new Cell('', new Geometry(0, 0, 10, 10));
    v.setVertex(true);
    expect(handOfLegCell(v)).toBeNull();
    expect(handOfLegCell(edge([0, 5], [40, 5]))).toBeNull();
    const bare = new Cell('', new Geometry());
    bare.setEdge(true);
    expect(handOfLegCell(bare)).toBeNull();
  });
});
