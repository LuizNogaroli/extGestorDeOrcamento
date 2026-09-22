import { getPendingQueue, setPendingQueue } from './storage.js';
import { api } from './api-client.js';

/**
 * Enfileira uma despesa capturada offline (ou quando o POST direto falhou).
 * A fila fica em chrome.storage.local (ver storage.js) — sobrevive a fechar
 * o popup/navegador, diferente de uma variável em memória.
 */
export async function enqueueDespesa(payload) {
  const queue = await getPendingQueue();
  const item = {
    localId: crypto.randomUUID(),
    payload,
    createdAt: new Date().toISOString(),
  };
  queue.push(item);
  await setPendingQueue(queue);
  return item;
}

/**
 * Tenta enviar todos os itens da fila. Itens que falham (offline, API fora do
 * ar) voltam para a fila com o erro anotado; itens sincronizados com sucesso
 * saem da fila.
 */
export async function flushQueue() {
  const queue = await getPendingQueue();
  if (queue.length === 0) {
    return { synced: 0, remaining: 0 };
  }

  const remaining = [];
  let synced = 0;

  for (const item of queue) {
    try {
      await api.createDespesa(item.payload);
      synced++;
    } catch (err) {
      remaining.push({ ...item, lastError: String(err?.message || err) });
    }
  }

  await setPendingQueue(remaining);
  return { synced, remaining: remaining.length };
}

export async function getPendingCount() {
  const queue = await getPendingQueue();
  return queue.length;
}
