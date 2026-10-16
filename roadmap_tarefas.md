# Roadmap de Refatoração e Melhorias

Este documento consolida as tarefas de aprimoramento do aplicativo, organizadas em 5 fases sequenciais.
Para rodar qualquer tarefa no CLI, instrua o agente:
> "Leia a Tarefa XX de @roadmap_tarefas.md, execute todas as implementações, testes, documentação, build, commit e push."

---

## Protocolo Geral de Entrega (Obrigatório para todas as tarefas)
1. **Documentação:** Atualizar a documentação técnica relevante e os comentários de arquitetura.
2. **Qualidade & Testes:** Rodar/criar testes unitários ou de integração e executar o build de produção (`npm run build` ou equivalente), garantindo zero erros de lint e tipagem.
3. **Controle de Versão:** Executar o commit semântico padronizado indicado na tarefa e realizar o push para a branch remota.

---

## FASE 1: Limpeza Estrutural, Autenticação e Design System Base

### Tarefa 01: Remoção Limpa da Autenticação em 2 Etapas (2FA) [Concluída]
- **Status:** ✅ Concluída
- **Objetivo:** Remover por completo a funcionalidade de autenticação em 2 etapas (2FA/MFA) do aplicativo, limpando código, dependências e interfaces.
- **Ações:**
  1. Frontend: remover tela/etapa de código 2FA no login e seção de ativação em Configurações/Perfil. (Concluído: remoção do card de 2FA em `security-tab.tsx`, preservação do status RLS e limpeza de aliases).
  2. Backend/Auth: desativar endpoints/triggers voltados para TOTP/MFA e garantir que nenhum usuário ativo fique bloqueado com status pendente de 2FA. (Concluído: `max_enrolled_factors = 0` em `supabase/config.toml`, remoção de `domain/auth` e validação de invariantes).
  3. Desinstalar bibliotecas exclusivas de 2FA (ex.: `otplib`, geradores de QR Code) e limpar o `package.json`. (Concluído: zero dependências residuais de 2FA no projeto).
- **Commit:** `refactor(auth): remove two-factor authentication flow and clean dependencies`

---

### Tarefa 02: Padronização e Limpeza de Pop-ups e Modais [Concluída]
- **Status:** ✅ Concluída
- **Objetivo:** Revisar todos os pop-ups e modais, garantindo herança da cor de destaque (accent) e tema ativo, eliminando redundâncias.
- **Ações:**
  1. Mapear e consolidar modais redundantes em um componente reutilizável padrão. (Concluído: `ResponsiveDialog` e `ConfirmDialog` consolidados utilizando o `ModalFooter` canônico do `Modal`, unificando safe-area padding e botões).
  2. Garantir que todos os modais herdem as variáveis do tema ativo (background, bordas, botões) e a cor de destaque definida pelo usuário. (Concluído: anéis de foco com `--ring` e `--primary`, hover states nos botões de calculadora e drag-handle, paleta de comando, seletores e date/color/icon pickers com `border-border/80`, `bg-surface` e `backdrop-blur-md`).
  3. Remover diálogos obsoletos que causem poluição visual e padronizar tipografia/bordas nos modais analíticos (Concluído: remoção de classes ad-hoc `text-[9.5px]` e `border-border/60` no modal explicativo de investimentos, alinhado às Regras 14 e 16 de `AGENTS.md`).
- **Commit:** `refactor(ui): standardize popups and modals to reflect active accent theme`

---

### Tarefa 03: Reposicionamento Responsivo de Modais e Pop-ups [Concluída]
- **Status:** ✅ Concluída
- **Objetivo:** Ajustar a ancoragem de modais/pop-ups para não sobrepor barras de navegação (bottom bar no mobile e sidebar no desktop).
- **Ações:**
  1. Mobile: implementar safe areas inferiores e estratégia de Bottom Sheet ou modal centralizado com backdrop que não fique escondido sob a bottom navigation bar. (Concluído: `Modal` com `pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]`, `ModalFooter` sticky com `pb-[max(0.75rem,calc(env(safe-area-inset-bottom,0px)+0.5rem))]` e overlay em `z-modal: 50` cobrindo integralmente a `BottomNav: 30`).
  2. Desktop: centralizar modais com margens adequadas e isolamento de foco. (Concluído: centralização responsiva com `md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2`, respiro vertical garantido via `md:max-h-[calc(100dvh-3rem)]`, overlay cobrindo `Sidebar: 40`, e foco inicial condicional evitando abertura acidental de teclado virtual no mobile).
  3. Padronizar a escala global de `z-index` (dropdowns < tooltips < bottom bar < modais < toasts). (Concluído: escala unificada em tokens/globals: `dropdowns (20) < tooltips (25) < bottom bar (30) < sidebar (40) < modais (50) < floating-tools (60) < toasts (70)`, além de `collisionPadding={8}` e regras de elevação dinâmica para poppers em modais).
