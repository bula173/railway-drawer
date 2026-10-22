/**
 * The closed interpreter that evaluates draw.io's palette sources for the generator
 * (scripts/drawio-palettes/safe-js.ts): ES5 semantics the Sidebar*.js files rely on, a sample
 * palette conversion, and no way out to the host.
 */
import { describe, expect, it } from 'vitest';
import { HostFn, Interpreter, hostFn, sobj, toStr } from '../../../scripts/drawio-palettes/safe-js';
import type { SObj } from '../../../scripts/drawio-palettes/safe-js';

function run(code: string, globals: Record<string, unknown> = {}): unknown {
  const it = new Interpreter({ out: sobj(), ...globals });
  it.run(code, 'test.js');
  return (it.global.lookup('out')?.value as SObj).value;
}

describe('safe-js interpreter', () => {
  it('evaluates closures, prototypes, loops and string/array methods like JavaScript', () => {
    expect(run(`
      function Base(n) { this.n = n; }
      Base.prototype.twice = function() { return this.n * 2; };
      function Sub(n) { Base.call(this, n + 1); }
      Sub.prototype = new Base(0);
      var s = new Sub(2), parts = [];
      for (var i = 0; i < 3; i++) { parts.push(i % 2 == 0 ? 'e' + i : 'o' + i); }
      var fns = [];
      for (let j = 0; j < 3; j++) fns.push(function() { return j; });
      var o = {a: 1, 'b': 2}, keys = [];
      for (var k in o) keys.push(k);
      out.value = [s.twice(), parts.join(','), fns.map(function(f) { return f(); }).join(''), keys.join(''),
        'A_b_c'.replace(/_/g, ' ').toLowerCase(), 'x;y'.split(';').length, typeof Sub, s instanceof Base,
        (function() { return arguments.length; })(1, 2, 3), Math.round(2.5), [1, 2].concat([3], 4).length];
    `)).toEqual([6, 'e0,o1,e2', '012', 'ab', 'a b c', 2, 'function', true, 3, 3, 4]);
  });

  it('runs a draw.io style palette function against host stubs (sample conversion)', () => {
    const entries: Array<Record<string, unknown>> = [];
    const proto = sobj({
      createVertexTemplateEntry: hostFn('cvte', (_t, a) => {
        entries.push({ style: a[0], w: a[1], h: a[2], value: a[3], title: a[4] });
        return null;
      }),
    });
    const Sidebar = hostFn('Sidebar', () => undefined, () => sobj(undefined, proto));
    Sidebar.props.prototype = proto;
    const it = new Interpreter({ Sidebar, mxConstants: sobj({ STYLE_SHAPE: 'shape' }) });
    it.run(`(function() {
      Sidebar.prototype.addSamplePalette = function() {
        var s = 'sketch=0;' + mxConstants.STYLE_SHAPE + '=mxgraph.sample.';
        var names = ['Box', 'Round Box'];
        for (var i = 0; i < names.length; i++) {
          this.createVertexTemplateEntry(s + names[i].toLowerCase().replace(/ /g, '_') + ';', 40 + i, 30, '', names[i]);
        }
      };
    })();`, 'Sidebar-Sample.js');
    const sb = it.construct(Sidebar, []) as SObj;
    it.call((Sidebar.props.prototype as SObj).addSamplePalette, sb, []);
    expect(entries).toEqual([
      { style: 'sketch=0;shape=mxgraph.sample.box;', w: 40, h: 30, value: '', title: 'Box' },
      { style: 'sketch=0;shape=mxgraph.sample.round_box;', w: 41, h: 30, value: '', title: 'Round Box' },
    ]);
    expect(it.callStack).toEqual([]);
  });

  it('reports the source line of errors', () => {
    expect(() => run('var a = 1;\nundefinedName();')).toThrow(/test\.js:2: undefinedName is not defined/);
  });

  it('gives interpreted code no path to host functions or globals', () => {
    // prototype-less objects: no constructor chain to Function
    expect(run('out.value = typeof ({}).constructor;')).toBe('undefined');
    expect(() => run("out.value = ({}).constructor.constructor('return process')();")).toThrow();
    expect(() => run("out.value = 'x'.constructor('1');")).toThrow(/not a function/);
    expect(() => run("out.value = [].constructor;")).not.toThrow();
    expect(run('out.value = [].constructor;')).toBeUndefined();
    // host functions are opaque values: their JS internals are not reachable
    expect(run('out.value = typeof parseInt.constructor;')).toBe('undefined');
    expect(() => run('out.value = process;')).toThrow(/process is not defined/);
    expect(() => run('out.value = globalThis;')).toThrow(/globalThis is not defined/);
    expect(() => run("out.value = eval('1');")).toThrow(/eval is not defined/);
    expect(() => run("out.value = Function('return 1')();")).toThrow(/Function is not defined/);
    // a foreign (non-interpreter) object passed in cannot be read
    const foreign = { secret: 1 };
    expect(() => run('out.value = f.secret;', { f: foreign })).toThrow(/foreign object/);
  });

  it('converts values to strings like JavaScript and rejects objects in concatenation', () => {
    expect(toStr([1, null, 'a'])).toBe('1,,a');
    expect(() => run("out.value = 'a' + {};")).toThrow(/cannot convert/);
    expect(new HostFn('x', () => 1).name).toBe('x');
  });
});
