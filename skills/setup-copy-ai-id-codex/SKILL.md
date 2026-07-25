---
name: setup-copy-ai-id-codex
description: Install, update, start, diagnose, or uninstall the Copy AI ID Codex companion on macOS. Use when a user wants to enable Copy AI ID's Send to Codex feature, make its localhost server start automatically at login, check why the companion is unavailable, refresh it from a newer bundled release, or remove it safely.
---

# Setup Copy AI ID Codex

Manage the bundled, macOS-only localhost companion without asking the user to
copy commands by hand. The scripts are deterministic and never install system
packages or persist credentials.

## Choose the operation

Run every script through `bash`; downloaded archives may not preserve executable
bits.

- Install or repair: `bash scripts/setup.sh`
- Check prerequisites, LaunchAgent, and client-header health: `bash scripts/status.sh`
- Start if stopped: `bash scripts/start.sh`
- Update to the server bundled with this Skill: `bash scripts/update.sh`
- Remove the LaunchAgent and runtime: `bash scripts/uninstall.sh`

Resolve those paths relative to this `SKILL.md`, not the caller's working
directory. Do not use `sudo`.

## Workflow

1. For setup or update, run the matching script. It checks macOS, `node`,
   `codex`, `codex login status`, `git`, and `lsof` before changing files.
2. If a prerequisite fails, report the exact missing action and stop. Do not
   install tools, initiate Codex authentication, or weaken the checks unless the
   user explicitly asks for separate help.
3. Report the final readiness result. If startup fails, point the user to the
   two log paths printed by the script; do not expose or request secrets.
4. Explain that `update.sh` installs the version bundled with the current Skill.
   To move to another release, first install the Skill or companion ZIP from
   the tag that matches the user's extension version, then run update again.

Setup, update, start, and uninstall do not interrupt an active Codex run. If a
script reports that a run is active, wait for it to finish before retrying.

## Refresh the public Skill safely

The Skill installer does not overwrite an existing Skill. When the user asks to
refresh a GitHub-installed copy, do not delete it first:

1. Move the existing `setup-copy-ai-id-codex` directory to a temporary backup
   outside the Codex skills directory.
2. Install `airman5573/copy-ai-id`, path
   `skills/setup-copy-ai-id-codex`, with `$skill-installer`, explicitly passing
   the release tag that matches the extension (for this release, `--ref
   v0.1.16`). Never default to the moving `main` branch or `latest` release.
3. Run the newly installed `update.sh`, then `status.sh`, through `bash`.
4. Delete the backup only after status succeeds. If installation or status
   fails, remove the incomplete new directory and restore the backup.

For a release ZIP, download the newer ZIP and run its `Update.command`; do not
run the updater from the older extracted folder.

## Fixed installation contract

- Runtime: `~/Library/Application Support/Copy AI ID Codex`
- LaunchAgent: `~/Library/LaunchAgents/com.copy-ai-id.codex-server.plist`
- Label: `com.copy-ai-id.codex-server`
- Endpoint: `http://127.0.0.1:45130`
- Logs: `~/Library/Application Support/Copy AI ID Codex/logs/stdout.log` and
  `stderr.log`
- Installed distribution marker: `~/Library/Application Support/Copy AI ID Codex/VERSION`

The client-header health request must include
`x-copy-ai-id-client: copy-ai-id-extension`. Keep the server bound to
`127.0.0.1`; do not add remote networking, tokens, API keys, or other secrets.
The `VERSION` marker identifies the bundled distribution. `/health` also
reports protocol version `1`; the extension treats a missing or different
protocol version as not ready and keeps Send disabled until the matching
companion release is installed.
