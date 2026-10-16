import { spawn } from 'node:child_process';
import { join } from 'node:path';

export function buildChildEnv(baseEnv, desktopEnv, { host, port, userData, cacheDir }) {
  // Drop Electron-injected vars — they can make a real node.exe misbehave
  // when the parent process is Electron (portable / packaged).
  const cleaned = { ...baseEnv };
  for (const key of Object.keys(cleaned)) {
    if (key.startsWith('ELECTRON_') || key === 'ELECTRON_RUN_AS_NODE') {
      delete cleaned[key];
    }
  }
  delete cleaned.ELECTRON_RUN_AS_NODE;

  return {
    ...cleaned,
    ...desktopEnv,
    NODE_ENV: 'production',
    HOSTNAME: host,
    PORT: String(port),
    OSIRIS_CCTV_SNAPSHOT: join(cacheDir, 'cctv-catalog.json'),
    OSIRIS_NOMINATIM_CACHE: join(cacheDir, 'nominatim.json'),
    // Keep userData available for future features
    OSIRIS_USER_DATA: userData,
  };
}

export function startNextServer({ standaloneDir, env, nodeBinary = process.execPath }) {
  // When running under Electron, process.execPath is Electron — do NOT use it for Next.
  // Caller must pass a real Node binary path (see main.mjs).
  const serverJs = join(standaloneDir, 'server.js');
  return spawn(nodeBinary, [serverJs], {
    cwd: standaloneDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
}
