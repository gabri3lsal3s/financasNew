# PLANO_FUNCIONALIDADES_FUTURAS.md — Planejamento Executivo (Fases 3 a 6)

> **Documento Canônico de Planejamento Executivo**  
> Status: Planejado / Aguardando Aprovação para Execução  
> Referências Obrigatórias: `AGENTS.md` · `docs/architecture/ESPECIFICACAO_TECNICA.md` · `docs/architecture/ARCHITECTURE.md` · `docs/architecture/FINANCIAL_MATH_SPEC.md` · `docs/platforms/NATIVE_DISTRIBUTION_GUIDE.md`

---

## 1. INTRODUÇÃO E ESCOPO

Este documento estabelece o plano formal, arquitetural e executivo para as 4 funcionalidades aprovadas para implementação futura, sucedendo as Fases 1 (Quitação Direta em Lembretes) e 2 (Radar de Vencimentos dos Próximos 7 Dias no Dashboard):

| Fase | Funcionalidade | Localização Primária | Objetivo Estratégico |
|---|---|---|---|
| **Fase 3** | Destinar Sobra do Mês para Metas com Vínculo Patrimonial | Dashboard (`/`) & Metas (`/goals`) | Fechamento proativo de mês e alocação orientada a ativos/classes de investimentos. |
| **Fase 4** | Auditoria de Assinaturas & Alerta de Reajuste | Extrato (`/extract`) & Lembretes (`/lembretes`) | Detecção determinística de gastos recorrentes e avisos de aumento de preço. |
| **Fase 5** | Busca Global Universal & Comandos Rápidos | Header / Atalho `Ctrl+K` / Botão de Lupa | Navegação e respostas contextuais ultra-rápidas (< 15ms) sem complexidade de LLM. |
| **Fase 6** | Ações Diretas em Notificações Nativas do Android APK | Notificações do Sistema Android (`financas-native`) | Baixa ou adiamento com 1 toque diretamente da barra de notificações. |

---

## FASE 3: DESTINAR SOBRA DO MÊS PARA METAS COM VÍNCULO PATRIMONIAL

### 3.1. Visão Geral e Justificativa de Negócio
No fechamento do mês (ou quando a capacidade de poupança apurada for positiva e o mês estiver nos últimos 5 dias ou encerrado), o sistema exibe um card de ação rápida: *"Você poupou R$ X este mês. Deseja destinar essa sobra a uma meta financeira?"*.
Ao clicar, abre-se um modal dedicado que permite distribuir o valor entre as metas ativas do usuário. Caso a meta possua vínculo com a carteira de investimentos (ex: "Reserva de Emergência" vinculada a Tesouro Selic/CDB ou "Independência Financeira" vinculada à classe Ações/FIIs), o aporte financeiro gera simultaneamente o progresso na meta e o lançamento contábil auditado de aporte na carteira (`portfolio_contributions`).

### 3.2. Regras de Domínio e Engenharia (`src/domain/`)
1. **Apuração da Capacidade Residual:** função pura `calculateMonthSurplus(realIncomeCents, realExpenseCents, projectedObligationsCents)`:
   - Se `surplusCents <= 0`, a sugestão não é ativada.
   - O valor sugerido padrão é limitado ao saldo livre real em conta (`min(surplusCents, realCashCents)`).
2. **Vínculo Patrimonial de Metas (`GoalAssetBinding`):**
   - Tipos de Vínculo:
     - `none`: Meta puramente monetária (sem vínculo com ativos).
     - `asset`: Meta vinculada a um ativo específico da carteira (`asset_id`).
     - `asset_class`: Meta vinculada a uma classe de ativos (`asset_class`: RF, Ações, FIIs, etc.).
     - `portfolio`: Meta vinculada ao patrimônio total da carteira.
3. **Invariantes e Precisão:**
   - A soma dos centavos destinados a cada meta deve ser idêntica ao valor debitado da conta de origem ($\sum \text{destCents}_i = \text{totalCents}$).
   - Não há valores fracionários ou arredondamento com perda de centavos.

### 3.3. Contratos de Dados & Backend RPC
1. **Schema Supabase (`goals`):**
   - Adicionar colunas opcionais:
     - `linked_asset_id uuid references assets(id) on delete set null`
     - `linked_asset_class text check (linked_asset_class in ('pos_fixado','ipca','pre_fixado','acoes_br','fiis','renda_variavel_global','reserva'))`
     - `auto_sync_portfolio boolean not null default false`
