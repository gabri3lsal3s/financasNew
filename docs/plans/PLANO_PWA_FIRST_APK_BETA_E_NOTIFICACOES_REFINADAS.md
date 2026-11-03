# Plano Detalhado de Implementação: PWA First, APK Beta Opcional & Blindagem do Leitor de Notificações Bancárias

> **Status:** Documento Canônico de Planejamento e Especificação Técnica (Revisão v1.0)  
> **Escopo:** Landing Page comercial, Guia de Instalação de APK sem atrito, Camada Nativa Android (Java), Motor de Domínio Financeiro (TypeScript) e Configurações In-App da Plataforma.  
> **Objetivo:**
> 1. Posicionar o **PWA** como produto oficial primário e universal na comunicação, vendas e onboarding;
> 2. Rotular o APK Android como **"Beta Opcional para Android"** para usuários que desejam automações nativas em 2º plano;
> 3. Eliminar a resistência e o atrito dos alertas de segurança do Android através de um guia visual interativo de instalação com saída facilitada para PWA;
> 4. Eliminar falsos positivos em notificações de bancos (anúncios, ofertas de empréstimo e limites pré-aprovados sendo catalogados indevidamente como despesa);
> 5. Aprimorar o suporte a bancos internacionais (Nomad, Wise) com ponto decimal e moedas estrangeiras, e a carteiras digitais (Carteira Google, Samsung Pay) com deduplicação temporal inteligente.

---

## 1. Painel Geral de Progresso (Checklist Consolidado)

| Fase | Descrição | Status | Tarefas Concluídas | Portão de Qualidade |
|---|---|:---:|:---:|:---:|
| **Fase 0** | Diagnóstico Aprofundado de Fragilidades, Riscos e Especificação Técnica | Concluído | 4 / 4 | QG-0 Aprovado |
| **Fase 1** | Motor Nativo Android (Java): Moedas Globais, Fato Consumado & Carteiras | Concluído | 5 / 5 | QG-1 Aprovado |
| **Fase 2** | Domínio TypeScript: Parser Universal, Anti-Fallback e Deduplicação Temporal | Concluído | 5 / 5 | QG-2 Aprovado |
| **Fase 3** | UX/UI: Diálogo Interativo de Instalação Sem Atrito do APK & Saída PWA | Pendente | 0 / 4 | QG-3 Pendente |
| **Fase 4** | Posicionamento Comercial: Landing Page, FAQ e Identificação In-App | Pendente | 0 / 5 | QG-4 Pendente |
| **Fase 5** | Homologação Integrada, Bateria de Testes E2E e Portão de Qualidade Final (DoD) | Pendente | 0 / 4 | QG-Final Pendente |

---

## 2. Diagnóstico Técnico de Fragilidades, Bugs e Gargalos

A auditoria de engenharia no código atual revelou **5 fragilidades arquiteturais críticas**:

### 2.1. O Bug do Ponto Decimal em Bancos Globais (Nomad e Wise)
- **Localização:** `BankNotificationListenerService.java` (L30-32)
- **Problema:** A expressão regular de quantia monetária exige estritamente vírgula (`,`) antes dos dois dígitos de centavos:
  ```java
  private static final Pattern AMOUNT_PATTERN = Pattern.compile(
      "(?:R\\$\\s*|US\\$\\s*|USD\\s*)(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+(?:,\\d{2})?)"
  );
  ```
- **Consequência:** Notificações do Nomad ou Wise como `"Compra aprovada: US$ 15.50 em Starbucks"` ou `"Purchase of $45.00 approved"` retornam `null` em `extractAmountText`.
- **Efeito cascata:** A linha 182 descarta silenciosamente a notificação antes mesmo de avaliar qualquer dado financeiro.

