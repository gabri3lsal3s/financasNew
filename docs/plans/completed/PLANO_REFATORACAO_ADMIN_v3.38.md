# Plano de evolução do portal administrativo

**Objetivo.** Tornar o Admin fácil de operar no dia a dia, no celular e no desktop. Priorizar aprovações, suporte, cobrança e incidentes, com informações suficientes para investigar custos, permissões e falhas quando necessário.

**Arquitetura.** Evoluir o portal isolado em entregas pequenas, reaproveitando os componentes do app e preservando os controles de acesso nas rotas, no banco e nas Edge Functions. Cada entrega deve deixar um fluxo utilizável e verificável.

**Base técnica.** React, TypeScript, TanStack Query, Supabase e os componentes do design system. Referências normativas em `AGENTS.md`, `docs/architecture/ESPECIFICACAO_TECNICA.md`, `ARCHITECTURE.md`, `PROJECT_STRUCTURE.md`, `FINANCIAL_MATH_SPEC.md`, `docs/design/DESIGN_SYSTEM.md` e `docs/operations/SECURITY_GOVERNANCE.md`. Consultar também o histórico da Fase 132 no roadmap e a seção 8 do manual do fundador.

**Classificação da execução futura.** Fluxo Completo (Feature/Plano). A revisão atual define escopo e critérios de aceite.

## 1. Diagnóstico conferido no repositório

| Área | Estado atual | Consequência para o plano |
|---|---|---|
| Isolamento do Admin | Entrada própria em `src/app/admin-main.tsx`, casca `AdminShell`, rotas e guardas em `src/app/router.tsx`. | Evoluir a casca existente. Preservar sessão administrativa, acesso direto às rotas, exclusão do precache público e isolamento do Laboratório Forense. |
| Backups | `/admin/backups` redireciona para Segurança. A página anterior ainda aparece no barrel e usa componentes e hooks próprios. O manual do fundador indica o Supabase Dashboard para PITR e snapshots. | Confirmar consumidores antes de remover a cadeia órfã. Preservar o backup e a restauração pessoais, o histórico persistido e o redirecionamento legado. |
| Acesso modular | Família, Viagens e Negócio usam `transactions` no roteador. Categorias usa `budgets`. O produto combina flags globais, `user_feature_overrides`, `user_module_permissions` e regras de assinatura. | Comparar cliente e servidor antes de separar chaves. As calculadoras de `/ferramentas` e o compartilhamento público de viagens têm rotas públicas. |
| Cota e custo de IA | `ai-financial-assistant` pode retornar dados do cache antes da verificação da cota. O débito de cota ocorre após resultado aceito. A tabela de cache armazena resultados. | Exibir consumo de cota como tal. Medir separadamente chamadas ao provedor, falhas e acertos de cache. A contagem de linhas de cache não mede taxa de acerto. |
| Receita | Faturamento exibe MRR estimado. Há intenções de cobrança, pagamentos processados e logs de webhook. | Validar cobertura dos pagamentos, estornos, taxas e datas antes de rotular valores como recebidos ou conciliados. Logs de webhook são evidência operacional. |
| Conexões | O indicador do cabeçalho deriva da consulta de métricas. Há fontes parciais para Asaas, Resend, cotações, push e Telegram. | Exibir a evidência e sua data por integração. Separar presença de configuração, atividade observada e resultado de teste manual. |
| UX | A Fase 132 já entregou navegação agrupada, paginação, filtros, estados de erro e edição de usuário em abas. | Reaproveitar os fluxos existentes, medir o ganho de cada alteração e retirar as duplicações verificadas. |

## 2. Navegação e experiência para quem está começando

Quatro grupos no menu. A primeira abertura da Visão geral responde, nesta ordem, “O que precisa da minha atenção?”, “Como está o serviço?” e “Como fechou o mês?”. Cada pendência leva à tela onde se resolve. O resumo usa a mesma consulta ou regra da fila que detalha.

