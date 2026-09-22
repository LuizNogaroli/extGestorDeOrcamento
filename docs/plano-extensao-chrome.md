# Plano de Implementação — Extensão Chrome do Gestor de Orçamento

**Data:** 2026-09-22 (atualizado em 2026-09-22 com aprendizados do projeto irmão `extTotalPlanner`)
**Origem:** Ideia registrada em `gestorDeOrcamento/docs/ideias.md` ("Estratégia de Marketing — Extensão Chrome vs PWA")
**Decisão de direção:** seguir o "meio-termo" já esboçado — extensão como **complemento de captura rápida**, consumindo uma API nova no backend Laravel existente. Sem reescrever a lógica de negócio.
**Fonte adicional:** `extTotalPlanner` (`C:\Users\luizn\Documents\07-PROJETOS\extTotalPlanner`) é outra extensão Chrome do mesmo autor, já implementada e madura (30+ iterações documentadas). Não compartilha domínio (é um planner, não financeiro) nem arquitetura de dados (é standalone, sem backend), mas compartilha a **plataforma** (Manifest V3, Chrome APIs) e o **processo de documentação** — seções 6 e 15 abaixo trazem o que foi importado de lá.

---

## 1. Objetivo

Permitir que o usuário registre uma despesa em segundos a partir de qualquer aba do Chrome (ícone na barra de ferramentas), sem abrir o app web completo, mantendo o Laravel/SQLite atual como única fonte da verdade dos dados.

**Não-objetivo:** portar o app inteiro para a extensão. Import CSV, IRPF, investimentos, projeções detalhadas, CRUD de categorias continuam exclusivos do app web.

---

## 2. Restrição de arquitetura descoberta (importante)

O app `gestorDeOrcamento` **não tem nenhuma rota de API hoje** — `routes/web.php` só expõe componentes Livewire (server-rendered, sem login, single-user). Livewire não serve JSON utilizável por uma extensão.

➡️ **Pré-requisito obrigatório:** criar uma camada de API REST nova no Laravel (Fase 0 abaixo) antes de qualquer código de extensão. Isso é trabalho novo no backend, não reaproveitamento.

---

## 3. Arquitetura proposta

```
┌─────────────────────────┐        HTTPS/JSON        ┌──────────────────────────┐
│  Extensão Chrome (MV3)   │ ───────────────────────► │  Laravel API (Sanctum)   │
│  - Popup (captura rápida)│ ◄─────────────────────── │  routes/api.php (novo)   │
│  - Options (token/config)│                           │  Controllers *ApiController│
│  - Service worker (sync) │                           │  Mesmos Models/DB atual  │
│  - IndexedDB (fila off.) │                           └──────────────────────────┘
└─────────────────────────┘
```

- **Fonte da verdade:** banco SQLite atual, via Eloquent — nenhuma duplicação de regra de negócio.
- **Extensão é "burra" por design:** só captura, cacheia localmente o mínimo (categorias, contas) e sincroniza. Toda regra de projeção/categorização semântica permanece no backend.
- **Acesso remoto:** como o Laravel roda localmente (sem hoje um domínio público), o MVP assume `apiBaseUrl` configurável (ex.: `http://localhost:8000` ou um túnel Cloudflare/ngrok se o usuário quiser usar de outro dispositivo). Isso fica explícito na tela de Options — não é resolvido automaticamente.

---

## 4. Autenticação

App atual é single-user sem login. Não criar login na extensão. Usar **Laravel Sanctum (personal access token)**:

1. Adicionar Sanctum ao backend (`composer require laravel/sanctum`).
2. Gerar um token pessoal de longa duração (via `php artisan tinker` ou um botão em `SettingsManager`/nova tela em `/settings`).
3. Usuário cola o token na tela **Options** da extensão (armazenado em `chrome.storage.local`, nunca sincronizado via `chrome.storage.sync`).
4. Toda requisição da extensão envia `Authorization: Bearer <token>`.
5. `config/cors.php` liberado para origem `chrome-extension://<id>`.

