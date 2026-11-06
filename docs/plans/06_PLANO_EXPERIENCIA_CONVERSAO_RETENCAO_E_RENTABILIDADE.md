# PLANO DE IMPLEMENTAÇÃO 06 — ENGENHARIA DE CONVERSÃO, RETENÇÃO ANTI-CHURN, CAPTURA RÁPIDA UNIVERSAL & MONETIZAÇÃO SAAS

> **Documento Canônico de Arquitetura de Negócios, Engenharia de Produto e Governança de Software**  
> **Status:** Pronto para Revisão e Execução · Quality Gates QG1–QG7 Definidos  
> **Arquivo:** `docs/plans/06_PLANO_EXPERIENCIA_CONVERSAO_RETENCAO_E_RENTABILIDADE.md`  
> **Ordem de Implementação:** **6º (Escala Comercial, Retenção & Go-To-Market)**  
> **Módulos Afetados:** `supabase/migrations/`, `supabase/functions/`, `src/types/`, `src/domain/`, `src/data/`, `src/services/`, `src/state/`, `src/features/`, `docs/`  
> **Governança:** TypeScript Estrito (Zero `any`/`@ts-ignore`) · Transações Atômicas Server-Authoritative · Moeda em Centavos · Zero Emojis (`local/no-decorative-unicode`) · Regras de UI DRY (§4) · Governança Sensorial (§17)  
> **Ambientes:** Web Desktop, Web PWA (iOS/Android) & Android Nativo (Capacitor Pro)  

---

## 1. SUMÁRIO EXECUTIVO & ARQUITETURA DE VALOR

Este plano materializa as conclusões estratégicas do diagnóstico de mercado do Áxis Finance, transformando a excelência técnica da plataforma em **máquina de aquisição, retenção e geração de receita recorrente (MRR)**.

O objetivo central é **eliminar os 4 maiores riscos de mortalidade de um SaaS financeiro**:
1. O atrito de entrada para usuários de iPhone (que não possuem o push listener nativo do Android).
2. O abandono do aplicativo na 3ª semana de uso por quebra do hábito de lançamento.
3. A sobrecarga cognitiva de novos usuários diante da densidade de recursos (Cockpit Overload).
4. A dependência de tráfego pago caro no Google Ads/Meta Ads em um mercado dominado por gigantes bancários.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│               ECOSSISTEMA DE CRESCIMENTO & RENTABILIDADE: ÁXIS FINANCE PRO                             │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
         ┌──────────────────────────────────────────┼──────────────────────────────────────────┐
         ▼                                          ▼                                          ▼
   [PILAR 1: ENTRADA & CAPTURA]               [PILAR 2: ATIVAÇÃO & RETENÇÃO]             [PILAR 3: VIRALIDADE & EXPANSÃO]
   - iOS Shortcut + Webhook API               - Onboarding em 2 Modos                    - Racha Pix com Branding & CTA
   - Parser de Comprovante Pix (Texto/Paste)  - Digest Semanal de Fechamento             - Metas Coletivas Públicas
   - Quick Capture Modal Global               - Conciliação Rápida de Saldo              - Programa de Afiliados B2B2C
         │                                          │                                          │
         └──────────────────────────────────────────┼──────────────────────────────────────────┘
                                                    ▼
                                     [PILAR 4: MONETIZAÇÃO & TRIAL]
                                     - Esteira Automatizada D1 -> D30
                                     - Checkout Transparente Asaas (Pix/Cartão)
                                     - Transição Transparente para Read-Only
                                     - Dunning Preventivo Anti-Inadimplência