| Grupo | Rota | Uso principal |
|---|---|---|
| Operação | `/admin/dashboard` | Aprovações pendentes, chamados abertos, cobranças que exigem ação, estado resumido das integrações e poucos indicadores do mês. |
| Operação | `/admin/usuarios` | Localizar uma conta, entender o acesso efetivo e abrir assinatura, diagnóstico de suporte ou ações de segurança conforme o papel. |
| Operação | `/admin/chamados` | Fila de suporte. Comunicados aparecem em aba vinculada, com histórico e composição sujeitos à autorização existente. |
| Receita e crescimento | `/admin/faturamento` | Visão financeira, assinaturas e consumo de APIs. Os pagamentos com falha apontam para os registros filtrados da plataforma. |
| Receita e crescimento | `/admin/convites` | Convites, validade, lista de acesso e revisão das permissões concedidas. |
| Plataforma | `/admin/sistema` | Conexões, módulos, distribuição Android, layouts de fatura e Telegram. Agrupar configurações de entrada frequente e abrir detalhes conforme a tarefa. |
| Governança | `/admin/seguranca` | Auditoria administrativa, filtros e exportação autorizada. Backups e recuperação de infraestrutura apontam para o procedimento operacional existente. |
| Governança | `/admin/laboratorio-forense` | Laboratório já existente, acessível apenas a superadministradores. |

**Compatibilidade de links.** Manter `/admin` → `/admin/dashboard` e `/admin/backups` → `/admin/seguranca`. Redirecionar `/admin/notificacoes` para `/admin/chamados?tab=comunicados` e `/admin/configuracoes` para `/admin/sistema`, traduzindo abas antigas já suportadas e preservando apenas parâmetros previstos. Testar acesso direto e recarga. Registros de Asaas e Resend têm uma única listagem em Conexões; Faturamento e Segurança apontam para a origem filtrada.

### 2.1. Três níveis de informação

1. **Uso diário.** Título curto no `PageHeader`, 1 ação principal por fluxo, filas em ordem de atenção, status com texto legível e estados de loading, vazio e erro com retry. Exemplo na conta do usuário: “Plano ativo”, “Pode editar viagens” e “Último acesso observado há 2 dias”.
2. **Ajuda no contexto.** `PageGuideButton` em `utilityActions` explica para que serve a página e como concluir suas tarefas comuns. O `?` ao lado de um termo explica o significado, quando agir e o efeito da ação, usando o `Popover` do app. Nos KPIs compostos, usar `CalculationMemoryTrigger` com `priority="p0"` e `CalculationMemoryModal`, alimentados por builders puros em `src/domain/calculation-memory/builders/`. Mostrar fórmula, passos, período, fonte, critérios de inclusão e exclusão e cópia em texto. O popup de equações existente pode apoiar resumos onde já é usado.
3. **Investigação.** Detalhes técnicos em `Accordion` ou uma aba carregada ao abrir, com códigos padronizados, timestamps, fonte, motivo, identificadores de correlação permitidos e estado de entrega observado. Filtrar ou mascarar no servidor antes de retornar dados.

### 2.2. Reuso, celular e desktop

- No celular, navegação inferior com **Início**, **Usuários**, **Faturamento**, **Chamados** e **Mais**, que abre o drawer existente. Reusar `BottomNavItem` onde suas props permitem. Usar a mesma configuração de rotas e badges para sidebar e drawer. Validar safe area, zona do `BackToTop`, foco e restauração da rolagem.
- Em listas operacionais, usar `DataList`, `FilterChips` e `KeyValueGrid` quando couber. Manter colunas densas em tabelas com rolagem horizontal e indicar essa rolagem no celular. Para Usuários e Auditoria, manter busca acessível e aplicar filtros adicionais em `ResponsiveDialog` se o layout precisar.
- Usar `KpiGrid`, `KpiCard` e `MoneyText`. Começar com uma ou duas colunas no celular. Aplicar a anatomia do `Modal`, `ModalFooter` e `ConfirmDialog`, sem autofoco declarativo nem rolagem vertical aninhada. Usar abas fluidas quando houver 4 ou mais.
- Preferências do Console tem uma única opção, **Cor de destaque**, com três escolhas iniciais, Padrão, Índigo e Verde. É uma proposta desta revisão. Salvar somente essa escolha visual localmente e escopar os tokens à casca e aos portais administrativos que precisem herdá-los. Manter o `ThemeToggle` existente e os tokens semânticos de risco, sucesso e atenção.
- Na edição de usuário, começar pelo resumo de conta. Manter assinatura, permissões e segurança acessíveis por abas. Carregar o diagnóstico de suporte sob demanda, com última atividade observada, plataforma e versão do dispositivo, push cadastrado e cotas. Uma inscrição push ou dispositivo cadastrado não confirma sessão ativa nem entrega. A operação de suporte usa a própria sessão administrativa.