### 2.2. A Fragilidade do Fallback Cego para Despesa (`bank-parser.ts`)
- **Localização:** `bank-parser.ts` (L910-960 e L1295-1298)
- **Problema:** A função `detectTransactionType` avalia apenas se a mensagem é receita (`incomeKeywords`). Se não encontrar termos de renda, assume cegamente:
  ```ts
  const txType = detectTransactionType(text, title);
  return { nature: txType === "income" ? "income" : "expense" };
  ```
- **Consequência:** Se o banco enviar uma notificação de marketing ou oferta de empréstimo não bloqueada pela blacklist (ex.: *"Gabriel, você tem R$ 10.000,00 de crédito pré-aprovado para contratar agora"* ou *"Aproveite o limite extra de R$ 1.500,00"*), o sistema não a reconhece como receita e a converte automaticamente em uma **DESPESA de R$ 10.000,00**!
- **Impacto UX:** O usuário recebe um push de transação detectada sugerindo salvar uma despesa inexistente, causando alarme e desconfiança imediata.

### 2.3. Validação Frágil de "Fato Consumado" no Sinal Financeiro Nativo
- **Localização:** `BankNotificationListenerService.java` (L363-420)
- **Problema:** O método `hasFinancialSignal` aceita qualquer notificação que contenha `"r$"` e uma palavra de canal como `"crédito"`, `"cartão"` ou `"limite"`.
- **Consequência:** Propagandas de cartões ou propostas de crédito como *"Use seu cartão e ganhe desconto na loja parceira para compras acima de R$ 200,00"* passam pelo filtro, pois contêm o token `"cartão"` e `"r$"`.

### 2.4. Atrito Psicológico e Bloqueios no Download do APK
- **Localização:** Fluxo de distribuição web e landing page.
- **Problema:** Ao baixar o arquivo `.apk`, navegadores como Google Chrome exibem o aviso em vermelho *"O arquivo pode ser nocivo"*, seguido do bloqueio padrão do Android *"Seu telefone não tem permissão para instalar apps dessa fonte"* e avisos do Play Protect.
- **Consequência:** Usuários leigos desistem da instalação acreditando que o aplicativo contém vírus ou é inseguro, sem saber que poderiam utilizar 100% da plataforma sem nenhum download através do PWA.

### 2.5. Duplicidade Entre Carteiras Digitais e Bancos Emissores
- **Localização:** `suggestions-store.ts`
- **Problema:** Ao pagar por aproximação usando Carteira Google ou Samsung Pay vinculada a um cartão Nubank/Itaú, o celular frequentemente emite duas notificações simultâneas (uma da Carteira e outra do Banco emissor).
- **Consequência:** Se a chave de deduplicação não reconciliar os pacotes no mesmo segundo, o usuário recebe duas sugestões da mesma compra.

---

## 3. Arquitetura Alvo das Melhorias

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PIPELINE DE VALIDAÇÃO REFINADO                       │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Checagem de Pacote Autorizado (Allowed Bank Packages)               │
│ 2. Extração Universal de Moeda (R$, US$, USD, $, €, EUR com , e .)    │
│ 3. Blacklist Estrita Anti-Marketing / Ofertas / Empréstimos / Limites  │
│ 4. Trava de "Fato Consumado" (Exige termos de pagamento/débito real)   │
│ 5. Classificação Semântica Anti-Fallback (Retorna null em ambiguidade) │
│ 6. Deduplicação com Janela Temporal (Reconciliação Carteira vs Banco)  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Fases Detalhadas de Execução

---

### Fase 1: Motor Nativo Android (Java) — Moedas Globais, Fato Consumado & Carteiras

#### Objetivos
- Suporte a moedas internacionais e separador decimal por ponto (`.`) e vírgula (`,`).
- Eliminar o vazamento de notificações promocionais e de empréstimos.
- Suporte refinado aos pacotes da Carteira Google e Samsung Wallet.

#### Tarefas de Implementação

