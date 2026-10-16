import { describe, it, expect } from 'vitest';
import { resolveStandaloneDir } from './paths.mjs';

describe('resolveStandaloneDir', () => {
  it('uses resourcesPath/standalone when packaged', () => {
    const dir = resolveStandaloneDir({
      isPackaged: true,
      resourcesPath: 'C:\\App\\resources',
      getAppPath: () => 'C:\\App\\app.asar',
    });
    expect(dir.replace(/\\/g, '/')).toMatch(/resources\/standalone$/);
  });
});
