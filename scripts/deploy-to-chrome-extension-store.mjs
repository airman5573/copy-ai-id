#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = resolve(repoRoot, 'package.json');
const packageLockPath = resolve(repoRoot, 'package-lock.json');
const manifestSourcePath = resolve(repoRoot, 'src/manifest.ts');
const releasePinnedDocumentPaths = [
  resolve(repoRoot, 'README.md'),
  resolve(repoRoot, 'README.ko.md'),
  resolve(repoRoot, 'docs/codex-setup.md'),
  resolve(repoRoot, 'docs/codex-setup.ko.md'),
  resolve(repoRoot, 'skills/setup-copy-ai-id-codex/SKILL.md'),
];
const companionVersionPath = resolve(
  repoRoot,
  'skills/setup-copy-ai-id-codex/assets/VERSION',
);
const distManifestPath = resolve(repoRoot, 'dist/manifest.json');
const distDir = resolve(repoRoot, 'dist');
const outputDir = resolve(repoRoot, 'output');
const companionPackagerPath = resolve(repoRoot, 'scripts/package-codex-companion.mjs');

const args = process.argv.slice(2);
const options = parseArgs(args);

const packageJson = readJson(packageJsonPath);
const currentVersion = packageJson.version;
const nextVersion = options.noVersionBump
  ? currentVersion
  : options.version ?? bumpPatchVersion(currentVersion);

if (!isChromeExtensionVersion(nextVersion)) {
  throw new Error(
    `Invalid release version "${nextVersion}". Use three dot-separated integer parts, e.g. 0.1.13.`,
  );
}

if (nextVersion !== currentVersion) {
  packageJson.version = nextVersion;
  writeJson(packageJsonPath, packageJson);
  syncPackageLockVersion(nextVersion);
  syncManifestSourceVersion(nextVersion);
  syncCompanionVersion(nextVersion);
  syncReleasePinnedDocuments(currentVersion, nextVersion);
  console.log(`Version bumped: ${currentVersion} -> ${nextVersion}`);
} else {
  syncManifestSourceVersion(nextVersion);
  syncPackageLockVersion(nextVersion);
  syncCompanionVersion(nextVersion);
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

console.log('\nPackaging the macOS Codex companion...');
execFileSync(process.execPath, [companionPackagerPath], {
  cwd: repoRoot,
  stdio: 'inherit',
});

const companionZipPath = resolve(
  outputDir,
  `copy-ai-id-codex-companion-${nextVersion}-macos.zip`,
);
if (!existsSync(companionZipPath)) {
  throw new Error(`Expected companion zip was not created: ${companionZipPath}`);
}

console.log('\nRelease packages ready:');
console.log(zipPath);
console.log(companionZipPath);
console.log('\nUpload the extension zip manually in Chrome Web Store Developer Dashboard.');
console.log('Attach both zip files to the matching GitHub Release.');

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
  - create output/copy-ai-id-codex-companion-<version>-macos.zip
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
    parts.length === 3 &&
    parts.every((part) => /^(?:0|[1-9]\d*)$/.test(part) && Number(part) <= 65535)
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

function syncCompanionVersion(version) {
  writeFileSync(companionVersionPath, `${version}\n`);
}

function syncReleasePinnedDocuments(previousVersion, version) {
  if (previousVersion === version) {
    return;
  }

  for (const path of releasePinnedDocumentPaths) {
    const source = readFileSync(path, 'utf8');
    if (!source.includes(`v${previousVersion}`)) {
      throw new Error(`Could not find release tag v${previousVersion} in ${path}`);
    }
    writeFileSync(path, source.replaceAll(previousVersion, version));
  }
}