- **Commit:** `fix(ui): reposition popups and modals to avoid overlapping navigation bars`

---

### Tarefa 04: Auditoria de Feedback Sonoro e Háptico [Concluída]
- **Status:** ✅ Concluída
- **Objetivo:** Auditar todos os sons e vibrações do app, eliminando duplicidades e ruídos desnecessários.
- **Ações:**
  1. Mapear chamadas de áudio e vibração (`navigator.vibrate` / Web Audio API) eliminando chamadas redundantes e diretas em componentes (Concluído: remoção de chamadas concorrentes `triggerHaptic` dentro de handlers `onClick` de botões em `calculator-button`, `notifications-button`, `month-picker`, `year-picker`, `bill-refinance-dialog`, `early-amortization-dialog`, `loan-form-dialog`, `settle-dialog`, `report-detail-dialog`, `expense-detail-dialog`, `income-detail-dialog` e transição do `useSwipeNavigation` para o Gateway Central Sensorial, eliminando por completo o defeito de duplo disparo / *double-haptic* em conformidade com a Regra 17 de `AGENTS.md`).
  2. Eliminar disparos concorrentes ao clicar rapidamente ou alternar telas (Concluído: implementado algoritmo de throttle anti-concorrência no `soundManager` com janela de 40ms geral e 60ms para mesmo efeito, e no `hapticsManager` com janela mínima de 60ms, com bypass exclusivo para alertas críticos urgentes).
  3. Criar utilitário centralizado (`soundManager` / `hapticsManager`) com controle de mute global e respeitando as configurações do usuário (Concluído: classes `SoundManager` e `HapticsManager` integradas no `sensory` central com métodos `mute()`, `unmute()`, `isMuted()`, `sound` e `haptics`, suporte a preferências do usuário `soundEnabled`, `hapticEnabled`, `disabledSensoryIntents` e testes unitários 100% cobrindo controle de mudo e anti-concorrência).
- **Commit:** `fix(audio): audit sound effects and haptics to eliminate duplicates and refine UX`

---

## FASE 2: Refinamento de UI/UX no Dashboard e Navegação

### Tarefa 05: Padronização dos Ícones Lucide nos Cards do Dashboard [Concluída]
- **Status:** ✅ Concluída
- **Objetivo:** Padronizar os ícones do Dashboard em duas regras visuais rígidas.
- **Ações:**
  1. Ícones com fundo/cores contextuais: apenas em banners, carrossel inicial de informações ou cards contextuais (reagindo a receitas, despesas, investimentos). (Concluído: mantidos containers com cores contextuais estritamente nos banners do carrossel inicial de alertas `PaceAlertBanner`, `SurplusAporteBanner`, `CashGapAlert`, `DemoModeBanner`, `TrialEndingBanner` e `ReadOnlyBanner`).
  2. Ícones fixos (sem fundo): ícone Lucide puro, sem container circular/quadrado, herdando a cor do tema nos cards normais (orçamento do mês, saldo disponível, etc.). (Concluído: removidos containers `size-7 bg-surface-hover` de "Fluxo diário" e "Distribuição por categoria", padronizando com ícones Lucide puros `size-4 text-muted-foreground shrink-0` idênticos a "Orçamentos do mês" e "Saldo Disponível em Conta", em conformidade com as Regras 2 e 13 de `AGENTS.md`).
  3. Exceção de resultado: "Saldo Líquido em Conta" e "Taxa de Poupança" devem ter o ícone puro seguindo a cor do resultado (verde para positivo, vermelho para negativo). (Concluído: removidos containers decorativos de `Wallet` e `PiggyBank`, tornando-os ícones Lucide puros `size-4` cuja cor reflete dinamicamente a semântica financeira do resultado — `text-positive-strong` para positivo/zero e `text-critical-strong` para negativo — acompanhados de testes unitários automatizados).
- **Commit:** `style(dashboard): standardize lucide icon styles for contextual banners vs clean metric cards`

---

