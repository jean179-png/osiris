import { describe, it, expect } from 'vitest';
import { buildChildEnv } from './spawn-next.mjs';

describe('buildChildEnv', () => {
  it('forces loopback host/port and injects cache paths', () => {
    const env = buildChildEnv(
      { PATH: '/usr/bin', HOSTNAME: '0.0.0.0', ELECTRON_RUN_AS_NODE: '1' },
      { AIS_API_KEY: 'x' },
      {
        host: '127.0.0.1',
        port: 41234,
        userData: '/tmp/osiris-data',
        cacheDir: '/tmp/osiris-cache',
      },
    );
    expect(env.HOSTNAME).toBe('127.0.0.1');
    expect(env.PORT).toBe('41234');
    expect(env.AIS_API_KEY).toBe('x');
    expect(env.OSIRIS_CCTV_SNAPSHOT).toContain('osiris-cache');
    expect(env.OSIRIS_NOMINATIM_CACHE).toContain('osiris-cache');
    expect(env.ELECTRON_RUN_AS_NODE).toBeUndefined();
  });
});