---

## 5. Stack técnica da extensão

| Item | Escolha | Motivo |
|---|---|---|
| Manifest | **Manifest V3** | Exigência atual do Chrome Web Store |
| Linguagem | TypeScript | Consistência de tipos com payloads da API |
| Build | Vite + `@crxjs/vite-plugin` | Hot reload em dev, build MV3 padronizado |
| UI | HTML + Tailwind (mesma paleta do app) | Reaproveita identidade visual, popup leve (sem framework pesado) |
| Storage offline | IndexedDB via `idb-keyval` | Fila de despesas pendentes de sync, robusto a fechar o navegador |
| Config/token | `chrome.storage.local` | Não deve sincronizar entre máquinas (token é sensível) |
| Sync trigger | `chrome.alarms` + evento `online` no service worker | Retry periódico sem manter processo ativo |

**Decisão em aberto — build step vs. vanilla JS:** o `extTotalPlanner` não usa nenhum bundler — é Vanilla JS puro com ES Modules nativos (`<script type="module">`) carregados direto pelo navegador, sem TypeScript, sem Vite/CRXJS, e funcionou bem por dezenas de iterações. Vantagem: zero configuração de build, mais fácil de depurar (o que roda é exatamente o que está no disco). Dado que esta extensão é pequena por escopo (um popup de captura + options + service worker), **vale reconsiderar Vite/CRXJS/TypeScript da seção 5 em favor de Vanilla JS + ES Modules**, seguindo o padrão já validado no projeto irmão — decidir antes de iniciar a Fase 1, não é bloqueante para a Fase 0 (backend).

---

## 6. Funcionalidades — MVP (Fase 1)

### Popup (clique no ícone)
- Formulário mínimo: **valor**, **descrição**, **categoria** (select com busca, cacheado localmente), **origem/conta** (select), **data** (default: hoje).
- Botão "Salvar" grava direto via API se online; se offline, entra na fila local e mostra badge "pendente".
- Lista das **últimas 5 despesas** (somente leitura) para conferência rápida.
- Indicador de status de sincronização (✓ sincronizado / ⏳ N pendentes).

### Badge do ícone
- Contador de itens pendentes de sync (quando > 0).

### Options page
- Campo `apiBaseUrl` e `apiToken`.
- Botão "Testar conexão" (chama `GET /api/ping` autenticado).
- Botão "Forçar sincronização agora".

---

## 7. Funcionalidades — Fase 2 (pós-MVP)

- **Resumo MM+1** no popup (reaproveita a mesma lógica do card do Dashboard) — endpoint dedicado.
- **Autocomplete inteligente de categoria** reaproveitando `CategorizationService` (sugestão semântica) via endpoint novo.
- **Notificações do Chrome** (`chrome.notifications`) para despesas fixas próximas do vencimento (consulta periódica ao backend).
- **Atalho de teclado** (`chrome.commands`) para abrir o popup direto no formulário de captura.

## 8. Fase 3 (exploratório / não comprometido)

- Content script para sugerir captura ao detectar valores copiados (clipboard) em páginas de banco/e-commerce — **avaliar privacidade antes de avançar**.
- OCR de recibo (ex.: Tesseract.js) para preencher valor/descrição automaticamente.
- Publicação na Chrome Web Store (hoje, uso via "carregar sem compactação" é suficiente por ser single-user).

---

## 9. Modelo de dados local da extensão (IndexedDB)

```ts
interface PendingExpense {
  localId: string;        // uuid gerado no client
  data: string;            // YYYY-MM-DD
  descricao_despesa: string;
  valor: number;
  tipo_pagamento: 'Dinheiro' | 'Débito' | 'Crédito';
  category_id?: number;
  bank_account_id?: number;
  createdAt: string;
  syncStatus: 'pending' | 'syncing' | 'error';
  syncError?: string;
}

interface CachedLookup {
  categories: { id: number; name: string; parent_id: number | null; color: string }[];
  bankAccounts: { id: number; nome: string; banco: string }[];
  fetchedAt: string; // usado para invalidar cache (ex.: > 1h)
}

interface ExtensionSettings {
  apiBaseUrl: string;
  apiToken: string;
  lastSyncAt: string | null;
}
```