2. **RPC Transacional (`allocate_month_surplus`):**
   - Parâmetros: `p_month text, p_account_id uuid, p_allocations jsonb, p_create_expense boolean, p_create_contribution boolean`.
   - Executa atomicamente:
     1. Lançamento da despesa de investimento ou transferência contábil.
     2. Atualização dos saldos atuais das metas (`goals.current_amount`).
     3. Inserção em `portfolio_contributions` para as metas com `linked_asset_id` ou `linked_asset_class`.
     4. Auditoria contábil com rollback integral em caso de falha.

### 3.4. Componentes e Telas
- `src/components/modules/month-surplus-banner.tsx`: banner elegante no topo do Dashboard e no relatório mensal.
- `src/features/goals/components/allocate-surplus-dialog.tsx`: diálogo com distribuição percentual ou por valor, seletores de metas e preview do reflexo patrimonial.
- `src/features/goals/components/goal-asset-link-picker.tsx`: controle para vincular a meta a um ativo específico ou classe de investimento.

### 3.5. Etapas de Execução
- **Etapa 3.1:** Migration SQL com colunas de vínculo patrimonial em `goals` + RPC `allocate_month_surplus`.
- **Etapa 3.2:** Funções puras em `src/domain/goals/surplus-allocation.ts` com testes unitários em Vitest.
- **Etapa 3.3:** Hooks de mutação TanStack Query (`useAllocateMonthSurplus`, `useUpdateGoalBinding`).
- **Etapa 3.4:** Diálogo de alocação e integração no Dashboard e página de Metas.

### 3.6. Portões de Qualidade (Quality Gates)
- **QG-3.1 (Precisão Contábil):** Cobertura de 100% de testes unitários para a função de partição e rateio entre metas sem divergência de 1 centavo.
- **QG-3.2 (Transacionalidade):** Teste de integração do RPC validando rollback completo caso a conta de débito ou a meta não pertença ao usuário logado (RLS estrito).
- **QG-3.3 (UI & Responsividade):** Diálogo simétrico no mobile (`grid-cols-2` no rodapé) e sem auto-focus em inputs numéricos.

---

## FASE 4: AUDITORIA DE ASSINATURAS E PLANOS FIXOS COM ALERTA DE REAJUSTE

### 4.1. Visão Geral e Justificativa de Negócio
Usuários frequentemente acumulam assinaturas de streaming, academias, softwares e serviços recorrentes cujos valores sofrem reajustes anuais silenciosos sem aviso prévio. A funcionalidade analisa o histórico de despesas dos últimos 3 a 12 meses, agrupa despesas com nomes similares e mesma periodicidade, e detecta:
1. Despesas recorrentes ativas (assinaturas e despesas fixas).
2. Reajustes de preço: variação positiva no valor de uma cobrança em relação aos meses anteriores (ex.: plano que custava R$ 39,90 passou a custar R$ 45,90).
3. Cobranças duplicadas ou simultâneas no mesmo ciclo.

### 4.2. Regras de Domínio e Engenharia (`src/domain/`)
1. **Normalização e Agrupamento Fonético/Léxico:** função pura `normalizeSubscriptionTitle(rawTitle: string): string`:
   - Remove sufixos como datas, parcelas (`1/12`), operadoras e números de autorização.
2. **Motor de Detecção de Recorrência:** função pura `detectRecurringSubscriptions(expenses: Expense[]): SubscriptionAuditResult`:
   - Identifica lançamentos que ocorrem em 2 ou mais meses consecutivos com o mesmo padrão léxico.
   - Calcula valor médio histórico, desvio padrão e periodicidade detectada (mensal/anual).
3. **Detector de Reajuste de Preço:** função pura `detectPriceAdjustments(history: SubscriptionHistoryItem[]): PriceAdjustmentAlert[]`:
   - Compara o valor da cobrança mais recente com a média dos últimos 3 meses.
   - Se variação for positiva, classifica como reajuste:
     - `variationCents = currentCents - previousCents`
     - `variationPercent = ((currentCents / previousCents) - 1) * 100`
     - `annualizedImpactCents = variationCents * 12`

### 4.3. Contratos de Dados & Integração
- Sem necessidade de novas tabelas pesadas: a auditoria é uma **visão analítica pura** sobre as despesas existentes (`expenses` e `card_expenses`), com suporte a preferências de arquivamento/descarte no `user_preferences.custom_settings.dismissed_subscription_alerts`.
- Opção para o usuário marcar uma despesa como *"Assinatura confirmada"* ou *"Não é assinatura"*.