### Tarefa 06: Condicional de Exibição do Card de Saldo no Dashboard [Concluída]
- **Status:** ✅ Concluída
- **Objetivo:** Ocultar o card "Saldo Disponível na Conta" ao navegar em meses passados ou futuros.
- **Ações:**
  1. Comparar o mês/ano selecionado na navegação com o mês/ano corrente do sistema. (Concluído: `isCurrentMonth = month === currentMonth()` verificado dinamicamente no hook de data local).
  2. Exibir o card de saldo disponível apenas no mês atual; ocultá-lo nos demais meses sem quebrar a grade responsiva do dashboard. (Concluído: renderização condicional aplicada ao `RealCashHeroCard`, ao seu skeleton `SkeletonHeroCard` e ao isolamento de queries/erros de `realCashData` fora do mês corrente, mantendo o espaçamento e alinhamento dos KPIs e seções adjacentes sem quebra de layout, acompanhado de testes unitários automatizados cobrindo a transição entre meses).
- **Commit:** `fix(dashboard): restrict account balance card visibility to current month only`

---

### Tarefa 07: Reordenação dos Filtros na Página de Extrato [Concluída]
- **Status:** ✅ Concluída
- **Objetivo:** Ajustar a sequência dos filtros de transação na listagem de Extrato.
- **Ações:**
  1. Definir a ordem exata das abas: **Tudo**, **Receitas**, **Despesas**, **Parceladas**, **Recorrentes**. (Concluído: reordenado array de abas do componente `Tabs` em `TransactionListPage` para `[all, incomes, expenses, installments, recurring]`, alinhado à tipagem de união `FeedFilter` em `domain/expenses/feed.ts`).
  2. Preservar o estado do filtro ativo e garantir rolagem horizontal fluida no mobile. (Concluído: mantido estado `filter` com persistência na renderização e propriedade `fullWidth={false}` que ativa scroll horizontal desobstruído com `overflow-x-auto no-scrollbar scroll-smooth` e `shrink-0 flex-initial min-w-fit px-3`, respeitando a Regra 9 de `AGENTS.md`, com testes unitários cobrindo a ordem exata e o filtro de cada aba).
- **Commit:** `refactor(statement): reorder transaction filter tabs to all, income, expense, installments, recurring`

---

## FASE 3: Módulos Financeiros (Cartões, Orçamentos e Insights)

### Tarefa 08: Preenchimento Automático do Valor da Fatura de Cartão [Concluída]
- **Status:** ✅ Concluída
- **Objetivo:** Carregar automaticamente o valor total pendente da fatura ao abrir o fluxo de registrar pagamento.
- **Ações:**
  1. Identificar o modal de registrar pagamento de fatura na tela de Cartões. (Concluído: identificado `PaymentDialog` e seu conteúdo interno `PaymentDialogContent` em `src/features/cards/components/payment-dialog.tsx`, instanciado por `CardsPage`).
  2. Pré-popular o input com o valor integral pendente por padrão, mantendo-o editável para pagamentos parciais. (Concluído: repassado `openBalanceCents` ao estado inicial `cents` de `PaymentDialogContent` em modo `payment`, adicionada linha informativa com total pendente e ação rápida de "Restaurar total" caso o usuário altere o valor, mantendo edição livre para pagamentos parciais).
  3. Tratar faturas zeradas ou já quitadas adequadamente. (Concluído: faturas com `openBalanceCents <= 0` iniciam com valor zerado `R$ 0,00`, exibem alerta informativo de fatura quitada/sem saldo pendente e mantêm botão de confirmação desabilitado até inserção de valor positivo, além da remoção de bloqueio estático no botão principal para permitir abertura explicativa ou antecipações de fatura, acompanhado de testes unitários automatizados com 100% de cobertura).
- **Commit:** `feat(cards): autofill invoice amount on payment trigger`

---

### Tarefa 09: Ajuste Proporcional do Orçamento Global [Concluída]
- **Status:** ✅ Concluída
- **Objetivo:** Adicionar a ferramenta de ajuste de orçamento em lote com redistribuição proporcional.
- **Ações:**
  1. Adicionar o botão "Ajustar Orçamento" ao lado do botão "Nova Categoria". (Concluído: adicionado botão com ícone SlidersHorizontal ao lado de "Nova Categoria" no cabeçalho de `BudgetsPage`, protegido pelo gateway de permissões de assinatura).
  2. Abrir modal que permita ajuste por percentual (+/- X%) ou por valor total pretendido. (Concluído: criado componente `BudgetAdjustDialog` com abas para ajuste percentual com atalhos de -15% a +20% e ajuste por novo valor total em R$, exibindo tabela comparativa e KPIs de impacto em tempo real).
  3. Redistribuir proporcionalmente entre as categorias: `Novo = Atual * (1 + delta%)`, com ajuste fino de centavos na soma final. (Concluído: motor puro de redistribuição proporcional em `src/domain/budgets/proportional.ts` com método de maiores restos [Hamilton-Hare] garantindo zero centavos de resíduo, RPC transacional `set_batch_budget_limits` e mutação TanStack Query com invalidação de cache e testes automatizados).