---

## 10. Endpoints novos necessários no backend (Fase 0)

Todos sob `routes/api.php`, middleware `auth:sanctum`, prefixo `/api`:

| Método | Rota | Descrição | Reaproveita |
|---|---|---|---|
| GET | `/ping` | Health check para "Testar conexão" | — |
| GET | `/categories` | Lista achatada (id, name, parent_id, color) | `Category` |
| GET | `/bank-accounts` | Lista contas ativas | `BankAccount` |
| POST | `/despesas` | Cria despesa (mesma validação do `TotalExpensesManager`) | `Despesa` |
| GET | `/despesas?limit=5` | Últimas despesas para conferência no popup | `Despesa` |
| DELETE | `/despesas/{id}` | Desfazer captura errada direto do popup | `Despesa` |
| GET | `/dashboard/summary` | Projeção MM+1 (Fase 2) | lógica do `ExpenseManager`/Dashboard |
| GET | `/despesas/suggest-category?descricao=...` | Sugestão semântica (Fase 2) | `CategorizationService` |

**Importante:** extrair a validação/regra de criação de despesa hoje embutida no Livewire (`TotalExpensesManager`) para um `FormRequest` ou `Action` compartilhável, para não duplicar regra entre Livewire e API Controller.

---

## 11. Estrutura de pastas sugerida da extensão

```
extGestorDeOrcamento/
├── docs/
│   └── plano-extensao-chrome.md   (este arquivo)
├── src/
│   ├── background/
│   │   └── service-worker.ts      (sync, alarms, badge)
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.ts
│   │   └── popup.css
│   ├── options/
│   │   ├── options.html
│   │   └── options.ts
│   ├── lib/
│   │   ├── api-client.ts          (fetch wrapper + auth header)
│   │   ├── storage.ts             (idb-keyval wrappers)
│   │   └── sync.ts                (fila -> API, retry/backoff)
│   └── types/
│       └── models.ts              (tipos espelhando payloads da API)
├── manifest.json
├── vite.config.ts
├── package.json
└── tsconfig.json
```

---

## 12. Roadmap por fases

### Fase 0 — Backend (pré-requisito, feito em `gestorDeOrcamento`)
- [x] Instalar Sanctum, configurar CORS para `chrome-extension://`.
- [x] Extrair validação/regra de criação de despesa para reuso (`App\Actions\Despesas\SaveDespesaAction`, usada pelo Livewire e pela API).
- [x] Criar `routes/api.php` com os endpoints da seção 10 (exceto Fase 2/3): `/ping`, `/categories`, `/bank-accounts`, `/despesas` (index/store/destroy).
- [x] Botão em Settings para gerar/revogar token pessoal (`SettingsManager::generateExtensionToken()`/`revokeExtensionTokens()`).
- [x] Testes básicos dos novos endpoints — `tests/Feature/Api/DespesaApiTest.php`, 8/8 passando; suíte completa 25/26 (1 falha pré-existente e não relacionada: `ExampleTest`).
- [x] Iniciar repositório Git em `extGestorDeOrcamento` (remote `origin` já apontando para `github.com/LuizNogaroli/extGestorDeOrcamento`; primeiro commit ainda pendente de push manual).
- [x] Criar `docs/MANUAL_TECNICO.md` e `docs/pendencias.md`, seguindo o formato do projeto irmão (ver 14.6).
- [ ] Decidir tooling da extensão: Vite+CRXJS+TypeScript vs. Vanilla JS + ES Modules sem build step (ver decisão em aberto na seção 5) — **ainda pendente, bloqueia o início da Fase 1**.

