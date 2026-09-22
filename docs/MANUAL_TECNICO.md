# extGestorDeOrcamento - Manual de Arquitetura e Soluções Técnicas (Playbook do Desenvolvedor)

Este documento é o **Mapa Técnico** e **Playbook de Soluções Reutilizáveis** da extensão. Segue o mesmo formato usado em `extTotalPlanner/docs/MANUAL_TECNICO.md` (projeto irmão) — ver seção 3 antes de reimplementar algo que "parece" novo.

---

## 1. Visão Arquitetural

Extensão Chrome (Manifest V3) como **complemento de captura rápida**, sem lógica de negócio própria — consome uma API REST no backend Laravel de `gestorDeOrcamento`, que continua sendo a única fonte da verdade dos dados. Ver `docs/plano-extensao-chrome.md` para o plano completo e o racional de cada decisão.

**Tooling:** Vanilla JS + ES Modules nativos (`<script type="module">`), sem bundler/TypeScript — decisão tomada em 2026-09-22, mesmo padrão do projeto irmão `extTotalPlanner`. Sem `package.json`, sem `node_modules`.

**Storage:** `chrome.storage.local` como armazenamento primário (fila de despesas pendentes, cache de categorias/contas, configurações), com fallback para `localStorage` fora do contexto de extensão — **não usa IndexedDB** apesar do plano original (seção 9) ter especificado isso; simplificação feita na implementação porque `chrome.storage.local` já é suficiente para o volume de dados de uma fila de captura pessoal, e evita depender de uma lib externa (idb-keyval) que precisaria ser vendorizada localmente (Manifest V3 proíbe carregar scripts remotos em runtime).

---

## 2. Estrutura de Diretórios

```
extGestorDeOrcamento/
├── manifest.json
├── background/service-worker.js   # sync via chrome.alarms + badge
├── popup/{popup.html,popup.js,popup.css}
├── options/{options.html,options.js}
├── lib/
│   ├── storage.js      # chrome.storage.local -> localStorage fallback
│   ├── api-client.js   # fetch wrapper com Bearer token
│   ├── sync.js         # fila de pendentes + flush
│   └── runtime.js       # guard chrome.runtime.* (permite rodar fora da extensão)
├── tools/dev-server.py  # servidor de teste local sem cache
├── rodar.bat             # atalho para tools/dev-server.py
└── docs/
```

---

## 3. Soluções Técnicas de Destaque

### 3.1. API do backend pronta para consumo (Fase 0 concluída em `gestorDeOrcamento`)
* **Onde:** repositório `gestorDeOrcamento`, `routes/api.php`.
* **Autenticação:** Laravel Sanctum, personal access token (Bearer). Gerado/revogado em `/settings` (botão "Gerar Token da Extensão"), nome fixo do token: `extensao-chrome`.
* **CORS:** `gestorDeOrcamento/config/cors.php` libera `paths => ['api/*']` para qualquer origem `chrome-extension://*` via `allowed_origins_patterns` (regex) — a extensão não precisa de domínio público, mas o Laravel precisa estar acessível pela rede/máquina onde o Chrome roda.
* **Endpoints disponíveis agora:**
  | Método | Rota | Descrição |
  |---|---|---|
  | GET | `/api/ping` | Health check + dados do usuário autenticado |
  | GET | `/api/categories` | Lista achatada de categorias (`id`, `name`, `parent_id`, `color`) |
  | GET | `/api/bank-accounts` | Contas ativas do usuário autenticado |
  | GET | `/api/despesas?limit=N` | Últimas N despesas (padrão 5, máx. 50), mais recentes primeiro |
  | POST | `/api/despesas` | Cria despesa (mesma classificação de IRPF/cartão/origem do app web) |
  | DELETE | `/api/despesas/{id}` | Remove despesa (só o dono pode) |
* **Regra de negócio compartilhada:** `App\Actions\Despesas\SaveDespesaAction` (em `gestorDeOrcamento/app/Actions/Despesas/SaveDespesaAction.php`) concentra a classificação de elegibilidade IRPF, resolução de `tipo_cartao`/parcelas e `origem_pagamento`. Usada tanto pelo Livewire (`TotalExpensesManager::save()`) quanto pelo `DespesaApiController::store()` — **qualquer mudança nessa regra deve ser feita ali, nunca duplicada em um dos dois lados**.
* **Testes:** `gestorDeOrcamento/tests/Feature/Api/DespesaApiTest.php` cobre autenticação obrigatória, listagem/paginação, criação com classificação correta, validação de campos obrigatórios e isolamento por usuário no delete.
* **Regra para o futuro:** ao adicionar um novo endpoint que crie/edite despesa, sempre passar pelo `SaveDespesaAction` — não reimplementar a classificação inline no controller.

