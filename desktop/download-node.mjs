/**
 * Download official Node.js 22 LTS binary for the current platform into
 * desktop/resources/node/ (node.exe on Windows, node elsewhere).
 *
 * Override version with NODE_VERSION=22.x.y
 */
import {
  chmodSync,
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';

/** Pinned Node 22 LTS; override via NODE_VERSION env. */
const NODE_VERSION = process.env.NODE_VERSION || '22.20.0';

const root = join(import.meta.dirname, '..');
const outDir = join(root, 'desktop', 'resources', 'node');

function resolveAsset() {
  const { platform, arch } = process;
  const nodeArch = arch === 'ia32' ? 'x86' : arch;

  if (platform === 'win32') {
    return {
      file: `node-v${NODE_VERSION}-win-${nodeArch}.zip`,
      binaryName: 'node.exe',
      binaryRel: `node-v${NODE_VERSION}-win-${nodeArch}/node.exe`,
    };
  }
  if (platform === 'darwin') {
    return {
      file: `node-v${NODE_VERSION}-darwin-${nodeArch}.tar.gz`,
      binaryName: 'node',
      binaryRel: `node-v${NODE_VERSION}-darwin-${nodeArch}/bin/node`,
    };
  }
  if (platform === 'linux') {
    return {
      file: `node-v${NODE_VERSION}-linux-${nodeArch}.tar.xz`,
      binaryName: 'node',
      binaryRel: `node-v${NODE_VERSION}-linux-${nodeArch}/bin/node`,
    };
  }
  throw new Error(`Unsupported platform for Node download: ${platform}/${arch}`);
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed (${res.status} ${res.statusText}): ${url}`);
  }
  if (!res.body) {
    throw new Error(`Download returned empty body: ${url}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

function extractArchive(archivePath, extractDir) {
  mkdirSync(extractDir, { recursive: true });
  // Windows 10+ and Unix both ship tar that can handle zip/tar.gz/tar.xz
  execFileSync('tar', ['-xf', archivePath, '-C', extractDir], { stdio: 'inherit' });
}

function findBinary(extractDir, binaryName) {
  const stack = [extractDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        stack.push(full);
      } else if (name === binaryName) {
        return full;
      }
    }
  }
  return null;
}

async function main() {
  const asset = resolveAsset();
  const url = `https://nodejs.org/dist/v${NODE_VERSION}/${asset.file}`;
  const work = join(tmpdir(), `osiris-node-${NODE_VERSION}-${process.pid}`);
  const archivePath = join(work, asset.file);
  const extractDir = join(work, 'extract');

  console.log(`Fetching Node ${NODE_VERSION} for ${process.platform}/${process.arch}`);
  console.log(`URL: ${url}`);

  try {
    rmSync(work, { recursive: true, force: true });
    mkdirSync(work, { recursive: true });

    await download(url, archivePath);
    extractArchive(archivePath, extractDir);

    const preferred = join(extractDir, asset.binaryRel);
    const binaryPath = existsSync(preferred)
      ? preferred
      : findBinary(extractDir, asset.binaryName);

    if (!binaryPath) {
      throw new Error(`Extracted archive but did not find ${asset.binaryName}`);
    }

    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });
    const dest = join(outDir, asset.binaryName);
    copyFileSync(binaryPath, dest);
    if (process.platform !== 'win32') {
      chmodSync(dest, 0o755);
    }

    console.log(`Node binary staged → ${dest}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Failed to download Node ${NODE_VERSION}: ${msg}`);
    console.error('Check network access to nodejs.org, or set NODE_VERSION to a published 22.x release.');
    process.exit(1);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main();
