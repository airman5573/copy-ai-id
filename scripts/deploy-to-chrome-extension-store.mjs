#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = resolve(repoRoot, 'package.json');
const packageLockPath = resolve(repoRoot, 'package-lock.json');
const manifestSourcePath = resolve(repoRoot, 'src/manifest.ts');
const distManifestPath = resolve(repoRoot, 'dist/manifest.json');
const distDir = resolve(repoRoot, 'dist');
const outputDir = resolve(repoRoot, 'output');

const args = process.argv.slice(2);
const options = parseArgs(args);

const packageJson = readJson(packageJsonPath);
const currentVersion = packageJson.version;
const nextVersion = options.noVersionBump
  ? currentVersion
  : options.version ?? bumpPatchVersion(currentVersion);

if (!isChromeExtensionVersion(nextVersion)) {
  throw new Error(
    `Invalid Chrome extension version "${nextVersion}". Use 1-4 dot-separated integer parts, e.g. 0.1.13.`,
  );
}

if (nextVersion !== currentVersion) {
  packageJson.version = nextVersion;
  writeJson(packageJsonPath, packageJson);
  syncPackageLockVersion(nextVersion);
  syncManifestSourceVersion(nextVersion);
  console.log(`Version bumped: ${currentVersion} -> ${nextVersion}`);
} else {
  syncManifestSourceVersion(nextVersion);
  syncPackageLockVersion(nextVersion);
  console.log(`Version unchanged: ${nextVersion}`);
}

console.log('Building extension...');
execFileSync('npm', ['run', 'build'], { cwd: repoRoot, stdio: 'inherit' });

const distManifest = readJson(distManifestPath);
if (distManifest.version !== nextVersion) {
  throw new Error(`Built manifest version ${distManifest.version} does not match expected ${nextVersion}.`);
}
if ('key' in distManifest) {
  throw new Error(
    'dist/manifest.json contains a manifest key. Chrome Web Store upload builds must omit the local development key.',
  );
}

mkdirSync(outputDir, { recursive: true });
const zipName = `${packageJson.name}-${nextVersion}-chrome-web-store.zip`;
const zipPath = resolve(outputDir, zipName);
rmSync(zipPath, { force: true });

console.log(`Packaging ${zipName}...`);
execFileSync('zip', ['-qr', zipPath, '.', '-x', '*.DS_Store', '__MACOSX/*'], {
  cwd: distDir,
  stdio: 'inherit',
});

if (!existsSync(zipPath)) {
  throw new Error(`Expected zip was not created: ${zipPath}`);
}

console.log('\nChrome Web Store package ready:');
console.log(zipPath);
console.log('\nUpload this zip manually in Chrome Web Store Developer Dashboard.');

function parseArgs(rawArgs) {
  const parsed = {
    noVersionBump: false,
    version: null,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === '--no-version-bump') {
      parsed.noVersionBump = true;
      continue;
    }
    if (arg === '--version') {
      const value = rawArgs[index + 1];
      if (!value) {
        throw new Error('Missing value after --version. Example: --version 0.1.13');
      }
      parsed.version = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--version=')) {
      parsed.version = arg.slice('--version='.length);
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (parsed.noVersionBump && parsed.version) {
    throw new Error('Use either --no-version-bump or --version, not both.');
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage:
  npm run deploy-to-chrome-extension-store
  npm run deploy-to-chrome-extension-store -- --version 0.1.13
  npm run deploy-to-chrome-extension-store -- --no-version-bump

Default behavior:
  - bump package/manifest patch version
  - run npm run build
  - create output/<name>-<version>-chrome-web-store.zip
`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function bumpPatchVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Cannot patch-bump non x.y.z version: ${version}`);
  }
  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

function isChromeExtensionVersion(version) {
  const parts = version.split('.');
  return (
    parts.length >= 1 &&
    parts.length <= 4 &&
    parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 65535)
  );
}

function syncPackageLockVersion(version) {
  if (!existsSync(packageLockPath)) {
    return;
  }
  const packageLock = readJson(packageLockPath);
  packageLock.version = version;
  if (packageLock.packages?.['']) {
    packageLock.packages[''].version = version;
  }
  writeJson(packageLockPath, packageLock);
}

function syncManifestSourceVersion(version) {
  const source = readFileSync(manifestSourcePath, 'utf8');
  const versionPattern = /version:\s*['"][^'"]+['"]/;
  if (!versionPattern.test(source)) {
    throw new Error(`Could not find version field in ${manifestSourcePath}`);
  }
  const nextSource = source.replace(versionPattern, `version: '${version}'`);
  writeFileSync(manifestSourcePath, nextSource);
}
