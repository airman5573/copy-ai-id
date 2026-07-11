#!/usr/bin/env bash

# Shared implementation for the public management scripts. This file is sourced
# by scripts that enable `set -euo pipefail`; do not run it directly.

SKILL_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
BUNDLED_SERVER="$SKILL_ROOT/assets/codex-server.mjs"
USER_HOME="${HOME:-}"
CODEX_HOME_RESOLVED="${CODEX_HOME:-$USER_HOME/.codex}"
RUNTIME_DIR="$USER_HOME/Library/Application Support/Copy AI ID Codex"
RUNTIME_SERVER="$RUNTIME_DIR/codex-server.mjs"
RUNTIME_RUNNER="$RUNTIME_DIR/run-server.sh"
RUNTIME_VERSION="$RUNTIME_DIR/VERSION"
LOG_DIR="$RUNTIME_DIR/logs"
STDOUT_LOG="$LOG_DIR/stdout.log"
STDERR_LOG="$LOG_DIR/stderr.log"
LAUNCH_AGENT_LABEL="com.copy-ai-id.codex-server"
LAUNCH_AGENT_DIR="$USER_HOME/Library/LaunchAgents"
LAUNCH_AGENT_PLIST="$LAUNCH_AGENT_DIR/$LAUNCH_AGENT_LABEL.plist"
HEALTH_URL="http://127.0.0.1:45130/health"
SERVER_PORT="45130"
HEALTH_HEADER_NAME="x-copy-ai-id-client"
HEALTH_HEADER_VALUE="copy-ai-id-extension"

NODE_BIN=""
CODEX_BIN_RESOLVED=""
GIT_BIN=""
LSOF_BIN=""
SETUP_STAGING_DIR=""
MANAGEMENT_LOCK_DIR="$USER_HOME/Library/Application Support/Copy AI ID Codex.management.lock"
MANAGEMENT_LOCK_RECOVERY_DIR="$MANAGEMENT_LOCK_DIR.recovery"
MANAGEMENT_LOCK_TOKEN=""
MANAGEMENT_RECOVERY_TOKEN=""
MANAGEMENT_LOCK_OWNED=0
MANAGEMENT_RECOVERY_OWNED=0
INSTALL_TRANSACTION_ACTIVE=0
INSTALL_BACKUP_DIR=""
PREVIOUS_SERVICE_LOADED=0
PREVIOUS_SERVICE_READY=0

say() {
  printf '%s\n' "$*"
}

fail() {
  printf 'Copy AI ID Codex: %s\n' "$*" >&2
  return 1
}

management_owner_is_alive() {
  local owner_pid="$1"
  case "$owner_pid" in
    ''|*[!0-9]*) return 1 ;;
  esac
  [ "$owner_pid" -gt 0 ] 2>/dev/null && /bin/kill -0 "$owner_pid" 2>/dev/null
}

read_management_owner_pid() {
  /usr/bin/head -n 1 "$1/pid" 2>/dev/null || true
}

read_management_owner_token() {
  /usr/bin/head -n 1 "$1/token" 2>/dev/null || true
}

create_management_lock() {
  MANAGEMENT_LOCK_TOKEN="$$.${RANDOM:-0}.${RANDOM:-0}"
  if ! /bin/mkdir "$MANAGEMENT_LOCK_DIR" 2>/dev/null; then
    MANAGEMENT_LOCK_TOKEN=""
    return 1
  fi
  # Traps are armed before this function. Mark ownership immediately after
  # atomic mkdir so a signal during metadata writes can remove this directory.
  MANAGEMENT_LOCK_OWNED=1
  if ! /bin/chmod 0700 "$MANAGEMENT_LOCK_DIR" || \
     ! printf '%s\n' "$$" >"$MANAGEMENT_LOCK_DIR/pid" || \
     ! printf '%s\n' "$MANAGEMENT_LOCK_TOKEN" >"$MANAGEMENT_LOCK_DIR/token" || \
     ! /bin/chmod 0600 "$MANAGEMENT_LOCK_DIR/pid" "$MANAGEMENT_LOCK_DIR/token"; then
    fail "could not record or secure the management-lock owner."
    return 1
  fi
  return 0
}

create_management_recovery_lock() {
  MANAGEMENT_RECOVERY_TOKEN="$$.${RANDOM:-0}.${RANDOM:-0}"
  if ! /bin/mkdir "$MANAGEMENT_LOCK_RECOVERY_DIR" 2>/dev/null; then
    MANAGEMENT_RECOVERY_TOKEN=""
    return 1
  fi
  # See create_management_lock: immediate in-memory ownership plus the
  # pre-armed trap closes every catchable-signal window around these writes.
  MANAGEMENT_RECOVERY_OWNED=1
  if ! /bin/chmod 0700 "$MANAGEMENT_LOCK_RECOVERY_DIR" || \
     ! printf '%s\n' "$$" >"$MANAGEMENT_LOCK_RECOVERY_DIR/pid" || \
     ! printf '%s\n' "$MANAGEMENT_RECOVERY_TOKEN" >"$MANAGEMENT_LOCK_RECOVERY_DIR/token" || \
     ! /bin/chmod 0600 "$MANAGEMENT_LOCK_RECOVERY_DIR/pid" \
       "$MANAGEMENT_LOCK_RECOVERY_DIR/token"; then
    fail "could not record or secure the management recovery-lock owner."
    return 1
  fi
  return 0
}

management_lock_is_old_enough_to_recover() {
  local path="$1"
  local modified=""
  local now=""

  modified="$(/usr/bin/stat -f '%m' "$path" 2>/dev/null || true)"
  now="$(/bin/date '+%s' 2>/dev/null || true)"
  case "$modified:$now" in
    *[!0-9:]*|:*|*:) return 1 ;;
  esac
  [ $((now - modified)) -ge 5 ] 2>/dev/null
}

management_lock_can_be_recovered() {
  local path="$1"
  local owner_pid="$2"
  local owner_token="$3"

  if management_owner_is_alive "$owner_pid"; then
    return 1
  fi
  if [ -n "$owner_pid" ] && [ -n "$owner_token" ]; then
    return 0
  fi
  management_lock_is_old_enough_to_recover "$path"
}