### 3.2. Guard `lib/runtime.js` — código roda dentro e fora da extensão
* **Problema:** `chrome.runtime.sendMessage()`/`chrome.runtime.openOptionsPage()` só existem quando a página roda como extensão de verdade (`chrome-extension://...`). Testar `popup.html`/`options.html` como página comum via `rodar.bat` (`http://localhost:8010/...`) faz o namespace `chrome` inteiro não existir, quebrando qualquer chamada direta.
* **Solução:** `lib/runtime.js` expõe `requestSync()`/`notifyBadgeUpdate()`/`openOptionsPage()` que checam `hasExtensionRuntime()` (`typeof chrome !== 'undefined' && chrome.runtime?.id`) e caem para um comportamento equivalente fora da extensão — ex.: `requestSync()` importa `sync.js` e roda `flushQueue()` no mesmo contexto, em vez de mandar mensagem para um service worker que não existe fora da extensão instalada.
* **Regra para o futuro:** qualquer novo uso de `chrome.runtime`/`chrome.action`/`chrome.alarms` a partir de `popup.js`/`options.js` deve passar por um guard assim — nunca chamar `chrome.*` direto nesses dois arquivos.

### 3.3. CORS liberado também para a porta fixa do dev-server (não só `chrome-extension://`)
* **Arquivo:** `gestorDeOrcamento/config/cors.php`.
* **Contexto:** testar via `rodar.bat` serve as páginas em `http://localhost:8010`, uma origem HTTP normal — o regex `#^chrome-extension://.*$#` não cobre isso, e sem CORS liberado o navegador bloqueia o preflight (`Access-Control-Allow-Origin` ausente), mesmo com o token correto.
* **Solução:** adicionado `'http://localhost:8010'` em `allowed_origins` (lista exata, não regex — porta fixa e conhecida do `tools/dev-server.py`), ao lado do padrão de `chrome-extension://`.
* **Verificado:** `curl -X OPTIONS .../api/ping -H "Origin: http://localhost:8010" ...` retorna `Access-Control-Allow-Origin: http://localhost:8010`; testado também via `fetch()` real no navegador (ping, criação e exclusão de despesa, todos OK).

---

## 4. Mapeamento de Funcionalidades vs. Arquivos

### Backend (`gestorDeOrcamento`)
| Funcionalidade | Arquivo |
| :--- | :--- |
| Autenticação da API | `routes/api.php`, `config/sanctum.php`, `app/Models/User.php` (`HasApiTokens`) |
| CORS para a extensão + dev-server | `config/cors.php` |
| Geração/revogação de token | `app/Livewire/SettingsManager.php`, `resources/views/livewire/settings-manager.blade.php` |
| Regra de criação de despesa (compartilhada) | `app/Actions/Despesas/SaveDespesaAction.php` |
| Endpoints da API | `app/Http/Controllers/Api/*.php`, `app/Http/Requests/Api/StoreDespesaRequest.php` |
| Testes da API | `tests/Feature/Api/DespesaApiTest.php` |

### Extensão (`extGestorDeOrcamento`)
| Funcionalidade | Arquivo |
| :--- | :--- |
| Manifest / permissões | `manifest.json` |
| Captura rápida (formulário) | `popup/popup.html`, `popup/popup.js` |
| Configurações (URL/token) | `options/options.html`, `options/options.js` |
| Sync em background + badge | `background/service-worker.js` |
| Fila offline de despesas pendentes | `lib/sync.js` |
| Chamadas HTTP à API | `lib/api-client.js` |
| Storage (settings, fila, cache) | `lib/storage.js` |
| Compatibilidade dentro/fora da extensão | `lib/runtime.js` |
| Teste local sem carregar a extensão | `rodar.bat`, `tools/dev-server.py` |

---

## 5. Dicas e Boas Práticas (herdadas do projeto irmão `extTotalPlanner`)

Ver seção 14 de `docs/plano-extensao-chrome.md` para o detalhamento completo. Resumo:
1. Storage com fallback (`chrome.storage.local` → local/IndexedDB) para testar fora da extensão instalada.
2. Servidor de teste local sempre com `Cache-Control: no-store`.
3. Notificações via `chrome.alarms`, nunca `setTimeout`/`setInterval` no service worker.
4. Nunca editar arquivos com acentuação via PowerShell sem `-Encoding utf8`.
5. Modularizar assim que um arquivo passar de ~100 linhas.

---

## 6. Histórico de Versões do Documento

| Versão | Data/Hora | Responsável | Resumo das Alterações |
| :---: | :--- | :--- | :--- |
| **1.0** | 2026-09-22 | Claude Code (Sonnet 5) & User | Criação do manual. Fase 0 concluída no backend (`gestorDeOrcamento`): Sanctum instalado, CORS configurado, `routes/api.php` com 6 endpoints, `SaveDespesaAction` extraída e reutilizada pelo Livewire, UI de token em Settings, 8 testes de API passando (suíte completa: 25/26 — 1 falha pré-existente e não relacionada, `ExampleTest`). Ver histórico em `gestorDeOrcamento/docs/historico/`. |
| **1.1** | 2026-09-22 | Claude Code (Sonnet 5) & User | Fase 1 (MVP) implementada: manifest MV3, popup de captura rápida (form + fila offline + últimas 5), options page (URL/token/testar conexão/forçar sync), service worker (`chrome.alarms` + badge), `lib/{storage,api-client,sync,runtime}.js`, `rodar.bat`/`tools/dev-server.py`. Testado ponta a ponta via dev-server contra o backend real (ping, categorias/contas reais carregadas, criação e exclusão de despesa via API, classificação correta confirmada no banco) — o registro de teste foi removido logo em seguida. Teste com a extensão de fato **carregada no Chrome** ainda pendente (fora do alcance desta sessão). Ver histórico `docs/historico/mvp_captura_rapida_20260922.md`. |
