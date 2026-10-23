// @vitest-environment node
/**
 * The module boundaries of eslint.config.js (eslint-plugin-boundaries) really apply: probes of
 * forbidden and allowed imports are linted as if they were files of the given layers.
 */
import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..');

async function boundaryErrors(file: string, code: string): Promise<number> {
  const eslint = new ESLint({ cwd: ROOT });
  const [result] = await eslint.lintText(code, { filePath: join(ROOT, file) });
  return result.messages.filter((m) => m.ruleId === 'boundaries/element-types').length;
}

describe('module boundaries (core <- document <- features <- ui)', () => {
  it('rejects imports against the layers', async () => {
    // services (document) -> a feature
    expect(await boundaryErrors('src/services/probe.ts', "import { ScenarioSet } from '../scenarios/scenario-model';\nexport const x = ScenarioSet;\n")).toBe(1);
    // core -> services
    expect(await boundaryErrors('src/drawio-shapes/probe.ts', "import { CacheService } from '../services/cache-service';\nexport const x = CacheService;\n")).toBe(1);
    // a feature -> the UI shell (value import)
    expect(await boundaryErrors('src/railway/probe.ts', "import { TabManager } from '../ui/tabs';\nexport const x = TabManager;\n")).toBe(1);
    // railway (the domain base) -> scenarios: no exception any more
    expect(await boundaryErrors('src/railway/probe.ts', "import { ScenarioSet } from '../scenarios/scenario-model';\nexport const x = ScenarioSet;\n")).toBe(1);
    // the step editor is a plain feature module now (no UI shell imports)
    expect(await boundaryErrors('src/scenarios/step-editor.ts', "import { confirmDialog } from '../ui/app-dialogs';\nexport const x = confirmDialog;\n")).toBe(1);
  }, 60_000);

  it('accepts imports along the layers', async () => {
    expect(await boundaryErrors('src/services/probe.ts', "import { installOnce } from '../core/install-once';\nexport const x = installOnce;\n")).toBe(0);
    expect(await boundaryErrors('src/scenarios/probe.ts', "import { getCellKind } from '../railway/object-data';\nimport type { TabManager } from '../ui/tabs';\nexport const x: TabManager | null = getCellKind ? null : null;\n")).toBe(0);
    expect(await boundaryErrors('src/ui/probe.ts', "import { ScenarioSet } from '../scenarios/scenario-model';\nexport const x = ScenarioSet;\n")).toBe(0);
  }, 60_000);
});
