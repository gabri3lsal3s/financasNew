# PLANO DE IMPLEMENTAÇÃO — CAPTURA INTELIGENTE DE COMPROVANTES, MODO RÁPIDO & ASSISTENTE PROATIVO

> **Documento Canônico de Arquitetura e Engenharia**  
> **Status:** Aprovado e Blindado (Pronto para Execução)  
> **Módulos Afetados:** `android/`, `src/domain/notifications/`, `src/domain/insights/`, `src/features/transactions/wizard/`, `src/features/overview/`, `src/components/modules/`, `docs/`  
> **Governança:** Custo Zero de Infraestrutura (Google ML Kit Thin on-device) · Zero Inchaço de APK (<800 KB) · Zero Emojis · TypeScript Estrito · Commit por Tarefa e Push por Fase  
> **Data:** Outubro de 2026 · **Ambiente:** Android Nativo (Capacitor) & Web PWA  

---

## 1. SUMÁRIO EXECUTIVO & DIAGNÓSTICO DE FRAGILIDADES

O objetivo deste plano é eliminar o atrito de registro financeiro (despesas, rendas e investimentos), permitindo que o usuário capture transações no momento em que elas ocorrem (mesmo quando o banco não emite notificação push), conte com um motor inteligente que reconhece CNPJs, razões sociais e estabelecimentos em todo o aplicativo, realize lançamentos manuais em menos de 3 segundos e conte com um assistente financeiro proativo na tela inicial que aprende com seus hábitos.

A auditoria exaustiva de código e cenários reais identificou **10 fragilidades críticas** que foram tratadas e blindadas na arquitetura deste plano:

### 1.1 Matriz de Fragilidades e Soluções de Engenharia

| # | Fragilidade Identificada | Risco Técnico no Mundo Real | Solução de Engenharia Blindada |
|---|---|---|---|
| **F1** | App não aparece no menu "Compartilhar" do banco | `AndroidManifest.xml` declarava apenas `text/plain`. Bancos exportam **Imagem (PNG/JPG)** ou **PDF**. | Declarar `text/plain`, `image/*` e `application/pdf` nas tags `<intent-filter>` de `MainActivity`. |
| **F2** | Perda de dados em Cold Start | Se o app estiver fechado e receber compartilhamento, a Activity emite evento antes do React anexar ouvintes no JS. | Buffer estático de retenção (`pendingSharePayload`) no plugin nativo, consumido no carregamento do React. |
| **F3** | Erro de permissão de arquivo (`SecurityException`) | URIs de outros bancos (`content://...`) expiram se não consumidas imediatamente pela Activity. | Cópia imediata dos bytes recebidos para o cache temporário seguro do app (`context.getCacheDir()`). |
| **F4** | Inchaço de APK por OCR ou custos de nuvem | APIs de nuvem geram custos recorrentes; modelos OCR offline grandes pesam 30 MB. | **Google ML Kit Text Recognition** versão thin (<800 KB, unbundled via Google Play Services) + `PdfRenderer` nativo (até 2 páginas). Custo = R$ 0,00 e 100% offline. |
| **F5** | Colisão entre Comprovante e Push atrasada | O usuário compartilha o comprovante e, 40s depois, a push do banco chega, duplicando a despesa. | **Deduplicação Cruzada com Janela de 10 minutos** por assinatura hash `(amountCents + date + merchant/chavePix)`. |
| **F6** | Pix Agendado lançado como despesa paga | Comprovantes de agendamento têm liquidação futura; lançar como despesa de hoje distorce saldos. | Detecção semântica de termos de agendamento em `bank-parser.ts`, lançando como despesa pendente/agendada. |
| **F7** | Nomes burocráticos / Prefixos de Maquininhas | Comprovantes e notificações trazem `PAG*`, `MP*`, `STONE*` ou Razões Sociais em vez do Nome Fantasia. | **Motor Unificado de Aprendizado Semântico (`MerchantLearningEngine`)** com busca por CNPJ, remoção de prefixos e dicionário adaptativo em todo o app. |
| **F8** | Rendas Variáveis de Autônomos ignoradas | Se o motor exigir dia e valor exato, autônomos e freelancers nunca recebem sugestões de receita. | **Classificação Dual:** Renda Fixa/CLT (valor pré-preenchido) vs. Renda de Cliente Recorrente (valor aberto para digitação rápida). |
| **F9** | Falso positivo de "Cobrança Duplicada" | Compras reais de mesmo valor no mesmo mês (ex.: dois almoços de R$ 40) sendo marcadas como erro. | Duplicidade restrita a **assinaturas de valor fixo** ou compras de balcão com **mesmo valor na mesma hora/minuto**. |
| **F10** | Fadiga de Alertas na Home (Banner Blindness) | Cards diários em excesso cansam o usuário e poluem a interface inicial. | **Política de Discrição:** Dismiss cirúrgico por sugestão individual com silenciamento de 30 dias, limite de 1 card/dia e invisibilidade total quando regular. |

