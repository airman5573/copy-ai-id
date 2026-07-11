# Set up Send to Codex on macOS

[한국어](codex-setup.ko.md)

Copy AI ID can copy an AI-ready request without any extra software. The optional **Send to Codex** button additionally needs a small companion service on your Mac. The Chrome extension cannot start a local program by itself, so the companion runs as a per-user macOS LaunchAgent and passes an explicit send request to your authenticated Codex CLI.

> **Platform support:** this setup currently supports macOS only. The editor and **Copy** continue to work without the companion on any supported Chrome page.

## Before you start

You need:

| Requirement | How to check | What to do if it is missing |
| --- | --- | --- |
| macOS | Apple menu → **About This Mac** | Windows and Linux companion setup is not supported yet. |
| Copy AI ID | Open the extension in Chrome | Install it from the link in the [project README](../README.md). |
| Node.js 18 or newer (current LTS recommended) | `node --version` | Install or update Node.js, reopen Terminal and Codex, then check again. |
| OpenAI Codex CLI with compatible non-interactive exec support | `codex --version` and `codex exec --help` | Follow the [official Codex CLI guide](https://learn.chatgpt.com/docs/codex/cli), and update the CLI if the setup modal reports unsupported exec options. |
| An authenticated Codex session | `codex login status` | Run `codex login` and complete the sign-in flow. |
| Git | `git --version` | Install the macOS developer command-line tools or another trusted Git distribution. |
| `lsof` | `/usr/sbin/lsof -v` | `lsof` is normally included with macOS. Restore it before using localhost project detection. |

You do not need to clone this repository or run `npm install`. The setup Skill copies the zero-dependency companion runtime to your user Library folder.

## Recommended setup: let Codex use the setup Skill

1. Open Codex on your Mac. If you use the terminal app, run `codex` first.
2. In Copy AI ID, open the editor and select **Codex setup** in the top toolbar or **Setup help** in the note panel.
3. Use **Copy prompt**, paste the prompt into Codex, and let it finish. The prompt points Codex to the release-matched [`setup-copy-ai-id-codex` Skill](https://github.com/airman5573/copy-ai-id/tree/v0.1.13/skills/setup-copy-ai-id-codex) in this repository.
4. Return to Copy AI ID and select **Retry**. The Codex send buttons become available only after every readiness check passes and no other send is running.

You can also copy this bootstrap prompt directly:

```text
Use $skill-installer to install the skill from GitHub repo airman5573/copy-ai-id at path skills/setup-copy-ai-id-codex, pinned to ref v0.1.13 (do not use main or latest). Pass --ref v0.1.13 to the installer, or use the release-pinned Skill source URL below. If the destination skill already exists, move it to a temporary backup outside the active skills directory before installing; restore it if setup or status fails, and delete the backup only after status succeeds. After installation, locate the installed skill folder, read its SKILL.md, and in this same task run its setup.sh and status.sh through bash. Set up the macOS companion to start at login and report its readiness. If newly installed skill metadata is available only in the next turn, use the installed files directly instead of stopping.

Skill source: https://github.com/airman5573/copy-ai-id/tree/v0.1.13/skills/setup-copy-ai-id-codex
Readiness endpoint: http://127.0.0.1:45130/health
```

This guide targets Copy AI ID `0.1.13`. The extension-generated prompt derives `v0.1.13` from its own manifest version so it never installs the moving `main` branch. The versioned source URL resolves when the matching GitHub release/tag is published.

The shell preflight checks macOS, Node.js, Codex CLI availability, `codex login status`, Git, and `lsof` before changing files. The staged companion then checks the required `codex exec --help` capabilities before the installation is committed; if that check fails, setup rolls back to the previous installation. The capability probe reads local help/feature metadata only—it does not start a Codex agent or make an authenticated network request. If a requirement is missing, fix the item Codex reports and run setup again.

If Codex says the newly installed Skill will be available after a restart, restart Codex and ask: “Use `$setup-copy-ai-id-codex` to set up the macOS companion, start it at login, and report its readiness.”

## What the setup installs

The Skill:

1. copies the companion runtime to `~/Library/Application Support/Copy AI ID Codex`;
2. writes `~/Library/LaunchAgents/com.copy-ai-id.codex-server.plist`;
3. registers the per-user LaunchAgent named `com.copy-ai-id.codex-server`;
4. starts the companion immediately, starts it again at login, and restarts it if the process exits; and
5. checks `http://127.0.0.1:45130/health` until the service is reachable and ready.

This is a user-level installation. It does not need `sudo`, install a browser native-messaging host, or modify your project during setup. The setup Skill remains useful for status, start, update, and uninstall operations; the companion service—not the Skill—is what receives requests from the extension.

## Use Send to Codex in the extension

### Supported pages

Direct send can map only these pages to a local project:

- **Localhost dev-server pages:** `http://localhost:...`, `https://localhost:...`, `127.0.0.1`, and IPv6 loopback pages. The companion uses `lsof` to map the listening port to the local process's working directory, then walks upward to the nearest `.git` directory or `package.json` and uses that canonical project root. Keep the dev server running and start it from somewhere inside the intended project. If no marker exists, the companion falls back to the listener's working directory but requires you to review and confirm that path before Git or Codex runs.
- **Local files:** `file:///...` pages. The companion walks upward from the file to the nearest `.git` directory or `package.json`. In Chrome extension details, enable **Allow access to file URLs** first.

Normal remote websites can still use the Copy AI ID editor and **Copy**, but direct Codex send is intentionally unavailable because a remote URL cannot be safely mapped to a local project folder. By default, the companion also refuses project paths outside your macOS home directory and never uses the filesystem root or your entire home directory as a project.

### Connection states

Copy AI ID checks the companion when the editor starts, when the window becomes active again, periodically while open, and when you select **Retry**.

| Extension state | Meaning | What you can do |
| --- | --- | --- |
| **Checking Codex setup…** | The extension is checking the local companion. | Wait briefly. The send buttons remain disabled. |
| **Ready to send** | The companion answered and all tool/authentication checks passed. | Use **Send to Codex**. |
| **Codex is busy** | Another Copy AI ID Codex run is active. | Wait for it to finish; a second run is not started. |
| **Companion updating** | Setup, update, repair, or uninstall currently holds the maintenance lock. | Wait for that operation to finish; Send is disabled without misreporting a prerequisite failure. |
| **Companion unavailable** | Nothing compatible answered at `127.0.0.1:45130`. | Open **Codex Setup**, run setup or start, then select **Retry**. |
| **Setup incomplete** | The companion answered, but its protocol does not match this extension or Node, Codex non-interactive exec support, authentication, Git, or `lsof` is not ready. | Install the matching companion release or follow the failed check shown in the setup modal, then select **Retry**. |

The top toolbar and note panel each have a separate **Codex setup**/**Setup help** control, because a genuinely disabled send button cannot itself open a modal.

### What happens when you send

After project detection, marker-based project roots can start immediately. A markerless localhost working directory or local-file directory is never trusted automatically: Copy AI ID shows the path and waits for your confirmation. The companion then:

1. initializes Git and creates a basic `.gitignore` if the folder is not already a repository;
2. commits any pre-existing uncommitted work as a local safety snapshot;
3. runs `codex exec` in that project with a workspace-write sandbox, using the fast service tier only when the installed CLI reports `fast_mode` support; and
4. commits changes from a successful Codex run.

Review the detected project before confirming. On success, Copy AI ID clears the sent note and visual edits. If the run fails or times out, it keeps a clipboard fallback so you can paste the request manually.

## Manage the companion

The easiest way to manage the service is to ask Codex to use `$setup-copy-ai-id-codex`. If you downloaded the companion ZIP instead, use the matching `.command` file in the extracted folder.

| Task | Ask Codex | Companion ZIP |
| --- | --- | --- |
| Check status and readiness | “Use `$setup-copy-ai-id-codex` to check the Copy AI ID companion status and explain failed checks.” | Open `Status.command`. |
| Start or restart it | “Use `$setup-copy-ai-id-codex` to start the Copy AI ID companion and verify readiness.” | Open `Start.command`. |
| Update it | “Install the Copy AI ID setup Skill from the release tag that matches my extension, then use `$setup-copy-ai-id-codex` to update and verify the companion.” | Download the ZIP that matches the extension version, then open `Update.command`. |
| Uninstall it | “Use `$setup-copy-ai-id-codex` to uninstall the Copy AI ID companion.” | Open `Uninstall.command`. |

The update script installs the runtime bundled with the Skill or ZIP you are currently using; it is not an automatic network updater. Install the tagged Skill or ZIP that matches your extension version before updating—do not update from `main` or `latest` independently. Uninstall removes the LaunchAgent and installed companion runtime, but does not remove Chrome, Copy AI ID, the Codex CLI, your Codex account, the downloaded ZIP, or your project files.

If you are working from a checked-out copy of this repository, the equivalent scripts are:

```bash
bash skills/setup-copy-ai-id-codex/scripts/status.sh
bash skills/setup-copy-ai-id-codex/scripts/start.sh
bash skills/setup-copy-ai-id-codex/scripts/update.sh
bash skills/setup-copy-ai-id-codex/scripts/uninstall.sh
```

Run Skill scripts with `bash`; downloaded GitHub archives do not always preserve executable permission bits.

## Manual companion ZIP fallback

Use this path if Codex cannot install the Skill from GitHub or if you prefer a downloaded bundle.

1. Open the [Copy AI ID v0.1.13 release](https://github.com/airman5573/copy-ai-id/releases/tag/v0.1.13), which matches this guide and extension build.
2. Download `copy-ai-id-codex-companion-0.1.13-macos.zip`. Do not download the Chrome Web Store ZIP for this step.
3. Extract the ZIP. It contains `SETUP_PROMPT.md`, the setup Skill and runtime, plus `Setup.command`, `Start.command`, `Status.command`, `Update.command`, and `Uninstall.command`.
4. Choose one setup method:
   - open `SETUP_PROMPT.md`, paste its prompt into Codex, and let Codex read the bundled `skills/setup-copy-ai-id-codex/SKILL.md`; or
   - open `Setup.command` directly. If macOS asks you to confirm a script downloaded from the internet, review that it came from the official `airman5573/copy-ai-id` release before allowing it.
5. When setup reports ready, return to the extension's **Codex Setup** modal and select **Retry**.

If Finder cannot open a `.command` file, run it from Terminal by passing the extracted file path to Bash, for example:

```bash
bash "/path/to/extracted/Setup.command"
```

## Troubleshooting

### The Codex button stays disabled

Open **Codex Setup** and read the status before reinstalling anything:

- **Checking Codex setup…:** wait a moment, then select **Retry**.
- **Companion unavailable:** start it with the Skill or `Start.command`, then check status.
- **Setup incomplete:** if the failed item is **Companion compatibility**, install the companion release matching your extension version. Otherwise fix the named prerequisite. For authentication, run `codex login status`; if needed, run `codex login` and retry.
- **Codex is busy:** wait for the current run to finish.

### Codex or another tool is not found

Run these in a new Terminal window:

```bash
node --version
codex --version
codex exec --help
codex login status
git --version
/usr/sbin/lsof -v
```

If `codex exec --help` is missing a required non-interactive option, update the Codex CLI. If a command works in Terminal but readiness still fails, update/restart the LaunchAgent with the Skill so it receives the current executable paths, then select **Retry** in Copy AI ID. Missing `fast_mode` support alone does not fail readiness; the companion uses the standard service tier instead.

### The companion is reachable but the page has no project

- For localhost, make sure the development server is still listening on the URL's port and was started from the intended project folder.
- For `file://`, make sure the file still exists and enable **Allow access to file URLs** for Copy AI ID in Chrome.
- Use a local page. A production `https://example.com/...` URL cannot identify a folder on your Mac.
- Keep the project inside your home folder unless you deliberately configure the advanced `COPY_AI_ID_ALLOW_OUTSIDE_HOME=1` override.

### Port 45130 is already in use

Ask the setup Skill to show status and identify the process using the port. Prefer stopping an old Copy AI ID companion instead of changing the port: the published extension expects `127.0.0.1:45130`.

### A run fails after readiness passes

Read the activity log below the toolbar Codex button. Check that the detected project is writable, Git can create commits, the Codex account is still authenticated, and the request fits within the run timeout. Copy AI ID copies the prompt as a fallback when it cannot complete a send.

The LaunchAgent logs are stored at:

```text
~/Library/Application Support/Copy AI ID Codex/logs/stdout.log
~/Library/Application Support/Copy AI ID Codex/logs/stderr.log
```

## Security and privacy

- The companion binds only to `127.0.0.1`; it is not exposed on your LAN or the public internet.
- `/health` reports companion protocol version `1`; the extension keeps Send disabled and shows **Companion compatibility** when that version does not match.
- It requires Copy AI ID's exact client marker and allows the published extension origin plus the documented stable development build. The marker is a protocol check, not a password; binding to the loopback interface and restricting extension origins are the main network boundaries.
- It resolves project symlinks, rejects the filesystem root and your entire home folder, and keeps projects inside the real home path unless you deliberately enable the advanced outside-home override.
- Local processes on your Mac can reach loopback services, so install the companion only from this public repository or its official release and keep your Mac account secure.
- Readiness details report tool status without returning credentials.
- Nothing is sent merely because the companion is running. A project is accessed only after you explicitly select **Send to Codex** and accept any required project confirmation.
- The local companion does not upload your notes to a Copy AI ID server. When a run starts, your installed Codex CLI communicates with OpenAI under your existing Codex authentication and configuration. Review the [official Codex CLI guide](https://learn.chatgpt.com/docs/codex/cli) for Codex data and account behavior.
- The companion performs local Git snapshot/commit operations as described above. Keep your normal backups and review changes after every automated run.
