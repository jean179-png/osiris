import { spawn } from 'node:child_process';
import { join } from 'node:path';

process.env.OSIRIS_DESKTOP_DEV = '1';
const electron = join(import.meta.dirname, '..', 'node_modules', 'electron', 'cli.js');
spawn(process.execPath, [electron, join(import.meta.dirname, '..')], {
  stdio: 'inherit',
  env: process.env,
}).on('exit', (c) => process.exit(c ?? 0));