release_management_recovery_lock() {
  local owner_pid=""
  local owner_token=""
  if [ "$MANAGEMENT_RECOVERY_OWNED" -eq 1 ]; then
    owner_pid="$(read_management_owner_pid "$MANAGEMENT_LOCK_RECOVERY_DIR")"
    owner_token="$(read_management_owner_token "$MANAGEMENT_LOCK_RECOVERY_DIR")"
    if { [ -n "$owner_pid" ] && [ "$owner_pid" != "$$" ]; } || \
       { [ -n "$owner_token" ] && [ "$owner_token" != "$MANAGEMENT_RECOVERY_TOKEN" ]; }; then
      MANAGEMENT_RECOVERY_OWNED=0
      MANAGEMENT_RECOVERY_TOKEN=""
      fail "management recovery-lock ownership changed; refusing to remove another operation's lock."
      return 1
    fi
    if ! /bin/rm -rf "$MANAGEMENT_LOCK_RECOVERY_DIR"; then
      fail "could not release the management recovery lock: $MANAGEMENT_LOCK_RECOVERY_DIR"
      return 1
    fi
    MANAGEMENT_RECOVERY_OWNED=0
    MANAGEMENT_RECOVERY_TOKEN=""
  fi
  return 0
}

release_management_lock() {
  local owner_pid=""
  local owner_token=""
  if [ "$MANAGEMENT_LOCK_OWNED" -ne 1 ]; then
    return 0
  fi

  owner_pid="$(read_management_owner_pid "$MANAGEMENT_LOCK_DIR")"
  owner_token="$(read_management_owner_token "$MANAGEMENT_LOCK_DIR")"
  if { [ -n "$owner_pid" ] && [ "$owner_pid" != "$$" ]; } || \
     { [ -n "$owner_token" ] && [ "$owner_token" != "$MANAGEMENT_LOCK_TOKEN" ]; }; then
    MANAGEMENT_LOCK_OWNED=0
    MANAGEMENT_LOCK_TOKEN=""
    fail "management-lock ownership changed; refusing to remove another operation's lock."
    return 1
  fi
  if ! /bin/rm -rf "$MANAGEMENT_LOCK_DIR"; then
    fail "could not release the management lock: $MANAGEMENT_LOCK_DIR"
    return 1
  fi
  MANAGEMENT_LOCK_OWNED=0
  MANAGEMENT_LOCK_TOKEN=""
  return 0
}

acquire_management_lock() {
  local lock_parent
  local observed_pid=""
  local observed_token=""
  local current_pid=""
  local current_token=""
  local recovered_pid=""
  local recovered_token=""
  local recovery_anchor_owned=0
  local quarantine_dir=""
  local stale_lock=""

  lock_parent="$(dirname -- "$MANAGEMENT_LOCK_DIR")"
  if ! /bin/mkdir -p "$lock_parent"; then
    fail "could not create the management-lock parent: $lock_parent"
    return 1
  fi
  if [ -e "$MANAGEMENT_LOCK_RECOVERY_DIR" ]; then
    if [ -L "$MANAGEMENT_LOCK_RECOVERY_DIR" ] || [ ! -d "$MANAGEMENT_LOCK_RECOVERY_DIR" ]; then
      fail "the management recovery-lock path is not a plain directory: $MANAGEMENT_LOCK_RECOVERY_DIR"
      return 1
    fi
    observed_pid="$(read_management_owner_pid "$MANAGEMENT_LOCK_RECOVERY_DIR")"
    observed_token="$(read_management_owner_token "$MANAGEMENT_LOCK_RECOVERY_DIR")"
    if management_owner_is_alive "$observed_pid"; then
      fail "another management operation is recovering a lock (pid $observed_pid)."
      return 1
    fi
    if ! management_lock_can_be_recovered "$MANAGEMENT_LOCK_RECOVERY_DIR" \
      "$observed_pid" "$observed_token"; then
      fail "a recent incomplete management recovery lock exists; retry in a few seconds."
      return 1
    fi

    # Keep maintenance continuously visible if a crashed recovery lock exists
    # without a main lock. This anchor becomes our normal operation lock.
    if [ ! -e "$MANAGEMENT_LOCK_DIR" ]; then
      if ! create_management_lock; then
        fail "could not create a maintenance anchor while recovering the stale recovery lock."
        return 1
      fi
      recovery_anchor_owned=1
    fi

    # Isolate into a unique existing parent, so mv always has a non-directory
    # destination and can never nest this lock inside a competing lock.
    quarantine_dir="$(/usr/bin/mktemp -d \
      "$MANAGEMENT_LOCK_RECOVERY_DIR.stale.XXXXXX")" || return 1
    stale_lock="$quarantine_dir/recovery-lock"
    current_pid="$(read_management_owner_pid "$MANAGEMENT_LOCK_RECOVERY_DIR")"
    current_token="$(read_management_owner_token "$MANAGEMENT_LOCK_RECOVERY_DIR")"
    if [ "$current_pid" != "$observed_pid" ] || [ "$current_token" != "$observed_token" ] || \
       management_owner_is_alive "$current_pid" || \
       ! /bin/mv -h "$MANAGEMENT_LOCK_RECOVERY_DIR" "$stale_lock" 2>/dev/null; then
      /bin/rm -rf "$quarantine_dir"
      if [ "$recovery_anchor_owned" -eq 1 ]; then
        release_management_lock
      fi
      fail "the management recovery-lock owner changed; retry shortly."
      return 1
    fi
    recovered_pid="$(read_management_owner_pid "$stale_lock")"
    recovered_token="$(read_management_owner_token "$stale_lock")"
    if management_owner_is_alive "$recovered_pid" || \
       [ "$recovered_pid" != "$observed_pid" ] || [ "$recovered_token" != "$observed_token" ]; then
      if [ ! -e "$MANAGEMENT_LOCK_RECOVERY_DIR" ]; then
        /bin/mv -h "$stale_lock" "$MANAGEMENT_LOCK_RECOVERY_DIR" 2>/dev/null || true
      fi
      /bin/rm -rf "$quarantine_dir"
      if [ "$recovery_anchor_owned" -eq 1 ]; then
        release_management_lock
      fi
      fail "a live or changed management recovery lock was encountered; retry."
      return 1
    fi
    /bin/rm -rf "$quarantine_dir"
    if [ "$recovery_anchor_owned" -eq 1 ]; then
      return 0
    fi
  fi

  # A live main owner needs no recovery mutex, and checking it here prevents
  # a contender from creating a transient recovery directory beside it.
  if [ -e "$MANAGEMENT_LOCK_DIR" ]; then
    if [ -L "$MANAGEMENT_LOCK_DIR" ] || [ ! -d "$MANAGEMENT_LOCK_DIR" ]; then
      fail "the management-lock path is not a plain directory: $MANAGEMENT_LOCK_DIR"
      return 1
    fi
    observed_pid="$(read_management_owner_pid "$MANAGEMENT_LOCK_DIR")"
    if management_owner_is_alive "$observed_pid"; then
      fail "another setup, update, repair, or uninstall is already running (pid $observed_pid)."
      return 1
    fi
  fi

  if ! create_management_recovery_lock; then
    fail "another management operation is acquiring or recovering the lock; retry shortly."
    return 1
  fi

  if [ ! -e "$MANAGEMENT_LOCK_DIR" ]; then
    if create_management_lock; then
      release_management_recovery_lock
      return $?
    fi
  fi
  if [ -L "$MANAGEMENT_LOCK_DIR" ] || [ ! -d "$MANAGEMENT_LOCK_DIR" ]; then
    release_management_recovery_lock
    fail "the management-lock path is not a directory: $MANAGEMENT_LOCK_DIR"
    return 1
  fi

  observed_pid="$(read_management_owner_pid "$MANAGEMENT_LOCK_DIR")"
  observed_token="$(read_management_owner_token "$MANAGEMENT_LOCK_DIR")"
  if management_owner_is_alive "$observed_pid"; then
    release_management_recovery_lock
    fail "another setup, update, repair, or uninstall is already running (pid $observed_pid)."
    return 1
  fi
  if ! management_lock_can_be_recovered "$MANAGEMENT_LOCK_DIR" \
    "$observed_pid" "$observed_token"; then
    release_management_recovery_lock
    fail "a recent incomplete management lock exists; retry in a few seconds."
    return 1
  fi

  # Serialize stale/incomplete main-lock recovery. Re-read ownership while the
  # recovery lock is held so a live operation's directory is never deleted.
  current_pid="$(read_management_owner_pid "$MANAGEMENT_LOCK_DIR")"
  current_token="$(read_management_owner_token "$MANAGEMENT_LOCK_DIR")"
  if [ "$current_pid" != "$observed_pid" ] || [ "$current_token" != "$observed_token" ] || \
     management_owner_is_alive "$current_pid"; then
    release_management_recovery_lock
    fail "the management-lock owner changed while recovering it; retry."
    return 1
  fi

  quarantine_dir="$(/usr/bin/mktemp -d \
    "$MANAGEMENT_LOCK_RECOVERY_DIR.stale-lock.XXXXXX")" || {
    release_management_recovery_lock
    return 1
  }
  stale_lock="$quarantine_dir/main-lock"
  if ! /bin/mv -h "$MANAGEMENT_LOCK_DIR" "$stale_lock"; then
    /bin/rm -rf "$quarantine_dir"
    release_management_recovery_lock
    fail "could not isolate the stale management lock."
    return 1
  fi
  recovered_pid="$(read_management_owner_pid "$stale_lock")"
  recovered_token="$(read_management_owner_token "$stale_lock")"
  if management_owner_is_alive "$recovered_pid" || \
     [ "$recovered_pid" != "$observed_pid" ] || [ "$recovered_token" != "$observed_token" ]; then
    if [ ! -e "$MANAGEMENT_LOCK_DIR" ]; then
      /bin/mv -h "$stale_lock" "$MANAGEMENT_LOCK_DIR" 2>/dev/null || true
    fi
    /bin/rm -rf "$quarantine_dir"
    release_management_recovery_lock
    fail "a live or changed management lock was encountered; retry."
    return 1
  fi
  if ! create_management_lock; then
    if [ ! -e "$MANAGEMENT_LOCK_DIR" ]; then
      /bin/mv -h "$stale_lock" "$MANAGEMENT_LOCK_DIR" 2>/dev/null || true
    fi
    /bin/rm -rf "$quarantine_dir"
    release_management_recovery_lock
    fail "another management operation acquired the lock; retry."
    return 1
  fi
  /bin/rm -rf "$quarantine_dir"
  if ! release_management_recovery_lock; then
    return 1
  fi
  return 0
}

