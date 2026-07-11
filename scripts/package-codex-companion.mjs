#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillName = 'setup-copy-ai-id-codex';
const skillSource = join(repoRoot, 'skills', skillName);
const serverSource = join(skillSource, 'assets', 'codex-server.mjs');
const skillVersionSource = join(skillSource, 'assets', 'VERSION');
const skillGuideSource = join(skillSource, 'SKILL.md');
const licenseSource = join(repoRoot, 'LICENSE');
const releaseDocuments = [
  ['README.md', 'README.md'],
  ['README.ko.md', 'README.ko.md'],
  ['docs/codex-setup.md', 'docs/codex-setup.md'],
  ['docs/codex-setup.ko.md', 'docs/codex-setup.ko.md'],
];
const outputDir = join(repoRoot, 'output');
const packageJson = readJson(join(repoRoot, 'package.json'));
const version = packageJson.version;

if (!isReleaseVersion(version)) {
  throw new Error(`package.json has an unsupported version: ${String(version)}`);
}
if (!existsSync(join(skillSource, 'SKILL.md'))) {
  throw new Error(`Missing companion Skill: ${skillSource}`);
}
if (!existsSync(serverSource)) {
  throw new Error(`Missing bundled companion server: ${serverSource}`);
}
if (!existsSync(licenseSource)) {
  throw new Error(`Missing repository license: ${licenseSource}`);
}
for (const [source] of releaseDocuments) {
  if (!existsSync(join(repoRoot, source))) {
    throw new Error(`Missing companion guide: ${join(repoRoot, source)}`);
  }
}
assertReleaseSourcesMatchVersion();

const archiveBaseName = `copy-ai-id-codex-companion-${version}-macos`;
const archivePath = join(outputDir, `${archiveBaseName}.zip`);
const stagingParent = mkdtempSync(join(tmpdir(), 'copy-ai-id-codex-package-'));
const bundleRoot = join(stagingParent, archiveBaseName);