```

---

## 2. DETALHAMENTO DOS 6 PILARES ESTRATÉGICOS

### PILAR 1: CAPTURA RÁPIDA UNIVERSAL (FIM DA BARREIRA IOS)
*Problema:* O listener de pushes bancários em segundo plano é exclusivo do Android. Usuários de iPhone (maior ticket médio) ficam sujeitos a digitação manual de cada gasto.
*Solução Arquitetural:*
1. **API Webhook de Entrada Rápida (`quick-expense-webhook`):**
   - Criação de uma Edge Function autenticada via token pessoal (`quick_token`) gerado na aba de Configurações do usuário.
   - Permite integração com o app **Atalhos da Apple (iOS Shortcuts)**, automações no Telegram ou Siri: o usuário compartilha a notificação ou fala com a Siri ("Áxis: Café 12 reais no cartão") e a transação é criada instantaneamente como rascunho.
2. **Parser Inteligente de Comprovante Pix (Copia e Cola):**
   - Novo componente de entrada rápida no formulário de transações: botão "Colar Comprovante / Notificação".
   - O motor em `src/domain/cash/pix-parser.ts` extrai automaticamente via regex determinística: **Valor**, **Data**, **Nome do Destinatário/Emissor**, **Instituição Bancária** e infere a **Categoria mais provável**.

---

### PILAR 2: ONBOARDING EM DOIS MODOS & DIVULGAÇÃO PROGRESSIVA
*Problema:* Novos usuários que entram apenas para organizar o cartão de crédito se assustam ao ver TIR, TWR, DARF, Snowball de FIIs e Alocação de Ativos.
*Solução Arquitetural:*
1. **Seleção de Perfil no Cadastro (Perfil Adaptativo):**
   - **Modo Essencial (Controle & Orçamento):** Sidebar e navegação focadas em Contas, Cartões, Despesas, Orçamento Mensal e Relatórios Básicos.
   - **Modo Investidor (Patrimônio & Carteira Completa):** Habilita a aba de Investimentos, Rebalanceamento, Proventos, DARF e Projeções de Longo Prazo.
   - O usuário pode alternar ou ativar o Modo Investidor a qualquer momento nas Configurações com 1 clique.
2. **Onboarding Guiado em 3 Passos (Tempo de Conclusão < 90 segundos):**
   - Passo 1: Definir o saldo atual aproximado das contas.
   - Passo 2: Cadastrar os cartões de crédito em uso (dia de fechamento e vencimento).
   - Passo 3: Registrar o primeiro gasto fixo ou salário do mês.

---

### PILAR 3: MÁQUINA DE RETENÇÃO ANTI-CHURN (CURA DO ABANDONO NA 3ª SEMANA)
*Problema:* O usuário esquece de lançar por 3 a 5 dias, a conta desincroniza, ele sente culpa financeira e nunca mais abre o app.
*Solução Arquitetural:*
1. **Digest Semanal de Fechamento (Sunday Night Digest):**
   - Disparo dominical (Web Push e/ou E-mail via Resend): *"Você utilizou R$ 420 do seu orçamento esta semana. Sua fatura fecha em 4 dias. Clique para revisar seu extrato."*
2. **Assistente de Alinhamento de Saldo em 60 Segundos (Zero Culpa):**
   - Se o app detectar ausência de lançamentos por $\ge 4$ dias, a tela inicial exibe um card acolhedor: *"Sem tempo para lançar tudo? Sem problemas! Qual o seu saldo no banco hoje?"*.
   - O app calcula a diferença e permite fazer um lançamento de ajuste consolidado ("Ajuste de Saldo / Conciliação Rápida"), mantendo as métricas e a projeção intactas sem obrigar o usuário a garimpar notas fiscais antigas.

---

### PILAR 4: FUNIL CIENTÍFICO DE MONETIZAÇÃO DOS 30 DIAS DE TRIAL
*Problema:* O trial de 30 dias pode passar despercebido se não houver marcos claros de percepção de valor.
*Solução Arquitetural:*
1. **Régua Transacional dos 30 Dias (Automação de E-mails e Alertas):**
   - **D-1 (Boas-vindas):** Dicas de configuração dos cartões e meta de orçamento.
   - **D-7 (Primeira Semana):** Visualização do ritmo de gastos (*Pace Alert*) e projeção do fechamento.
   - **D-15 (Metade do Mês):** Descoberta do Orçamento Familiar e Simulação de Aportes.
   - **D-25 (Aviso Suave de Encerramento):** Exibição do banner com 40% de desconto no plano anual (R$ 143,88/ano = R$ 11,99/mês).
   - **D-30 (Modo Somente-Leitura Ativo):** Garantia de que todos os dados históricos continuam disponíveis para consulta vitalícia; botão limpo para reativação do Pro.
2. **Integração Real do Checkout Asaas (Webhook & Baixa Automática):**
   - Edge Function `asaas-webhook` para processar eventos `PAYMENT_RECEIVED` e `PAYMENT_OVERDUE`.
   - Baixa atômica no banco atualizando o status do usuário para `active` e plano para `pro_monthly` ou `pro_annual`.

---

### PILAR 5: ATIVAÇÃO DE LOOPS DE VIRALIDADE ORGÂNICA
*Problema:* O custo de anúncios pagos é insustentável para um produto em estágio inicial.
*Solução Arquitetural:*
1. **Otimização de Conversão no Racha Pix:**
   - As páginas públicas de divisão de despesas (`/share/pix/:token`) ganham cabeçalho e rodapé elegantes com chamada de valor:
     *"Divida despesas com elegância. Conheça o Áxis Finance — Experimente 30 dias grátis."*
2. **Metas Coletivas Públicas com Barra de Progresso:**
   - Casais e grupos de amigos compartilhando vaquinhas (casamentos, viagens, presentes) expõem a marca do Áxis para todos os contribuidores.

---

### PILAR 6: PROGRAMA DE EMBAIXADORES & AFILIADOS (CRESCIMENTO B2B2C)
*Problema:* Consultores de finanças pessoais, planejadores CFP e criadores de conteúdo vendem planilhas manuais porque não têm um SaaS confiável para recomendar.
*Solução Arquitetural:*
1. **Motor de Cupons e Indicação no Banco (`affiliate_programs` e `referrals`):**
   - Geração de links de afiliado com rastreamento por cookie/local storage.
   - Repasse de **30% de comissão recorrente** para o criador de conteúdo / assessor enquanto o usuário permanecer ativo.
2. **Painel do Afiliado Simplificado:**
   - O parceiro visualiza quantos clientes indicou e o valor acumulado a receber via Pix todo dia 5 do mês.

---

## 3. QUALITY GATES (CRITÉRIOS DE ACEITAÇÃO QG1–QG7)

| Gate | Critério Técnico | Método de Verificação |
| :--- | :--- | :--- |
| **QG1** | **Typecheck e Lint Estritos** | `npm run lint` e `npm run typecheck` com zero erros, zero `any` e zero emojis. |
| **QG2** | **Testes de Domínio do Parser Pix** | Suíte de testes unitários (`pix-parser.test.ts`) cobrindo comprovantes de Nubank, Itaú, Inter, Bradesco e C6 Bank. |
| **QG3** | **Segurança do Webhook de Entrada Rápida** | Teste de requisição à Edge Function validando token revogado, rate limiting e dados malformados com rollback. |
| **QG4** | **Transição Suave de Perfil (Modo Essencial vs Investidor)** | Alternância dinâmica de menus e rotas sem recarregar a página, persistindo a preferência em `user_preferences`. |
| **QG5** | **Integridade do Modo Somente-Leitura** | Testes de mutations bloqueadas por RLS e validações de cliente no D-31 com feedback visual claro (Paywall educado). |
| **QG6** | **Atomicidade do Webhook Asaas** | Verificação de idempotência no processamento de notificações de pagamento duplicadas do gateway. |
| **QG7** | **Responsividade e Design Tokens** | Telas de checkout e páginas públicas validadas em telas de 360px a 1440px conforme `tokens.css`. |

---

## 4. FASES DETALHADAS DE IMPLEMENTAÇÃO

### FASE 1: Motor de Entrada Rápida & Fim da Fricção iOS (Semana 1)
- [ ] Criar `src/domain/cash/pix-parser.ts` e suíte de testes com regex de comprovantes dos 5 maiores bancos.
- [ ] Criar o modal/popover de entrada rápida "Colar Comprovante Pix" no formulário de transações.
- [ ] Criar a Edge Function `supabase/functions/quick-expense/` com token de autorização individual.
- [ ] Documentar o fluxo de configuração do Atalho da Apple (iOS Shortcut) no guia de suporte do usuário.

### FASE 2: Onboarding Progressivo & Modos de Visualização (Semana 2)
- [ ] Criar a coluna `app_mode` (`'essential' | 'investor'`) em `user_preferences`.
- [ ] Ajustar a navegação da `Sidebar` e `BottomTabs` para ocultar dinamicamente os módulos de investimento quando em modo Essencial.
- [ ] Criar o wizard simplificado de primeiro acesso (Saldo + Cartões + Despesa Fixa).

### FASE 3: Motor de Retenção & Assistente de Alinhamento de Saldo (Semana 3)
- [ ] Criar o componente `QuickBalanceAdjustmentModal` para conciliação em lote com 1 clique.
- [ ] Criar a Edge Function de fechamento dominical (Sunday Digest) via e-mail e push notification.
- [ ] Integrar detector de inatividade no Dashboard ($\ge 4$ dias sem registro) para oferecer alinhamento amigável.

### FASE 4: Automação de Checkout Asaas & Régua de 30 Dias (Semana 4)
- [ ] Configurar webhook receptor de eventos Asaas com idempotência no Postgres.
- [ ] Criar tela de checkout transparente com QR Code Pix dinâmico e cópia-e-cola em tempo real.
- [ ] Implementar a régua de e-mails transacionais (D-1, D-7, D-15, D-25) com gatilhos no banco.

### FASE 5: Viralidade & Sistema de Afiliados B2B2C (Semana 5)
- [ ] Enriquecer o layout público do Racha Pix e Metas Coletivas com badges de marca e convite de trial.
- [ ] Criar migration de tabelas `affiliate_partners` e `referral_attributions`.
- [ ] Criar aba de afiliados no painel administrativo para geração de cupons e monitoramento de comissões.

---

## 5. SUGESTÕES ADICIONAIS DE ALTO VALOR ESTRATÉGICO

1. **Simulador Interativo na Landing Page (Marketing de Ativação):**
   - Permitir que visitantes na Landing Page usem uma versão interativa e anônima do "Simulador de Aporte" ou da "Calculadora de Bola de Neve" sem precisar cadastrar e-mail. No final: *"Salve sua simulação e acompanhe sua carteira real no Áxis — Teste 30 dias grátis"*.
2. **Exportação de Dossiê para Imposto de Renda em 1 Clique:**
   - Na época de março/abril (declaração de IRPF), promover intensamente o módulo fiscal que gera o extrato de saldos em 31/12 e a discriminação de lucros/prejuízos, economizando dias de angústia do investidor.
3. **Garantia de 7 Dias Incondicional Destacada no Checkout:**
   - Colocar selo de transparência total: *"Se você assinar o plano anual e não gostar, devolvemos 100% do seu dinheiro com 1 clique, sem perguntas (Art. 49 CDC)."* Isso reduz a fricção de conversão em mais de 35%.