require_supported_user() {
  if [ "$(uname -s)" != "Darwin" ]; then
    fail "this companion currently supports macOS only."
    return 1
  fi

  if [ "$(id -u)" -eq 0 ]; then
    fail "run this as your normal macOS user, not with sudo."
    return 1
  fi

  if [ -z "$USER_HOME" ] || [ ! -d "$USER_HOME" ]; then
    fail "HOME does not identify an existing user folder."
    return 1
  fi
}

resolve_executable() {
  local name="$1"
  local fallback="${2:-}"
  local resolved
  resolved="$(command -v "$name" 2>/dev/null || true)"
  if [ -z "$resolved" ] && [ -n "$fallback" ] && [ -x "$fallback" ]; then
    resolved="$fallback"
  fi
  if [ -z "$resolved" ] || [ ! -x "$resolved" ]; then
    return 1
  fi
  printf '%s\n' "$resolved"
}

check_prerequisites() {
  local failed=0
  local login_output=""
  local node_version=""
  local node_major=""

  NODE_BIN="$(resolve_executable node || true)"
  CODEX_BIN_RESOLVED="$(resolve_executable codex || true)"
  GIT_BIN="$(resolve_executable git /usr/bin/git || true)"
  LSOF_BIN="$(resolve_executable lsof /usr/sbin/lsof || true)"

  if [ -z "$NODE_BIN" ]; then
    printf 'Missing prerequisite: node is not installed or not on PATH.\n' >&2
    failed=1
  else
    node_version="$("$NODE_BIN" -p 'process.versions.node' 2>/dev/null || true)"
    node_major="${node_version%%.*}"
    case "$node_major" in
      ''|*[!0-9]*)
        printf 'Missing prerequisite: the Node.js version could not be checked.\n' >&2
        failed=1
        ;;
      *)
        if [ "$node_major" -lt 18 ]; then
          printf 'Missing prerequisite: Node.js 18 or newer is required (found %s).\n' "$node_version" >&2
          failed=1
        fi
        ;;
    esac
  fi
  if [ -z "$CODEX_BIN_RESOLVED" ]; then
    printf 'Missing prerequisite: Codex CLI is not installed or not on PATH.\n' >&2
    failed=1
  elif ! "$CODEX_BIN_RESOLVED" --version >/dev/null 2>&1; then
    printf 'Missing prerequisite: `codex --version` did not succeed.\n' >&2
    failed=1
  fi
  if [ -z "$GIT_BIN" ]; then
    printf 'Missing prerequisite: git is not installed or not on PATH.\n' >&2
    failed=1
  elif ! "$GIT_BIN" --version >/dev/null 2>&1; then
    printf 'Missing prerequisite: `git --version` did not succeed.\n' >&2
    failed=1
  fi
  if [ -z "$LSOF_BIN" ]; then
    printf 'Missing prerequisite: lsof is not installed or not on PATH.\n' >&2
    failed=1
  elif ! "$LSOF_BIN" -v >/dev/null 2>&1; then
    printf 'Missing prerequisite: `lsof -v` did not succeed.\n' >&2
    failed=1
  fi

  if [ -n "$CODEX_BIN_RESOLVED" ]; then
    if ! login_output="$("$CODEX_BIN_RESOLVED" login status 2>&1)"; then
      printf 'Missing prerequisite: Codex CLI is not logged in. Run `codex login`, then retry.\n' >&2
      failed=1
    elif printf '%s\n' "$login_output" | /usr/bin/grep -Eiq \
      'not[[:space:]]+(logged[[:space:]]+in|authenticated)|login[[:space:]]+required|please[[:space:]]+log[[:space:]]*in'; then
      printf 'Missing prerequisite: Codex CLI is not logged in. Run `codex login`, then retry.\n' >&2
      failed=1
    fi
  fi

  if [ "$failed" -ne 0 ]; then
    return 1
  fi
}

