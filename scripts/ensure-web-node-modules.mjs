import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const webRoot = path.join(repoRoot, 'apps', 'web');
const webNodeModules = path.join(webRoot, 'node_modules');

// The Spark icon proxy plugin looks for this package at a hard-coded relative path:
//   apps/web/node_modules/@phosphor-icons/react
// In npm workspaces, deps are typically hoisted to repoRoot/node_modules, so we create
// a workspace-local symlink to keep dev output clean.
const pkgRel = path.join('@phosphor-icons', 'react');
const target = path.join(repoRoot, 'node_modules', pkgRel);
const link = path.join(webNodeModules, pkgRel);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function exists(p) {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

if (!exists(target)) {
  // Nothing to do if dependencies are not installed yet.
  process.exit(0);
}

ensureDir(path.dirname(link));

if (!exists(link)) {
  fs.symlinkSync(target, link, 'dir');
}