## 3. Segurança e permissões

### 3.1. Controles por ação

| Operação | Contrato de segurança |
|---|---|
| Leituras operacionais | Operador ativo e autorização administrativa equivalente à do fluxo existente. Em novas interfaces privilegiadas, validar o grant do portal associado à sessão e o nível de autenticação exigido no servidor. Paginar e limitar janela, colunas e alvo. |
| Finanças individuais e telemetria detalhada | Restringir novos dados por conta e exportações de FinOps a superadmin com sessão administrativa válida e AAL2. O painel de operação pode usar números agregados conforme o papel. |
| Telefone/CPF, revogação, MFA e LGPD | Preservar o cofre auditado e regras de mascaramento/revelação. Reaproveitar `admin-super-action` e o step-up nas ações já protegidas. Respeitar a quarentena, restauração e retenção fiscal existentes. |
| Desligamento global, reset de cota e envio global | Proposta para controles novos ou ampliados: superadmin, AAL2, grant válido, confirmação com motivo, step-up vinculado à ação e ao alvo e evento de auditoria. Preservar as ações segmentadas e seus contratos existentes. |

- Guards de rota complementam a autorização de RPCs, Edge Functions e RLS. Consultar a migração `20260101000177_t05_admin_portal_grants_and_step_up.sql` e inventariar os caminhos diretos existentes antes de alterar qualquer nível de acesso.
- Para ação global, calcular impacto no servidor e mostrar população, critério e horário. Em comunicados, separar público elegível de inscrições aptas a push. Cancelar a execução se público materialmente alterado ou preview vencido. Usar confirmação acessível e garantir idempotência em repetição ou concorrência.
- Registrar autor, ação, alvo, motivo, resultado e campos permitidos antes/depois. Para mudanças transacionais no banco, gravar alteração e auditoria na mesma transação. Para disparos externos, registrar tentativa e resultado, prever reenvio idempotente e mostrar falha parcial. Excluir segredos, conteúdo de OCR, mensagens privadas, tokens de sessão e payloads brutos das respostas, caches de UI e exportações.

### 3.2. Módulos, migração e paridade

