# Diretrizes do Projeto extGestorDeOrcamento

## Protocolo de Documentação Técnica
- **Registro Automático:** toda mudança técnica, refatoração ou decisão arquitetural deve ser registrada em `docs/MANUAL_TECNICO.md` (seção 3 se for um padrão reutilizável, seção 6 sempre) imediatamente após a implementação, mais um arquivo novo em `docs/historico/<assunto>_<YYYYMMDD>.md`.
- **Autonomia:** faça essa atualização sem precisar de permissão do usuário — o objetivo é manter o histórico de soluções, mesmo que venham a ser substituídas depois.
- Este protocolo replica o do projeto irmão `extTotalPlanner` (ver `extTotalPlanner/CLAUDE.md`), que já validou essa prática em ~30 iterações.

## Onboarding Rápido para uma Nova IA / Sessão

Leia nesta ordem antes de propor ou implementar qualquer coisa:

1. **[`docs/plano-extensao-chrome.md`](docs/plano-extensao-chrome.md)** — visão, arquitetura, roadmap por fases e decisões em aberto. É o documento fundador do projeto.
2. **[`docs/MANUAL_TECNICO.md`](docs/MANUAL_TECNICO.md)** — mapa técnico: o que já existe (hoje, principalmente do lado do backend em `gestorDeOrcamento`), qual arquivo cuida de qual funcionalidade, e soluções de engenharia já resolvidas.
3. **[`docs/pendencias.md`](docs/pendencias.md)** — decisões em aberto e funcionalidades ainda não implementadas.
4. **`docs/historico/`** (quando existir) — uma entrada por mudança relevante, mais granular que o Manual Técnico.
5. **`gestorDeOrcamento/docs/`** — o app principal (Laravel/Livewire) que esta extensão consome via API. `handoff.md` e `sugestoes.md` lá dão o contexto de negócio (regras de despesas, categorias, IRPF etc.).

## Nota sobre o projeto irmão
`extTotalPlanner` (`../extTotalPlanner`) é outra extensão Chrome do mesmo autor, mais madura. Não compartilha domínio nem dados, mas vale consultar seu `docs/MANUAL_TECNICO.md` para armadilhas já resolvidas de Manifest V3 (storage, notificações, cache de dev, encoding) antes de reimplementar algo do zero aqui.
