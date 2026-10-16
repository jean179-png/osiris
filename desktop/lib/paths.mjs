import { join } from 'node:path';

export function resolveStandaloneDir(appLike) {
  if (appLike.isPackaged) {
    return join(appLike.resourcesPath, 'standalone');
  }
  // Dev production-smoke: repo .next/standalone
  return join(appLike.getAppPath(), '..', '.next', 'standalone');
}
