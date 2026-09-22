# extGestorDeOrcamento - Manual de Arquitetura e Soluções Técnicas (Playbook do Desenvolvedor)

Este documento é o **Mapa Técnico** e **Playbook de Soluções Reutilizáveis** da extensão. Segue o mesmo formato usado em `extTotalPlanner/docs/MANUAL_TECNICO.md` (projeto irmão) — ver seção 3 antes de reimplementar algo que "parece" novo.

---

## 1. Visão Arquitetural

Extensão Chrome (Manifest V3) como **complemento de captura rápida**, sem lógica de negócio própria — consome uma API REST nova no backend Laravel de `gestorDeOrcamento`, que continua sendo a única fonte da verdade dos dados. Ver `docs/plano-extensao-chrome.md` para o plano completo e o racional de cada decisão.

Tooling da extensão ainda **não decidido no código** (ver `docs/pendencias.md` e seção 5/14 do plano) — este arquivo será atualizado assim que a Fase 1 começar e a estrutura de diretórios real existir.

---

## 2. Estrutura de Diretórios

Ainda não existe código da extensão (apenas `docs/`). A estrutura proposta está na seção 11 de `docs/plano-extensao-chrome.md` — será confirmada/ajustada aqui quando a Fase 1 iniciar.

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

---

## 4. Mapeamento de Funcionalidades vs. Arquivos

| Funcionalidade | Arquivo (no repo `gestorDeOrcamento`, até a extensão ganhar código próprio) |
| :--- | :--- |
| Autenticação da API | `routes/api.php`, `config/sanctum.php`, `app/Models/User.php` (`HasApiTokens`) |
| CORS para a extensão | `config/cors.php` |
| Geração/revogação de token | `app/Livewire/SettingsManager.php`, `resources/views/livewire/settings-manager.blade.php` |
| Regra de criação de despesa (compartilhada) | `app/Actions/Despesas/SaveDespesaAction.php` |
| Endpoints da API | `app/Http/Controllers/Api/*.php`, `app/Http/Requests/Api/StoreDespesaRequest.php` |
| Testes da API | `tests/Feature/Api/DespesaApiTest.php` |

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