### 4.4. Componentes e Telas
- `src/features/extract/components/subscriptions-audit-card.tsx`: painel expansível no extrato e relatórios com métricas de gasto anualizado com serviços recorrentes.
- `src/features/extract/components/price-increase-badge.tsx`: badge visual discreto na linha da transação reajustada indicando variação (ex.: `+15,0%`).
- `src/components/modules/subscription-adjustment-modal.tsx`: modal detalhado mostrando o histórico do plano, impacto no orçamento anual e atalho para cancelar ou renegociar.

### 4.5. Etapas de Execução
- **Etapa 4.1:** Criação de `src/domain/subscriptions/audit.ts` e `src/domain/subscriptions/audit.test.ts`.
- **Etapa 4.2:** Hook analítico TanStack Query `useSubscriptionsAudit()`.
- **Etapa 4.3:** Componentes de visualização no Extrato e aba dedicada em Relatórios.
- **Etapa 4.4:** Alerta integrado no carrossel de insights da Home quando houver reajuste no mês atual.

### 4.6. Portões de Qualidade (Quality Gates)
- **QG-4.1 (Falsos Positivos):** Testes unitários com casos reais (compras parceladas com mesmo nome NÃO devem ser classificadas como reajuste de assinatura).
- **QG-4.2 (Zero Emojis):** Utilizar ícones `lucide-react` padronizados (`TrendingUp`, `RefreshCw`, `AlertCircle`) sem caracteres Unicode decorativos.
- **QG-4.3 (Desempenho):** Execução do algoritmo de auditoria em menos de 5ms para 2.000 transações locais.

---

## FASE 5: BUSCA GLOBAL UNIVERSAL COM INTENÇÕES DETERMINÍSTICAS RÁPIDAS

### 5.1. Visão Geral e Justificativa de Negócio
Substituir o campo de busca genérico atual por uma **Paleta de Comandos e Busca Global Universal** acionável via atalho de teclado global (`Ctrl+K` ou `Cmd+K`) ou botão de lupa persistente no cabeçalho.
A busca atende dois propósitos:
1. **Localização Instantânea de Dados:** pesquisa unificada em transações, contas bancárias, cartões, dívidas, categorias, relatórios e metas.
2. **Intenções Determinísticas Rápidas (Zero Risco de Alucinação):** reconhecimento de padrões objetivos de linguagem natural para navegação e consultas analíticas rápidas:
   - *"quanto gastei com alimentação este mês"* -> resposta direta: R$ 840,00 + link para o extrato filtrado.
   - *"faturas vencendo"* -> lista direta das faturas em aberto.
   - *"novo gasto"* -> abre o modal de nova despesa pré-preenchido.

### 5.2. Regras de Domínio e Engenharia (`src/domain/`)
1. **Parser de Intenções Determinístico (`parseSearchIntent`):**
   - Baseado em Regex e busca por sinônimos estruturados (`src/domain/search/intents.ts`).
   - Sem chamadas a APIs de IA ou LLM (garantindo resposta em menos de 10ms, sem custo de tokens e com 100% de privacidade).
2. **Motor de Busca Indexado Localmente:**
   - Criação de índice compacto em memória durante a sessão.
   - Classificação por relevância com pesos:
     - Telas e Ações do Sistema (peso 1.0)
     - Contas e Cartões (peso 0.9)
     - Categorias e Metas (peso 0.8)
     - Transações recentes e Dívidas (peso 0.7)

### 5.3. Componentes e Telas
- `src/components/modules/global-command-palette.tsx`: diálogo estilo Spotlight/Command Palette com abas/filtros rápidos (Tudo, Ações, Transações, Navegação).
- `src/components/modules/intent-quick-answer.tsx`: cartão de resposta direta no topo da lista quando a busca identificar uma pergunta analítica clara.
- Integração no `src/components/layout/page-shell.tsx` com badge de atalho (`Cmd+K` / `Ctrl+K`) adaptativo ao SO.

### 5.4. Etapas de Execução
- **Etapa 5.1:** Motor puro de detecção de intenções analíticas em `src/domain/search/` com bateria de testes cobrindo variações de frases em pt-BR.
- **Etapa 5.2:** Hook `useGlobalSearchIndex` agregando dados de cache do TanStack Query sem re-fetch de rede.
- **Etapa 5.3:** Componente visual `GlobalCommandPalette` implementado com Radix UI Dialog / `cmdk`.
- **Etapa 5.4:** Atalhos de teclado globais e suporte tátil no mobile via botão de lupa no header.

