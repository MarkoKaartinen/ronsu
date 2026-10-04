/**
 * Escape hatch for a broken or stale install: removes the service worker and its caches, then reloads.
 * Accounts and settings (IndexedDB / localStorage) are not touched, so nobody has to log in again.
 */
export async function resetAndReload(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations();
    await Promise.all((registrations ?? []).map((r) => r.unregister()));
    await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
  } catch {
    /* nothing to clean up, or not allowed: reload anyway */
  }
  location.reload();
}
