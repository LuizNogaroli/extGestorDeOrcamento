import { getSettings } from './storage.js';

class ApiError extends Error {}

async function request(path, options = {}) {
  const settings = await getSettings();

  if (!settings.apiBaseUrl || !settings.apiToken) {
    throw new ApiError('Configure a URL da API e o token de acesso em Opções.');
  }

  const url = settings.apiBaseUrl.replace(/\/$/, '') + path;

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiToken}`,
      ...(options.headers || {}),
    },
  });

  if (response.status === 204) {
    return null;
  }

  let body = null;
  try {
    body = await response.json();
  } catch (err) {
    // resposta sem corpo JSON (ex.: erro de servidor bruto)
  }

  if (!response.ok) {
    const message = body?.message
      || (body?.errors ? Object.values(body.errors).flat().join(' ') : null)
      || `Erro ${response.status}`;
    throw new ApiError(message);
  }

  return body;
}

export const api = {
  ping: () => request('/api/ping'),
  categories: () => request('/api/categories'),
  bankAccounts: () => request('/api/bank-accounts'),
  recentDespesas: (limit = 5) => request(`/api/despesas?limit=${limit}`),
  createDespesa: (payload) => request('/api/despesas', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  deleteDespesa: (id) => request(`/api/despesas/${id}`, { method: 'DELETE' }),
};
