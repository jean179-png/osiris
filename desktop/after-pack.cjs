/**
 * electron-builder's createFilter hard-skips a root `node_modules` directory
 * (it assumes npm deps are handled separately for the Electron app). Next
 * standalone needs that folder, so copy it after the default pack step.
 *
 * @param {import('electron-builder').AfterPackContext} context
 */
exports.default = async function afterPack(context) {
  const { cpSync, existsSync, mkdirSync, rmSync } = require('node:fs');
  const { join } = require('node:path');

  const src = join(
    context.packager.projectDir,
    'desktop',
    'resources',
    'standalone',
    'node_modules',
  );
  const dest = join(context.appOutDir, 'resources', 'standalone', 'node_modules');

  if (!existsSync(src)) {
    throw new Error(`afterPack: missing standalone node_modules at ${src}`);
  }

  mkdirSync(join(context.appOutDir, 'resources', 'standalone'), { recursive: true });
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
  console.log('afterPack: copied Next standalone node_modules →', dest);
};
