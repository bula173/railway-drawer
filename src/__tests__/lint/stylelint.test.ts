// @vitest-environment node
/**
 * The colour rule of .stylelintrc.json really applies: a colour literal is an error in any stylesheet
 * but src/styles/variables.css (the token definitions), and the app's stylesheets pass.
 */
import { describe, expect, it } from 'vitest';
import stylelint from 'stylelint';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..');

async function errors(file: string, code: string): Promise<string[]> {
  const result = await stylelint.lint({ code, codeFilename: join(ROOT, file), cwd: ROOT });
  return result.results.flatMap((r) => r.warnings.map((w) => w.rule)).sort();
}

describe('stylelint colour rule', () => {
  it('rejects colour literals outside variables.css, accepts tokens', async () => {
    expect(await errors('src/ui/probe.css', '.a { color: #333; background: rgba(0, 0, 0, 0.5); border-color: red; }\n')).toEqual([
      'color-named',
      'color-no-hex',
      'function-disallowed-list',
    ]);
    expect(await errors('src/ui/probe.css', '.a { color: var(--rd-text); background: transparent; }\n')).toEqual([]);
    expect(await errors('src/styles/variables.css', ':root { --rd-x: #333; --rd-y: rgba(0, 0, 0, 0.5); }\n')).toEqual([]);
  }, 60_000);

  it('the app stylesheets pass', async () => {
    const result = await stylelint.lint({ files: 'src/**/*.css', cwd: ROOT });
    expect(result.results.flatMap((r) => r.warnings.map((w) => `${r.source}: ${w.text}`))).toEqual([]);
  }, 60_000);
});