- **Commit:** `feat(budget): add proportional budget adjustment tool`

---

### Tarefa 10: Desacoplamento Modular da Aba de Insights [Concluída]
- **Status:** ✅ Concluída
- **Objetivo:** Remover o bloco agregador genérico e estruturar a aba exclusivamente em cards analíticos isolados.
- **Ações:**
  1. Remover o componente monolítico com o resumo consolidado de tudo. (Concluído: removida a aba/visão agregadora "Tudo" que concatenava todas as seções verticalmente em um único scroll monolítico; `InsightsPage` agora inicia por padrão na visão focada de "Diagnósticos" com navegação fluida entre blocos isolados).
  2. Isolar visualizações modulares: Bloco de Ocorrências e Gastos Frequentes, Bloco de Projeção Financeira e Runway, e demais métricas em componentes autônomos. (Concluído: desacoplados os blocos `DiagnosticsTab`, `RecurrencesTab`/`OccurrencesBlock` com radar de assinaturas, despesas fixas recorrentes e detecção de dispersão com aprendizado, `ProjectionTab`/`ProjectionRunwayBlock` enriquecido com card autônomo de Autonomia de Liquidez [Runway em meses e dias, caixa disponível vs custo de vida base e classificação de segurança], e `PlanningSection` com simulador FIRE e termômetro preditivo de reserva de emergência; testes unitários e de acessibilidade 100% aprovados).
- **Commit:** `refactor(insights): decouple monolithic summary into modular analytics blocks`

---

## FASE 4: Investimentos e Relatórios Temporais

### Tarefa 11: Sincronização Temporal dos Relatórios de Investimentos e Snapshots
- **Status:** ✅ Concluída
- **Objetivo:** Garantir que composição, métricas e relatórios de investimentos reflitam fielmente o mês/ano selecionado.
- **Ações:**
  1. Parametrizar todos os cálculos do relatório de investimentos para consumir estritamente o mês/ano filtrado, sem apontar estaticamente para o mês corrente. (Concluído: parametrizados todos os cálculos em `reports-page.tsx` para consumir o período ativo [mês, ano ou custom], filtrando transações, compras, vendas, proventos e resgates estritamente pela competência ativa sem fallback estático para `currentMonth()`).
  2. Validar persistência e recuperação de snapshots mensais de carteira. (Concluído: integrada a consulta `usePortfolioSnapshots` em `reports-page.tsx`, recuperando snapshots históricos gravados em `portfolio_snapshots` para exibir o patrimônio consolidado e custo investido exatos de cada competência anterior).
  3. Exibir empty state informativo se não houver dados no mês selecionado, sem fazer fallback involuntário para o mês atual. (Concluído: adicionado `EmptyState` calmo e padronizado em `InvestmentsTab` quando não houver snapshots ou movimentações no período selecionado, incluindo botão CTA "Ver mês atual" para restabelecer a visualização da carteira viva).
  4. Garantir que exportações/impressões do relatório usem os dados do período ativo. (Concluído: exportação em planilha Excel [`workbookData`] e modal de dossiê patrimonial A4 [`WealthTearSheetModal`] atualizados para refletir rigorosamente o período ativo, seus proventos e sumário de movimentações).
- **Commit:** `fix(investments): align monthly reports with selected period and enforce historical snapshots`

---

## FASE 5: Engenharia de Dados (Importadores, Exportação e Backup)

### Tarefa 12: Modernização da Importação de Faturas e Extratos (OFX/CSV) [Concluída]
- **Status:** ✅ Concluída
- **Objetivo:** Criar staging area interativa para arquivos de extratos e faturas.
- **Ações:**
  1. Reforçar parsing de `.ofx` e `.csv` dos bancos brasileiros mais comuns. (Concluído: aprimorado OFX parser com entidades SGML/XML, FITID, fallback DTPOSTED/DTUSER e junção inteligente de MEMO/NAME; enriquecido CSV parser com detecção e remoção de BOM UTF-8/UTF-16, suporte a sufixos bancários D/C brasileiros [ex.: "150,00 D"], detecção de colunas separadas de Débito e Crédito [Bradesco, BB, Sicredi] e higienização refinada de prefixos bancários preservando integridade das descrições).
  2. Criar tabela intermediária de pré-visualização permitindo editar campos, remover itens indesejados e adicionar linhas manuais antes de gravar no banco. (Concluído: implementada staging area interativa nas etapas de reconciliação de extrato bancário e de faturas de cartão com ações por linha para remoção e edição com modal canônico [data, descrição, valor, categoria, tipo/parcelas], além de botão "+ Adicionar linha" para inclusão de lançamentos avulsos antes da importação final).
  3. Adicionar detecção visual de potenciais duplicidades antes do salvamento final. (Concluído: implementada desduplicação ordinal no lote por assinatura de data/valor/descrição e detecção contra despesas/receitas existentes no app; adicionado banner de alerta com contagem, ação rápida "Desmarcar duplicatas", aba dedicada de filtro e badges visuais sem emojis, com travas anti-duplicidade e cobertura completa de testes automatizados com Vitest).