- Inventariar o caminho de cada chave em `src/types/schema.ts`, `src/app/router.tsx`, navegação, `src/state/queries/use-user-access.ts`, repositórios de assinatura/acesso, `get_my_features`, `get_user_module_access`, RLS e Edge Functions. Registrar em matriz as leituras, escritas, rotas autenticadas e pontos de entrada indiretos. Para a IA, incluir o controle global, o override de feature e a verificação real na Edge Function.
- Criar catálogo puro em `src/domain/admin/module-catalog.ts` para metadados, grupos e presets, com chaves tipadas. Alimentar Sistema, `UserModulePermissionsMatrix` e `CreateInviteDialog` com o catálogo. Grupos: Núcleo (inclui Categorias e Metas sob Orçamentos), Patrimônio e análise, Família/Viagens/Negócio, IA e beta. Chaves de distribuição APK ficam na seção Android e preservam o contrato atual.
- Evoluir `family`, `trips` e `business` com migração aditiva e paridade para contas existentes. Antes da adoção da nova chave por uma superfície, calcular a decisão usando o módulo legado `transactions` quando não houver configuração específica para o módulo novo. Confirmar que os bloqueios e concessões existentes sobrevivem à migração. Validar coortes de contas com overrides explícitos ou expirados, convites pendentes, plano expirado, trial, lifetime, inadimplência em carência e perfis internos. Mudanças efetivas de política ficam explícitas no plano antes de implementadas.
- Preservar comportamento vigente do servidor para status da conta, chave global, exceções administrativas, flags individuais, override modular (`none`, `read`, `write`, `admin`), expiração, beta e carência. `get_user_module_access` já considera parte dessas regras e a UI também consulta `get_my_features`. Fixar a precedência por tipo de acesso com testes: conta inelegível ou bloqueio global no fluxo aplicável, exceções já autorizadas, override vigente e regra de plano. Divergências entre rota e servidor devem ter uma decisão documentada antes do corte.
- Calculadoras públicas e `/viagem/:token` preservam seus contratos. A chave `tools` só faz sentido se houver recurso autenticado com fronteira própria. Enquanto houver dependências entre módulos, mostrar o impacto nos fluxos compartilhados, incluindo Família ou Viagens que acionem lançamentos.
- Revisar “Somente investimentos” incluindo `insights` e expansões. Propor “Somente pessoal” e “Sem IA” conforme a matriz validada. “Acesso completo” usa as permissões do plano e deixa o plano explícito. Exibir as alterações antes de salvar; presets respeitam o ciclo de faturamento e a disponibilidade global.
- Publicar em etapas: schema e resolução compatível primeiro, clientes e guardas depois, habilitação dos novos controles após teste de paridade. Antes de permitir alterações, verificar se clientes anteriores continuam respeitando os bloqueios pelo servidor ou bloquear a edição enquanto houver incompatibilidade. Na reversão, voltar ao resolvedor compatível, preservar os valores das novas chaves e suspender novas edições até confirmar a paridade. Evitar depender de Realtime para efetivar bloqueio em operações do servidor.

## 4. O que medir e como apresentar

### 4.1. Conexões e evidências

| Serviço | Evidência passiva inicial | Teste manual, quando disponível |
|---|---|---|
| Supabase DB/Auth | Resultado e horário de uma operação conhecida no próprio console, com DB e Auth identificados separadamente. | Consulta leve e verificação da sessão atual. Estado do pool exige fonte verificável própria. |
| Asaas | Último webhook processado, volume e falhas na janela. | Operação de leitura suportada pelo provedor, sem criar cobrança. Presença de segredo indica configuração. |
| Resend | Eventos de aceitação, entrega ou rejeição conforme campos realmente persistidos. | Leitura não mutante suportada. Teste de envio, se adotado, é ação explícita para destino interno. |
| Gemini | Último resultado e falhas observadas após instrumentação. Cota e cache são mostrados à parte. | Apenas teste de baixo impacto, com custo indicado caso consuma chamada. |
| Cotações | Última atualização por fonte identificável; `source = 'fallback'` indica fallback, sem atribuir chamadas a um provedor por inferência. | Checagens permitidas e limitadas por integração. |
| Web Push e FCM | Inscrições ativas por canal e último resultado de despacho disponível. | Diagnóstico de configuração. Eventual entrega de teste só em instalação interna autorizada. |
| Telegram | Canal configurado e resultado observado do fluxo `support-notify`, se disponível. | Teste explícito para o canal operacional previamente configurado. |

O cabeçalho consome um único resumo passivo compacto. A tela detalhada mostra **Evidência recente**, **Atenção**, **Falha observada** ou **Sem evidência recente**, além do horário e da fonte. A ausência de webhook fora de uma janela movimentada não basta para declarar falha. Usar janelas por serviço, definidas com exemplos de volume no piloto, e distinguir integração desabilitada. Sondagens ativas ficam para uma segunda entrega, com destinos fixos, segredo apenas no servidor, cooldown, timeout, concorrência limitada e respostas sanitizadas.

### 4.2. Consumo, cotas e custos de APIs

