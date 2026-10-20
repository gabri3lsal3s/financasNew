# PLANO DE IMPLEMENTAÇÃO — ASSISTENTE PASSIVO DE COMPRAS & CARTEIRAS DIGITAIS

> **Documento Canônico de Arquitetura e Engenharia**  
> **Status:** Aprovado para Execução · **Alinhamento:** Decisões D1–D5 do `/grill-me`  
> **Módulos Afetados:** `src/domain/notifications/`, `src/services/native/`, `android/`, `src/features/settings/`, `src/components/modules/`, `public/pwa/`  
> **Data:** Outubro de 2026 · **Ambiente:** Android Nativo (Capacitor) & PWA Web  

---

## 1. SUMÁRIO EXECUTIVO & DIAGNÓSTICO DE FRAGILIDADES

O **Assistente Passivo de Compras & Notificações Bancárias** é o componente responsável por transformar eventos financeiros do sistema operacional (notificações push de compras, transferências, comprovantes Pix compartilhados e ordens de corretoras) em lançamentos organizados com zero atrito manual.

A auditoria de código de ponta a ponta identificou as seguintes fragilidades críticas na implementação atual:

### 1.1 Diagnóstico Técnico de Falhas

1. **Restrição de Package Visibility (Android 11+ / API 30+):**
   - *Causa:* O método `pm.getPackageInfo(pkg, 0)` em `BankNotificationPlugin.java` lança `NameNotFoundException` para pacotes ausentes na tag `<queries>` de `android/app/src/main/AndroidManifest.xml`.
   - *Impacto:* Bancos e carteiras como **Rico**, **Binance**, **Google Wallet / Carteira Google**, **Samsung Pay** e versões corporativas/investimentos não são detectados, gerando falsos negativos no dispositivo do usuário.
2. **Incompletude e Desalinhamento do Catálogo:**
   - `BANK_PACKAGES` (Java), `BANK_NAME_TO_PACKAGES` (TS), `HOMOLOGATED_BANKS` (TS) e `BANK_PACKAGE_MAP` (TS) possuem divergências de mapeamento (ex.: `com.btgpactual.investimentos` era colapsado sob o nome de banking tradicional, e corretoras como Rico e Binance não existiam).
3. **Poluição Visual e Efeito "Ruído de 17 Cards Desconhecidos":**
   - Por padrão, `DEFAULT_BANK_ASSISTANT_PREFERENCES.monitoredBanks` inicializava com **todos** os 17 bancos do catálogo marcados como monitorados.
   - A interface em `NotificationsTab.tsx` renderizava indiscriminadamente todos os bancos do catálogo em um grid estático, obrigando o usuário que utiliza 2 ou 3 instituições a visualizar e desmarcar manualmente dezenas de opções que sequer possui instaladas.
4. **Colisão e Duplicação entre Carteiras Digitais e Bancos Emissores:**
   - Compras por aproximação via **Google Pay** ou **Samsung Pay** disparam duas notificações simultâneas (uma da carteira e outra do cartão emissor, como Nubank ou Itaú).
   - O algoritmo atual de chave unívoca (`getSuggestionCompositeKey`) inclui `bankName` na assinatura (`bank_amount_date_merchant`). Como "Google Wallet" $\neq$ "Nubank", o sistema gerava duas sugestões duplicadas para o mesmo gasto.
5. **Tipagem Rígida e Blacklist Restritiva de Investimentos:**
   - O parser descartava termos financeiros válidos de investimentos (regex de CDB em blacklist semântica) e sua tipagem admitia exclusivamente `"expense" | "income"`, impossibilitando o roteamento inteligente de proventos, aportes e ordens executadas de corretoras (Binance, Rico, BTG Investimentos, XP).
6. **Ausência de Web Share Target no PWA:**
   - O arquivo `public/pwa/manifest.webmanifest` não declarava `share_target`, inviabilizando o recebimento de comprovantes bancários compartilhados via menu nativo do Android diretamente para o aplicativo PWA.
7. **Fricção Ergonômica no Card da Home:**
   - O `PendingSuggestionsCard` oferecia apenas "Conferir e Salvar", que abre a janela modal completa de formulário, gerando fricção desnecessária em despesas corriqueiras onde a categoria já foi inferida com alta precisão.

---

## 2. DIRETRIZES DE ARQUITETURA E DECISÕES CANÔNICAS (GRILL-ME)