try {
  const bundledSkill = join(bundleRoot, 'skills', skillName);
  mkdirSync(dirname(bundledSkill), { recursive: true });
  cpSync(skillSource, bundledSkill, {
    recursive: true,
    filter: (source) => !source.endsWith('/.DS_Store') && !source.endsWith('\\.DS_Store'),
  });

  // Reassert the finalized package version in the release snapshot. The store
  // deployment script also synchronizes the tracked Skill marker at each bump.
  writeText(join(bundleRoot, 'VERSION'), version);
  writeText(join(bundledSkill, 'assets', 'VERSION'), version);
  writeText(join(bundleRoot, 'SETUP_PROMPT.md'), buildSetupPrompt(version));
  cpSync(licenseSource, join(bundleRoot, 'LICENSE'));
  for (const [source, destination] of releaseDocuments) {
    const destinationPath = join(bundleRoot, destination);
    mkdirSync(dirname(destinationPath), { recursive: true });
    cpSync(join(repoRoot, source), destinationPath);
  }

  const launchers = [
    ['Setup.command', 'setup.sh', 'setup'],
    ['Start.command', 'start.sh', 'start'],
    ['Status.command', 'status.sh', 'status check'],
    ['Update.command', 'update.sh', 'update'],
    ['Uninstall.command', 'uninstall.sh', 'uninstall'],
  ];

  for (const [filename, script, description] of launchers) {
    const launcherPath = join(bundleRoot, filename);
    writeFileSync(launcherPath, buildLauncher(script, description));
    chmodSync(launcherPath, 0o755);
  }

  // Management scripts are intentionally called with bash, but retain useful
  // executable modes for users who launch them directly from a local checkout.
  for (const script of ['setup.sh', 'start.sh', 'status.sh', 'update.sh', 'uninstall.sh']) {
    chmodSync(join(bundledSkill, 'scripts', script), 0o755);
  }
  chmodSync(join(bundledSkill, 'scripts', '_common.sh'), 0o644);
  chmodSync(join(bundledSkill, 'assets', 'codex-server.mjs'), 0o644);

  mkdirSync(outputDir, { recursive: true });
  rmSync(archivePath, { force: true });
  execFileSync('zip', [
    '-qry',
    archivePath,
    archiveBaseName,
    '-x',
    '*.DS_Store',
    '__MACOSX/*',
  ], {
    cwd: stagingParent,
    stdio: 'inherit',
  });

  if (!existsSync(archivePath)) {
    throw new Error(`Expected ZIP was not created: ${archivePath}`);
  }

  console.log('Copy AI ID Codex companion package ready:');
  console.log(archivePath);
  console.log(`GitHub Release asset: ${archiveBaseName}.zip`);
} finally {
  rmSync(stagingParent, { recursive: true, force: true });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function isReleaseVersion(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const parts = value.split('.');
  return parts.length === 3
    && parts.every((part) => /^(?:0|[1-9]\d*)$/u.test(part) && Number(part) <= 65535);
}

function assertReleaseSourcesMatchVersion() {
  const trackedVersion = existsSync(skillVersionSource)
    ? readFileSync(skillVersionSource, 'utf8').trim()
    : '';
  if (trackedVersion !== version) {
    throw new Error(
      `Companion VERSION marker ${trackedVersion || '(missing)'} does not match package.json ${version}.`,
    );
  }

  const pinnedSources = [
    skillGuideSource,
    ...releaseDocuments.map(([source]) => join(repoRoot, source)),
  ];
  for (const sourcePath of pinnedSources) {
    const source = readFileSync(sourcePath, 'utf8');
    const pinnedTags = [...source.matchAll(/\bv(\d+\.\d+\.\d+)\b/gu)]
      .map((match) => match[1]);
    if (pinnedTags.length === 0 || pinnedTags.some((tagVersion) => tagVersion !== version)) {
      throw new Error(
        `Release-pinned references in ${sourcePath} do not all match v${version}.`,
      );
    }
  }

  for (const guide of ['docs/codex-setup.md', 'docs/codex-setup.ko.md']) {
    const guidePath = join(repoRoot, guide);
    const expectedAsset = `copy-ai-id-codex-companion-${version}-macos.zip`;
    if (!readFileSync(guidePath, 'utf8').includes(expectedAsset)) {
      throw new Error(`${guidePath} does not reference the matching asset ${expectedAsset}.`);
    }
  }
}

function writeText(path, value) {
  writeFileSync(path, `${value.trim()}\n`);
}

function buildLauncher(script, description) {
  return `#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "\${BASH_SOURCE[0]}")" && pwd -P)"
status=0
bash "$ROOT_DIR/skills/${skillName}/scripts/${script}" || status=$?

if [ -t 0 ]; then
  printf '\\nCopy AI ID Codex ${description} finished (status %s).\\n' "$status"
  read -r -p 'Press Return to close this window. ' _
fi

exit "$status"
`;
}

function buildSetupPrompt(releaseVersion) {
  return `# Copy AI ID Codex Companion ${releaseVersion}

macOS only. This package contains no credentials or API keys.

## Easiest setup

Double-click \`Setup.command\`. If macOS or the download removed its executable
permission, open Terminal in this folder and run:

\`\`\`bash
bash ./Setup.command
\`\`\`

The setup checks Node.js 18+, Codex CLI login, Git, and \`lsof\`, then installs a
user LaunchAgent that starts the localhost companion at login.

## Prompt to paste into Codex

First open this extracted \`${archiveBaseName}\` folder as the Codex workspace,
so the relative Skill path in the prompt resolves to this bundle.

\`\`\`text
Read ./skills/${skillName}/SKILL.md and use that Skill to set up the Copy AI ID
Codex companion on this Mac. Run its setup script through bash, then run its
status script through bash and report readiness or the exact prerequisite that
needs my action. Do not use sudo and do not store any secret.
\`\`\`

The other launchers start, check, update from this bundle, or uninstall the
companion. Download a newer release before using \`Update.command\` when moving
to a newer version.
`;
}
