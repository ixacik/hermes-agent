/**
 * remote-only.ts
 *
 * Fork flag (single source of truth, renderer side).
 *
 * This fork ships the desktop app as a thin REMOTE-ONLY client: it connects to a
 * Hermes gateway running elsewhere and never spawns a local Python backend. The
 * UI hides the local-vs-remote toggle, the local-recovery actions, and the
 * profiles page (a local-only concept) when this is `true`.
 *
 * Behavior changes are gated on this flag to keep the diff vs upstream small and
 * trivially re-appliable. Flip to `false` for upstream's local+remote behavior.
 *
 * Main-process mirror: electron/remote-only.cjs (keep the two in sync).
 */
export const REMOTE_ONLY = true
