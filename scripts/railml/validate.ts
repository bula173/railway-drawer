/**
 * Validates railML 3.2 files against the official railML 3.2 XSD with xmllint (libxml2), when
 * both are available locally. Dev only; not part of the build or CI.
 *
 * The railML schemas are licensed by railML.org (restricted CC BY-NC-ND 4.0 / commercial licence,
 * distribution only through railML.org), so the XSD is NOT in this repository: download the
 * railML 3.2 schema package from https://www.railml.org/en/schemas (registration) and point
 * RAILML_XSD (or --xsd) at its railml3.xsd.
 *
 * Usage: node scripts/railml/validate.ts [--xsd <railml3.xsd>] [file.railml ...]
 *   Without files: the exported samples and test fixtures in src/railml/__tests__/fixtures/.
 *   (Node >= 22.18 strips TypeScript types natively.)
 *
 * Exit code: 0 all valid, 1 invalid files, 2 xmllint or the XSD missing.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(HERE, '../../src/railml/__tests__/fixtures');

function main(argv: string[]): number {
  let xsd = process.env.RAILML_XSD ?? '';
  const files: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--xsd') xsd = argv[++i] ?? '';
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage: node scripts/railml/validate.ts [--xsd <railml3.xsd>] [file.railml ...]');
      return 0;
    } else files.push(argv[i]);
  }
  if (files.length === 0) {
    for (const f of fs.readdirSync(FIXTURES)) if (f.endsWith('.railml')) files.push(path.join(FIXTURES, f));
  }
  const probe = spawnSync('xmllint', ['--version'], { encoding: 'utf8' });
  if (probe.error) {
    console.error('xmllint not found (libxml2). macOS: preinstalled; Debian/Ubuntu: apt install libxml2-utils.');
    return 2;
  }
  if (!xsd || !fs.existsSync(xsd)) {
    console.error(
      'railML 3.2 XSD not found. It is not vendored (railML.org licence): download the railML 3.2 schemas from\n' +
        'https://www.railml.org/en/schemas and run with RAILML_XSD=/path/to/railml3.xsd or --xsd /path/to/railml3.xsd'
    );
    return 2;
  }
  let invalid = 0;
  for (const file of files) {
    const r = spawnSync('xmllint', ['--noout', '--schema', xsd, file], { encoding: 'utf8' });
    const ok = r.status === 0;
    if (!ok) invalid++;
    console.log(`${ok ? 'valid  ' : 'INVALID'} ${path.relative(process.cwd(), file)}`);
    if (!ok) console.log((r.stderr || r.stdout).trim().split('\n').slice(0, 40).map((l) => `    ${l}`).join('\n'));
  }
  console.log(`${files.length - invalid}/${files.length} valid`);
  return invalid > 0 ? 1 : 0;
}

process.exit(main(process.argv.slice(2)));
