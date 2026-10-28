import { mkdir, cp, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// An explicit allowlist prevents reference archives, tools, tests, or metadata
// from reaching the public website, even if somebody adds other source files.
export const publicFiles = ['index.html', 'styles.css', 'app.js', 'app-utils.js', 'conversion-worker.js', 'converter.js', 'assets'];
const dist = resolve(root, 'dist');
await mkdir(dist, { recursive: true });
const existing = await readdir(dist);
if (existing.some(name => !publicFiles.includes(name))) throw new Error('Unexpected file in dist. Use a fresh output directory before publishing.');
for (const file of publicFiles) await cp(resolve(root, file), resolve(dist, file), { recursive: true });
console.log('Built static site in dist (public file allowlist).');