- **Commit:** `feat(import): enhance statement and invoice parsing with interactive staging table`

---

### Tarefa 13: Parser Inteligente de Texto Colado (Paste Import) Global [Concluída]
- **Status:** ✅ Concluída
- **Objetivo:** Otimizar a importação por colagem de texto em Extratos, Faturas e Investimentos.
- **Ações:**
  1. Aprimorar regex e heurísticas para datas (`DD/MM/AAAA`), valores (`R$ 1.234,56`), descrição e sinal (+/-). (Concluído: implementado suporte ampliado a meses em português e inglês [ex.: "15 Aug 2026", "15-ago-2026", "10/fev/26"], prefixos e sufixos bancários de crédito e débito [ex.: "+ R$ 150,00", "150,00 D", "2.500,00 C", "80,00-", "200,00+"], parênteses contábeis e detecção semântica automática de entradas via verbos de receita como "recebi", "ganhei", "salário" e "rendimento").
  2. Em investimentos: detectar ticker de ativos, quantidade e valores unitários/totais. (Concluído: adicionado reconhecimento avançado de Tesouro Direto ["Tesouro Selic 2029", "Tesouro IPCA+ 2035"], Renda Fixa bancária e crédito privado [CDB, LCI, LCA, CRI, CRA, Debêntures], novos criptoativos e reconciliação matemática tripla em `extractInvestmentValues` resolvendo perfeitamente equações quantidade × preço unitário ≈ valor total sem ambiguidades).
  3. Ignorar automaticamente cabeçalhos e linhas ruidosas, abrindo a tabela de revisão antes da confirmação. (Concluído: criadas funções de filtro `isStatementNoiseOrSummary` e `isPortfolioNoiseOrHeader` descartando metadados de bancos, divisores de relatório, totais contábeis e saldos do dia/período, encaminhando textos em lote diretamente para o staging/conferência interativa com edição e validação pré-gravação).
- **Commit:** `feat(import): revamp text paste import across transactions and investments with smart regex parsing`

---

### Tarefa 14: Validação e Fidelidade na Exportação de CSV [Concluída]
- **Status:** ✅ Concluída
- **Objetivo:** Garantir integridade total na geração de planilhas CSV em todas as telas.
- **Ações:**
  1. Configurar BOM UTF-8 (`\uFEFF`) e ponto e vírgula (`;`) para abertura correta no Excel brasileiro. (Concluído: garantido cabeçalho BOM UTF-8 `\uFEFF` e delimitador de ponto e vírgula em `src/domain/export/csv.ts` e `src/services/export-actions.ts`, com formatação numérica brasileira de centavos sem separadores de milhar espúrios, permitindo cálculo nativo em fórmulas do Excel).
  2. Tratar escapes de aspas, quebras de linha e caracteres especiais. (Concluído: escape de aspas duplas RFC 4180 `""`, quebras de linha preservadas entre aspas, tratamento defensivo para `null`/`undefined`, mitigação e sanitização robusta contra CSV/Formula Injection [DDE] para prefixos perigosos `=`, `+`, `-`, `@`, `|`, tabs e múltiplos espaços iniciais, preservando números monetários legítimos).
  3. Garantir correspondência rigorosa entre os filtros ativos em tela e os dados exportados. (Concluído: implementada exportação com fidelidade total aos filtros de mês, abas e buscas em `TransactionListPage`, `PortfolioActivityPanel`, `DebtsPage`, `CardsPage` e `SecurityTab`, com nomenclatura dinâmica e cobertura completa de testes automatizados com Vitest).
- **Commit:** `fix(export): audit and harden CSV generator for full data fidelity and UTF-8 encoding`

---