### Fase 1 — MVP da extensão
- [ ] Scaffold conforme decisão de tooling da Fase 0 (Vite+CRXJS ou Vanilla JS+ES Modules) + manifest MV3.
- [ ] `lib/storage.ts` com fallback `chrome.storage.local` → IndexedDB/localStorage puro (ver 14.1), para permitir testar como página comum.
- [ ] Se Vanilla JS sem Vite: criar servidor de teste local auto-contido com `Cache-Control: no-store` (ver 14.2), nos moldes do `rodar.bat` do projeto irmão.
- [ ] Options page (apiBaseUrl, token, testar conexão).
- [ ] Popup: formulário de captura + fila offline + lista últimas 5.
- [ ] Service worker: sync em background via `chrome.alarms` + badge de pendências.
- [ ] Teste manual ponta a ponta: capturar offline → voltar online → aparecer no Dashboard web.
- [ ] Criar primeira entrada em `docs/historico/` documentando o MVP (ver 14.6).

### Fase 2 — Complementos
- [ ] Endpoint + card de resumo MM+1 no popup.
- [ ] Autocomplete com sugestão semântica de categoria.
- [ ] Notificações de despesas fixas a vencer.

### Fase 3 — Exploratório (sem compromisso de prazo)
- [ ] Avaliar content script / clipboard.
- [ ] Avaliar OCR de recibo.
- [ ] Avaliar publicação pública na Web Store vs. uso privado.

---

## 13. Riscos e decisões em aberto

| Risco/Decisão | Impacto | Observação |
|---|---|---|
| Acesso remoto ao backend local | Alto | Sem domínio público hoje; MVP funciona só na mesma máquina/rede a menos que se configure túnel |
| Duplicação de regra de validação (Livewire vs API) | Médio | Mitigar extraindo para Action/FormRequest compartilhado (Fase 0) |
| Zero testes no projeto atual | Médio | Novos endpoints da API deveriam nascer com teste, mesmo que o resto do app não tenha |
| Token único sem expiração/rotação | Baixo (single-user) | Aceitável para uso pessoal; documentar como revogar via Settings |
| Publicação na Web Store exige revisão do Google | Baixo (Fase 3) | Uso via "carregar sem compactação" resolve o caso de uso pessoal sem essa dependência |
| Edição de arquivos com acentuação via PowerShell sem `-Encoding utf8` | Médio | Ver seção 14.4 — já corrompeu conteúdo (mojibake) no projeto irmão. Preferir Node/Python/ferramentas cientes de UTF-8 para editar HTML/JSON/locale com acentos |
| Cache agressivo de servidor HTTP simples durante dev | Baixo/Médio | Ver seção 14.2 — pode fazer uma correção "parecer não funcionar"; mitigar de origem com `Cache-Control: no-store` no servidor de teste local |

---

## 14. Aprendizados aplicáveis do projeto irmão `extTotalPlanner`

`extTotalPlanner` é outra extensão Chrome do mesmo autor, com ~30 iterações documentadas em `docs/historico/` e um manual técnico (`docs/MANUAL_TECNICO.md`) cheio de armadilhas já resolvidas. Domínio e modelo de dados não se aplicam (é um planner standalone, sem backend), mas os pontos abaixo são transferíveis diretamente por serem sobre a **plataforma Chrome Extension** e sobre **processo**.

### 14.1. Abstração de storage com fallback para teste fora da extensão
`StorageService.js` de lá cai automaticamente para `localStorage` quando `chrome.storage` não está disponível (ex.: rodando como página comum via servidor local, sem carregar como extensão). **Aplicar aqui:** `src/lib/storage.ts` deveria seguir o mesmo padrão — detectar `typeof chrome !== 'undefined' && chrome.storage?.local` e cair para IndexedDB/localStorage puro quando ausente. Isso permite testar o popup/options como página HTML comum no navegador, sem precisar recarregar a extensão a cada mudança (acelera bastante o ciclo de dev do MVP).