| Indicador | Fonte e limite |
|---|---|
| Cota de extração por usuário | `user_ai_quotas` e as regras que a Edge Function usa para período e limite de cada balde. Exibir consumo do dia e mês vigentes e próximo reset. Essa fonte não reconstrói histórico. |
| Chamadas e acertos de cache | Instrumentar separadamente tentativas externas, resultado útil, falha e resultado de cache efetivamente servido. Capturar provedor/modelo, balde, unidade de uso quando disponível, período e chave idempotente. Excluir documento, prompt e resposta do provedor. |
| Cotações | `quote_refresh_rate_limits` informa refreshes do app. Contabilizar chamadas por provedor no ponto de saída para medir consumo da franquia. Atualizações coletivas entram como custo compartilhado até haver atribuição verificável. |
| Blueprint | Expor no `StatementBlueprintsCard` os contadores `exact_checksum_hits`, `distinct_users_verified`, `distinct_users_failed` e `consecutive_failures`, com ajuda sobre período e unidade. Deixar eventual taxa para quando houver denominador compatível. |

**Evolução em ordem.** Leitura de cotas e diagnóstico primeiro. Reset por balde, se necessário operacionalmente, em ação auditada e transacional com teste de concorrência com débito; o reset não apaga consumo já medido. “Pausar IA para testes grátis” entra após a medição e fica no servidor. Definir unidade do teto (chamadas verificadas ou custo estimado), mês e limiar explícitos. Automatizar somente com reserva/controle atômico antes da chamada, tratamento de retries e estado de telemetria indisponível definido. Mostrar estado, motivo e próxima revisão, manter clientes pagantes fora da pausa e alertar uma vez por mudança de estado. Documentar recuperação e override de emergência restrito. Reset de cota e pausa ficam em entregas independentes do painel somente leitura.

### 4.3. Receita, custo e margem

| Indicador | Definição |
|---|---|
| Receita recebida no mês | Pagamentos confirmados identificados por provedor e ID, com data financeira validada e ajustes de estornos/chargebacks quando disponíveis. Deduplicar e mostrar cobertura. Anual entra integralmente no caixa do mês do recebimento. |
| Receita líquida recebida | Receita recebida menos tarifas e ajustes conciliados ainda não refletidos no pagamento. Aplicar cada ajuste uma única vez. Se tarifas precisarem de parâmetro, o resultado é “Receita líquida estimada”. Datas e ajustes devem seguir a base de caixa declarada. |
| MRR estimado | Soma mensal normalizada das assinaturas recorrentes pagantes elegíveis. Anual dividido por 12; excluir trial, cortesia/lifetime e pré-pagamento avulso. Explicitar política da carteira inadimplente. ARR estimado = MRR × 12; mostrar apenas quando houver necessidade operacional. |
| Custo variável direto | Consumo atribuível × tarifa por unidade ou valor apurado no provedor. Identificar unidade, moeda e tarifa efetiva. E-mail acima da franquia exige volume faturável validado para toda a base e regra de rateio explícita. |
| Margem de contribuição por conta | Receita líquida da conta menos custo variável atribuível, na mesma janela e base. Se faltar dado essencial, indicar cobertura parcial ou indisponibilidade. |
| Resultado operacional estimado | Receita líquida do período menos custos variáveis e fixos conhecidos. Se houver custo fixo rateado por conta, mostrar “Resultado estimado após rateio” e denominador; a margem de contribuição segue separada. |

- Montar funções puras em `src/domain/admin/unit-economics.ts`. Trabalhar em centavos inteiros, usar arredondamento definido no domínio e reconciliar totais após rateio; distribuir resíduo com ordem determinística e tratar denominador zero. Atribuir a custos não vinculados o estado **Compartilhado**. Conversão cambial de tarifa exige fonte e data.
- Usar mês civil e fuso de referência da operação, proposto nesta revisão como `America/Bahia` para o relatório financeiro, com intervalo início inclusivo e próximo início exclusivo. Respeitar o relógio vigente da cota para seus próprios limites. Versionar parâmetros por `period_month`, registrar fonte e estado de fechamento. Correção retroativa vira revisão explícita e auditada. Exibir **Medido**, **Estimado**, **Parcial** ou **Sem dados**, com fonte, período e atualização; zero é reservado a dado efetivamente medido.
- MVP financeiro: MRR estimado, receita recebida com cobertura verificável e custos de IA medidos ou estimados quando a fonte existir. Conciliação de taxas/estornos e margem detalhada entram após validar fontes. ARPU, churn e conversão de trial são posteriores: exigem denominador, janela e coortes documentados. Sem histórico suficiente, iniciar na data de instrumentação.
- O radar de retenção usa filtros acionáveis: pagante sem atividade observada há pelo menos 21 dias, trial sem atividade observada há pelo menos 72 horas, inadimplente com chamado aberto. Diferenciar conta sem sinal de atividade de conta inativa. Validar qual atividade cada fonte realmente mede.

