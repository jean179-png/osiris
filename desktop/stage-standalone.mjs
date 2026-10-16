import { cpSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const standalone = join(root, '.next', 'standalone');
const staticDir = join(root, '.next', 'static');
const publicDir = join(root, 'public');
const out = join(root, 'desktop', 'resources', 'standalone');

if (!existsSync(join(standalone, 'server.js'))) {
  console.error('Missing .next/standalone/server.js — run npm run build first');
  process.exit(1);
}
rmSync(out, { recursive: true, force: true });
mkdirSync(join(root, 'desktop', 'resources'), { recursive: true });
cpSync(standalone, out, { recursive: true });
cpSync(staticDir, join(out, '.next', 'static'), { recursive: true });
cpSync(publicDir, join(out, 'public'), { recursive: true });
// Drop nested desktop pack trees if Next file-tracing pulled them in.
const nestedDesktop = join(out, 'desktop');
if (existsSync(nestedDesktop)) {
  rmSync(nestedDesktop, { recursive: true, force: true });
  console.log('Removed nested desktop/ from standalone stage');
}
console.log('Staged standalone →', out);
