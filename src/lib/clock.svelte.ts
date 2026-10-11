/**
 * A reactive "now" for relative times such as "11m". Without it a timestamp is computed once when the post
 * is drawn and stays as it was, even when the app has been open in the background for a long while.
 * It ticks every 30 seconds while the page is visible, and refreshes at once when the app is shown again.
 */
export const clock = $state({ now: Date.now() });

let started = false;

function refresh() {
  if (document.visibilityState === 'visible') clock.now = Date.now();
}

/** Start the clock (once). Called by the first component that shows a relative time. */
export function startClock() {
  if (started || typeof document === 'undefined') return;
  started = true;
  setInterval(refresh, 30_000);
  for (const name of ['visibilitychange', 'pageshow', 'focus', 'online']) {
    (name === 'visibilitychange' ? document : window).addEventListener(name, refresh);
  }
}