### 14.2. Servidor de teste local auto-contido, sem cache
O projeto irmão tem um `rodar.bat` que sobe um servidor HTTP local forçando `Cache-Control: no-store` e `Content-Type: text/javascript` correto para módulos ES6 — porque `python -m http.server` puro não envia `Cache-Control`, e o navegador passa a servir JS do cache mesmo após reload forçado (armadilha real, já mordeu o projeto irmão mais de uma vez). **Aplicar aqui:** se o MVP usar Vanilla JS + ES Modules (ver decisão da seção 5) em vez de Vite, replicar esse mesmo tipo de servidor de teste local para o popup/options; se ficar com Vite/CRXJS, o dev server dele já resolve isso nativamente.

### 14.3. Notificações confiáveis exigem `chrome.alarms`, não `setTimeout`
Para a Fase 2 (notificação de despesas fixas a vencer), o projeto irmão migrou de temporizadores no `setTimeout` para `chrome.alarms` no service worker, porque o Manifest V3 mata o service worker quando ocioso e `setTimeout` não sobrevive a isso — só alarmes são garantidos pelo sistema. **Aplicar aqui:** já estava certo na seção 5 (sync via `chrome.alarms`), mas vale reforçar — qualquer notificação futura (despesa fixa vencendo, resumo diário) **precisa** ser `chrome.alarms` + `chrome.notifications`, nunca timer em memória.

### 14.4. Nunca editar arquivos com acentuação via PowerShell sem `-Encoding utf8`
Edições via `Get-Content`/`Set-Content` sem encoding explícito corromperam acentos/emojis no HTML do projeto irmão (UTF-8 relido como CP1252 e regravado — "mojibake duplo"), exigindo um script de correção depois. **Aplicar aqui:** válido para qualquer arquivo com pt-BR (locale JSON, HTML, `.md` de docs) — usar ferramentas cientes de UTF-8 (o editor/Edit tool do Claude Code já é seguro nesse sentido; cuidado é só com scripts PowerShell manuais).

### 14.5. Modularizar assim que passar de ~100 linhas
Regra explícita do manual técnico do projeto irmão: toda função/arquivo que ultrapassa ~100 linhas deve ser extraída para um módulo dedicado. A extensão daqui já nasce modular (seção 11: `lib/api-client.ts`, `lib/storage.ts`, `lib/sync.ts` separados), mas vale manter essa disciplina conforme o popup ganhar funcionalidades (ex.: separar renderização de lista de despesas do handler de submit assim que crescer).

### 14.6. Adotar a mesma governança de documentação
O projeto irmão usa (via `CLAUDE.md`) um protocolo fixo: `Sobre_X.md` (visão) → `MANUAL_TECNICO.md` (arquitetura + playbook de soluções, seção "Histórico de Versões" cronológica) → `pendencias.md` (ideias não implementadas) → `docs/historico/<assunto>_<timestamp>.md` (uma entrada por mudança, formato "O que foi feito / Estado Anterior / Estado Novo / Rollback"), atualizado **de forma autônoma após cada mudança**, sem precisar de solicitação. Isso é consistente com a preferência já registrada do usuário (documentação completa por implementação + snapshots com timestamp). **Recomendação:** replicar essa mesma estrutura em `extGestorDeOrcamento` assim que a Fase 1 começar — criar `docs/MANUAL_TECNICO.md` e `docs/pendencias.md`, e passar a gerar um arquivo em `docs/historico/` a cada mudança relevante, no mesmo formato. Também iniciar um repositório Git desde o início (o projeto irmão só ganhou um depois de um incidente de perda de conteúdo por restauração de backup desatualizado).

---

## 15. Critério de sucesso do MVP

> O usuário consegue, a partir de qualquer aba, clicar no ícone da extensão e registrar uma despesa (valor + descrição + categoria) em menos de 10 segundos, e essa despesa aparece corretamente no Dashboard do app web após a sincronização — inclusive quando capturada offline.
