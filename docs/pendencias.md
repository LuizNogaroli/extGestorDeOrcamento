# Pendências e Ideias para Implementação Futura

Este arquivo compila decisões em aberto e funcionalidades ainda não implementadas. Consulte antes de propor algo "novo" — pode já estar anotado aqui.

## 1. ~~Decisão em aberto: tooling da extensão~~ — Resolvido em 2026-09-22
**Decisão:** Vanilla JS + ES Modules nativos, sem bundler — mesmo padrão do projeto irmão `extTotalPlanner` (30+ iterações, funcionou bem), zero configuração de build.

## 2. Fase 1 — MVP da extensão — Implementado em 2026-09-22, falta validação real
Código completo (manifest, popup, options, service worker, lib/*) e testado via `rodar.bat` contra o backend real (ver `docs/historico/mvp_captura_rapida_20260922.md`). **Falta:**
- [ ] Usuário carregar a extensão de verdade via `chrome://extensions` → "Carregar sem compactação" e validar ícone/popup nativo/badge/`chrome.alarms`.
- [ ] Gerar um token real em `/settings` (o de teste usado nesta sessão foi revogado).
- [ ] Testar fluxo 100% offline (desligar a rede de verdade, não só simular erro de fetch).
- [ ] Ícones da extensão (`icons/icon16.png` etc.) — hoje o manifest não declara nenhum, Chrome usa um genérico. Não bloqueia "carregar sem compactação", mas fica pendente.

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
**Próximo passo:** carregar a extensão no Chrome de verdade (item 2) e, se tudo funcionar, seguir para a Fase 2.