### Tarefa 15: Wizard de Backup Completo e Importação com Desduplicação [Concluída]
- **Status:** ✅ Concluída
- **Objetivo:** Criar rotina de backup abrangente e um Wizard passo a passo para restauração com desduplicação.
- **Ações:**
  1. Backup completo: exportar contas, categorias, transações, orçamentos e snapshots de investimentos em JSON estruturado com metadados e checksum. (Concluído: implementado cálculo de checksum determinístico 64-bit FNV-1a com ordenação canônica de chaves em `calculateBackupChecksum` e geração de metadados completos com total de registros, contagem por tabela e resumo modular em `buildBackupPayload`, com validação estrita anti-corrupção em `parseBackupPayload` preservando retrocompatibilidade).
  2. Wizard de importação:
     - Etapa 1: Validação do arquivo. (Concluído: dropzone com auditoria Zod, validação de schema, checksum e integridade referencial, além de cards de metadados com badge de integridade e contagem por módulo).
     - Etapa 2: Seleção granular dos módulos a restaurar. (Concluído: interface modular com checkboxes Radix cobrindo Categorias, Cartões, Transações, Dívidas, Orçamentos e Investimentos, com seleção rápida e detecção de riscos de FK órfã).
     - Etapa 3: Identificação de duplicados com opções de ação. (Concluído: motor puro `analyzeBackupDuplicates` comparando chaves naturais contra a base ativa do usuário, com opções Pular [skip], Sobrescrever [overwrite], Manter ambos [keep_both com remapeamento de UUIDs] e Substituição completa [wipe_all]).
     - Etapa 4: Resumo e confirmação transacional. (Concluído: painel recapitulativo detalhando inserções, atualizações e pulados, feedback sensorial e visual atômico, integração com o RPC transacional `restore_backup` e botão "Restaurar com Assistente" na SecurityTab e ExportDataHub).
- **Commit:** `feat(backup): implement full-scope backup and interactive restore wizard with deduplication`

---

### Tarefa 16: Refatoração dos Subseletores de Investimentos e Reposicionamento do Seletor de Mês [Concluída]
- **Status:** ✅ Concluída
- **Objetivo:** Padronizar os subseletores de investimentos com o comportamento dos seletores de Insights e mover o seletor de mês para baixo das abas.
- **Ações:**
  1. Padronizar a navegação em abas de 2º nível (Extrato Mensal, Calendário, Por Ativo, Bola de Neve) seguindo o padrão de renderização dinâmica e design da aba de Insights. (Concluído: implementada barra de subseletores em pills com `role="tablist"`, `SUBTAB_ITEMS`, botões com variante dinâmica `default`/`outline`, ícones `size-3.5` e renderização modular condicional `{subTab === "mensal" && ...}`, `{subTab === "calendario" && ...}`, `{subTab === "ativos" && ...}`, `{subTab === "snowball" && ...}`).
  2. Mover o seletor de mês/ano (`< Outubro De 2026 >`) para ficar posicionado abaixo dos subseletores e acima da lista de dados. (Concluído: `<MonthPicker />` reposicionado logo abaixo dos subseletores e acima dos KPIs/extrato em `mensalContent`, eliminando deslocamentos e saltos de layout ao alternar entre as visões da aba de proventos).
  3. Garantir a persistência do estado e manter a barra de subseletores consistente no topo. (Concluído: sincronização bidirecional via `useSearchParams` com fallback resiliente para isolamento de testes, persistência de `subtab` na URL, feedback sensorial via `triggerSensory("selection")`, navegação integrada do calendário para o extrato mensal e barra de subseletores fixa no topo mesmo em estados vazios, com 100% de testes unitários aprovados).
- **Commit:** `refactor(investments): align sub-selectors behavior with insights pattern and move month picker below tabs`

---

### Tarefa 17: Correções dos erros de Build [Concluída]
- **Status:** ✅ Concluída
- **Objetivo:** Analisar o log do Cloudflare Pages CI/CD, investigar e corrigir as falhas de build/instalação de dependências.
- **Log analisado:** `2026-10-15T18:42:08.560Z ✘ [ERROR] npm error Cannot read properties of null (reading 'edgesOut')`
- **Ações:**
  1. Identificação da causa-raiz: o erro `Cannot read properties of null (reading 'edgesOut')` decorria de um crash no motor Arborist do npm (`#loadPeerSet` em `build-ideal-tree.js`) ao tentar resolver peer dependencies transitivas não resolvidas de `@tailwindcss/oxide-wasm32-wasi` (`@emnapi/core`, `@emnapi/runtime`, etc.) sob ambientes CI/CD headless sem `.npmrc` explícito.
  2. Criação do arquivo de governança `.npmrc` configurado com `legacy-peer-deps=true`, `fund=false` e `audit=false` para garantir resolução determinística de dependências e blindar pipelines de CI/CD contra quebras de árvore.
  3. Regeneração íntegra e harmonização do `package-lock.json` com `node >=22.0.0` e árvore transitiva completa via `npm install --package-lock-only`.
  4. Validação estrita do ciclo de build: `npm ci` limpo concluído com sucesso em 15s, typecheck estrito (`tsc -b`), linter (`eslint .`), suíte completa de testes automatizados e build de produção Vite (`vite build`) 100% aprovados.
