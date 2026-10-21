# PLANO DE IMPLEMENTAÇÃO — CAPTURA INTELIGENTE DE COMPROVANTES, MODO RÁPIDO & ASSISTENTE PROATIVO

> **Documento Canônico de Arquitetura e Engenharia**  
> **Status:** Aprovado para Execução (Planejamento Concluído)  
> **Módulos Afetados:** `android/`, `src/domain/notifications/`, `src/domain/insights/`, `src/features/transactions/wizard/`, `src/features/overview/`, `src/components/modules/`, `docs/`  
> **Governança:** Custo Zero de Infraestrutura (Google ML Kit Thin on-device) · Zero Inchaço de APK (<800 KB) · Zero Emojis · TypeScript Estrito · Commit por Tarefa e Push por Fase  
> **Data:** Outubro de 2026 · **Ambiente:** Android Nativo (Capacitor) & Web PWA  

---

## 1. SUMÁRIO EXECUTIVO & DIAGNÓSTICO DE FRAGILIDADES

O objetivo deste plano é eliminar o atrito de registro financeiro (despesas, rendas e investimentos), permitindo que o usuário capture transações no momento em que elas ocorrem (mesmo quando o banco não emite notificação push), realize lançamentos manuais em menos de 3 segundos e conte com um assistente inteligente na tela inicial que aprende com seus hábitos financeiros.

A análise profunda da arquitetura atual revelou **4 fragilidades críticas** que impediam essa visão:

### 1.1 Diagnóstico Técnico das Fragilidades

1. **Restrição de Formato no Compartilhamento (`AndroidManifest.xml`):**
   - *Causa:* O aplicativo declarava exclusivamente `<data android:mimeType="text/plain" />`.
   - *Impacto:* Quase todos os bancos brasileiros (Nubank, Inter, Itaú, Santander, Bradesco, C6) exportam comprovantes no formato **Imagem (PNG/JPG)** ou **PDF**. O aplicativo não aparecia no menu de compartilhamento do sistema operacional para esses formatos.
2. **Perda de Dados em Inicialização a Frio (Cold Start):**
   - *Causa:* Se o aplicativo estivesse fechado e o usuário compartilhasse um comprovante, a `MainActivity` em Java recebia o Intent e disparava o evento nativo antes que a camada Web/React tivesse carregado e anexado os ouvintes de evento no JavaScript.
   - *Impacto:* O comprovante compartilhado era descartado silenciosamente.
3. **Fricção Ergonômica no Assistente de Lançamento (`LaunchWizard`):**
   - *Causa:* Todo lançamento manual exigia percorrer 4 etapas consecutivas (Valor ➔ Categoria ➔ Detalhes ➔ Revisão).
   - *Impacto:* Cansaço mental para transações corriqueiras de balcão (café, padaria, estacionamento, Pix rápido).
4. **Motor de Insights Passivo e Escondido (`domain/insights/`):**
   - *Causa:* O motor de detecção de recorrências e assinaturas existia apenas dentro de uma sub-aba da página de Insights e lia exclusivamente despesas.
   - *Impacto:* O usuário não visualizava cobranças duplicadas ou reajustes silenciosos a tempo, e rendas habituais previsíveis (como Salário) não contavam com reconhecimento automático.

---

## 2. DIRETRIZES TÉCNICAS E REGRAS DE GOVERNANÇA

Toda a implementação deve respeitar rigorosamente os seguintes pilares:

- **Custo Zero & Privacidade Total:** Processamento de imagens e PDFs via **Google ML Kit Text Recognition** versão thin (`play-services-mlkit-text-recognition` < 800 KB) associado ao `PdfRenderer` nativo do Android. Zero APIs pagas, zero tráfego de comprovantes para servidores externos e funcionamento 100% offline.
- **Funções Puras no Domínio:** Todo cálculo matemático de recorrência, dia típico, tolerância e impacto orçamentário vive em `src/domain/insights/` sem nenhuma dependência de UI, banco de dados ou Supabase, acompanhado de testes unitários no Vitest.
- **Zero Emojis no Produto:** Proibição de emojis em textos, alertas, toasts e badges, utilizando exclusivamente ícones padronizados `lucide-react` com `aria-hidden`.
- **Governança de Git:**
  - **Commit semântico obrigatório por tarefa concluída** (com verificação e testes aprovados).
  - **Portão de Qualidade (Quality Gate) inegociável** ao final de cada fase.
  - **Git push para o repositório remoto** executado imediatamente após a aprovação de cada fase.