---

## 2. DIRETRIZES TÉCNICAS E REGRAS DE GOVERNANÇA

Toda a implementação deve respeitar rigorosamente os seguintes pilares:

- **Custo Zero & Privacidade Total:** Processamento de imagens e PDFs via **Google ML Kit Text Recognition** versão thin (`play-services-mlkit-text-recognition` < 800 KB) associado ao `PdfRenderer` nativo do Android. Zero APIs pagas, zero tráfego de comprovantes para servidores externos e funcionamento 100% offline.
- **Funções Puras no Domínio:** Todo cálculo matemático de recorrência, dia típico, tolerância, normalização semântica e impacto orçamentário vive em `src/domain/` sem nenhuma dependência de UI, banco de dados ou Supabase, acompanhado de testes unitários no Vitest.
- **Zero Emojis no Produto:** Proibição de emojis em textos, alertas, toasts e badges, utilizando exclusivamente ícones padronizados `lucide-react` com `aria-hidden`.
- **Governança de Git:**
  - **Commit semântico obrigatório por tarefa concluída** (com verificação e testes aprovados).
  - **Portão de Qualidade (Quality Gate) inegociável** ao final de cada fase.
  - **Git push para o repositório remoto** executado imediatamente após a aprovação de cada fase.

---

## 3. ROTEIRO DE EXECUÇÃO DETALHADO EM 5 FASES

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                       FLUXO DE EXECUÇÃO EM 5 FASES MODULARES & INTEGRADAS                      │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
    ┌───────────────────┬───────────────────────┼───────────────────────┬───────────────────┐
    ▼                   ▼                       ▼                       ▼                   ▼
 [FASE 1]            [FASE 2]                [FASE 3]                [FASE 4]            [FASE 5]
 Compartilhamento    Motor Semântico de      Lançamento Rápido em    Motor de Insights   Card Inteligente
 de Comprovantes     Estabelecimentos        1 Tela (3 segundos)     Bidirecional &      na Home &
 (PDF/Imagem/Texto)  (CNPJ/Nome/Categoria)   no LaunchWizard         Gastos Vampiros     Feedback de 1 Toque
    │                   │                       │                       │                   │
    ▼                   ▼                       ▼                       ▼                   ▼