Com base nas decisões alinhadas no refinamento técnico, a nova arquitetura do assistente passivo obedece aos seguintes pilares:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                        ARQUITETURA DO ASSISTENTE PASSIVO                       │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
           ┌────────────────────────────┴────────────────────────────┐
           ▼                                                         ▼
┌──────────────────────┐                                  ┌──────────────────────┐
│    ANDROID NATIVO    │                                  │       PWA WEB        │
│  NotificationListener│                                  │   Web Share Target   │
│  & Package Visibility│                                  │   & Paste Area       │
└──────────┬───────────┘                                  └──────────┬───────────┘
           │                                                         │
           └────────────────────────────┬────────────────────────────┘
                                        ▼
                         ┌──────────────────────────────┐
                         │   DOMAIN: PARSER & ENGINE    │
                         │   - Semantic Normalization   │
                         │   - Fuzzy Deduplication      │
                         │   - Institution Categorizer  │
                         └──────────────┬───────────────┘
                                        ▼
                         ┌──────────────────────────────┐
                         │      SUGGESTIONS STORE       │
                         │   - 5-Min Temporal Window    │
                         │   - Wallet-to-Issuer Merge   │
                         └──────────────┬───────────────┘
                                        │
           ┌────────────────────────────┴────────────────────────────┐
           ▼                                                         ▼