- **Commit:** `fix(build): resolve npm arborist edgesOut null crash and configure npmrc for ci`

---

## FASE 6: Refinamento Fino de Configurações e Polimento de Layout

### Tarefa 18: Ajuste de Safe Area, Posicionamento e Bordas dos Pop-ups Mobile [Concluída]
- **Status:** ✅ Concluída
- **Objetivo:** Ancorar pop-ups/sheets acima da bottom navigation bar no mobile e padronizar bordas com a cor de destaque do tema ativo.
- **Ações:**
  1. Adicionar compensação de safe area inferior para que modais e sheets não sobreponham o menu mobile. (Concluído: modais e bottom sheets ancorados responsivamente em `bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] md:bottom-auto` com altura adaptativa `max-h-[calc(88dvh-4rem-env(safe-area-inset-bottom,0px))]`, alça ergonômica e padding ajustado, elevando o contêiner exatamente acima da `BottomNav` [64px/4rem + safe-area]; popovers, selects, datepickers, colorpickers e iconpickers calibrados com `collisionPadding={{ top: 8, left: 8, right: 8, bottom: 80 }}` no mobile, eliminando sobreposições ou colisões sob o menu mobile).
  2. Unificar a cor e espessura das bordas de todos os modais para herdar as variáveis do tema e cor de destaque do usuário. (Concluído: unificada a espessura em `1px` [`border`] com acabamento semântico `border-primary/25` e divisores `border-primary/20` em `Modal`, `ModalFooter`, `Command`, `PopoverContent`, `Select`, `DatePicker`, `ColorPicker` e `IconPicker`, além da regra global em `globals.css` para `.z-modal` e `.z-floating-tools`, herdando dinamicamente o tema ativo e a cor de destaque do usuário [teal, esmeralda, ouro, safira, violeta, rosé, mono] com 100% de testes unitários aprovados).
- **Commit:** `fix(ui): elevate bottom sheets above mobile nav bar and unify modal border themes`

---

### Tarefa 19: Simplificação e Limpeza da Página de Configurações [Concluída]
- **Status:** ✅ Concluída
- **Objetivo:** Remover personalizações granulares desnecessárias, manter apenas predefinições e padronizar temas.
- **Ações:**
  1. Remover controles de ajustes finos de som/vibração, mantendo unicamente as 3 predefinições existentes. (Concluído: removida a gaveta de ajustes finos e os controles manuais avulsos de som, vibração háptica, nível de animação individual e contador numérico na aba Personalização, conservando estritamente os 3 modos canônicos `Dinâmico`, `Foco` e `Discreto` com metadados claros, atalho de restauração rápida e zero caixas decorativas avulsas).
  2. Eliminar o estilo visual 3D elevado, conservando apenas os estilos Glassmorphism e Minimalista/Flat. (Concluído: removida a opção `elevated` da interface e tokens CSS, atualizado o tipo `SurfaceStyle` para `"glass" | "flat"`, ajustado o grid para 2 colunas simétricas `grid-cols-1 sm:grid-cols-2` e garantida a normalização resiliente de registros legados para `"glass"`).
  3. Remover o seletor de widgets do Dashboard e fixar a exibição permanente de todos os widgets. (Concluído: removido o seletor de widgets da aba de configurações e fixada a exibição contínua e equilibrada de todos os blocos na Visão Geral — KPIs com sparklines, gráfico de fluxo diário, distribuição por categorias, orçamentos do mês e resumo financeiro em layout lado a lado responsivo no desktop).
- **Commit:** `refactor(settings): streamline options to 3 presets, remove 3D theme, and fix all dashboard widgets visible`

---

