# PLANO DE IMPLEMENTAÇÃO 06 — ENGENHARIA DE CONVERSÃO, RETENÇÃO ANTI-CHURN, CAPTURA RÁPIDA UNIVERSAL & MONETIZAÇÃO SAAS

> **Documento Canônico de Arquitetura de Negócios, Engenharia de Produto e Governança de Software**  
> **Status:** Otimizado, Harmonizado com os Módulos Existentes e Pronto para Execução · Quality Gates QG1–QG5 Definidos  
> **Arquivo:** `docs/plans/06_PLANO_EXPERIENCIA_CONVERSAO_RETENCAO_E_RENTABILIDADE.md`  
> **Ordem de Implementação:** **6º (Escala Comercial, Retenção & Go-To-Market)**  
> **Módulos Afetados:** `supabase/migrations/`, `supabase/functions/quick-expense/`, `src/types/`, `src/domain/`, `src/data/`, `src/services/`, `src/state/`, `src/features/transactions/`, `src/features/public-share/`, `src/features/settings/`, `docs/`  
> **Governança:** TypeScript Estrito (Zero `any`/`@ts-ignore`) · Transações Atômicas Server-Authoritative · Moeda em Centavos · Zero Emojis (`local/no-decorative-unicode`) · Regras de UI DRY (§4) · Governança Sensorial (§17) · Reutilização Obrigatória de Componentes e Parsers Existentes  
> **Ambientes:** Web Desktop, Web PWA (iOS/Android) & Android Nativo (Capacitor Pro)  

---

## 1. SUMÁRIO EXECUTIVO & ARQUITETURA DE VALOR

Este plano materializa as conclusões estratégicas de crescimento do Áxis Finance, transformando a excelência técnica da plataforma em **máquina de aquisição, retenção e geração de receita recorrente (MRR)**.

O objetivo central é eliminar as maiores barreiras de tração:
1. **O atrito de entrada para usuários de iPhone:** O listener nativo em segundo plano é exclusivo do Android Pro. O iOS Shortcut integrado via Webhook seguro elimina a digitação manual para usuários Apple.
2. **O abandono do aplicativo na 3ª semana de uso por quebra de hábito:** Se o usuário passar 4+ dias sem lançar, o app oferece conciliação rápida em 60 segundos ("Zero Culpa").
3. **Loops virais de aquisição orgânica:** Conversão de visitantes nas páginas públicas de divisão de despesas (`/r/:token`) e vaquinhas coletivas (`/meta/:token`).
4. **Crescimento B2B2C via parceiros:** Programa de indicação e comissão para consultores financeiros e criadores de conteúdo.

> [!NOTE]
> **Harmonização Arquitetural com Entregas Anteriores:**
> - O **Checkout Transparente Asaas**, a **Edge Function `asaas-webhook`** e a **idempotência de assinaturas** já foram 100% implementados e testados (`src/tests/asaas-webhook-idempotency.test.ts`).
> - O **Parser de Comprovantes Pix** já existe consolidado em `src/domain/notifications/pix-receipt-parser.ts`, sendo reutilizado diretamente sem duplicação de código.
> - O **Simulador Interativo da Landing Page** já está em produção (`MinimalWealthSimulator.tsx`).
> - A funcionalidade de **Transição de Perfil (Modo Essencial vs Modo Investidor)** foi segregada com responsabilidade no **Plano 07 dedicado**, garantindo foco cirúrgico neste plano.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│               ECOSSISTEMA DE CRESCIMENTO & RENTABILIDADE: ÁXIS FINANCE PRO                             │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
         ┌──────────────────────────────────────────┼──────────────────────────────────────────┐
         ▼                                          ▼                                          ▼
   [PILAR 1: ENTRADA RÁPIDA IOS]              [PILAR 2: RETENÇÃO ANTI-CHURN]             [PILAR 3: VIRALIDADE & EXPANSÃO]
   - Webhook API (quick-expense)              - Detector de Inatividade (>= 4 dias)      - Racha Pix (/r/:token) com Branding
   - iOS Shortcut (Apple Shortcuts/Siri)      - Alinhamento de Saldo em 60s              - Metas (/meta/:token) com CTA 30d
   - Reuso do pix-receipt-parser.ts           - Sunday Night Digest                      - Programa de Afiliados B2B2C
