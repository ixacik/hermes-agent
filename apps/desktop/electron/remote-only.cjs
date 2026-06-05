/**
 * remote-only.cjs
 *
 * Fork flag (single source of truth, main-process side).
 *
 * This fork ships the desktop app as a thin REMOTE-ONLY client: it connects to a
 * Hermes gateway running elsewhere (e.g. a box on the LAN) and never spawns or
 * bootstraps a local Python backend. The full agent suite (agent/, tools/,
 * gateway/, cli.py, …) is left in the tree untouched so `git merge upstream/main`
 * stays clean — it's simply never run from here.
 *
 * Every behavior change for remote-only mode is gated on this flag so the diff
 * against upstream is small and trivially re-appliable. Flip to `false` to get
 * upstream's local+remote behavior back.
 *
 * Renderer mirror: src/lib/remote-only.ts (keep the two in sync).
 */
// Shown when remote-only mode has no gateway to connect to (no env override and
// no saved remote URL). Surfaced via the boot-failure overlay.
const REMOTE_ONLY_NO_GATEWAY_MSG =
  'This is a remote-only build with no gateway configured. ' +
  'Open Settings → Gateway and point it at your Hermes gateway.'

module.exports = { REMOTE_ONLY: true, REMOTE_ONLY_NO_GATEWAY_MSG }
