# Pendências e Ideias para Implementação Futura

Este arquivo compila decisões em aberto e funcionalidades ainda não implementadas. Consulte antes de propor algo "novo" — pode já estar anotado aqui.

## 1. Decisão em aberto: tooling da extensão
Ainda não decidido no código (ver seção 5/14 de `docs/plano-extensao-chrome.md`):
- **Opção A:** Vite + CRXJS + TypeScript — mais robusto, exige build step.
- **Opção B:** Vanilla JS + ES Modules nativos, sem bundler — padrão já validado no projeto irmão `extTotalPlanner` (30+ iterações, funcionou bem), zero configuração.

**Decidir antes de iniciar a Fase 1** (scaffold da extensão).

## 2. Fase 1 — MVP da extensão (não iniciado)
- [ ] Scaffold conforme decisão de tooling acima + manifest MV3.
- [ ] `lib/storage` com fallback `chrome.storage.local` → IndexedDB/localStorage.
- [ ] Options page (apiBaseUrl, token, testar conexão via `GET /api/ping`).
- [ ] Popup: formulário de captura + fila offline + lista últimas 5 (`GET /api/despesas?limit=5`).
- [ ] Service worker: sync em background via `chrome.alarms` + badge de pendências.
- [ ] Teste ponta a ponta: capturar offline → voltar online → aparecer no Dashboard web.

## 3. Fase 2 — Complementos (não iniciado)
- [ ] Endpoint `/api/dashboard/summary` (projeção MM+1) + card no popup.
- [ ] Endpoint `/api/despesas/suggest-category` reaproveitando `CategorizationService` + autocomplete no popup.
- [ ] Notificações de despesas fixas a vencer via `chrome.alarms` + `chrome.notifications`.

## 4. Fase 3 — Exploratório (sem compromisso de prazo)
- [ ] Avaliar content script / clipboard para sugestão de captura em páginas de banco.
- [ ] Avaliar OCR de recibo (ex.: Tesseract.js).
- [ ] Avaliar publicação pública na Chrome Web Store vs. uso privado ("carregar sem compactação").

## 5. Risco conhecido: acesso remoto ao backend
O Laravel de `gestorDeOrcamento` roda localmente, sem domínio público hoje. A extensão só sincroniza quando consegue alcançar a `apiBaseUrl` configurada — avaliar túnel (Cloudflare/ngrok) se o uso precisar funcionar fora da rede local, sem tratar isso como bloqueante do MVP.

---
**Próximo passo:** decidir o item 1 (tooling) e iniciar a Fase 1.