- [x] **Tarefa 1.1:** Atualizar regex `AMOUNT_PATTERN` em `BankNotificationListenerService.java`
  - Modificar o padrão para aceitar símbolos `R$`, `US$`, `USD`, `$`, `€`, `EUR` e tanto ponto quanto vírgula nos centavos:
    ```java
    private static final Pattern AMOUNT_PATTERN = Pattern.compile(
        "(?i)(?:R\\$|US\\$|USD|\\$|EUR|€)\\s*(\\d{1,3}(?:[.,]\\d{3})*[.,]\\d{2}|\\d+(?:[.,]\\d{2})?)"
    );
    ```
- [x] **Tarefa 1.2:** Ampliar `BLACKLIST_MARKETING_PATTERN` em `BankNotificationListenerService.java`
  - Incluir termos específicos de empréstimos, créditos fáceis, limites e campanhas:
    ```java
    "simule|contrate|contratar|dispon[íi]vel\\s+para\\s+voc[êe]|empr[ée]stimo\\s+pessoal|" +
    "cr[ée]dito\\s+f[áa]cil|dinheiro\\s+r[áa]pido|taxas\\s+a\\s+partir|desconto\\s+de|" +
    "cupom|cashback\\s+de\\s+at[ée]|limite\\s+emergencial|pr[ée]-aprovado|pr[ée]\\s+aprovado|" +
    "aumente\\s+seu\\s+limite|solicite\\s+seu|cart[ãa]o\\s+aprovado"
    ```
- [x] **Tarefa 1.3:** Blindar a trava de `hasFinancialSignal` em `BankNotificationListenerService.java`
  - Exigir que a notificação contenha um verbo ou locução de **operação financeira consumada** (ex.: `"compra aprovada"`, `"pagamento realizado"`, `"debitado"`, `"transferência enviada"`, `"pix recebido"`, `"recebido"`).
  - Bloquear mensagens com teor apenas condicional ou indicativo (ex.: `"parcele em até"`, `"use seu cartão e ganhe"`).
- [x] **Tarefa 1.4:** Atualizar pacotes monitorados da Carteira Google e Samsung
  - Garantir a presença de `com.google.android.apps.walletnfcrel`, `com.google.android.gms` (filtrado por sinais de pagamento NFC) e `com.samsung.android.app.spay`.
- [x] **Tarefa 1.5:** Criar novos testes unitários JUnit em `BankNotificationListenerServiceTest.java`
  - Testar parsing de Nomad (`US$ 15.50`, `$ 42.00`).
  - Testar descarte de ofertas de empréstimo (`"Você tem R$ 5.000,00 de empréstimo pré-aprovado"` -> descartada).
  - Testar aprovação de compras da Carteira Google.

#### Portão de Qualidade 1 (QG-1)
1. **Comando de Teste:** Executar testes unitários nativos Android:
   ```bash
   cd android && ./gradlew testReleaseUnitTest && cd ..
   ```
2. **Critério de Aceite:** 100% dos testes JUnit passando sem erros ou advertências.
3. **Commit & Push:**
   ```bash
   git add android/
   git commit -m "fix(android): robustecer motor de notificacoes contra falsos positivos e suportar moedas internacionais"
   git push origin main
   ```

---

### Fase 2: Domínio TypeScript — Parser Universal, Anti-Fallback e Deduplicação Temporal

#### Objetivos
- Extração precisa de quantias em moedas internacionais e identificação correta de transações Nomad e Wise.
- Eliminação do fallback cego que transforma mensagens não reconhecidas em despesas.
- Deduplicação inteligente de eventos entre carteiras digitais e bancos emissores.

#### Tarefas de Implementação

- [x] **Tarefa 2.1:** Aprimorar `extractCentsFromText` em `bank-parser.ts`
  - Tratar adequadamente valores com ponto decimal internacional (ex.: `15.50` -> 1550 centavos em vez de descartar ou interpretar como 1550 reais inteiros).
