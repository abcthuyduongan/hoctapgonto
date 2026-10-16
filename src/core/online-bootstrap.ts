/** Retire the app's earlier offline worker before any authenticated API calls. */
export async function prepareOnlineBrowser(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return true;
  const owned = (url: string) => {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname === '/sw.js';
  };
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    if ([registration.active, registration.waiting, registration.installing].some(worker => worker && owned(worker.scriptURL))) {
      await registration.unregister();
    }
  }
  if ('caches' in window) {
    for (const name of await caches.keys()) {
      if (name.startsWith('bao-an-learning-')) await caches.delete(name);
    }
  }
  if (navigator.serviceWorker.controller && owned(navigator.serviceWorker.controller.scriptURL)) {
    window.location.reload();
    return false;
  }
  return true;
}