xml_escape() {
  local value="$1"
  value=${value//&/&amp;}
  value=${value//</&lt;}
  value=${value//>/&gt;}
  value=${value//\"/&quot;}
  value=${value//\'/&apos;}
  printf '%s' "$value"
}

build_launch_path() {
  local value
  value="$(dirname -- "$NODE_BIN"):$(dirname -- "$CODEX_BIN_RESOLVED"):$(dirname -- "$GIT_BIN"):$(dirname -- "$LSOF_BIN")"
  value="$value:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
  printf '%s' "$value"
}

write_staged_runtime() {
  local staging_dir="$1"
  local launch_path
  local escaped_home
  local escaped_runtime
  local escaped_runner
  local escaped_node
  local escaped_codex
  local escaped_codex_home
  local escaped_management_lock
  local escaped_path
  local escaped_stdout
  local escaped_stderr
  local source_version

  /bin/cp "$BUNDLED_SERVER" "$staging_dir/codex-server.mjs" || return 1
  source_version="$(resolve_bundled_version)"
  printf '%s\n' "$source_version" >"$staging_dir/VERSION" || return 1

  cat >"$staging_dir/run-server.sh" <<'RUNNER' || return 1
#!/usr/bin/env bash
set -euo pipefail

: "${COPY_AI_ID_NODE_BIN:?COPY_AI_ID_NODE_BIN is not set}"
: "${COPY_AI_ID_CODEX_RUNTIME_DIR:?COPY_AI_ID_CODEX_RUNTIME_DIR is not set}"
: "${CODEX_BIN:?CODEX_BIN is not set}"

exec "$COPY_AI_ID_NODE_BIN" "$COPY_AI_ID_CODEX_RUNTIME_DIR/codex-server.mjs"
RUNNER

  launch_path="$(build_launch_path)"
  escaped_home="$(xml_escape "$USER_HOME")"
  escaped_runtime="$(xml_escape "$RUNTIME_DIR")"
  escaped_runner="$(xml_escape "$RUNTIME_RUNNER")"
  escaped_node="$(xml_escape "$NODE_BIN")"
  escaped_codex="$(xml_escape "$CODEX_BIN_RESOLVED")"
  escaped_codex_home="$(xml_escape "$CODEX_HOME_RESOLVED")"
  escaped_management_lock="$(xml_escape "$MANAGEMENT_LOCK_DIR")"
  escaped_path="$(xml_escape "$launch_path")"
  escaped_stdout="$(xml_escape "$STDOUT_LOG")"
  escaped_stderr="$(xml_escape "$STDERR_LOG")"

  cat >"$staging_dir/$LAUNCH_AGENT_LABEL.plist" <<PLIST || return 1
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LAUNCH_AGENT_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$escaped_runner</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>$escaped_home</string>
    <key>PATH</key>
    <string>$escaped_path</string>
    <key>COPY_AI_ID_NODE_BIN</key>
    <string>$escaped_node</string>
    <key>COPY_AI_ID_CODEX_RUNTIME_DIR</key>
    <string>$escaped_runtime</string>
    <key>CODEX_BIN</key>
    <string>$escaped_codex</string>
    <key>CODEX_HOME</key>
    <string>$escaped_codex_home</string>
    <key>COPY_AI_ID_MANAGEMENT_LOCK_DIR</key>
    <string>$escaped_management_lock</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>$escaped_stdout</string>
  <key>StandardErrorPath</key>
  <string>$escaped_stderr</string>
</dict>
</plist>
PLIST

  /bin/chmod 0644 "$staging_dir/codex-server.mjs" || return 1
  /bin/chmod 0644 "$staging_dir/VERSION" || return 1
  /bin/chmod 0700 "$staging_dir/run-server.sh" || return 1
  /bin/chmod 0600 "$staging_dir/$LAUNCH_AGENT_LABEL.plist" || return 1
}

resolve_bundled_version() {
  local marker="$SKILL_ROOT/assets/VERSION"
  local package_json="$SKILL_ROOT/../../package.json"
  local value=""

  if [ -s "$marker" ]; then
    value="$(/usr/bin/head -n 1 "$marker" 2>/dev/null || true)"
  elif [ -s "$package_json" ] && [ -n "$NODE_BIN" ]; then
    value="$("$NODE_BIN" -e '
      try {
        const fs = require("node:fs");
        const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).version;
        if (typeof value === "string") process.stdout.write(value);
      } catch {}
    ' "$package_json" 2>/dev/null || true)"
  fi

  case "$value" in
    ''|*[!0-9A-Za-z.+-]*) printf '%s' "unversioned" ;;
    *) printf '%s' "$value" ;;
  esac
}

replace_file() {
  local source="$1"
  local destination="$2"
  local mode="$3"
  local temporary

  temporary="$(/usr/bin/mktemp "$destination.tmp.XXXXXX")"
  if ! /bin/cp "$source" "$temporary" || \
     ! /bin/chmod "$mode" "$temporary" || \
     ! /bin/mv -f "$temporary" "$destination"; then
    /bin/rm -f "$temporary"
    return 1
  fi
}

replace_file_preserving_metadata() {
  local source="$1"
  local destination="$2"
  local temporary

  temporary="$(/usr/bin/mktemp "$destination.restore.XXXXXX")"
  if ! /bin/cp -p "$source" "$temporary" || \
     ! /bin/mv -f "$temporary" "$destination"; then
    /bin/rm -f "$temporary"
    return 1
  fi
}

require_safe_install_paths() {
  local candidate
  for candidate in \
    "$RUNTIME_DIR" "$LOG_DIR" "$LAUNCH_AGENT_DIR" \
    "$RUNTIME_SERVER" "$RUNTIME_RUNNER" "$RUNTIME_VERSION" "$LAUNCH_AGENT_PLIST"; do
    if [ -L "$candidate" ]; then
      fail "refusing to install through a symbolic-link path: $candidate"
      return 1
    fi
  done

  for candidate in "$RUNTIME_DIR" "$LOG_DIR" "$LAUNCH_AGENT_DIR"; do
    if [ -e "$candidate" ] && [ ! -d "$candidate" ]; then
      fail "expected a directory at: $candidate"
      return 1
    fi
  done
  for candidate in "$RUNTIME_SERVER" "$RUNTIME_RUNNER" "$RUNTIME_VERSION" "$LAUNCH_AGENT_PLIST"; do
    if [ -e "$candidate" ] && [ ! -f "$candidate" ]; then
      fail "expected a regular file at: $candidate"
      return 1
    fi
  done
}

launch_domain() {
  printf 'gui/%s' "$(id -u)"
}

service_target() {
  printf '%s/%s' "$(launch_domain)" "$LAUNCH_AGENT_LABEL"
}

service_is_loaded() {
  /bin/launchctl print "$(service_target)" >/dev/null 2>&1
}

service_pid() {
  /bin/launchctl print "$(service_target)" 2>/dev/null | \
    /usr/bin/awk '$1 == "pid" && $2 == "=" && $3 ~ /^[0-9]+$/ { print $3; exit }'
}

listener_belongs_to_service() {
  local pid
  local listeners
  local line
  pid="$(service_pid || true)"
  if [ -z "$pid" ] || [ -z "$LSOF_BIN" ]; then
    return 1
  fi

  listeners="$("$LSOF_BIN" -nP -iTCP:"$SERVER_PORT" -sTCP:LISTEN -Fp 2>/dev/null || true)"
  while IFS= read -r line; do
    if [ "$line" = "p$pid" ]; then
      return 0
    fi
  done <<LISTENERS
$listeners
LISTENERS
  return 1
}

stop_service() {
  local domain
  local attempt=0
  domain="$(launch_domain)"

  if service_is_loaded; then
    /bin/launchctl bootout "$(service_target)" >/dev/null 2>&1 || \
      /bin/launchctl bootout "$domain" "$LAUNCH_AGENT_PLIST" >/dev/null 2>&1 || true
  elif [ -f "$LAUNCH_AGENT_PLIST" ]; then
    /bin/launchctl bootout "$domain" "$LAUNCH_AGENT_PLIST" >/dev/null 2>&1 || true
  fi

  while service_is_loaded && [ "$attempt" -lt 12 ]; do
    attempt=$((attempt + 1))
    /bin/sleep 0.25
  done
  if service_is_loaded; then
    fail "could not stop LaunchAgent $LAUNCH_AGENT_LABEL; installed files were left in place."
    return 1
  fi
  return 0
}

load_service() {
  local domain
  domain="$(launch_domain)"

  if ! stop_service; then
    return 1
  fi
  /bin/launchctl enable "$(service_target)" >/dev/null 2>&1 || true
  if ! /bin/launchctl bootstrap "$domain" "$LAUNCH_AGENT_PLIST"; then
    fail "could not load $LAUNCH_AGENT_PLIST."
    return 1
  fi
  if ! /bin/launchctl kickstart -k "$(service_target)"; then
    stop_service || true
    fail "the LaunchAgent was loaded but could not be started."
    return 1
  fi
}

health_response() {
  /usr/bin/curl \
    --silent \
    --show-error \
    --fail \
    --connect-timeout 1 \
    --max-time 7 \
    --header "$HEALTH_HEADER_NAME: $HEALTH_HEADER_VALUE" \
    "$HEALTH_URL"
}

health_is_ready() {
  local response
  response="$(health_response 2>/dev/null || true)"
  response_is_ready "$response"
}

response_is_ready() {
  local response="$1"
  case "$response" in *'"ok":true'*) ;; *) return 1 ;; esac
  case "$response" in *'"service":"copy-ai-id-codex-server"'*) ;; *) return 1 ;; esac
  case "$response" in *'"protocolVersion":1'*) ;; *) return 1 ;; esac
  case "$response" in *'"ready":true'*) ;; *) return 1 ;; esac
  case "$response" in *'"maintenance":false'*) ;; *) return 1 ;; esac
  case "$response" in *'"acceptingRuns":true'*) ;; *) return 1 ;; esac
}

