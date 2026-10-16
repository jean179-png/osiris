import { app, BrowserWindow, dialog } from 'electron';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findFreePort } from './lib/port.mjs';
import { waitForHealth } from './lib/health.mjs';
import { loadDesktopEnv } from './lib/env.mjs';
import { resolveStandaloneDir } from './lib/paths.mjs';
import { buildChildEnv, startNextServer } from './lib/spawn-next.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOOPBACK = '127.0.0.1';

/** @type {import('node:child_process').ChildProcess | null} */
let nextChild = null;
/** @type {string | null} */
let appUrl = null;
let quitting = false;

function resolveNodeBinary() {
  if (app.isPackaged) {
    return join(
      process.resourcesPath,
      'node',
      process.platform === 'win32' ? 'node.exe' : 'node',
    );
  }
  return process.env.OSIRIS_NODE || 'node';
}

function createMainWindow(url) {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: true,
    webPreferences: {
      preload: join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      /* Guest page for YouTube channels that block iframe embeds (NBC, CBS, …). */
      webviewTag: true,
    },
  });

  win.loadURL(url);
  return win;
}

function killNextChild() {
  const child = nextChild;
  if (!child || child.killed || child.exitCode != null) {
    nextChild = null;
    return;
  }
  const pid = child.pid;
  nextChild = null;

  if (process.platform === 'win32' && pid) {
    try {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }
    return;
  }

  try {
    child.kill('SIGTERM');
  } catch {
    /* ignore */
  }
  setTimeout(() => {
    if (child.exitCode == null && !child.killed) {
      try {
        child.kill('SIGKILL');
      } catch {
        /* ignore */
      }
    }
  }, 2000);
}

function failAndQuit(title, message) {
  try {
    dialog.showErrorBox(title, message);
  } catch {
    console.error(title, message);
  }
  killNextChild();
  app.quit();
}

async function bootProduction() {
  const userData = app.getPath('userData');
  const cacheDir = join(userData, 'cache');
  mkdirSync(cacheDir, { recursive: true });

  const port = await findFreePort(LOOPBACK);
  const desktopEnv = loadDesktopEnv(userData);
  const env = buildChildEnv(process.env, desktopEnv, {
    host: LOOPBACK,
    port,
    userData,
    cacheDir,
  });

  const standaloneDir = resolveStandaloneDir({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    getAppPath: () => app.getAppPath(),
  });

  const nodeBinary = resolveNodeBinary();
  if (!existsSync(nodeBinary)) {
    failAndQuit(
      'Osiris failed to start',
      `Bundled Node binary missing:\n${nodeBinary}`,
    );
    return;
  }
  if (!existsSync(join(standaloneDir, 'server.js'))) {
    failAndQuit(
      'Osiris failed to start',
      `Next standalone server missing:\n${join(standaloneDir, 'server.js')}`,
    );
    return;
  }

  const child = startNextServer({ standaloneDir, env, nodeBinary });
  nextChild = child;
  let nextLog = '';
  const appendLog = (buf) => {
    const text = String(buf);
    nextLog = (nextLog + text).slice(-4000);
    console.error(`[next] ${text.trimEnd()}`);
  };

  child.stdout?.on('data', appendLog);
  child.stderr?.on('data', appendLog);
  child.on('error', (err) => {
    if (!quitting) {
      failAndQuit('Osiris failed to start', err?.message || String(err));
    }
  });
  child.on('exit', (code, signal) => {
    if (!quitting && appUrl == null) {
      const detail = nextLog.trim()
        ? `\n\n${nextLog.trim()}`
        : '';
      failAndQuit(
        'Osiris failed to start',
        `Next server exited early (code=${code}, signal=${signal})${detail}`,
      );
    }
  });

  const healthUrl = `http://${LOOPBACK}:${port}/api/health`;
  await waitForHealth(healthUrl);
  appUrl = `http://${LOOPBACK}:${port}`;
  createMainWindow(appUrl);
}

async function bootDevShell() {
  appUrl = process.env.OSIRIS_DEV_URL || `http://${LOOPBACK}:3000`;
  createMainWindow(appUrl);
}

async function boot() {
  try {
    if (process.env.OSIRIS_DESKTOP_DEV === '1') {
      await bootDevShell();
    } else {
      await bootProduction();
    }
  } catch (err) {
    failAndQuit('Osiris failed to start', err?.message || String(err));
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setName('Osiris');

  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => boot());

  app.on('before-quit', () => {
    quitting = true;
    killNextChild();
  });

  app.on('will-quit', () => {
    quitting = true;
    killNextChild();
  });

  app.on('window-all-closed', () => {
    quitting = true;
    killNextChild();
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && appUrl) {
      createMainWindow(appUrl);
    }
  });
}