[Quality Gate 1]    [Quality Gate 2]        [Quality Gate 3]        [Quality Gate 4]    [Quality Gate 5]
Commit + Push       Commit + Push           Commit + Push           Commit + Push       Commit + Push
```

---

### FASE 1: RECEPÇÃO E IDENTIFICAÇÃO DE COMPROVANTES (SHARE INTENT NATIVO)

**Objetivo:** Permitir que o usuário toque em "Compartilhar comprovante" no banco, selecione o Guia Financeiro e o aplicativo identifique e cadastre a transação instantaneamente, permitindo edição imediata e blindando contra duplicatas de push.

#### Tarefas da Fase 1:
- [ ] **Tarefa 1.1 — Suporte a Múltiplos Formatos no `AndroidManifest.xml`:**
  - Adicionar suporte aos tipos MIME `image/*` e `application/pdf` no filtro de Intent da `MainActivity`.
  - *Teste & Verificação:* Inspecionar o `AndroidManifest.xml` e compilar projeto Android para validar sintaxe de intent-filter.
  - *Commit:* `feat(android): adicionar intent-filter para compartilhamento de imagem e pdf`

- [ ] **Tarefa 1.2 — Integração do Google ML Kit Thin (<800 KB) no Android:**
  - Declarar a dependência `com.google.android.gms:play-services-mlkit-text-recognition:19.0.1` em `android/app/build.gradle`.
  - Criar o utilitário nativo `ReceiptOcrHelper.java` que decodifica imagens a partir de URIs e converte páginas de PDFs em Bitmap via `PdfRenderer` nativo (suportando até 2 páginas com autenticação mecânica) para leitura no OCR.
  - *Teste & Verificação:* Teste de compilação do Gradle (`./gradlew assembleDebug`) verificando acréscimo de peso inferior a 1 MB no APK.
  - *Commit:* `feat(android): integrar extrator nativo de texto via ML Kit e PdfRenderer`

- [ ] **Tarefa 1.3 — Buffer Anti-Perda em Cold/Warm Start (`BankNotificationPlugin`):**
  - Implementar retenção estática de payload pendente (`pendingSharePayload`) em `BankNotificationPlugin.java` e método `@PluginMethod public void getPendingShare(PluginCall call)`.
  - Em `MainActivity.java`, interceptar intents de `ACTION_SEND` em `onCreate` e `onNewIntent`, gravando os bytes em cache temporário seguro (`getCacheDir()`) para evitar `SecurityException`.
  - *Teste & Verificação:* Simular cold start enviando intent de texto/imagem via ADB e verificar persistência do buffer até a chamada do JavaScript.
  - *Commit:* `fix(android): blindar ciclo de vida e buffer de comprovante compartilhado`

- [ ] **Tarefa 1.4 — Motor de Domínio de Parsing com Triagem de Agendamentos (`bank-parser.ts`):**
  - Aprimorar `parsePixShareText` para extrair com alta tolerância:
    - *Tipo:* Despesa (`expense`) vs. Renda (`income`).
    - *Status:* Efetivado vs. Agendado (detectando termos de liquidação futura para não distorcer saldo atual).
    - *Valor:* centavos com precisão estrita.
    - *Favorecido / Pagador:* extração limpa de nomes de pessoas, CNPJs e razões sociais.
    - *Instituição:* banco emissor.
    - *Data e Identificador:* para prevenção de lançamentos duplicados.
  - *Teste & Verificação:* Criar fixtures de testes em `src/domain/notifications/bank-parser.test.ts` com comprovantes reais de Nubank, Inter, Itaú, Santander, Bradesco, C6 e Mercado Pago.
  - *Commit:* `feat(domain): aprimorar parser de comprovantes bancarios para pix e agendamentos`

- [ ] **Tarefa 1.5 — Deduplicação Cruzada (Comprovante $\leftrightarrow$ Notificação Push):**
  - Em `src/services/native/suggestions-store.ts`, registrar janela temporal de 10 minutos para transações originadas de comprovantes.
  - Se uma notificação push do mesmo valor e estabelecimento chegar posteriormente, descartar silenciosamente sem gerar card duplicado.
  - *Teste & Verificação:* Teste unitário em `suggestions-store.test.ts` simulando chegada de push 45s após compartilhamento de comprovante.
  - *Commit:* `feat(native): implementar deduplicacao cruzada entre comprovantes e push`

- [ ] **Tarefa 1.6 — UX de Auto-Cadastro com Janela de Edição e Desfazer:**
  - Atualizar `src/features/transactions/pages/share-target-page.tsx` para processar comprovantes recebidos do plugin nativo:
    - Efetivar o cadastro imediato via RPC transacional com os dados identificados.
    - Redirecionar para a Home exibindo Toast e Banner persistente: *"Pix de R$ 45,00 para Padaria Silva cadastrado! [Editar Lançamento] [Desfazer (5s)]"*.
    - Ao tocar em `[Editar]`, abre o diálogo com todos os campos pré-carregados.
  - *Teste & Verificação:* Testes unitários no Vitest em `share-target-page.test.tsx` cobrindo sucesso, falha e ação de reversão.
  - *Commit:* `feat(transactions): implementar fluxo de auto-cadastro com edicao imediata`

#### PORTÃO DE QUALIDADE 1 (Quality Gate 1):
1. Suíte de testes do parser (`src/domain/notifications/`) 100% verde com fixtures de comprovantes reais e agendamentos.
2. Compilação do módulo Android concluída sem advertências de segurança de URI.
3. Teste de deduplicação comprovante $\leftrightarrow$ push aprovado.
4. Typecheck estrito (`npx tsc --noEmit`) sem erros.
5. Linter (`npm run lint`) 100% limpo sem violações de emojis ou tipos.
6. **Ação Obrigatória:** Executar `git push origin` com os commits da Fase 1.

---

### FASE 2: MOTOR UNIFICADO DE RECONHECIMENTO E APRENDIZADO SEMÂNTICO (`MerchantLearningEngine`)

**Objetivo:** Criar um motor inteligente e consistente em todo o aplicativo que correlaciona CNPJs, razões sociais, nomes de maquininhas (`PAG*`, `MP*`, `STONE*`) com a descrição amigável (Nome Fantasia) e categoria escolhida pelo usuário.

#### Tarefas da Fase 2:
- [ ] **Tarefa 2.1 — Modelo de Dados e Domínio Puro do Aprendizado Semântico:**
  - Em `src/domain/notifications/merchant-memory.ts`, expandir a interface para `MerchantLearningRecord`:
    - `friendlyName: string` (ex.: "McDonald's", "Padaria do Zé")
    - `categorySlug: string` (ex.: "alimentacao", "mercado")
    - `cnpjOrCpf?: string` (dígitos limpos para correspondência unívoca)
    - `rawAliases: string[]` (variações como "arcos dourados", "pag*mcdonalds", "mc donalds")
    - `usageCount: number` e `lastUsedAt: string`
  - Criar extrator e normalizador de CNPJ/CPF em textos bancários (`extractTaxIdFromText`).
  - *Teste & Verificação:* Testes unitários em `merchant-memory.test.ts` cobrindo extração de CNPJs formatados e desformatados.
  - *Commit:* `feat(domain): expandir merchant memory para aprendizado de nomes amigaveis e cnpjs`

- [ ] **Tarefa 2.2 — Removedor de Prefixos de Adquirentes e Catálogo Base:**
  - Criar função pura `cleanAcquirerPrefixes(text: string): string` que elimina ruídos como `PAG*`, `MP*`, `STONE*`, `CIELO*`, `REDE*`, `IFOOD *`, `UBER *TRIP`.
  - Embarcar dicionário canônico com as 100 marcas e redes mais frequentes no Brasil (mercados, farmácias, postos, streamings e concessoes de serviços públicos).
  - *Teste & Verificação:* Testes cobrindo dezenas de formatos sujos de adquirentes e cartões.
  - *Commit:* `feat(domain): implementar limpeza de adquirentes e catalogo base de marcas brasileiras`

- [ ] **Tarefa 2.3 — Pipeline de Resolução Hierárquica em 3 Camadas:**
  - Implementar função pura `resolveMerchantIdentity(params)`:
    - *1ª Camada (Chave de Ouro):* Busca por CNPJ/CPF limpo (precisão 100%).
    - *2ª Camada (Memória Adaptativa):* Busca por correspondência exata ou fuzzy nos aliases de aprendizado do usuário.
    - *3ª Camada (Catálogo Base + Inferência):* Busca por palavras-chave no catálogo geral.
  - Retorna `{ friendlyName, categorySlug, confidence, isLearned }`.
  - *Teste & Verificação:* Testes unitários cobrindo os 3 níveis da hierarquia.
  - *Commit:* `feat(domain): implementar pipeline de resolucao hierarquica de estabelecimentos`

- [ ] **Tarefa 2.4 — Hook Global e Sincronização em Todo o Aplicativo:**
  - Criar serviço/hook `useMerchantLearning()` conectando a memória rápida no cliente (tempo de resposta < 2 ms) com persistência multi-dispositivo no Supabase.
  - Integrar a auto-atualização do aprendizado: sempre que o usuário salvar ou editar uma transação alterando a descrição ou categoria, o motor grava a nova regra automaticamente em segundo plano.
  - *Teste & Verificação:* Testes de hook e simulação de concorrência com React Testing Library.
  - *Commit:* `feat(services): criar hook global de aprendizado semantico com persistencia`

#### PORTÃO DE QUALIDADE 2 (Quality Gate 2):
1. 100% dos testes do motor de estabelecimentos (`merchant-memory.test.ts`) aprovados.
2. Identificação de CNPJs e remoção de prefixos de adquirentes validada em cenários de estresse.
3. Zero dependências de UI no motor de domínio.
4. Typecheck (`npx tsc --noEmit`) e Linter (`npm run lint`) 100% limpos.
5. **Ação Obrigatória:** Executar `git push origin` com os commits da Fase 2.

---

### FASE 3: MODO DE LANÇAMENTO RÁPIDO EM 1 TELA (LAUNCHWIZARD)

**Objetivo:** Permitir que o usuário realize lançamentos manuais ou Pix em menos de 3 segundos, integrando o aprendizado semântico de comerciantes em tempo real.

#### Tarefas da Fase 3:
- [ ] **Tarefa 3.1 — Componente `StepQuick` em Tela Única:**
  - Criar `src/features/transactions/wizard/step-quick.tsx` contendo:
    - Abas Tipo (Despesa / Renda).
    - Campo de Valor em destaque (`MoneyInput`).
    - Grade Compacta de Categorias frequentes (ícones e rótulos selecionáveis em 1 toque).
    - Seletor rápido de Forma de Pagamento (Pix, Cartão de Crédito com dropdown de cartões, Débito, Dinheiro).
    - Campo de Descrição com autocompletar inteligente via `MerchantLearningEngine` (ao digitar "mc", já sugere "McDonald's" e auto-seleciona "Alimentação").
    - Botão *"Mais opções (parcelas, fixo, data retroativa)"* para alternar para o modo guiado.
  - *Teste & Verificação:* Testes de renderização e acessibilidade com React Testing Library.
  - *Commit:* `feat(transactions): criar componente StepQuick com integracao semantica`

- [ ] **Tarefa 3.2 — Integração do Modo Rápido no `LaunchWizard`:**
  - Atualizar `launch-wizard.tsx` para suportar `initialMode="quick" | "guided"` e transição sem perda de dados entre modos.
  - Conectar botão de rodapé *"Salvar Transação"* diretamente ao `handleSubmit()`.
  - *Teste & Verificação:* Atualizar `launch-wizard.test.tsx` validando preenchimento e salvamento direto no modo rápido.
  - *Commit:* `feat(transactions): integrar modo rapido ao LaunchWizard com alternancia suave`

- [ ] **Tarefa 3.3 — Botão "Colar Comprovante / Pix" com 1 Toque:**
  - Inserir botão de prancheta destacado no cabeçalho do `LaunchWizard`.
  - Ao clicar, lê a área de transferência com consentimento explícito do usuário, analisa via `parsePixShareText` e preenche valor, categoria e favorecido automaticamente.
  - *Teste & Verificação:* Teste simulando conteúdo no clipboard e verificando auto-preenchimento dos campos.
  - *Commit:* `feat(transactions): adicionar acao de colar comprovante no cabecalho do wizard`

- [ ] **Tarefa 3.4 — Deep Links e Atalhos no Android (`shortcuts.xml`):**
  - Mapear parâmetros de URL no `PageShell.tsx`:
    - `?novo=pix` ➔ abre `LaunchWizard` em modo rápido com forma Pix pré-selecionada.
    - `?modo=rapido` ➔ inicializa diretamente no `StepQuick`.
  - Atualizar `android/app/src/main/res/xml/shortcuts.xml` e `strings.xml` com os atalhos:
    - `+ Nova Despesa`
    - `+ Novo Pix`
    - `+ Novo Aporte`
  - *Teste & Verificação:* Testes em `page-shell.test.tsx` e `deep-links.test.ts`.
  - *Commit:* `feat(shortcuts): configurar atalhos nativos de novo pix e despesa rapida`

#### PORTÃO DE QUALIDADE 3 (Quality Gate 3):
1. Teste de usabilidade comprovando conclusão de lançamento em menos de 4 segundos.
2. Todos os testes de transações (`src/features/transactions/`) 100% aprovados.
3. Validação dos deep links no `PageShell`.
4. Typecheck (`npx tsc --noEmit`) e Linter (`npm run lint`) 100% limpos.
5. **Ação Obrigatória:** Executar `git push origin` com os commits da Fase 3.

---

### FASE 4: MOTOR DE INSIGHTS BIDIRECIONAL & GASTOS VAMPIROS

**Objetivo:** Aprimorar o motor em `src/domain/insights/` para detectar rendas previsíveis (fixas e de clientes recorrentes), alertar sobre cobranças duplicadas sem falsos positivos e calcular o peso orçamentário de gastos recorrentes.

#### Tarefas da Fase 4:
- [ ] **Tarefa 4.1 — Suporte a Rendas (`IncomeLike`) com Classificação Dual:**
  - Generalizar o algoritmo para processar receitas históricas dos últimos 3 a 6 meses.
  - **Perfil 1 — Renda Fixa/CLT:** Dia típico fixo ($\pm 2$ dias) e valor estável ($\pm 10\%$). Sugere confirmação em 1 toque com valor preenchido.
  - **Perfil 2 — Renda Recorrente de Cliente Frequente (Freelancer):** Mesma fonte/cliente habitual, frequência mensal, valor flutuante. Sugere card com campo de valor aberto para digitação imediata.
  - Detectar a condição `missingThisMonth` para receitas previstas no mês corrente.
  - *Teste & Verificação:* Testes unitários em `recurrences.test.ts` com cenários de salários CLT e múltiplos clientes freelancers.
  - *Commit:* `feat(domain/insights): adicionar deteccao dual de rendas fixas e variaveis`

- [ ] **Tarefa 4.2 — Identificador de "Gastos Vampiros" e Alto Impacto Orçamentário:**
  - Implementar função pura `evaluateBudgetImpact(occurrence, monthlyIncomeCents, categoryBudgetCents)`:
    - Sinalizar recorrências que comprometem $\ge 15\%$ da renda mensal ou $\ge 30\%$ do orçamento da categoria.
    - Calcular o custo projetado anual (ex.: *"Essa assinatura custa R$ 1.080,00 por ano"*).
  - *Teste & Verificação:* Testes cobrindo thresholds matemáticos e cálculos de projeção anual.
  - *Commit:* `feat(domain/insights): implementar calculo de impacto orcamentario e gastos vampiros`

- [ ] **Tarefa 4.3 — Filtro Estrito Antirruído para Cobranças Duplicadas e Reajustes:**
  - Regra de Duplicidade: Sinalizar cobrança duplicada exclusivamente se for **serviço de assinatura de valor fixo** OU se forem compras com **mesmo valor exato no mesmo dia e na mesma hora/minuto**.
  - Regra de Reajuste: Diferenciar reajustes inflacionários (10%–30%) de mudanças de plano (>50%).
  - *Teste & Verificação:* Testes garantindo que compras corriqueiras de mesmo valor em dias diferentes NÃO disparem falsos alertas de duplicidade.
  - *Commit:* `feat(domain/insights): aplicar regras estritas antirruido para cobrancas duplicadas`

- [ ] **Tarefa 4.4 — Sincronização dos Testes do Módulo de Insights:**
  - Executar e atualizar a suíte completa de `src/domain/insights/index.test.ts` e `recurrences.test.ts`.
  - Garantir 100% de pureza arquitetural (zero imports de UI ou banco).
  - *Teste & Verificação:* `npx vitest run src/domain/insights/`.
  - *Commit:* `test(domain/insights): cobrir integralmente motor bidirecional e regras de anomalias`

#### PORTÃO DE QUALIDADE 4 (Quality Gate 4):
1. 100% dos testes do motor de insights aprovados no Vitest.
2. Invariantes de cálculo matemático validadas (zero falsos positivos de duplicidade).
3. Pureza de domínio garantida (sem efeitos colaterais ou dependências externas).
4. Typecheck (`npx tsc --noEmit`) e Linter (`npm run lint`) 100% limpos.
5. **Ação Obrigatória:** Executar `git push origin` com os commits da Fase 4.

---

### FASE 5: ASSISTENTE PROATIVO NA HOME & APRENDIZADO ATIVO

**Objetivo:** Levar os insights para a Visão Geral em um microcard com ações de 1 toque, política de discrição antirruído, permitindo confirmar rendas e ensinar o motor a calibrar sua precisão.

#### Tarefas da Fase 5:
- [ ] **Tarefa 5.1 — Hook Unificado `useSmartAdvisorInsights` com Política de Cooldown:**
  - Criar `src/features/overview/hooks/use-smart-advisor-insights.ts` cruzando despesas, rendas, orçamentos, feedback do usuário e histórico de dismiss.
  - **Matriz de Prioridade:**
    1. *Crítica:* Cobrança duplicada ou conta esquecida com risco de juros.
    2. *Entrada:* Renda habitual prevista pronta para confirmação em 1 clique.
    3. *Economia:* Oportunidade de corte de assinatura ou reajuste de preço.
    4. *Calibração:* Pergunta simples para ensinar o motor.
  - **Regra de Discrição:** Limite estrito de no máximo 1 insight por dia; se dispensado, silenciar aquele tema por 30 dias; se o mês estiver regular, card fica 100% oculto.
  - *Teste & Verificação:* Testes de hook simulando cooldown, dismiss e ordenação por criticidade.
  - *Commit:* `feat(overview): criar hook de insights proativos com politica de cooldown e discricao`

- [ ] **Tarefa 5.2 — Componente `SmartAdvisorCard` na Home:**
  - Criar `src/components/modules/smart-advisor-card.tsx` respeitando as regras do Design System:
    - Borda canônica `border-border/80 bg-surface shadow-xs`.
    - Ícones temáticos `lucide-react` da escala `size-4`.
    - Zero emojis.
    - Botão de ação de 1 toque para confirmar renda com Toast de reversão.
    - Botões de feedback de aprendizado: `[Sim, monitorar]` / `[Não, foi pontual]`.
    - Botão sutil de dispensar (`[Dispensar por 30 dias]`).
  - *Teste & Verificação:* Testes de renderização nos 4 estados e disparo sensorial (`triggerSensory`).
  - *Commit:* `feat(modules): criar componente SmartAdvisorCard com acoes de 1 toque e dismiss`

- [ ] **Tarefa 5.3 — Persistência do Feedback do Usuário:**
  - Conectar as respostas de calibração à tabela `insight_feedback` via Supabase/RPC, garantindo que o motor recalcule imediatamente e elimine falsos positivos para aquele usuário.
  - *Teste & Verificação:* Testes de integração da mutation de feedback.
  - *Commit:* `feat(insights): persistir feedback de aprendizado ativo do usuario`

- [ ] **Tarefa 5.4 — Atalho Rápido de Aporte do Mês na Home:**
  - No bloco de Investimentos da Home, adicionar campo rápido para informar o valor do aporte e navegar diretamente para a aba de execução em lote do rebalanceamento (`/investments?tab=aporte&valor=...`).
  - *Teste & Verificação:* Teste de navegação e pré-carregamento do valor na `AporteTab`.
  - *Commit:* `feat(overview): adicionar acao rapida de aporte mensal direcionado`

- [ ] **Tarefa 5.5 — Atualização da Documentação Canônica em `docs/`:**
  - Atualizar `docs/ARCHITECTURE.md`, `docs/PROJECT_STRUCTURE.md` e `docs/ROADMAP.md` documentando os novos fluxos de captura nativa e motor proativo.
  - *Teste & Verificação:* Revisão de congruência da documentação técnica.
  - *Commit:* `docs: registrar arquitetura de captura de comprovantes e assistente proativo`

#### PORTÃO DE QUALIDADE 5 (Quality Gate 5 / DoD Final):
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
| **Aprendizado de CNPJ e Nome Fantasia** | CNPJ burocrático vira nome amigável ("Arcos Dourados" ➔ "McDonald's") em comprovantes e push | Teste unitário em `merchant-memory.test.ts` |
| **Deduplicação Comprovante $\leftrightarrow$ Push** | Notificação que chega 45s após o comprovante é descartada sem duplicar lançamento | Teste unitário em `suggestions-store.test.ts` |
| **Lançamento Rápido** | Cadastro de despesa concluído em $\le 3$ segundos na tela única | Interação manual e teste com `StepQuick` |
| **Detecção de Salário/Renda** | Renda prevista surge na data típica e é confirmada em 1 clique | Teste unitário em `recurrences.test.ts` |
| **Gastos Vampiros & Anomalias** | Cobrança duplicada gera alerta imediato na Home com economia anual calculada | Teste unitário e renderização no `SmartAdvisorCard` |
| **Governança de Código** | Zero emojis, TypeScript estrito, DRY respeitado e commits por tarefa | `npm run typecheck && npm run lint && npm run test` |