---

## 3. ROTEIRO DE EXECUÇÃO DETALHADO POR FASES

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                      FLUXO DE EXECUÇÃO EM 4 FASES INDEPENDENTES                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
    ┌───────────────────┬───────────────────┴───────────────────┬───────────────────┐
    ▼                   ▼                                       ▼                   ▼
 [FASE 1]            [FASE 2]                                [FASE 3]            [FASE 4]
 Compartilhamento    Lançamento Rápido em                    Motor de Insights   Card Inteligente
 de Comprovantes     1 Tela (3 segundos)                     Bidirecional &      na Home &
 (PDF/Imagem/Texto)  no LaunchWizard                         Gastos Vampiros     Feedback de 1 Toque
    │                   │                                       │                   │
    ▼                   ▼                                       ▼                   ▼
[Quality Gate 1]    [Quality Gate 2]                        [Quality Gate 3]    [Quality Gate 4]
Commit + Push       Commit + Push                           Commit + Push       Commit + Push
```

---

### FASE 1: RECEPÇÃO E IDENTIFICAÇÃO DE COMPROVANTES (SHARE INTENT NATIVO)

**Objetivo:** Permitir que o usuário toque em "Compartilhar comprovante" no banco, selecione o Guia Financeiro e o aplicativo identifique e cadastre a transação instantaneamente, permitindo edição imediata.

#### Tarefas:
- [ ] **Tarefa 1.1 — Suporte a Múltiplos Formatos no `AndroidManifest.xml`:**
  - Adicionar suporte aos tipos MIME `image/*` e `application/pdf` no filtro de Intent da `MainActivity`.
  - *Teste & Verificação:* Inspecionar o `AndroidManifest.xml` e compilar projeto Android para validar sintaxe de intent-filter.
  - *Commit:* `feat(android): adicionar intent-filter para compartilhamento de imagem e pdf`

- [ ] **Tarefa 1.2 — Integração do Google ML Kit Thin (<800 KB) no Android:**
  - Declarar a dependência `com.google.android.gms:play-services-mlkit-text-recognition:19.0.1` em `android/app/build.gradle`.
  - Criar o utilitário nativo `ReceiptOcrHelper.java` que decodifica imagens a partir de URIs e converte a primeira página de PDFs em Bitmap via `PdfRenderer` nativo para leitura no OCR.
  - *Teste & Verificação:* Teste de compilação do Gradle (`./gradlew assembleDebug`) verificando acréscimo de peso inferior a 1 MB no APK.
  - *Commit:* `feat(android): integrar extrator nativo de texto via ML Kit e PdfRenderer`

- [ ] **Tarefa 1.3 — Buffer Anti-Perda em Cold/Warm Start (`BankNotificationPlugin`):**
  - Implementar retenção estática de payload pendente (`pendingSharePayload`) em `BankNotificationPlugin.java` e método `@PluginMethod public void getPendingShare(PluginCall call)`.
  - Em `MainActivity.java`, interceptar intents de `ACTION_SEND` em `onCreate` e `onNewIntent`, gravando os bytes em cache temporário seguro (`getCacheDir()`) para evitar `SecurityException`.
  - *Teste & Verificação:* Simular cold start enviando intent de texto/imagem via ADB e verificar persistência do buffer até a chamada do JavaScript.
  - *Commit:* `fix(android): blindar ciclo de vida e buffer de comprovante compartilhado`

- [ ] **Tarefa 1.4 — Motor de Domínio de Parsing de Comprovantes (`bank-parser.ts`):**
  - Aprimorar `parsePixShareText` para extrair com alta tolerância:
    - *Tipo:* Despesa (`expense`) vs. Renda (`income`).
    - *Valor:* centavos com precisão estrita.
    - *Favorecido / Pagador:* nomes de pessoas e razões sociais limpas.
    - *Instituição:* banco emissor.
    - *Data e Identificador:* para prevenção de lançamentos duplicados.
  - *Teste & Verificação:* Criar fixtures de testes em `src/domain/notifications/bank-parser.test.ts` com comprovantes reais de Nubank, Inter, Itaú, Santander, Bradesco, C6 e Mercado Pago.
  - *Commit:* `feat(domain): aprimorar parser de comprovantes bancarios para pix e rendas`

- [ ] **Tarefa 1.5 — UX de Auto-Cadastro com Janela de Edição e Desfazer:**
  - Atualizar `src/features/transactions/pages/share-target-page.tsx` para processar comprovantes recebidos do plugin nativo:
    - Efetivar o cadastro imediato via RPC transacional com os dados identificados.
    - Redirecionar para a Home exibindo Toast e Banner persistente: *"Pix de R$ 45,00 para Padaria Silva cadastrado! [Editar Lançamento] [Desfazer (5s)]"*.
    - Ao tocar em `[Editar]`, abre o diálogo com todos os campos pré-carregados.
  - *Teste & Verificação:* Testes unitários no Vitest em `share-target-page.test.tsx` cobrindo sucesso, falha e ação de reversão.
  - *Commit:* `feat(transactions): implementar fluxo de auto-cadastro com edicao imediata`

#### PORTÃO DE QUALIDADE 1 (Quality Gate 1):
1. Suíte de testes do parser (`src/domain/notifications/`) 100% verde com fixtures de comprovantes.
2. Compilação do módulo Android concluída sem advertências de segurança de URI.
3. Typecheck estrito (`npx tsc --noEmit`) sem erros.
4. Linter (`npm run lint`) 100% limpo sem violações de emojis ou tipos.
5. **Ação Obrigatória:** Executar `git push origin` com os commits da Fase 1.

---

### FASE 2: MODO DE LANÇAMENTO RÁPIDO EM 1 TELA (LAUNCHWIZARD)

**Objetivo:** Permitir que o usuário realize lançamentos manuais ou Pix em menos de 3 segundos, substituindo o fluxo de 4 telas por uma tela única e ágil.

#### Tarefas:
- [ ] **Tarefa 2.1 — Componente `StepQuick` em Tela Única:**
  - Criar `src/features/transactions/wizard/step-quick.tsx` contendo:
    - Abas Tipo (Despesa / Renda).
    - Campo de Valor em destaque (`MoneyInput`).
    - Grade Compacta de Categorias frequentes (ícones e rótulos selecionáveis em 1 toque).
    - Seletor rápido de Forma de Pagamento (Pix, Cartão de Crédito com dropdown de cartões, Débito, Dinheiro).
    - Campo de Descrição simplificado com chips de habituais.
    - Botão *"Mais opções (parcelas, fixo, data retroativa)"* para alternar para o modo guiado.
  - *Teste & Verificação:* Testes de renderização e acessibilidade com React Testing Library.
  - *Commit:* `feat(transactions): criar componente StepQuick para lancamento em tela unica`

- [ ] **Tarefa 2.2 — Integração do Modo Rápido no `LaunchWizard`:**
  - Atualizar `launch-wizard.tsx` para suportar `initialMode="quick" | "guided"` e transição sem perda de dados entre modos.
  - Conectar botão de rodapé *"Salvar Transação"* diretamente ao `handleSubmit()`.
  - *Teste & Verificação:* Atualizar `launch-wizard.test.tsx` validando preenchimento e salvamento direto no modo rápido.
  - *Commit:* `feat(transactions): integrar modo rapido ao LaunchWizard com alternancia suave`

- [ ] **Tarefa 2.3 — Botão "Colar Comprovante / Pix" com 1 Toque:**
  - Inserir botão de prancheta destacado no cabeçalho do `LaunchWizard`.
  - Ao clicar, lê a área de transferência com consentimento explícito do usuário, analisa via `parsePixShareText` e preenche valor, categoria e favorecido automaticamente.
  - *Teste & Verificação:* Teste simulando conteúdo no clipboard e verificando auto-preenchimento dos campos.
  - *Commit:* `feat(transactions): adicionar acao de colar comprovante no cabecalho do wizard`

- [ ] **Tarefa 2.4 — Deep Links e Atalhos no Android (`shortcuts.xml`):**
  - Mapear parâmetros de URL no `PageShell.tsx`:
    - `?novo=pix` ➔ abre `LaunchWizard` em modo rápido com forma Pix pré-selecionada.
    - `?modo=rapido` ➔ inicializa diretamente no `StepQuick`.
  - Atualizar `android/app/src/main/res/xml/shortcuts.xml` e `strings.xml` com os atalhos:
    - `+ Nova Despesa`
    - `+ Novo Pix`
    - `+ Novo Aporte`
  - *Teste & Verificação:* Testes em `page-shell.test.tsx` e `deep-links.test.ts`.
  - *Commit:* `feat(shortcuts): configurar atalhos nativos de novo pix e despesa rapida`

#### PORTÃO DE QUALIDADE 2 (Quality Gate 2):
1. Teste de usabilidade comprovando conclusão de lançamento em menos de 4 segundos.
2. Todos os testes de transações (`src/features/transactions/`) 100% aprovados.
3. Validação dos deep links no `PageShell`.
4. Typecheck (`npx tsc --noEmit`) e Linter (`npm run lint`) 100% limpos.
5. **Ação Obrigatória:** Executar `git push origin` com os commits da Fase 2.

---

### FASE 3: MOTOR DE INSIGHTS BIDIRECIONAL & GASTOS VAMPIROS

**Objetivo:** Aprimorar o motor em `src/domain/insights/` para detectar rendas previsíveis, alertar sobre cobranças duplicadas, reajustes de preços e calcular o peso orçamentário de gastos recorrentes.

#### Tarefas:
- [ ] **Tarefa 3.1 — Suporte a Rendas (`IncomeLike`) em `domain/insights/recurrences.ts`:**
  - Generalizar a interface e o algoritmo de agrupamento para processar tanto despesas quanto receitas históricas dos últimos 3 a 6 meses.
  - Implementar inferência de dia típico (`calculateTypicalDay`) e valor mediano para receitas periódicas (Salário, aluguéis recebidos, pró-labore).
  - Identificar a condição `missingThisMonth` para receitas previstas no mês corrente.
  - *Teste & Verificação:* Testes unitários em `recurrences.test.ts` com cenários de salários em dias variáveis e múltiplos empregos.
  - *Commit:* `feat(domain/insights): adicionar deteccao inteligente de rendas habituais`

- [ ] **Tarefa 3.2 — Identificador de "Gastos Vampiros" e Alto Impacto Orçamentário:**
  - Implementar função pura `evaluateBudgetImpact(occurrence, monthlyIncomeCents, categoryBudgetCents)`:
    - Sinalizar recorrências que comprometem $\ge 15\%$ da renda mensal ou $\ge 30\%$ do orçamento da categoria.
    - Calcular o custo projetado anual (ex.: *"Essa assinatura custa R$ 1.080,00 por ano"*).
  - *Teste & Verificação:* Testes cobrindo thresholds matemáticos e cálculos de projeção anual.
  - *Commit:* `feat(domain/insights): implementar calculo de impacto orcamentario e gastos vampiros`

- [ ] **Tarefa 3.3 — Detecção Robusta de Anomalias Financeiras:**
  - Refinar detecção de cobranças duplicadas no mesmo mês (`duplicateChargesThisMonth >= 2`).
  - Refinar detecção de reajustes silenciosos de preços (`priceAdjustment >= 10%`).
  - Sinalizar contas essenciais pendentes com proximidade de vencimento.
  - *Teste & Verificação:* Testes de anomalias cobrindo variações de centavos e múltiplos lançamentos no mesmo dia.
  - *Commit:* `feat(domain/insights): refinar deteccao de cobrancas duplicadas e reajustes`

- [ ] **Tarefa 3.4 — Sincronização dos Testes do Módulo de Insights:**
  - Executar e atualizar a suíte completa de `src/domain/insights/index.test.ts` e `recurrences.test.ts`.
  - Garantir 100% de pureza arquitetural (zero imports de UI ou banco).
  - *Teste & Verificação:* `npx vitest run src/domain/insights/`.
  - *Commit:* `test(domain/insights): cobrir integralmente motor bidirecional e regras de anomalias`

#### PORTÃO DE QUALIDADE 3 (Quality Gate 3):
1. 100% dos testes do motor de insights aprovados no Vitest.
2. Invariantes de cálculo matemático validadas.
3. Pureza de domínio garantida (sem efeitos colaterais ou dependências externas).
4. Typecheck (`npx tsc --noEmit`) e Linter (`npm run lint`) 100% limpos.
5. **Ação Obrigatória:** Executar `git push origin` com os commits da Fase 3.

---

### FASE 4: ASSISTENTE PROATIVO NA HOME & APRENDIZADO ATIVO

**Objetivo:** Levar os insights para a Visão Geral em um microcard com ações de 1 toque, permitindo confirmar rendas e ensinar o motor a calibrar sua precisão.

#### Tarefas:
- [ ] **Tarefa 4.1 — Hook Unificado `useSmartAdvisorInsights`:**
  - Criar `src/features/overview/hooks/use-smart-advisor-insights.ts` cruzando despesas, rendas, orçamentos e feedback do usuário.
  - Classificar e retornar a recomendação de maior relevância no momento:
    1. *Crítica:* Cobrança duplicada ou conta esquecida com risco de juros.
    2. *Entrada:* Renda habitual prevista pronta para confirmação em 1 clique.
    3. *Economia:* Oportunidade de corte de assinatura ou reajuste de preço.
    4. *Calibração:* Pergunta simples para ensinar o motor.
  - *Teste & Verificação:* Testes de hook simulando cenários e validando a ordenação por relevância.
  - *Commit:* `feat(overview): criar hook unificado de insights proativos para a home`

- [ ] **Tarefa 4.2 — Componente `SmartAdvisorCard` na Home:**
  - Criar `src/components/modules/smart-advisor-card.tsx` respeitando as regras do Design System:
    - Borda canônica `border-border/80 bg-surface shadow-xs`.
    - Ícones temáticos `lucide-react` da escala `size-4`.
    - Zero emojis.
    - Botão de ação de 1 toque para confirmar renda com Toast de reversão.
    - Botões de feedback de aprendizado: `[Sim, monitorar]` / `[Não, foi pontual]`.
  - *Teste & Verificação:* Testes de renderização nos 4 estados e disparo sensorial (`triggerSensory`).
  - *Commit:* `feat(modules): criar componente SmartAdvisorCard para a tela inicial`

- [ ] **Tarefa 4.3 — Persistência do Feedback do Usuário:**
  - Conectar as respostas de calibração à tabela `insight_feedback` via Supabase/RPC, garantindo que o motor recalcule imediatamente e elimine falsos positivos para aquele usuário.
  - *Teste & Verificação:* Testes de integração da mutation de feedback.
  - *Commit:* `feat(insights): persistir feedback de aprendizado ativo do usuario`

- [ ] **Tarefa 4.4 — Atalho Rápido de Aporte do Mês na Home:**
  - No bloco de Investimentos da Home, adicionar campo rápido para informar o valor do aporte e navegar diretamente para a aba de execução em lote do rebalanceamento (`/investments?tab=aporte&valor=...`).
  - *Teste & Verificação:* Teste de navegação e pré-carregamento do valor na `AporteTab`.
  - *Commit:* `feat(overview): adicionar acao rapida de aporte mensal direcionado`

- [ ] **Tarefa 4.5 — Atualização da Documentação Canônica em `docs/`:**
  - Atualizar `docs/ARCHITECTURE.md`, `docs/PROJECT_STRUCTURE.md` e `docs/ROADMAP.md` documentando os novos fluxos de captura nativa e motor proativo.
  - *Teste & Verificação:* Revisão de congruência da documentação técnica.
  - *Commit:* `docs: registrar arquitetura de captura de comprovantes e assistente proativo`

#### PORTÃO DE QUALIDADE 4 (Quality Gate 4 / DoD Final):
1. Suíte completa de testes de regressão do projeto (`npm run test`) 100% verde.
2. Typecheck estrito (`npx tsc --noEmit`) sem erros.
3. Linter (`npm run lint`) 100% aprovado sem violação da regra de emojis.
4. Verificação de compatibilidade mobile e desktop.
5. Documentos canônicos sincronizados.
6. **Ação Obrigatória:** Executar `git push origin` com a entrega consolidada.

---

## 4. MATRIZ DE VERIFICAÇÃO E TESTES FINAIS

| Teste | Critério de Aceitação | Comando / Verificação |
|---|---|---|
| **Compartilhamento de Comprovante** | App surge no menu nativo, processa imagem/PDF sem custo e cadastra com opção de edição | Teste de Intent via ADB e banco real |
| **Lançamento Rápido** | Cadastro de despesa concluído em $\le 3$ segundos na tela única | Interação manual e teste com `StepQuick` |
| **Detecção de Salário/Renda** | Renda prevista surge na data típica e é confirmada em 1 clique | Teste unitário em `recurrences.test.ts` |
| **Gastos Vampiros & Anomalias** | Cobrança duplicada gera alerta imediato na Home com economia anual calculada | Teste unitário e renderização no `SmartAdvisorCard` |
| **Governança de Código** | Zero emojis, TypeScript estrito, DRY respeitado e commits por tarefa | `npm run typecheck && npm run lint && npm run test` |
