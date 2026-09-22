import { getCachedLookups, setCachedLookups, getSettings } from '../lib/storage.js';
import { api } from '../lib/api-client.js';
import { enqueueDespesa, getPendingCount } from '../lib/sync.js';
import { requestSync, notifyBadgeUpdate, openOptionsPage } from '../lib/runtime.js';

const LOOKUP_TTL_MS = 60 * 60 * 1000; // 1h — ver secao 9 do plano

const form = document.getElementById('form-despesa');
const statusMsg = document.getElementById('status-msg');
const listaRecentes = document.getElementById('lista-recentes');
const syncStatus = document.getElementById('sync-status');
const selectCategoria = document.getElementById('category_id');
const selectConta = document.getElementById('bank_account_id');
const selectTipoPagamento = document.getElementById('tipo_pagamento');
const labelConta = document.getElementById('label-conta');
const inputData = document.getElementById('data');

init();

async function init() {
  inputData.value = todayIso();

  document.getElementById('btn-options').addEventListener('click', openOptionsPage);
  document.getElementById('btn-sync').addEventListener('click', onSyncClick);
  selectTipoPagamento.addEventListener('change', toggleContaVisibility);
  form.addEventListener('submit', onSubmit);

  toggleContaVisibility();

  const settings = await getSettings();
  if (!settings.apiBaseUrl || !settings.apiToken) {
    setStatus('Configure a extensão em Opções antes de usar.', 'error');
    listaRecentes.innerHTML = '<li class="vazio">Configure a extensão primeiro.</li>';
    return;
  }

  await loadLookups();
  await refreshSyncStatus();
  await loadRecentes();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toggleContaVisibility() {
  labelConta.style.display = selectTipoPagamento.value === 'Dinheiro' ? 'none' : '';
}

async function loadLookups() {
  let cached = await getCachedLookups();
  const isStale = !cached.fetchedAt || (Date.now() - new Date(cached.fetchedAt).getTime()) > LOOKUP_TTL_MS;

  if (isStale) {
    try {
      const [categoriesRes, accountsRes] = await Promise.all([api.categories(), api.bankAccounts()]);
      cached = {
        categories: categoriesRes.data,
        bankAccounts: accountsRes.data,
        fetchedAt: new Date().toISOString(),
      };
      await setCachedLookups(cached);
    } catch (err) {
      console.warn('[popup] falha ao atualizar categorias/contas, usando cache local', err);
    }
  }

  renderCategorias(cached.categories || []);
  renderContas(cached.bankAccounts || []);
}

function renderCategorias(categories) {
  selectCategoria.innerHTML = '<option value="">Sem categoria</option>';
  const parents = categories.filter((c) => !c.parent_id);
  const children = categories.filter((c) => c.parent_id);

  for (const parent of parents) {
    selectCategoria.appendChild(new Option(parent.name, parent.id));
    for (const child of children.filter((c) => c.parent_id === parent.id)) {
      selectCategoria.appendChild(new Option(`— ${child.name}`, child.id));
    }
  }
}

function renderContas(accounts) {
  selectConta.innerHTML = '<option value="">—</option>';
  for (const acc of accounts) {
    selectConta.appendChild(new Option(`${acc.nome} (${acc.banco})`, acc.id));
  }
}

async function onSubmit(event) {
  event.preventDefault();
  setStatus('Salvando…');

  const payload = {
    descricao_despesa: document.getElementById('descricao').value.trim(),
    valor: parseFloat(document.getElementById('valor').value),
    data: inputData.value,
    category_id: selectCategoria.value || null,
    tipo_pagamento: selectTipoPagamento.value,
    bank_account_id: selectConta.value || null,
  };

  if (!payload.descricao_despesa || !payload.valor || !payload.data) {
    setStatus('Preencha descrição, valor e data.', 'error');
    return;
  }

  try {
    await api.createDespesa(payload);
    setStatus('Despesa registrada!', 'success');
    await loadRecentes();
  } catch (err) {
    await enqueueDespesa(payload);
    setStatus('Sem conexão — guardada para sincronizar depois.', 'warning');
    notifyBadgeUpdate();
  }

  form.reset();
  inputData.value = todayIso();
  toggleContaVisibility();
  await refreshSyncStatus();
}

async function onSyncClick() {
  setStatus('Sincronizando…');
  const result = await requestSync();

  if (result?.error) {
    setStatus(`Falha ao sincronizar: ${result.error}`, 'error');
  } else {
    setStatus(`Sincronizado: ${result.synced} enviada(s), ${result.remaining} pendente(s).`, 'success');
    await loadRecentes();
  }

  await refreshSyncStatus();
}

async function refreshSyncStatus() {
  const pending = await getPendingCount();
  syncStatus.textContent = pending > 0 ? `⏳ ${pending} pendente(s)` : '✓ Tudo sincronizado';
}

async function loadRecentes() {
  try {
    const res = await api.recentDespesas(5);
    listaRecentes.innerHTML = '';

    if (!res.data || res.data.length === 0) {
      listaRecentes.innerHTML = '<li class="vazio">Nenhuma despesa ainda.</li>';
      return;
    }

    for (const d of res.data) {
      const li = document.createElement('li');
      const valorFormatado = Number(d.valor).toFixed(2).replace('.', ',');
      li.textContent = `${d.data} — ${d.descricao_despesa} — R$ ${valorFormatado}`;
      listaRecentes.appendChild(li);
    }
  } catch (err) {
    listaRecentes.innerHTML = '<li class="vazio">Não foi possível carregar (offline?).</li>';
  }
}

function setStatus(text, kind = '') {
  statusMsg.textContent = text;
  statusMsg.className = kind;
}