### 4.4. Incidentes e alertas ao fundador

- Reutilizar `admin_broadcast_notifications` com tipo existente `warning` ou `critical`, validade e audiência explícitas. Encaminhar pelo Notification Hub, com controle de leitura, deduplicação e regras da Home. Usar prévia e encerramento antecipado via fluxo atual. O push é um canal explícito sujeito ao fluxo de autorização.
- Reusar a configuração do Telegram e o padrão de deduplicação de `support-notify`. Propostas iniciais para homologação: três falhas consecutivas confirmadas no Asaas, rejeição de e-mail acima de 5% com amostra mínima definida no piloto ou aproximação do teto da IA. Usar cooldown e registrar o último resultado do aviso. Priorizar sinais com volume e significado verificados.

## 5. Sequência de implementação e aceite

Cada fase tem uma entrega verificável. Implementar em branch de trabalho com saída compatível. Os testes pertencem à fase que introduz a mudança.

### Fase 1 — Inventário e limpeza sem alteração de permissões

- [ ] Mapear referências da página de backup antiga, componentes, hooks, RPCs, exports e testes com busca global. Remover código de UI comprovadamente órfão e preservar a rota de compatibilidade. Validar backup pessoal e rota Segurança.
- [ ] Em `admin-invites-page.tsx`, `admin-tickets-page.tsx`, `invites-tab.tsx` e `tickets-tab.tsx`, incorporar ou renomear wrappers apenas se reduzir um nível de indireção mantendo entry points, labels e testes. Registrar panorama do Admin e estado de cada integração.
- [ ] Consolidar o catálogo das chaves existentes e seus testes em `src/domain/admin/`. Fazer o inventário de paridade da seção 3.2 antes de incluir novas chaves no catálogo operacional.

### Fase 2 — Console navegável e orientação progressiva

- [ ] Ajustar `admin-shell.tsx`, `admin-nav-config.ts`, `admin-mobile-drawer.tsx`, `router.tsx` e as páginas Admin para as rotas da seção 2. Validar abas e links antigos, reload e acesso direto sob os guardas.
- [ ] Adotar `PageHeader` e guias curtos; aplicar ajuda contextual, navegação inferior e acento. Tratar estados de erro, vazio e loading. Revisar a edição de usuário e a composição de comunicados nos tamanhos de modal do design system.
- [ ] Aceite em 360, 768 e 1280 px, com temas suportados pelo `ThemeToggle`. Operador novato consegue localizar um usuário, abrir um chamado, identificar uma pendência e voltar à página de origem. Conferir teclado, foco de retorno, safe area e valores monetários completos.

### Fase 3 — Acesso modular com migração compatível

- [ ] Implementar e testar o inventário e o contrato da seção 3.2 em migrações, estado de acesso, rotas e consumidores reais. Cobrir legado bloqueado, somente leitura, concessão explícita ou expirada, suspensão, carência, beta, convites, acesso direto e atalhos.
- [ ] Ativar edição dos novos módulos em Sistema, Usuários e Convites somente após validar o comportamento no servidor. Homologar `/ferramentas` e `/viagem/:token` sem sessão e os fluxos pessoais autenticados. Validar fallback em um cliente anterior e testar reversão.
- [ ] Expor origem do acesso efetivo e prévia de impacto para mudança global. Cobrir autorização, cancelamento seguro e concorrência antes de liberar a mutação correspondente.

### Fase 4 — Operação, conexões e diagnóstico

