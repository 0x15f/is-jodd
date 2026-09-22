import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
await mkdir(output, { recursive: true });
await build({
  entryPoints: [new URL('index.js', root).pathname],
  outfile: new URL('index.js', output).pathname,
  format: 'esm',
  platform: 'node',
  target: 'node24',
  minify: true,
  legalComments: 'none',
});

// Publish only runtime metadata; tooling and credentials stay in the checkout.
const fields = ['name', 'version', 'description', 'type', 'main', 'types', 'exports',
  'files', 'engines', 'author', 'license', 'keywords', 'publishConfig', 'repository', 'homepage', 'bugs'];
const manifest = Object.fromEntries(fields.map(key => [key, pkg[key]]));
await writeFile(new URL('package.json', output), JSON.stringify(manifest) + '\n');
await Promise.all(['index.d.ts', 'README.md', 'LICENSE'].map(file =>
  copyFile(new URL(file, root), new URL(file, output))));
console.log('Built dist/ for npm publish ./dist');
