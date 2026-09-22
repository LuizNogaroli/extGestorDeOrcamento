/**
 * Guard para chrome.runtime.* — permite que popup/options rodem tanto dentro
 * da extensão instalada quanto como pagina comum via rodar.bat (dev-server),
 * onde o namespace `chrome` nao existe (nao e contexto de extensao).
 */

export function hasExtensionRuntime() {
  return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
}

/**
 * Pede ao service worker para sincronizar a fila agora. Fora da extensao
 * (modo dev-server), sincroniza diretamente no mesmo contexto.
 */
export async function requestSync() {
  if (hasExtensionRuntime()) {
    return chrome.runtime.sendMessage({ type: 'SYNC_NOW' });
  }
  const { flushQueue } = await import('./sync.js');
  return flushQueue();
}

export function notifyBadgeUpdate() {
  if (hasExtensionRuntime()) {
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' });
  }
}

export function openOptionsPage() {
  if (hasExtensionRuntime()) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open('../options/options.html', '_blank');
  }
}