- [x] **Tarefa 2.2:** Implementar trava Anti-Fallback de Despesa em `bank-parser.ts`
  - Refatorar `detectTransactionNature` e `detectTransactionType`:
    - Criar dicionário explícito de `expenseKeywords` (ex.: `"compra"`, `"pagamento"`, `"pago"`, `"debitado"`, `"transferência enviada"`, `"pix enviado"`).
    - Se a mensagem não contiver termo inequívoco de despesa, de receita ou de investimento, **retornar estritamente `null`** em `parseBankNotification`.
    - Proibido assumir `"expense"` por mera ausência de palavra de renda.
- [x] **Tarefa 2.3:** Refinar a Blacklist Semântica em `bank-parser.ts`
  - Incluir expressões para descartar:
    - Ofertas de empréstimo e crédito: `/\b(?:empr[ée]stimo|cr[ée]dito)\s+(?:pr[ée]-aprovado|dispon[íi]vel|f[áa]cil|especial)\b/i`
    - Simulações: `/\bsimule\s+(?:seu|um|agora)\b/i`
    - Limites de conta/cartão: `/\blimite\s+(?:dispon[íi]vel|aumentou|liberado|emergencial)\b/i`
    - Campanhas promocionais com valores monetários: `/\bganhe\s+(?:at[ée]\s+)?(?:r\$|us\$)\b/i`
- [x] **Tarefa 2.4:** Aprimorar reconciliação e deduplicação em `suggestions-store.ts`
  - Identificar quando uma notificação de Carteira Digital (`Carteira Google` / `Samsung Pay`) e de um Banco Emissor chegam dentro de um intervalo de 60 segundos com o mesmo valor (`amountCents`).
  - Fundir automaticamente as informações (preservar o nome do estabelecimento vindo da carteira e os dados da conta vindos do banco emissor) sem gerar dois itens na lista.
- [x] **Tarefa 2.5:** Expandir a suíte de testes Vitest em `bank-parser.test.ts` e `bank-e2e-matrix.test.ts`
  - Adicionar cenários para Nomad em USD com ponto decimal.
  - Adicionar cenários de descarte de falsos positivos (empréstimos e promoções).
  - Validar garantia de retorno `null` para qualquer ambiguidade.

#### Portão de Qualidade 2 (QG-2)
1. **Comandos de Teste:**
   ```bash
   npm test src/domain/notifications/bank-parser.test.ts
   npm test src/domain/notifications/bank-e2e-matrix.test.ts
   npm run typecheck
   npm run lint
   ```
2. **Critério de Aceite:** 100% dos testes de domínio passando, zero erros de tipo (`tsc`), zero violações de lint e zero caracteres decorativos/emojis.
3. **Commit & Push:**
   ```bash
   git add src/domain/notifications/
   git commit -m "feat(domain): eliminar falso positivo de despesas e adicionar suporte a moedas globais e ponto decimal"
   git push origin main
   ```

---

### Fase 3: UX/UI — Guia Interativo Sem Atrito de Instalação do APK & Saída PWA

#### Objetivos
- Reduzir o abandono e o receio de usuários ao baixar o APK Android através de um guia visual interativo de 3 passos.
- Oferecer botão de escape claro *"Continuar usando pelo PWA sem instalar nada"*, garantindo conversão imediata do usuário.

#### Tarefas de Implementação

- [x] **Tarefa 3.1:** Criar componente `src/components/modules/apk-install-guide-dialog.tsx`
  - Construído com o primitivo `<ResponsiveDialog>` / `<Modal>` e tokens oficiais do `DESIGN_SYSTEM.md`.
  - Apresentação em 3 etapas sequenciais (ou carrossel adaptativo):
    - **Etapa 1:** *"Aviso 'Arquivo pode ser nocivo' do navegador"*: explicação didática de que é o alerta padrão do Android para qualquer download fora da Play Store.
    - **Etapa 2:** *"Permitir desta fonte"*: como autorizar a instalação em 1 toque nas configurações.
    - **Etapa 3:** *"Verificação do Play Protect"*: como avançar tocando em 'Mais detalhes' > 'Instalar assim mesmo'.