response_is_companion() {
  local response="$1"
  case "$response" in *'"ok":true'*) ;; *) return 1 ;; esac
  case "$response" in *'"service":"copy-ai-id-codex-server"'*) ;; *) return 1 ;; esac
}

response_has_active_run() {
  local response="$1"
  case "$response" in *'"ok":true'*) ;; *) return 1 ;; esac
  case "$response" in *'"service":"copy-ai-id-codex-server"'*) ;; *) return 1 ;; esac
  case "$response" in *'"running":true'*) ;; *) return 1 ;; esac
}

response_honors_management_lock() {
  local response="$1"
  case "$response" in *'"ok":true'*) ;; *) return 1 ;; esac
  case "$response" in *'"service":"copy-ai-id-codex-server"'*) ;; *) return 1 ;; esac
  case "$response" in *'"protocolVersion":1'*) ;; *) return 1 ;; esac
  case "$response" in *'"ready":false'*) ;; *) return 1 ;; esac
  case "$response" in *'"maintenance":true'*) ;; *) return 1 ;; esac
  case "$response" in *'"acceptingRuns":false'*) ;; *) return 1 ;; esac
}

response_is_maintenance_ready() {
  local response="$1"
  response_honors_management_lock "$response" || return 1
  case "$response" in *'"prerequisitesReady":true'*) ;; *) return 1 ;; esac
}

installed_service_is_ready() {
  service_is_loaded && listener_belongs_to_service && health_is_ready
}

installed_service_is_maintenance_ready() {
  local response
  service_is_loaded || return 1
  listener_belongs_to_service || return 1
  response="$(health_response 2>/dev/null || true)"
  response_is_maintenance_ready "$response"
}

wait_for_maintenance_health() {
  local attempt=0
  while [ "$attempt" -lt 8 ]; do
    if installed_service_is_maintenance_ready; then
      return 0
    fi
    attempt=$((attempt + 1))
    /bin/sleep 0.25
  done
  return 1
}

print_locations() {
  say "Runtime: $RUNTIME_DIR"
  say "LaunchAgent: $LAUNCH_AGENT_PLIST"
  say "Logs:"
  say "  $STDOUT_LOG"
  say "  $STDERR_LOG"
}

backup_directory_state() {
  local source="$1"
  local key="$2"
  if [ -d "$source" ]; then
    : >"$INSTALL_BACKUP_DIR/$key.present" || return 1
    /usr/bin/stat -f '%Lp' "$source" >"$INSTALL_BACKUP_DIR/$key.mode" || return 1
  fi
}