- [ ] Definir contratos de leitura por serviço e papel em `src/types/`, validar bordas com Zod e ligar UI → `src/state/queries/use-admin.ts` → repositórios/RPCs administrativos. Usar consultas paginadas e um resumo compartilhado no shell e na Visão geral. Evitar chamadas externas automáticas.
- [ ] Entregar Conexões e os detalhes em Usuários, Cotas e Blueprints. Testar integração saudável observada, falha, janela sem eventos, dado atrasado e resultado parcial. Conferir que cabeçalho e lista compartilham o estado.
- [ ] Evoluir Comunicados, Radar de retenção e Telegram com as fontes verificadas. Sondagens ativas e novas mutações globais só entram na respectiva entrega após testes de papel, grant, AAL2, step-up quando aplicável, cooldown, auditoria e idempotência.

### Fase 5 — Receita e custos, depois automação

- [ ] Validar cobertura de pagamentos, tarifas, estornos, cotas e preços antes de fechar contratos. Conferir `billing_processed_payments`, `billing_intents`, `user_subscriptions` e a normalização em `supabase/functions/asaas-webhook/index.ts`. Distinguir data de processamento de data financeira e confirmar a conciliação com amostra de homologação. Publicar leitura financeira e de IA com rótulos de confiança e memória de cálculo.
- [ ] Instrumentar tentativas externas, resultados e cache. Implementar snapshots mensais e os cálculos da seção 4.3. Testar limites do mês, pagamento anual, cortesia, estorno, ausência de taxa, moeda, zero usuários no rateio e reconciliação em centavos.
- [ ] Quando houver sinais suficientes, entregar margem por usuário e alertas de teto. Homologar pausa de IA em trial com chamadas concorrentes, falha parcial, virada do mês, reativação e preservação de assinantes pagos. Liberar a exibição de custos estimados e a automação de pausa em etapas independentes.

### Casos que exigem verificação específica

| Caso | Resultado esperado | Fase |
|---|---|---|
| Consulta administrativa direta com grant expirado | O servidor recusa a consulta e os dados deixam de aparecer no console após expiração ou troca de sessão. | 3 e 4 |
| Conta antiga com transações bloqueadas | A separação de chaves preserva o acesso anterior a Família, Viagens e Negócio enquanto a conta não tiver configuração específica. | 3 |
| Serviço com janela vazia | O resumo informa ausência de evidência; a lista detalhada mostra a janela e o último evento conhecido. | 4 |
| Pagamento anual com tarifa desconhecida | Entra no caixa pelo valor confirmado e no MRR pela parcela mensal. O líquido indica estimativa ou indisponibilidade conforme a cobertura. | 5 |
| Provedor cobra tentativa com falha ou retry | A telemetria registra as tentativas cobradas identificáveis. Cache servido e débito de cota aparecem como indicadores próprios. | 5 |

### Fechamento da entrega

- [ ] Rodar `npm run verify:full` e testes focados de componentes administrativos, Edge Functions e Supabase, além dos testes de rollback, RLS e permissões. A suíte `verify:full` cobre domínio e smoke E2E; complementar com as suítes específicas de cada fase.
- [ ] Validar manualmente em Preview o portal de login, acesso de admin e superadmin, expiração, caminhos de suporte, histórico em links antigos e operação mobile/desktop. Usar contas e dados de homologação em ações críticas.
- [ ] Atualizar a especificação, arquitetura, estrutura, manual do fundador, governança de segurança e roadmap conforme as alterações efetivamente entregues. Registrar a sequência de deploy e o ponto seguro de rollback. No fechamento para `main`, aplicar bump MINOR conforme a versão vigente e arquivar o plano de execução em `docs/plans/completed/`.

## 6. Cortes de escopo e alternativas

- Evolução incremental da casca e dos fluxos atuais é a abordagem proposta. Uma troca completa do shell concentraria riscos de navegação, autorização e integração na mesma entrega. Liberar os controles de acesso sem as novas telas resolveria parte do problema, deixando os fluxos diários fragmentados.
- Command palette global, ações em massa, rollout por coortes, orquestrador de cron, force-update bloqueante, impersonação e preferências adicionais ficam fora deste ciclo.
- Os indicadores novos dependem de verificação de cobertura. Se uma fonte não atender, publicar a leitura disponível com sua limitação e manter o indicador derivado pendente. O início da execução pode seguir pelas duas primeiras fases, com a migração modular condicionada ao inventário de acesso.