- [x] **Tarefa 3.2:** Integrar botão de escape e incentivo ao PWA no rodapé do diálogo
  - Botão de ação secundária: *"Prefiro usar no navegador (PWA)"*.
  - Ao clicar, exibe instrução instantânea de como fixar na tela inicial do celular sem nenhum download de arquivo `.apk`.
- [x] **Tarefa 3.3:** Conectar o guia aos botões de download de APK existentes
  - Vincular nos pontos de download da landing page e nas configurações do app.
- [x] **Tarefa 3.4:** Criar testes unitários para o diálogo em `apk-install-guide-dialog.test.tsx`
  - Validar renderização dos 3 passos, acionamento das ações e conformidade a11y (ARIA).

#### Portão de Qualidade 3 (QG-3)
1. **Comandos de Teste:**
   ```bash
   npm test src/components/modules/apk-install-guide-dialog.test.tsx
   npm run typecheck
   npm run lint
   ```
2. **Critério de Aceite:** Diálogo funcionando com acessibilidade completa, responsivo em mobile e desktop, sem emojis no texto e com testes unitários verdes.
3. **Commit & Push:**
   ```bash
   git add src/components/modules/
   git commit -m "feat(ui): adicionar guia visual interativo de instalacao do apk com alternativa rapida via pwa"
   git push origin main
   ```

---

### Fase 4: Posicionamento Comercial, Landing Page & Configurações da Plataforma

#### Objetivos
- Transmitir com clareza na Landing Page que o produto comercial oficial é o **PWA**, universal e sem atrito.
- Apresentar o APK Android com o rótulo transparente de **"Beta Opcional para Android"**.
- Exibir card contextual de plataforma nas Configurações da aplicação.

#### Tarefas de Implementação

- [x] **Tarefa 4.1:** Atualizar tabela de plataformas em `platform-comparison.tsx`
  - Coluna do PWA: destacar como versão oficial recomendada (1 clique, compatível com iOS, Android, Mac, Windows, zero downloads).
  - Coluna do Android Nativo: adicionar badge `variant="warning"` com texto `"Beta Opcional para Android"`.
- [x] **Tarefa 4.2:** Ajustar comunicação na seção de preços e FAQ
  - Em `pricing-section.tsx`: explicitar que todos os planos concedem acesso imediato Web e PWA.
  - Em `faq-section.tsx`: adicionar item no FAQ *"Preciso baixar algum APK no meu celular para usar?"*, explicando que o PWA funciona direto do navegador em 1 toque, e o APK é um complemento opcional para quem usa Android e deseja captura passiva.
- [x] **Tarefa 4.3:** Criar card de status de plataforma em `settings-page.tsx`
  - Se acessando via PWA/Web: exibir card *"Você está no PWA (Web)"* com informações de segurança e link para o diálogo *"Conheça o Aplicativo Android (Beta)"*.
  - Se acessando via APK Nativo: exibir card *"Aplicativo Android Nativo (Beta)"* com status das permissões de notificações ativas e orientações de otimização de bateria do aparelho.
- [x] **Tarefa 4.4:** Atualizar documentações canônicas (`NATIVE_DISTRIBUTION_GUIDE.md` e `PWA_GUIDELINES.md`)
  - Registrar formalmente o modelo de governança PWA-First + APK Beta Opcional.
- [x] **Tarefa 4.5:** Atualizar e rodar testes de regressão da Landing Page e Configurações
  - Executar testes existentes de landing page e settings.

#### Portão de Qualidade 4 (QG-4)
1. **Comandos de Teste:**
   ```bash
   npm test src/features/landing/
   npm test src/features/settings/
   npm run typecheck
   npm run lint
   ```