### 5.5. Portões de Qualidade (Quality Gates)
- **QG-5.1 (Latência Máxima):** Renderização da lista de resultados em menos de 15ms após a digitação.
- **QG-5.2 (Acessibilidade & Foco):** Navegação 100% viável por teclado (Setas Cima/Baixo, Enter, Esc), suporte completo a leitores de tela (`aria-expanded`, `aria-activedescendant`).
- **QG-5.3 (Mobile Ergonomics):** Abertura suave em tela cheia no smartphone sem zoom automático do iOS (inputs com tamanho de fonte de pelo menos 16px).

---

## FASE 6: AÇÕES DIRETAS EM NOTIFICAÇÕES NATIVAS DO ANDROID APK

### 6.1. Visão Geral e Justificativa de Negócio
No aplicativo Android (`financas-native` compilado via Capacitor/Android Studio), as notificações de vencimento de faturas e dívidas atualmente exigem que o usuário abra o app e navegue até a tela correspondente. A melhoria introduz **Ações Rápidas na Notificação (Notification Action Buttons)**:
- Botão 1: `[Pagar no App]` — abre o app diretamente no diálogo de confirmação de baixa da fatura/dívida com valor preenchido.
- Botão 2: `[Adiar 3 Dias]` — adia a notificação diretamente em segundo plano ou via deep link sem fricção.

### 6.2. Regras de Domínio e Engenharia (`src/services/native/`)
1. **Payload da Notificação de Vencimento:**
   - Inclusão de `actionTypeId: 'DUE_BILL_ACTIONS'` e `actionTypeId: 'DUE_DEBT_ACTIONS'`.
   - Actions registradas no canal Android:
     - `ACTION_PAY`: label "Pagar no App", com lançamento de Intent para a Activity principal com deep-link `financas://lembretes?action=pay&key={key}`.
     - `ACTION_SNOOZE`: label "Adiar 3 dias", despachando evento para o Service Worker/BroadcastReceiver nativo.
2. **Tratamento de Deep Link e Permissões:**
   - Mapeamento no `src/services/native/notifications.ts` para capturar `PushNotificationActionPerformed` e `LocalNotificationActionPerformed`.
   - Compatibilidade estrita com Android 13+ (permissão em tempo de execução `POST_NOTIFICATIONS`).

### 6.3. Contratos de Dados & Camada Nativa
- Configuração do plugin `@capacitor/local-notifications` no `capacitor.config.ts`.
- Registro de canais de notificação (`NotificationChannel`) com prioridade alta e som padrão do sistema.
- Em ambiente Web PWA, degrada suavemente para links de ação via Notification API quando suportado, sem quebrar navegadores de desktop.

### 6.4. Componentes e Telas
- `src/services/native/notification-actions.ts`: gerenciador central de registro de tipos de ação nativas.
- `src/hooks/use-notification-action-handler.ts`: listener que captura a abertura do app via ação de notificação e aciona o modal correspondente (`ReminderPayDialog`).

### 6.5. Etapas de Execução
- **Etapa 6.1:** Configuração de categorias de ação no serviço de notificações locais.
- **Etapa 6.2:** Mapeamento de deep links de ação em `src/App.tsx` e roteador React Router.
- **Etapa 6.3:** Testes em emulador Android e verificação de degradação graciosa na Web.
- **Etapa 6.4:** Atualização do guia `docs/platforms/NATIVE_DISTRIBUTION_GUIDE.md`.

### 6.6. Portões de Qualidade (Quality Gates)
- **QG-6.1 (Segurança & Confirmação Obrigatória):** A ação "Pagar" NUNCA efetua a baixa silenciosa em segundo plano sem confirmação visual do usuário com o saldo em conta.
- **QG-6.2 (Degradação Graciosa):** Se executado em navegador desktop ou PWA iOS, nenhuma exceção de runtime é disparada e o fluxo padrão web permanece inalterado.
- **QG-6.3 (Build Nativo):** O build do projeto Android com Gradle (`./gradlew assembleRelease`) deve compilar com zero warnings de descontinuação de API de notificações.

---

## 2. MATRIZ DE DEPENDÊNCIAS E ORDEM DE EXECUÇÃO RECOMENDADA

1. **Fase 3 (Destinar Sobra para Metas)** pode iniciar imediatamente após aprovação, pois alavanca os motores já existentes de metas e carteira.
2. **Fase 4 (Auditoria de Assinaturas e Reajustes)** roda de forma independente sobre os repositórios de despesas já consolidados.
3. **Fase 5 (Busca Global e Comandos Rápidos)** se beneficia das entidades e ações criadas nas Fases 3 e 4 para indexação completa na busca.
4. **Fase 6 (Ações em Notificações Nativas Android)** encerra o ciclo refinando a experiência do aplicativo instalado no Android Pro.
