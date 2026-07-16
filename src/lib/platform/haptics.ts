/**
 * Haptic feedback helpers. Web Vibration API is a no-op on iOS Safari (which
 * ignores it entirely) — that's fine; callers don't need to guard.
 */

function safeVibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined") return;
  const v = (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate;
  if (typeof v !== "function") return;
  try {
    v.call(navigator, pattern);
  } catch {
    /* ignore */
  }
}

/** Light tap — button press. */
export const hapticTap = () => safeVibrate(8);
/** Medium tap — mode change / confirmation. */
export const hapticBump = () => safeVibrate(14);
/** Start-of-action — mic engaged, recording begins. */
export const hapticStart = () => safeVibrate([6, 30, 12]);
/** End-of-action — mic released, success. */
export const hapticEnd = () => safeVibrate([12, 40, 10]);
/** Cancel / discard. */
export const hapticCancel = () => safeVibrate(20);