backup_file_state() {
  local source="$1"
  local key="$2"
  if [ -f "$source" ]; then
    /bin/cp -p "$source" "$INSTALL_BACKUP_DIR/$key" || return 1
    : >"$INSTALL_BACKUP_DIR/$key.present" || return 1
  fi
}

begin_install_transaction() {
  INSTALL_BACKUP_DIR="$(/usr/bin/mktemp -d "${TMPDIR:-/tmp}/copy-ai-id-codex-backup.XXXXXX")" || return 1
  PREVIOUS_SERVICE_LOADED=0
  PREVIOUS_SERVICE_READY=0
  if service_is_loaded; then
    PREVIOUS_SERVICE_LOADED=1
    if installed_service_is_maintenance_ready; then
      PREVIOUS_SERVICE_READY=1
    fi
  fi

  backup_directory_state "$RUNTIME_DIR" runtime-dir || return 1
  backup_directory_state "$LOG_DIR" log-dir || return 1
  backup_directory_state "$LAUNCH_AGENT_DIR" launch-agent-dir || return 1
  backup_file_state "$RUNTIME_SERVER" codex-server.mjs || return 1
  backup_file_state "$RUNTIME_RUNNER" run-server.sh || return 1
  backup_file_state "$RUNTIME_VERSION" VERSION || return 1
  backup_file_state "$LAUNCH_AGENT_PLIST" launch-agent.plist || return 1
  INSTALL_TRANSACTION_ACTIVE=1
  return 0
}

restore_file_state() {
  local key="$1"
  local destination="$2"
  if [ -f "$INSTALL_BACKUP_DIR/$key.present" ]; then
    /bin/mkdir -p "$(dirname -- "$destination")" || return 1
    replace_file_preserving_metadata "$INSTALL_BACKUP_DIR/$key" "$destination"
  else
    /bin/rm -f "$destination"
  fi
}

restore_directory_mode() {
  local key="$1"
  local destination="$2"
  local mode=""
  if [ ! -f "$INSTALL_BACKUP_DIR/$key.present" ]; then
    return 0
  fi
  mode="$(/usr/bin/head -n 1 "$INSTALL_BACKUP_DIR/$key.mode" 2>/dev/null || true)"
  case "$mode" in
    ''|*[!0-7]*) return 1 ;;
  esac
  /bin/chmod "$mode" "$destination"
}

rollback_install_transaction() {
  local failed=0

  if [ "$INSTALL_TRANSACTION_ACTIVE" -ne 1 ]; then
    return 0
  fi
  # Prevent an EXIT trap from attempting the same rollback recursively.
  INSTALL_TRANSACTION_ACTIVE=0
  say "Restoring the previous Copy AI ID Codex installation..."

  if ! stop_service; then
    failed=1
  fi
  restore_file_state codex-server.mjs "$RUNTIME_SERVER" || failed=1
  restore_file_state run-server.sh "$RUNTIME_RUNNER" || failed=1
  restore_file_state VERSION "$RUNTIME_VERSION" || failed=1
  restore_file_state launch-agent.plist "$LAUNCH_AGENT_PLIST" || failed=1

  if [ ! -f "$INSTALL_BACKUP_DIR/runtime-dir.present" ]; then
    /bin/rm -rf "$RUNTIME_DIR" || failed=1
  else
    if [ ! -f "$INSTALL_BACKUP_DIR/log-dir.present" ]; then
      /bin/rm -rf "$LOG_DIR" || failed=1
    else
      restore_directory_mode log-dir "$LOG_DIR" || failed=1
    fi
    restore_directory_mode runtime-dir "$RUNTIME_DIR" || failed=1
  fi
  if [ ! -f "$INSTALL_BACKUP_DIR/launch-agent-dir.present" ]; then
    /bin/rmdir "$LAUNCH_AGENT_DIR" 2>/dev/null || true
  fi

  if [ "$PREVIOUS_SERVICE_LOADED" -eq 1 ]; then
    if ! load_service; then
      failed=1
    elif [ "$PREVIOUS_SERVICE_READY" -eq 1 ] && ! wait_for_maintenance_health; then
      failed=1
    elif ! service_is_loaded; then
      failed=1
    fi
  fi

  if [ "$failed" -ne 0 ]; then
    fail "automatic rollback was incomplete; inspect the runtime, LaunchAgent, and logs below."
    print_locations
    return 1
  fi
  say "Previous runtime, LaunchAgent plist, and loaded-service state were restored."
}

cleanup_management_operation() {
  local failed=0
  INSTALL_TRANSACTION_ACTIVE=0
  if [ -n "$SETUP_STAGING_DIR" ]; then
    if /bin/rm -rf "$SETUP_STAGING_DIR"; then
      SETUP_STAGING_DIR=""
    else
      printf 'Copy AI ID Codex: could not remove staging directory: %s\n' "$SETUP_STAGING_DIR" >&2
      failed=1
    fi
  fi
  if [ -n "$INSTALL_BACKUP_DIR" ]; then
    if /bin/rm -rf "$INSTALL_BACKUP_DIR"; then
      INSTALL_BACKUP_DIR=""
    else
      printf 'Copy AI ID Codex: could not remove transaction backup: %s\n' "$INSTALL_BACKUP_DIR" >&2
      failed=1
    fi
  fi
  if ! release_management_lock; then
    failed=1
  fi
  if ! release_management_recovery_lock; then
    failed=1
  fi
  trap - EXIT HUP INT TERM
  return "$failed"
}

report_management_cleanup_failure() {
  printf 'Copy AI ID Codex: management cleanup did not complete; success was not reported.\n' >&2
  if [ -e "$MANAGEMENT_LOCK_DIR" ] || [ -e "$MANAGEMENT_LOCK_RECOVERY_DIR" ]; then
    printf 'Copy AI ID Codex: Send remains disabled while the following maintenance lock path exists:\n' >&2
    if [ -e "$MANAGEMENT_LOCK_DIR" ]; then
      printf '  %s\n' "$MANAGEMENT_LOCK_DIR" >&2
    fi
    if [ -e "$MANAGEMENT_LOCK_RECOVERY_DIR" ]; then
      printf '  %s\n' "$MANAGEMENT_LOCK_RECOVERY_DIR" >&2
    fi
    printf 'Copy AI ID Codex: retry the same management command. Remove a stale lock manually only after confirming no setup, update, repair, or uninstall process is running.\n' >&2
  fi
  if [ -n "$SETUP_STAGING_DIR" ]; then
    printf 'Copy AI ID Codex: retained staging directory: %s\n' "$SETUP_STAGING_DIR" >&2
  fi
  if [ -n "$INSTALL_BACKUP_DIR" ]; then
    printf 'Copy AI ID Codex: retained transaction backup: %s\n' "$INSTALL_BACKUP_DIR" >&2
  fi
}

