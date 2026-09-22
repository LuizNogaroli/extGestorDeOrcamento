import { getSettings, setSettings } from '../lib/storage.js';
import { api } from '../lib/api-client.js';
import { requestSync } from '../lib/runtime.js';

const form = document.getElementById('form-options');
const inputUrl = document.getElementById('apiBaseUrl');
const inputToken = document.getElementById('apiToken');
const statusMsg = document.getElementById('status-msg');

init();

async function init() {
  const settings = await getSettings();
  inputUrl.value = settings.apiBaseUrl || '';
  inputToken.value = settings.apiToken || '';

  form.addEventListener('submit', onSave);
  document.getElementById('btn-testar').addEventListener('click', onTest);
  document.getElementById('btn-sync').addEventListener('click', onForceSync);
}

async function saveCurrentValues() {
  await setSettings({
    apiBaseUrl: inputUrl.value.trim().replace(/\/$/, ''),
    apiToken: inputToken.value.trim(),
  });
}

async function onSave(event) {
  event.preventDefault();
  await saveCurrentValues();
  setStatus('Configurações salvas.', 'success');
}

async function onTest() {
  await saveCurrentValues();
  setStatus('Testando…');

  try {
    const res = await api.ping();
    setStatus(`Conectado! Usuário: ${res.user?.name ?? res.user?.email ?? '—'}`, 'success');
  } catch (err) {
    setStatus(`Falha na conexão: ${err.message}`, 'error');
  }
}

async function onForceSync() {
  await saveCurrentValues();
  setStatus('Sincronizando…');

  const result = await requestSync();
  if (result?.error) {
    setStatus(`Falha ao sincronizar: ${result.error}`, 'error');
  } else {
    setStatus(`Sincronizado: ${result.synced} enviada(s), ${result.remaining} pendente(s).`, 'success');
  }
}

function setStatus(text, kind = '') {
  statusMsg.textContent = text;
  statusMsg.className = kind;
}
