/**
 * Haptic feedback — disabled in this fork.
 *
 * The `web-haptics` engine (and its audible-on-desktop fallback) was removed
 * because it played sound/vibration on taps, modal opens/closes, etc. — not
 * wanted. `triggerHaptic` is kept as a no-op shim so the ~70 call sites across
 * the (upstream) components still compile without churn, and the public
 * surface (`HapticIntent`, `triggerHaptic`, `registerHapticTrigger`) is
 * preserved for the same reason.
 */

export type HapticIntent =
  | 'cancel'
  | 'close'
  | 'crisp'
  | 'error'
  | 'open'
  | 'selection'
  | 'streamDone'
  | 'streamStart'
  | 'submit'
  | 'success'
  | 'tap'
  | 'warning'

export type HapticTrigger = (input?: unknown, options?: unknown) => Promise<void> | undefined

// No-op: kept so an accidental re-introduction of a provider doesn't need to
// touch every consumer.
export function registerHapticTrigger(_trigger: HapticTrigger | null): void {}

// No-op: haptics/audio feedback is intentionally disabled in this fork.
export function triggerHaptic(_intent: HapticIntent = 'selection'): void {}