cleanup_after_failed_management_operation() {
  if ! cleanup_management_operation; then
    report_management_cleanup_failure
  fi
  return 0
}

retain_lock_and_backup_after_failed_rollback() {
  if [ "$MANAGEMENT_LOCK_OWNED" -eq 1 ]; then
    printf '%s\n' "Automatic rollback was incomplete. Run setup/update again or inspect the retained backup." \
      >"$MANAGEMENT_LOCK_DIR/ROLLBACK_FAILED" 2>/dev/null || true
    MANAGEMENT_LOCK_OWNED=0
    MANAGEMENT_LOCK_TOKEN=""
  fi
  if [ -n "$INSTALL_BACKUP_DIR" ]; then
    say "Rollback backup retained at: $INSTALL_BACKUP_DIR"
    INSTALL_BACKUP_DIR=""
  fi
  say "Send remains disabled by the retained maintenance lock: $MANAGEMENT_LOCK_DIR"
}

management_exit_trap() {
  local exit_status="$1"
  local rollback_failed=0
  trap - EXIT HUP INT TERM
  set +e
  if [ "$INSTALL_TRANSACTION_ACTIVE" -eq 1 ]; then
    if ! rollback_install_transaction; then
      rollback_failed=1
      exit_status=1
    fi
    if [ "$exit_status" -eq 0 ]; then
      exit_status=1
    fi
  fi
  if [ "$rollback_failed" -ne 0 ]; then
    retain_lock_and_backup_after_failed_rollback
  fi
  if ! cleanup_management_operation; then
    report_management_cleanup_failure
    exit_status=1
  fi
  exit "$exit_status"
}

arm_management_traps() {
  trap 'management_exit_trap $?' EXIT
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM
}

abort_install_transaction() {
  local message="$1"
  local rollback_failed=0
  printf 'Copy AI ID Codex: %s\n' "$message" >&2
  if ! rollback_install_transaction; then
    rollback_failed=1
  fi
  if [ "$rollback_failed" -ne 0 ]; then
    retain_lock_and_backup_after_failed_rollback
    printf 'Copy AI ID Codex: the install/update failed and the previous service could not be fully restored.\n' >&2
  fi
  if ! cleanup_management_operation; then
    report_management_cleanup_failure
  fi
  return 1
}

publish_staged_runtime() {
  local staging_dir="$1"
  if ! /bin/mkdir -p "$RUNTIME_DIR" "$LOG_DIR" "$LAUNCH_AGENT_DIR" || \
     ! /bin/chmod 0700 "$RUNTIME_DIR" "$LOG_DIR" || \
     ! replace_file "$staging_dir/codex-server.mjs" "$RUNTIME_SERVER" 0644 || \
     ! replace_file "$staging_dir/run-server.sh" "$RUNTIME_RUNNER" 0700 || \
     ! replace_file "$staging_dir/VERSION" "$RUNTIME_VERSION" 0644 || \
     ! replace_file "$staging_dir/$LAUNCH_AGENT_LABEL.plist" "$LAUNCH_AGENT_PLIST" 0600; then
    return 1
  fi
}

install_bundled_runtime() {
  local verb="$1"
  local response=""
  local staging_dir

  require_supported_user
  if ! check_prerequisites; then
    fail "prerequisite checks failed; no files were changed."
    return 1
  fi
  if [ ! -s "$BUNDLED_SERVER" ]; then
    fail "bundled server is missing: $BUNDLED_SERVER"
    return 1
  fi
  if ! require_safe_install_paths; then
    return 1
  fi
  arm_management_traps
  if ! acquire_management_lock; then
    cleanup_after_failed_management_operation
    return 1
  fi

  # A running companion must explicitly acknowledge this lock before any
  # state is copied. That acknowledgement closes the old check-then-stop race:
  # once maintenance=true is observed, /runs cannot accept a new run.
  response="$(health_response 2>/dev/null || true)"
  if service_is_loaded; then
    if ! response_is_companion "$response"; then
      fail "the loaded LaunchAgent did not provide a verifiable companion health response; no files were changed."
      cleanup_after_failed_management_operation
      return 1
    fi
    if ! response_honors_management_lock "$response"; then
      fail "the running companion predates the safe maintenance contract; stop that LaunchAgent before updating."
      cleanup_after_failed_management_operation
      return 1
    fi
    if response_has_active_run "$response"; then
      fail "a Codex run is active; wait for it to finish before installing or updating."
      cleanup_after_failed_management_operation
      return 1
    fi
  elif response_is_companion "$response"; then
    fail "a companion server is running outside this LaunchAgent; stop it before installing or updating."
    cleanup_after_failed_management_operation
    return 1
  fi

  staging_dir="$(/usr/bin/mktemp -d "${TMPDIR:-/tmp}/copy-ai-id-codex.XXXXXX")"
  SETUP_STAGING_DIR="$staging_dir"
  write_staged_runtime "$staging_dir"
  begin_install_transaction

  if ! publish_staged_runtime "$staging_dir"; then
    abort_install_transaction "the staged runtime or LaunchAgent plist could not be published; the previous installation will be restored."
    return $?
  fi
  if ! load_service; then
    abort_install_transaction "the new LaunchAgent could not be loaded; the previous installation will be restored."
    return $?
  fi

  if ! wait_for_maintenance_health; then
    response="$(health_response 2>/dev/null || true)"
    if response_is_companion "$response"; then
      if [[ "$response" == *'"prerequisitesReady":false'* ]]; then
        say "Companion health checks that did not pass:"
        print_failed_health_checks "$response"
      elif ! response_honors_management_lock "$response"; then
        say "The staged companion did not report the required protocol and maintenance contract."
      else
        say "Companion prerequisites passed, but the listener was not owned by the loaded LaunchAgent."
      fi
    else
      say "Check whether another process already owns 127.0.0.1:$SERVER_PORT."
    fi
    abort_install_transaction "the new LaunchAgent did not become ready under the maintenance lock; the previous installation will be restored."
    return $?
  fi

  # Commit only after the staged server, plist, loaded service, listener owner,
  # protocol, and prerequisites have all been verified. Releasing the lock is
  # the single point that lets the extension see ready=true and submit runs.
  INSTALL_TRANSACTION_ACTIVE=0
  if ! cleanup_management_operation; then
    report_management_cleanup_failure
    printf 'Copy AI ID Codex: the new installation was verified, but it was not declared ready because cleanup or lock release failed.\n' >&2
    return 1
  fi
  say "$verb Copy AI ID Codex companion."
  say "Ready: $HEALTH_URL"
  print_locations
}

