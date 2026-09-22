# MVP: Captura Rápida (Fase 1) — 2026-09-22

## O que foi feito
Implementado o esqueleto funcional da extensão (Manifest V3, Vanilla JS + ES Modules, sem build step):

- `manifest.json` — permissões `storage`+`alarms`, `host_permissions` amplo (`http://*/*`, `https://*/*`) porque a `apiBaseUrl` é configurável pelo usuário (localhost, LAN, túnel) e não dá para prever o domínio de antemão. **Revisar/restringir antes de qualquer publicação pública** (Fase 3).
- `popup/` — formulário de captura (descrição, valor, data default hoje, categoria com indentação pai/filho, tipo de pagamento, conta — some quando "Dinheiro"), lista das últimas 5 despesas, status de sincronização, botão de sync manual.
- `options/` — URL da API + token, testar conexão (`/api/ping`), forçar sincronização.
- `background/service-worker.js` — `chrome.alarms` a cada 5 min para tentar esvaziar a fila pendente + atualiza o badge do ícone com a contagem de pendências.
- `lib/storage.js`, `lib/api-client.js`, `lib/sync.js`, `lib/runtime.js` — ver `docs/MANUAL_TECNICO.md` seções 3.1–3.3 para o racional de cada um.
- `rodar.bat` + `tools/dev-server.py` — permite testar popup/options como página comum (sem carregar a extensão), servidor sem cache.

## Desvio do plano original
O plano (seção 9) especificava IndexedDB para a fila offline. Na implementação, usei **`chrome.storage.local` diretamente** (com fallback `localStorage` fora da extensão) para tudo — fila, cache de categorias/contas e configurações. Motivo: `chrome.storage.local` já é suficiente para o volume de uma fila de captura pessoal (não são milhares de itens), e evita depender de uma lib externa como `idb-keyval`, que precisaria ser vendorizada localmente já que o Manifest V3 proíbe carregar scripts de CDN em runtime. Simplifica sem perder a garantia de persistência entre sessões do navegador.

## Testes realizados
Como não há como carregar uma extensão "de verdade" no Chrome a partir desta sessão, o teste ponta a ponta foi feito via `rodar.bat` (dev-server) contra o **backend real** (`gestorDeOrcamento` rodando localmente, `php artisan serve`):

1. Gerado um token Sanctum de teste via tinker (nome `extensao-chrome`, mesmo padrão que o botão real de Settings usa).
2. `config/cors.php` do backend precisou de um ajuste: a origem do dev-server (`http://localhost:8010`) não é coberta pelo regex `chrome-extension://*` — adicionada como origem exata (ver `MANUAL_TECNICO.md` 3.3). **Isso é uma mudança permanente no backend**, útil para qualquer sessão futura que queira repetir esse teste.
3. Options → "Testar conexão": confirmado `ping` retornando o usuário autenticado.
4. Popup: categorias e contas **reais** do usuário carregadas corretamente (via cache local + API), com indentação de subcategoria.
5. Submetida uma despesa de teste (`"TESTE EXTENSAO - APAGAR"`, R$ 1,23, Dinheiro) — criada com sucesso via `POST /api/despesas`. Verificado direto no banco: `origem_pagamento: dinheiro`, `tipo_cartao: null`, `elegivel_irpf: false`, `user_id` correto — classificação do `SaveDespesaAction` correta.
6. Removida via `DELETE /api/despesas/{id}` (retornou 204) — **o registro de teste não ficou no banco de produção do usuário**. Token de teste revogado depois. Arquivos temporários da geração do token apagados.

**Não testado:** o fluxo real dentro do Chrome como extensão instalada (ícone na toolbar, popup nativo, badge, `chrome.alarms` disparando de fato, `chrome.storage.local` real em vez do fallback `localStorage`). Isso requer o usuário carregar a pasta via `chrome://extensions` → "Carregar sem compactação" — passo manual fora do alcance desta sessão.

## Estado do backend após esta sessão
- `config/cors.php` do `gestorDeOrcamento` agora libera duas origens: `chrome-extension://*` (regex) e `http://localhost:8010` (exata, dev-server desta extensão).
- Nenhum dado de teste ficou no banco (registro criado e removido na mesma sessão).

## Próximos passos (ver `docs/pendencias.md`)
- Usuário carregar a extensão via "Carregar sem compactação" e testar o fluxo real (ícone, popup nativo, badge, alarms).
- Gerar um token real em `/settings` (não o de teste, que foi revogado) e configurar em Options.
- Fase 2: resumo MM+1, autocomplete de categoria, notificações de despesas fixas.
