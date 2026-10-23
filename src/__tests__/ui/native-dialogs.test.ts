import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC = resolve(__dirname, '../..');

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === '__tests__' || name === 'node_modules') continue;
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.ts$/.test(name)) out.push(path);
  }
  return out;
}

describe('no native dialogs in the chrome', () => {
  it('app code never calls alert() / confirm() / prompt() (use app-dialogs.ts)', () => {
    const offenders: string[] = [];
    for (const file of sources(SRC)) {
      const text = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        // window.confirm(...) or a bare confirm('...') / alert(`...`) call (not methods or declarations)
        if (/\bwindow\.(alert|confirm|prompt)\s*\(|(^|[^.\w])(alert|confirm|prompt)\s*\(\s*['"`]/.test(line)) {
          offenders.push(`${file.slice(SRC.length + 1)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