start_installed_runtime() {
  local bundled_version
  local installed_version
  local response

  require_supported_user
  if ! check_prerequisites; then
    fail "prerequisite checks failed."
    return 1
  fi
  if [ ! -s "$RUNTIME_SERVER" ] || [ ! -s "$RUNTIME_RUNNER" ] || [ ! -f "$LAUNCH_AGENT_PLIST" ]; then
    fail "the companion is not fully installed. Run setup.sh first."
    return 1
  fi
  if [ ! -s "$RUNTIME_VERSION" ]; then
    fail "the installed companion has no version marker. Run update.sh from the intended release before starting it."
    return 1
  fi

  installed_version="$(/usr/bin/head -n 1 "$RUNTIME_VERSION" 2>/dev/null || true)"
  bundled_version="$(resolve_bundled_version)"
  if [ -z "$installed_version" ] || [ "$bundled_version" = "unversioned" ]; then
    fail "the installed or bundled companion version could not be identified. Use a versioned release and run update.sh."
    return 1
  fi
  if [ "$installed_version" != "$bundled_version" ]; then
    fail "installed version $installed_version differs from this bundle ($bundled_version). Run update.sh from the version you intend to install."
    return 1
  fi

  response="$(health_response 2>/dev/null || true)"
  if installed_service_is_ready && response_is_ready "$response"; then
    say "Copy AI ID Codex companion is already started and ready."
    return 0
  fi
  if response_has_active_run "$response"; then
    fail "a Codex run is active; wait for it to finish before restarting."
    return 1
  fi

  install_bundled_runtime "Started or repaired"
}

show_runtime_status() {
  local failed=0
  local response

  require_supported_user
  say "Copy AI ID Codex companion status"

  if check_prerequisites; then
    say "Prerequisites: ready"
  else
    say "Prerequisites: action required"
    failed=1
  fi

  if [ -s "$RUNTIME_SERVER" ] && [ -s "$RUNTIME_RUNNER" ] && [ -f "$LAUNCH_AGENT_PLIST" ]; then
    say "Installation: present"
    if [ -s "$RUNTIME_VERSION" ]; then
      say "Version: $(/usr/bin/head -n 1 "$RUNTIME_VERSION")"
    fi
  else
    say "Installation: incomplete or missing"
    failed=1
  fi

  if service_is_loaded; then
    say "LaunchAgent: loaded ($LAUNCH_AGENT_LABEL)"
    if listener_belongs_to_service; then
      say "Listener: owned by the LaunchAgent on 127.0.0.1:$SERVER_PORT"
    else
      say "Listener: port $SERVER_PORT is not owned by the LaunchAgent process"
      failed=1
    fi
  else
    say "LaunchAgent: not loaded"
    failed=1
  fi

  response="$(health_response 2>/dev/null || true)"
  if response_is_ready "$response"; then
    say "Health: ready (client-header request succeeded)"
  elif response_honors_management_lock "$response"; then
    say "Health: maintenance lock active ($MANAGEMENT_LOCK_DIR)"
    failed=1
  elif [[ "$response" == *'"ok":true'* && "$response" == *'"service":"copy-ai-id-codex-server"'* ]]; then
    say "Health: reachable but prerequisites are not ready"
    print_failed_health_checks "$response"
    failed=1
  else
    say "Health: unavailable"
    failed=1
  fi

  print_locations
  if [ "$failed" -ne 0 ]; then
    return 1
  fi
}

print_failed_health_checks() {
  local response="$1"
  if [ -z "$NODE_BIN" ]; then
    return 0
  fi

  "$NODE_BIN" -e '
    try {
      const data = JSON.parse(process.argv[1]);
      for (const check of Array.isArray(data.checks) ? data.checks : []) {
        if (!check || check.ok !== false) continue;
        const clean = (value, max) => String(value ?? "")
          .replace(/[\u0000-\u001f\u007f]/gu, " ")
          .slice(0, max);
        const code = clean(check.issueCode || check.id || "not-ready", 80);
        const detail = clean(check.detail || "Prerequisite check failed.", 240);
        console.log(`  - ${code}: ${detail}`);
      }
    } catch {}
  ' "$response" 2>/dev/null || true
}

wait_for_companion_to_stop() {
  local attempt=0
  local response
  while [ "$attempt" -lt 8 ]; do
    response="$(health_response 2>/dev/null || true)"
    if ! response_is_companion "$response"; then
      return 0
    fi
    attempt=$((attempt + 1))
    /bin/sleep 0.25
  done
  return 1
}

uninstall_runtime() {
  local response

  require_supported_user
  arm_management_traps
  if ! acquire_management_lock; then
    cleanup_after_failed_management_operation
    return 1
  fi
  response="$(health_response 2>/dev/null || true)"
  if service_is_loaded; then
    if ! response_is_companion "$response" || ! response_honors_management_lock "$response"; then
      fail "the loaded LaunchAgent did not acknowledge the safe maintenance lock; no files were removed."
      cleanup_after_failed_management_operation
      return 1
    fi
    if response_has_active_run "$response"; then
      fail "a Codex run is active; wait for it to finish before uninstalling."
      cleanup_after_failed_management_operation
      return 1
    fi
  elif response_is_companion "$response"; then
    fail "a companion server is running outside this LaunchAgent; stop that process before uninstalling."
    cleanup_after_failed_management_operation
    return 1
  fi
  if ! stop_service; then
    cleanup_after_failed_management_operation
    return 1
  fi
  if ! wait_for_companion_to_stop; then
    fail "the companion still responds after LaunchAgent shutdown; installed files were left in place."
    cleanup_after_failed_management_operation
    return 1
  fi

  if ! /bin/rm -f "$LAUNCH_AGENT_PLIST"; then
    printf 'Copy AI ID Codex: could not remove LaunchAgent plist: %s\n' "$LAUNCH_AGENT_PLIST" >&2
    cleanup_after_failed_management_operation
    return 1
  fi
  if [ -e "$RUNTIME_DIR" ] || [ -L "$RUNTIME_DIR" ]; then
    if ! /bin/rm -rf "$RUNTIME_DIR"; then
      printf 'Copy AI ID Codex: could not remove runtime directory: %s\n' "$RUNTIME_DIR" >&2
      cleanup_after_failed_management_operation
      return 1
    fi
  fi

  if ! cleanup_management_operation; then
    report_management_cleanup_failure
    printf 'Copy AI ID Codex: installed files were removed, but uninstall was not declared complete because cleanup or lock release failed.\n' >&2
    return 1
  fi
  say "Removed Copy AI ID Codex companion."
  say "The setup Skill and downloaded release files were left in place."
}
