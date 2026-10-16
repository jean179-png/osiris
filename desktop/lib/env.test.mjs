import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadDesktopEnv } from './env.mjs';

describe('loadDesktopEnv', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'osiris-env-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('returns empty object when .env missing', () => {
    expect(loadDesktopEnv(dir)).toEqual({});
  });

  it('parses KEY=value lines and ignores comments', () => {
    writeFileSync(join(dir, '.env'), '# c\nFOO=bar\nBAZ=qux\n');
    expect(loadDesktopEnv(dir)).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });
});
