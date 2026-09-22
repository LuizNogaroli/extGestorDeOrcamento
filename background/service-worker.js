import { flushQueue, getPendingCount } from '../lib/sync.js';

const ALARM_NAME = 'gestor-sync';
const ALARM_PERIOD_MINUTES = 5;

// chrome.alarms, não setTimeout/setInterval: o Manifest V3 mata o service
// worker quando ocioso, e só alarmes são garantidos pelo sistema.
// Ver docs/plano-extensao-chrome.md secao 14.3.
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
  updateBadge();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
  updateBadge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    runSync();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'SYNC_NOW') {
    runSync().then(sendResponse);
    return true; // mantém o canal aberto para a resposta assíncrona
  }
  if (message?.type === 'UPDATE_BADGE') {
    updateBadge();
  }
  return false;
});

async function runSync() {
  try {
    const result = await flushQueue();
    await updateBadge();
    return result;
  } catch (err) {
    console.error('[service-worker] falha ao sincronizar', err);
    return { synced: 0, remaining: await getPendingCount(), error: String(err?.message || err) };
  }
}

async function updateBadge() {
  const count = await getPendingCount();
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#DC2626' });
}