┌──────────────────────────────┐                          ┌──────────────────────────────┐
│     FLUXO DE CAIXA (HOME)    │                          │      CARTEIRA (APORTE)       │
│  - 1-Click Quick Add         │                          │  - Aportes / Proventos       │
│  - Badge Inline de Categoria │                          │  - Ordens de Cripto/Ações    │
│  - Toast com Desfazer (5s)   │                          │  - Roteamento Dedicado       │
└──────────────────────────────┘                          └──────────────────────────────┘
```

1. **UX Despoluída:** Na aba de configurações, os bancos detectados no aparelho aparecem no topo com ativação imediata. Os demais ficam organizados em um Accordion colapsável dividido em 3 categorias:
   - *Bancos Tradicionais & Digitais* (Nubank, Itaú, BB, Bradesco, Santander, Inter, C6, Caixa, etc.)
   - *Carteiras Digitais & Pagamentos* (Google Pay, Samsung Pay, Mercado Pago, PicPay, PagBank)
   - *Investimentos & Cripto* (BTG Investimentos, Rico, XP, Binance, Nomad, Wise)
2. **Fusão Inteligente por Janela Temporal (Fuzzy Matching):** Janela temporal de 5 minutos unifica notificações de Google/Samsung Pay e do banco emissor, adotando o cartão emissor como autoridade e descartando duplicatas.
3. **Triagem Híbrida de Investimentos:** Distinção entre compras no cartão de corretora (Despesa de Fluxo de Caixa) e aportes/depósitos/proventos (Módulo de Investimentos / Carteira).
4. **Ergonomia Máxima (1-Clique + Desfazer):** Ação direta no card da Home para confirmação instantânea em 1 toque, com seletor inline de categoria e Toast de reversão em 5 segundos.
5. **Simetria PWA e Exclusividades Android:** Suporte a `share_target` no PWA manifest, zona de colar texto de comprovante na web e *Quick Settings Tile* ("+ Despesa") na cortina do Android.

---

## 3. PLANO DE EXECUÇÃO DETALHADO POR FASES

### FASE 1: AUDITORIA NATIVA, PACKAGE VISIBILITY & CORREÇÃO DO DETECTOR DE APPS

**Objetivo:** Garantir a detecção fidedigna de 100% dos aplicativos bancários, carteiras e corretoras instalados no Android 11, 12, 13, 14 e 15.

#### Tarefas Granulares:
- [x] **1.1. Atualização do `AndroidManifest.xml` (`<queries>`):**
  - Declarar as assinaturas completas de pacotes para todas as instituições homologadas:
    * *Google Wallet:* `com.google.android.apps.walletnfcrel`
    * *Samsung Pay / Wallet:* `com.samsung.android.spay`, `com.samsung.android.raja.spay`
    * *Rico:* `br.com.rico`, `br.com.rico.investimentos`
    * *Binance:* `com.binance.dev`
    * *BTG Pactual Banking:* `com.btg.pactual.banking`
    * *BTG Investimentos:* `com.btgpactual.investimentos`
    * *XP Investimentos:* `br.com.xp.carteira`, `com.xpinc.investments`
    * *Nomad:* `com.nomadfinancial.app`
    * *Wise:* `com.transferwise.android`
    * *Mercado Pago:* `com.mercadopago.wallet`
    * *Nubank, Itaú, Bradesco, Santander, BB, Inter, C6, Caixa, PicPay, PagBank, Neon, Next, Sicoob, Sicredi, Safra, Ton, Stone*.
- [x] **1.2. Refatoração de `BankNotificationPlugin.java`:**
  - Atualizar a tabela `BANK_PACKAGES` diferenciando nomes institucionais (separar "BTG Pactual" de "BTG Investimentos", cadastrar "Rico", "Binance", "Carteira Google", "Samsung Pay").
  - Otimizar o método `getInstalledBankingApps`:
    * Implementar checagem defensiva de pacotes com fallback para `getLaunchIntentForPackage`.
    * Retornar metadados enriquecidos: `packageName`, `bankName`, `category` (`bank`, `wallet`, `broker`).
- [x] **1.3. Atualização de `BankNotificationListenerService.java`:**
  - Incluir os novos pacotes na lista padrão `DEFAULT_MONITORED_PACKAGES`.
  - Expandir os filtros heurísticos de pré-validação (`hasFinancialSignal`) para reconhecer vocabulário de corretoras: `depósito`, `ordem`, `executada`, `cripto`, `dividendo`, `rendimento`, `investimento`.
- [x] **1.4. Atualização de Contratos no Domínio (`src/domain/notifications/preferences.ts`):**
  - Atualizar a constante `HOMOLOGATED_BANKS` e introduzir a estrutura tipada categorizada:
    ```typescript
    export type InstitutionCategory = "traditional_digital" | "payment_wallets" | "investments_crypto";
    
    export interface HomologatedInstitution {
      id: string;
      name: string;
      category: InstitutionCategory;
      packages: string[];
      supportsCardPurchases: boolean;
      supportsInvestments: boolean;
    }
    ```
  - Ajustar o fallback de `DEFAULT_BANK_ASSISTANT_PREFERENCES` para que em novas instalações a lista `monitoredBanks` inicie vazia ou vinculada aos apps instalados detectados, evitando o ruído de ativar tudo cegamente.

#### Quality Gate 1:
- **Testes Unitários:** Executar e aprovar a suíte de testes de preferências e detecção de pacotes (`npm run test -- preferences.test.ts`).
- **Verificação Android:** Compilar o projeto Android via Gradle (`./gradlew assembleDebug`) sem erros de manifesto ou permissão.
- **Validação de Pacotes:** Garantir que o comando nativo retorna corretamente apps instalados no emulador ou device de teste.
- **Lint & Formatação:** Código Java e TypeScript 100% compliant sem warnings (`npm run lint`).
- **Commit Canônico:** `fix(notifications): expand package visibility queries and homologated apps detector`.

---

### FASE 2: EXPANSÃO DE PARSERS, CARTEIRAS DIGITAIS, CRIPTO & DESDUPLICAÇÃO TEMPORAL

**Objetivo:** Enriquecer o motor semântico para suportar carteiras de pagamento, ativos e criptoativos, eliminando duplicidades por aproximação NFC.

#### Tarefas Granulares:
- [x] **2.1. Parser para Carteiras Digitais (`Google Wallet` e `Samsung Pay`):**
  - Mapear padrões de notificação de NFC:
    * Google Pay: `"Compra de R$ XX,XX em Estabelecimento Y com Cartão Banco Z final 1234"`.
    * Samsung Pay: `"Pagamento aprovado: R$ XX,XX em Estabelecimento Y"`.
  - Extrair metadados do cartão emissor subjacente diretamente do texto da carteira.
- [x] **2.2. Parser para Corretoras e Cripto (`Binance`, `Rico`, `Nomad`, `BTG Investimentos`):**
  - Remover a proibição indevida de investimentos na blacklist semântica.
  - Implementar parsers dedicados:
    * *Binance:* depósitos BRL via Pix, ordens de compra/venda Spot, transferências de cripto.
    * *Rico / XP:* proventos recebidos (dividendos/JCP), depósitos para investimento, notas de corretagem.
    * *Nomad:* transações em moeda estrangeira (conversão USD -> BRL com cotação e IOF detectados), compras no débito internacional.
    * *BTG Investimentos:* aportes em fundos/renda fixa, liquidação de títulos.
- [x] **2.3. Tipagem Expandida no Domínio (`ParsedBankTransaction`):**
  - Expandir o modelo de dados:
    ```typescript
    export type TransactionNature = "expense" | "income" | "investment";
    export type InvestmentSubtype = "contribution" | "dividend" | "trade" | "redemption";

    export interface ParsedBankTransaction {
      id: string;
      bankName: string;
      nature: TransactionNature;
      type: "expense" | "income"; // Compatibilidade retroativa
      investmentSubtype?: InvestmentSubtype;
      amountCents: number;
      currency?: "BRL" | "USD";
      description: string;
      date: string;
      paymentMethod?: PaymentMethod;
      cardLastDigits?: string;
      merchant?: string;
      categorySlug?: string;
      rawText: string;
      timestamp: number;
    }
    ```
- [x] **2.4. Motor de Fusão Temporal e Deduplicação Inteligente (`suggestions-store.ts`):**
  - Implementar janela de tolerância de 5 minutos ($300.000\text{ ms}$) em `addPendingSuggestion`:
    * Se chegar notificação de carteira digital e dentro de 5 minutos chegar a do banco emissor com mesmo valor ($\pm 0$ centavos) e estabelecimento compatível, fazer o *merge* atribuindo a transação ao banco oficial e mantendo a bandeira do cartão.
    * Se a do banco chegar primeiro, rejeitar a notificação subsequente da carteira como duplicata.
  - Adicionar testes de estresse contra *race conditions* de notificações concorrentes.

#### Quality Gate 2:
- **Testes Unitários:** Matriz de testes de parsing (`bank-parser.test.ts` e `bank-e2e-matrix.test.ts`) cobrindo 100% dos novos templates de notificação (Google Pay, Samsung Pay, Binance, Rico, Nomad, BTG).
- **Testes de Deduplicação:** Teste de colisão temporal em `suggestions-store.test.ts` simulando a chegada de Google Pay + Nubank em intervalos de 500ms a 4 minutos.
- **Pureza de Domínio:** Verificar ausência estrita de imports de UI ou banco em `src/domain/notifications/`.
- **Commit Canônico:** `feat(notifications): add digital wallets, crypto parsers and fuzzy temporal deduplication`.

---

### FASE 3: REFINAMENTO DE UX/UI, DESPOLUIÇÃO VISUAL & ADIÇÃO RÁPIDA ERGONÔMICA

**Objetivo:** Transformar a experiência de uso eliminando poluição visual nas configurações e oferecendo lançamento em 1-clique com total controle e segurança contra erros.

#### Tarefas Granulares:
- [x] **3.1. Redesenho da Aba de Notificações (`NotificationsTab.tsx`):**
  - **Seção Superior — "Aplicativos no seu Dispositivo":**
    * Exibir exclusivamente os aplicativos detectados como instalados no aparelho móvel.
    * Card compacto com status individual ativo/inativo, badge institucional e ação "Monitorar todos os instalados".
    * Se nenhum app detectado (ou em ambiente Web/PWA), exibir mensagem contextual clara e amigável.
  - **Seção Inferior — Accordion do Catálogo Geral:**
    * Componente colapsável discreto: *"Explorar catálogo completo (25+ instituições financeiras)"*.
    * Subdividido em 3 grupos limpos:
      1. Bancos Digitais e Tradicionais
      2. Carteiras de Pagamento (Google Pay, Samsung Pay, PicPay, etc.)
      3. Corretoras e Cripto (BTG, Rico, XP, Binance, Nomad, Wise)
    * Campo de busca instantânea no catálogo para localização rápida.
- [x] **3.2. Botão de Ação Rápida de 1-Clique no `PendingSuggestionsCard.tsx`:**
  - Adicionar botão primário **"Salvar Rápido"** ao lado de **"Revisar"**:
    * Renderiza o badge da categoria inferida com ícone semântico.
    * Badge de categoria clicável inline para troca rápida sem abrir o modal completo.
    * Ao acionar "Salvar Rápido", executa mutação direta no Supabase em segundo plano com feedback tátil suave (`triggerSensory("success")`).
  - **Toast de Desfazer (Undo):**
    * Exibe toast: *"Despesa de R$ 42,90 salva em Alimentação"* com botão acionável *"Desfazer"* ativo por 5 segundos.
    * Se o usuário acionar "Desfazer", a transação é removida e a notificação retorna imediatamente à fila de sugestões.
- [x] **3.3. Roteamento Inteligente de Investimentos:**
  - Quando a sugestão for do tipo `nature: "investment"`, o card exibe ações adaptadas:
    * Botão primário: *"Registrar Aporte / Provento"* (direciona para `/investimentos` com parâmetros preenchidos).
    * Botão secundário: *"Salvar como Despesa/Renda"*.
- [x] **3.4. Governança DRY & Design System:**
  - Utilizar estritamente os tokens canônicos (`border-border/80 bg-surface shadow-xs`).
  - Respeitar a proibição de emojis: utilizar exclusivamente ícones `lucide-react` com `aria-hidden`.
  - Zero uso de `truncate` em valores monetários (`<MoneyText />` adaptativo).

#### Quality Gate 3:
- **Testes de Componentes:** Testes unitários com React Testing Library para `NotificationsTab.test.tsx` e `PendingSuggestionsCard.test.tsx`.
- **Acessibilidade:** Checagem de navegação por teclado (`Tab`, `Enter`, `Space`) e leitores de tela (`aria-label`, `role="region"`).
- **Design System Audit:** Validação dos tokens CSS e conformidade total com o `DESIGN_SYSTEM.md`.
- **Commit Canônico:** `feat(ui): redesign bank assistant settings and add 1-click quick add with undo toast`.

---

### FASE 4: RECURSOS EXCLUSIVOS ANDROID, WEB SHARE TARGET PWA & QUALIDADE INTEGRADA

**Objetivo:** Maximizar a agilidade do usuário no ecossistema Android nativo e conferir paridade funcional ao PWA via padrões web modernos.

#### Tarefas Granulares:
- [x] **4.1. Configuração do Web Share Target no PWA (`manifest.webmanifest`):**
  - Declarar a rota de recebimento de comprovantes no manifest:
    ```json
    "share_target": {
      "action": "/share-target",
      "method": "GET",
      "params": {
        "title": "title",
        "text": "text",
        "url": "url"
      }
    }
    ```
  - Criar o manipulador de rota `/share-target` que extrai o texto do comprovante Pix, submete ao `processPixShare` e redireciona suavemente para a tela inicial com a sugestão pronta para salvamento.
- [x] **4.2. Área de "Colar Comprovante / Notificação" (Fallback Web/PWA):**
  - Implementar componente ergonômico acessível na tela inicial ou modal de transações permitindo ao usuário colar o texto de qualquer notificação bancária ou comprovante Pix para conversão automática em sugestão.
- [x] **4.3. Quick Settings Tile para Android Nativo:**
  - Criar o serviço `QuickExpenseTileService.java` herdando de `android.service.quicksettings.TileService`.
  - Registrar no `AndroidManifest.xml` com o ícone de moeda e rótulo "Lançar Despesa".
  - Ao ser tocado na barra de status do Android, abre diretamente o aplicativo com o modal de novo gasto ativo.
- [x] **4.4. Testes de Integração e Build de Produção:**
  - Validação da cadeia completa de testes:
    * `npm run test` (testes unitários e de integração verdes).
    * `npm run typecheck` (`tsc --noEmit` sem qualquer erro de tipagem).
    * `npm run lint` (zero violações de ESLint e sem caracteres decorativos proibidos).
    * `./gradlew assembleDebug` e `./gradlew assembleRelease` (geração íntegra dos pacotes APK do Android).

#### Quality Gate 4:
- **Testes Ponta a Ponta:** Validação do fluxo completo de compartilhamento de texto, recepção de notificação e adição rápida.
- **Documentação Atualizada:** Atualização obrigatória dos arquivos `docs/ARCHITECTURE.md`, `docs/ROADMAP.md` e `docs/PWA_GUIDELINES.md`.
- **Commit Canônico:** `feat(android-pwa): add web share target, quick settings tile and full verification`.

---

## 4. MATRIZ DE COBERTURA DE INSTITUIÇÕES & TEMPLATES HOMOLOGADOS

A tabela a seguir define a matriz técnica de cobertura integral após a conclusão do plano:

| Instituição Financeira | Categoria | Pacotes Android Identificados | Tipos de Operação Reconhecidas |
|---|---|---|---|
| **Nubank** | Banco Digital | `com.nu.production` | Compras Cartão (Crédito/Débito), Pix Enviado/Recebido, Boletos |
| **Itaú / Personnalité** | Banco Tradicional | `com.itau`, `com.itau.personnalite` | Compras Cartão, Pix, TED, Débito em Conta |
| **Bradesco / Next** | Banco Tradicional | `com.bradesco`, `br.com.bradesco.next` | Compras Cartão, Pix, Avisos de Conta |
| **Santander** | Banco Tradicional | `com.santander.app`, `br.com.santander.way` | Compras Way, Pix, Débito em Conta |
| **Banco do Brasil** | Banco Tradicional | `br.com.bb.android` | Compras Ourocard, Pix, Salário Recebido |
| **Inter** | Banco Digital | `br.com.intermedium` | Compras Inter Mastercard, Pix, Cashback |
| **C6 Bank** | Banco Digital | `com.c6bank.app` | Compras C6 Carbon, Pix, Átomos |
| **Caixa / Caixa Tem** | Banco Tradicional | `br.com.gabba.Caixa`, `br.gov.caixa.tem` | Benefícios, Pix, Compras Elo/Visa |
| **Mercado Pago** | Carteira Digital | `com.mercadopago.wallet` | Pagamentos QR Code, Linha de Crédito, Pix, Cartão MP |
| **PicPay** | Carteira Digital | `com.picpay` | Pagamentos de Amigos, Compras Card, Pix |
| **PagBank** | Carteira Digital | `br.com.uol.ps`, `br.com.uol.ps.myaccount` | Vendas maquininha, Compras Cartão, Pix |
| **Google Wallet** | Carteira de Pagamento | `com.google.android.apps.walletnfcrel` | Pagamentos NFC por Aproximação (Fuzzy deduplication) |
| **Samsung Pay / Wallet** | Carteira de Pagamento | `com.samsung.android.spay`, `com.samsung.android.raja.spay` | Pagamentos por Aproximação e MST |
| **BTG Pactual Banking** | Banco / Investimentos | `com.btg.pactual.banking` | Compras Cartão Black, Pix, Movimentações de Conta |
| **BTG Investimentos** | Investimentos | `com.btgpactual.investimentos` | Aportes em Fundos/Renda Fixa, Liquidação de Ativos |
| **XP Investimentos** | Investimentos | `br.com.xp.carteira`, `com.xpinc.investments` | Cartão XP Visa Infinite, Proventos, Aportes |
| **Rico** | Investimentos | `br.com.rico`, `br.com.rico.investimentos` | Cartão Rico, Proventos, Transferências para Aporte |
| **Binance** | Criptomoedas | `com.binance.dev` | Depósitos BRL Pix, Ordens Executadas (Cripto), Saques |
| **Nomad** | Conta Global / Invest. | `com.nomadfinancial.app` | Compras Débito USD, Câmbio BRL/USD, Aportes Stocks |
| **Wise** | Conta Global | `com.transferwise.android` | Compras Multimoeda, Conversões de Moeda, Transferências |

---

## 5. REGRAS DE GOVERNANÇA, QUALIDADE & DEFINITION OF DONE (DoD)

Para que qualquer etapa do plano seja considerada concluída, as seguintes condições contratuais devem ser satisfeitas:

1. **Zero Emojis ou Caracteres Decorativos:** Toda a interface e mensagens de toast/erro devem obedecer à regra ESLint local `local/no-decorative-unicode`.
2. **Online First Estrito:** Nenhuma escrita composta ou transação é orquestrada de forma ingênua no cliente. Validações nas bordas com RPCs do Supabase e rollback seguro.
3. **Resiliência a Falhas de Rede:** Operações de 1-clique verificam conectividade (`navigator.onLine`). Em caso de falha, a sugestão permanece intacta na fila e emite feedback claro de tentativa posterior.
4. **Colocalização de Testes Vitest:** Todo arquivo de domínio novo ou modificado deve possuir seu respectivo `*.test.ts` com cobertura de 100% de cenários de sucesso, erro e casos limites (*edge cases*).
5. **Git Flow Padronizado:** Commits estruturados com padrão Conventional Commits, atômicos e devidamente tipados.