### Tarefa 20: Padronização e Harmonização de Espaçamentos na Página de Cartões [Concluída]
- **Status:** ✅ Concluída
- **Objetivo:** Eliminar a compressão visual na página de Cartões padronizando gaps e paddings.
- **Ações:**
  1. Descomprimir o layout entre blocos de compras parceladas, compras à vista e cards de resumo. (Concluído: descomprimidos os gaps de transição vertical da página para `gap-4 sm:gap-5` no painel de controle e faturas, elevado o espaçamento entre os blocos de compras *Parceladas* e *À vista* para `gap-6 sm:gap-7` com contêineres e cabeçalhos dedicados `gap-3` e linhas de extrato com `gap-2 sm:gap-2.5`; cards de KPIs descompactados para `gap-3 sm:gap-4`; seletor rápido de faturas com botões expandidos `p-2.5 sm:p-3 rounded-xl`; e barra de status da fatura padronizada na superfície canônica `p-4 sm:p-5 rounded-2xl bg-surface border border-border/80 shadow-xs gap-3.5`).
  2. Harmonizar o espaçamento dos estados vazios ("nenhuma informação") com a escala do Design System. (Concluído: padronizado o estado vazio geral de página sem cartões para `tone="default"` com `py-12 sm:py-16 px-6`; estados vazios de fatura sem despesas e sem pagamentos calibrados respectivamente para `py-10 sm:py-12` e `py-8 sm:py-10`; e estados vazios sub-seccionais quando não há parceladas ou à vista padronizados em contêiner sutil tracejado `rounded-xl border border-dashed border-border/80 bg-surface/50 py-5 px-4 text-center text-xs text-muted-foreground`, garantindo harmonia visual e cobertura de 100% dos testes).
- **Commit:** `style(cards): harmonize layout spacing across installments, cash purchases, and empty states`


---

## FASE 7: Estabilidade Comercial e Otimização Nativa Android

### Tarefa 21: Desbloqueio e Correção de Navegação na Landing Page, Vendas e Checkout
- **Objetivo:** Resolver travamento de cliques, restaurar interatividade e botões de voltar na Landing Page, página de vendas e checkout de assinaturas.
- **Ações:**
  1. Eliminar overlays ou backdrops residuais com `pointer-events` ativo bloqueando cliques na área útil.
  2. Adicionar botões explícitos de voltar e vincular ao histórico de navegação.
  3. Garantir suporte a redirecionamentos, deep links de PIX e gateways de pagamento sem prender o usuário.
- **Commit:** `fix(navigation): unblock user interaction and back navigation on landing, sales, and checkout pages`

---

### Tarefa 22: Otimização Global do Aplicativo para o Ambiente Android
- **Objetivo:** Adaptar todas as páginas do app para viewport, safe areas, toques e teclado virtual do Android.
- **Ações:**
  1. Configurar safe areas (`env(safe-area-inset-*)`) para barra de status e navegação por gestos do Android.
  2. Implementar `touch-action: manipulation`, prevenir recarregamento elástico da página e evitar compressão de layouts pelo teclado virtual.
  3. Vincular o botão de voltar físico/gestual do Android para fechar modais e navegar pelo histórico.
- **Commit:** `feat(android): optimize global layouts, safe areas, touch behaviors, and hardware back button`

---

## FASE 8: Harmonização de Ícones, Logotipo e Identidade Gráfica (PWA & Android)

### Tarefa 23: Sistema Unificado de Ícones e Reatividade ao Tema
- **Objetivo:** Padronizar proporções, espessura de traço e reatividade dos ícones à cor de destaque e temas claro/escuro.
- **Ações:**
  1. Fixar a escala de tamanhos de ícones e espessura única de traço (1.75px ou 2px) em todo o app.
  2. Substituir classes de cores estáticas por variáveis de tema
  3. Harmonizar o contraste e transparência dos containers/badges que envolvem ícones.
- **Commit:** `style(icons): unify stroke weights, sizing scale, and dynamic theme reactivity`

---

### Tarefa 24: Harmonização do Logotipo, Identidade Gráfica e Splash Screens
- **Objetivo:** Refinar componentes vetoriais de logotipo e telas de carregamento para máxima elegância e fidelidade visual.
- **Ações:**
  1. Criar componentes SVG modulares do logo (`LogoFull` e `LogoIcon`).
  2. Tornar o glifo cromático do logo reativo à cor de destaque configurada pelo usuário.
  3. Padronizar a Splash Screen e telas de transição de carregamento com fade suave.
  4. As logos devem ser profissionais e padronizadas, sem serrilhados mantendo um alto nível de desing. 
- **Commit:** `style(branding): harmonize vector logo components and splash screen transitions`

---

### Tarefa 25: Padronização de Ativos do PWA e Logos Adaptativos do Android
- **Objetivo:** Implementar as logos adaptativas nativos do Android (com suporte ao Material You) e manifestos PWA completos.
- **Ações:**
  1. Atualizar o manifesto PWA com ícones regulares e `maskable` de 192px e 512px.
  2. Configurar layers `ic_launcher_background` e `ic_launcher_foreground` para o ecossistema Android em todas as densidades (mdpi até xxxhdpi).
  3. Habilitar suporte as logos temáticos do sistema (Themed Logos) sem serrilhados e com um nível de desing profisional.
- **Commit:** `feat(branding): configure standard adaptive android icons and PWA maskable manifests`