```

---

## 2. DETALHAMENTO DOS 4 PILARES ESTRATÉGICOS

### PILAR 1: CAPTURA RÁPIDA UNIVERSAL (FIM DA BARREIRA IOS)
*Problema:* O listener de pushes bancários em segundo plano é exclusivo do Android. Usuários de iPhone (maior ticket médio) ficam sujeitos a digitação manual de cada gasto.
*Solução Arquitetural:*
1. **API Webhook de Entrada Rápida (`quick-expense`):**
   - Criação da Edge Function `supabase/functions/quick-expense/`.
   - Autenticação via token pessoal (`quick_token`) gerado de forma segura nas Configurações, armazenado com hash criptográfico (`sha256`) no Postgres e escopo exclusivo (`expense:write`).
   - Permite integração com o app **Atalhos da Apple (iOS Shortcuts)**, automações no Telegram ou Siri: o usuário compartilha a notificação ou fala com a Siri ("Áxis: Café 12 reais no cartão") e a transação é criada instantaneamente como rascunho pendente de confirmação.
2. **Ação "Colar Comprovante / Notificação Pix":**
   - No formulário de transações, inclusão do botão de ação rápida "Colar Comprovante".
   - Conexão direta com o motor puro já homologado [`src/domain/notifications/pix-receipt-parser.ts`](file:///home/gabrielsales/meus_apps/financasnew/src/domain/notifications/pix-receipt-parser.ts), extraindo automaticamente: **Valor**, **Data**, **Nome do Destinatário/Emissor**, **Instituição Bancária** e **Categoria inferida**.

---

### PILAR 2: MÁQUINA DE RETENÇÃO ANTI-CHURN (CURA DO ABANDONO NA 3ª SEMANA)
*Problema:* O usuário esquece de lançar por 3 a 5 dias, a conta desincroniza, ele sente culpa financeira e nunca mais abre o app.
*Solução Arquitetural:*
1. **Assistente de Alinhamento de Saldo em 60 Segundos (Zero Culpa):**
   - Se o app detectar ausência de lançamentos por $\ge 4$ dias, a tela inicial exibe um card acolhedor: *"Sem tempo para lançar tudo? Sem problemas! Qual o seu saldo no banco hoje?"*.
   - Componente `QuickBalanceAdjustmentModal`: o app calcula a diferença e permite fazer um lançamento de ajuste consolidado ("Ajuste de Saldo / Conciliação Rápida"), mantendo as métricas e a projeção intactas sem obrigar o usuário a garimpar notas fiscais antigas.
2. **Digest Semanal de Fechamento (Sunday Night Digest):**
   - Edge Function para disparo dominical (Web Push e/ou E-mail via Resend): *"Você utilizou R$ 420 do seu orçamento esta semana. Sua fatura fecha em 4 dias. Clique para revisar seu extrato."*

---

### PILAR 3: ATIVAÇÃO DE LOOPS DE VIRALIDADE ORGÂNICA
*Problema:* O custo de anúncios pagos é insustentável para um produto em estágio inicial.
*Solução Arquitetural:*
1. **Branding e Conversão no Racha Pix:**
   - As páginas públicas de divisão de despesas ([`/r/:token`](file:///home/gabrielsales/meus_apps/financasnew/src/features/public-share/pages/split-public-page.tsx)) ganham cabeçalho e rodapé elegantes com chamada de valor:
     *"Divida despesas com elegância. Conheça o Áxis Finance — Experimente 30 dias grátis."*
2. **Metas Coletivas Públicas com Barra de Progresso:**
   - As páginas públicas de metas ([`/meta/:token`](file:///home/gabrielsales/meus_apps/financasnew/src/features/public-share/pages/goal-tracker-public-page.tsx)) expõem a marca do Áxis para todos os amigos e familiares contribuidores com botão de experimentação gratuita.

---

### PILAR 4: PROGRAMA DE EMBAIXADORES & AFILIADOS (CRESCIMENTO B2B2C)
*Problema:* Consultores de finanças pessoais, planejadores CFP e criadores de conteúdo vendem planilhas manuais porque não têm um SaaS confiável para recomendar.
*Solução Arquitetural:*
1. **Motor de Cupons e Indicação no Banco (`affiliate_partners` e `referral_attributions`):**
   - Geração de links de afiliado com rastreamento por cookie/local storage.
   - Repasse de **30% de comissão recorrente** para o criador de conteúdo / assessor enquanto o usuário indicado permanecer ativo.
2. **Painel do Parceiro em `/configuracoes`:**
   - O parceiro visualiza quantos clientes indicou e o valor acumulado a receber via Pix todo dia 5 do mês.

---

## 3. QUALITY GATES (CRITÉRIOS DE ACEITAÇÃO QG1–QG5)

| Gate | Critério Técnico | Método de Verificação |
| :--- | :--- | :--- |
| **QG1** | **Typecheck e Lint Estritos** | `npm run lint` e `npm run typecheck` com zero erros, zero `any` e zero emojis. |
| **QG2** | **Segurança da Edge Function `quick-expense`** | Teste de requisição validando token revogado, token expirado, rate limiting e dados malformados com rollback. |
| **QG3** | **Integração do Parser de Comprovantes** | Testes de integração no modal de transações utilizando o parser puro `pix-receipt-parser.ts` sem duplicação de lógica. |
| **QG4** | **Atomicidade do Alinhamento de Saldo** | Verificação de lançamento de ajuste financeiro respeitando a moeda em centavos e sem gerar inconsistências no Safe-to-Spend. |
| **QG5** | **Responsividade e Conversão Pública** | Telas públicas (`/r/:token` e `/meta/:token`) validadas em telas de 360px a 1440px com renderização impecável dos banners de convite. |

---

## 4. FASES DETALHADAS DE IMPLEMENTAÇÃO

### FASE 1: Motor de Entrada Rápida iOS & Parser Pix (Semana 1)
- [x] Criar a Edge Function `supabase/functions/quick-expense/` com token de autorização individual com hash SHA-256.
- [x] Adicionar botão "Colar Comprovante Pix" no formulário de transações conectado a `pix-receipt-parser.ts`.
- [x] Gerador e revogador de `quick_token` na aba de Configurações do usuário.
- [x] Documentar o fluxo de configuração do Atalho da Apple (iOS Shortcut) no guia de suporte do usuário.
- [x] **Portão de Qualidade 1 (QG1 + QG2):** `npx vitest run src/domain/notifications/pix-receipt-parser.test.ts` e `npm run typecheck`.

### FASE 2: Motor de Retenção & Assistente de Alinhamento de Saldo (Semana 2)
- [x] Criar o componente `QuickBalanceAdjustmentModal` para conciliação em lote com 1 clique.
- [x] Integrar detector de inatividade no Dashboard ($\ge 4$ dias sem registro) para oferecer alinhamento amigável ("Zero Culpa").
- [x] Criar a Edge Function de fechamento dominical (Sunday Digest) via e-mail e push notification.
- [x] **Portão de Qualidade 2 (QG3 + QG4):** `npm run typecheck` e `npm run lint`.

### FASE 3: Viralidade nas Páginas Públicas (Semana 3)
- [x] Enriquecer o layout público do Racha Pix ([`/r/:token`](file:///home/gabrielsales/meus_apps/financasnew/src/features/public-share/pages/split-public-page.tsx)) com badges de marca e convite de 30 dias de trial.
- [x] Enriquecer o layout público das Metas Coletivas ([`/meta/:token`](file:///home/gabrielsales/meus_apps/financasnew/src/features/public-share/pages/goal-tracker-public-page.tsx)) com chamada de conversão.
- [x] **Portão de Qualidade 3 (QG5):** `npx vitest run src/features/public-share/` e validação responsiva.

### FASE 4: Sistema de Afiliados B2B2C & Indicação (Semana 4)
- [x] Migration criando tabelas `affiliate_partners` e `referral_attributions`.
- [x] Rastreamento de código de indicação no cadastro de novos usuários.
- [x] Aba simplificada de afiliados em `/configuracoes` para monitoramento de comissões e chave Pix de repasse.
- [x] **Portão de Qualidade 4:** `npm run typecheck` e `npm run lint`.

### FASE 5: Homologação Integrada & Conclusão (Semana 5)
- [x] Validação ponta a ponta do fluxo iOS Shortcut -> Edge Function -> Dashboard.
- [x] Verificação de compliance com AGENTS.md (zero emojis, design tokens canônicos).
- [x] Arquivamento formal do plano em `docs/plans/completed/`.
- [x] **Portão de Qualidade 5:** `npm run test:run` e `npm run build`.
