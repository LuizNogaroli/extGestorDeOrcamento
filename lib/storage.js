/**
 * Abstração de storage com fallback chrome.storage.local -> localStorage.
 * Ver docs/plano-extensao-chrome.md secao 14.1 — permite testar popup/options
 * como pagina comum (rodar.bat) sem precisar carregar a extensao instalada.
 */

const PREFIX = 'gestor_';

function hasChromeStorage() {
  return typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
}

function get(key, fallback) {
  const namespaced = PREFIX + key;

  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.get([namespaced], (result) => {
        resolve(result[namespaced] === undefined ? fallback : result[namespaced]);
      });
    });
  }

  try {
    const raw = localStorage.getItem(namespaced);
    return Promise.resolve(raw === null ? fallback : JSON.parse(raw));
  } catch (err) {
    console.warn('[storage] falha ao ler', key, err);
    return Promise.resolve(fallback);
  }
}

function set(key, value) {
  const namespaced = PREFIX + key;

  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [namespaced]: value }, resolve);
    });
  }

  try {
    localStorage.setItem(namespaced, JSON.stringify(value));
  } catch (err) {
    console.warn('[storage] falha ao gravar', key, err);
  }
  return Promise.resolve();
}

export function getSettings() {
  return get('settings', { apiBaseUrl: '', apiToken: '', lastSyncAt: null });
}

export function setSettings(partial) {
  return getSettings().then((current) => set('settings', { ...current, ...partial }));
}

export function getPendingQueue() {
  return get('pending_queue', []);
}

export function setPendingQueue(queue) {
  return set('pending_queue', queue);
}

export function getCachedLookups() {
  return get('cached_lookups', { categories: [], bankAccounts: [], fetchedAt: null });
}

export function setCachedLookups(lookups) {
  return set('cached_lookups', lookups);
}
