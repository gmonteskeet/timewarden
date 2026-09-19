// Copies the demo data the interface needs from data/ (the source) into frontend/lib/fixture-data/.
// Vercel builds with frontend/ as its root folder, so the app cannot read ../data at build time.
// Run this from anywhere whenever data/history.json, data/expected_splits.json or data/people.json change,
// then commit the refreshed copies:  node frontend/scripts/sync-fixture-data.mjs

import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(frontend, '..', 'data');
const target = join(frontend, 'lib', 'fixture-data');

mkdirSync(target, { recursive: true });
for (const file of ['history.json', 'expected_splits.json', 'people.json']) {
  copyFileSync(join(source, file), join(target, file));
  console.log(`Copied data/${file} to frontend/lib/fixture-data/${file}`);
}