2. **Critério de Aceite:** 100% dos testes de telas e componentes aprovados, visual responsivo verificado no desktop e mobile.
3. **Commit & Push:**
   ```bash
   git add src/features/landing/ src/features/settings/ docs/
   git commit -m "feat(marketing): reposicionar produto como pwa-first e rotular apk como beta opcional para android"
   git push origin main
   ```

---

### Fase 5: Homologação Integrada, Bateria de Testes E2E e Portão de Qualidade Final (DoD)

#### Objetivos
- Executar todas as suítes de validação automatizada de ponta a ponta.
- Realizar auditoria preventiva contra fragilidades residuais.
- Homologar a entrega final com atualização do Roadmap.

#### Tarefas de Implementação

- [x] **Tarefa 5.1:** Execução da Bateria Completa de Testes
  - Rodar suíte completa de testes unitários e de integração (`npm test`).
  - Rodar suíte de testes unitários do Android (`./gradlew testReleaseUnitTest`).
- [x] **Tarefa 5.2:** Auditoria de Fragilidades e Verificação de Regressão
  - Verificar se alguma string de texto viola a Regra 8 do `AGENTS.md` (zero emojis decorativos): `npm run lint`.
  - Verificar estrita tipagem TypeScript sem erros: `npm run typecheck`.
  - Verificar geração do build de produção sem quebras: `npm run build`.
- [x] **Tarefa 5.3:** Atualização do `ROADMAP.md`
  - Registrar a nova versão incremental detalhando o PWA-First, APK Beta e a blindagem de notificações bancárias.
- [x] **Tarefa 5.4:** Commit e Push Final Consolidado

#### Portão de Qualidade Final (QG-Final / DoD)
1. **Comandos de Validação Geral:**
   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```
2. **Critérios de Aceite Inegociáveis:**
   - 0 erros de compilação TypeScript;
   - 0 violações de ESLint / Regra de Emojis;
   - 100% dos testes unitários e de integração verdes;
   - Build do Vite completado com sucesso em `dist/`;
   - Todos os commits com mensagens semânticas convencionais (`feat`, `fix`, `docs`).

---

## 5. Matriz de Rastreabilidade e Resolução de Fragilidades

| Fragilidade Identificada | Causa Raiz | Solução Implementada | Fase de Resolução |
|---|---|---|:---:|
| **Nomad e Wise falhando** | Regex exigia vírgula nos centavos | `AMOUNT_PATTERN` com suporte a `.` e `,` + prefixos de moedas internacionais | Fase 1 e Fase 2 |
| **Empréstimos virando despesa** | Fallback cego em `detectTransactionType` | Eliminação do fallback cego; retorno `null` em ambiguidade; blacklist ampliada | Fase 1 e Fase 2 |
| **Ofertas passando no leitor** | `hasFinancialSignal` permitia canais sem confirmação | Exigência estrita de verbos de operação consumada | Fase 1 e Fase 2 |
| **Atrito com alertas do Android** | Avisos assustadores do sistema sem orientação | Guia visual interativo de 3 passos + fuga para PWA | Fase 3 |
| **Hesitação de compra do usuário** | Usuário acreditava que o app só funcionava por APK | PWA como produto oficial universal; APK como Beta Opcional | Fase 4 |
| **Duplicidade Carteira vs Banco** | Eventos emitidos quase simultâneos | Deduplicação temporal de 60s em `suggestions-store.ts` | Fase 2 |

---

## 6. Procedimento Operacional de Execução

Ao iniciar o desenvolvimento, cada fase deve seguir o ciclo:
```
1. Implementar código da fase
2. Executar testes específicos da fase
3. Corrigir eventuais fragilidades ou falhas encontradas
4. Executar o Portão de Qualidade da fase (QG)
5. Realizar commit semântico e push para a branch remota
6. Avançar para a próxima fase
```
