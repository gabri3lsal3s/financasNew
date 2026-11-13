# PLANO DE IMPLEMENTAÇÃO 07 — EXPERIÊNCIA ADAPTATIVA, DIVULGAÇÃO PROGRESSIVA & PERFIS DE VISUALIZAÇÃO (MODO ESSENCIAL VS MODO INVESTIDOR)

> **Documento Canônico de Arquitetura de UX, Engenharia de Produto e Governança de Software**  
> **Status:** Concluído e Homologado  
> **Arquivo:** `docs/plans/completed/07_PLANO_EXPERIENCIA_ADAPTATIVA_E_PROGRESSIVE_DISCLOSURE.md`  
> **Ordem de Implementação:** **7º (Experiência Avançada & Retenção Comportamental)**  
> **Módulos Afetados:** `supabase/migrations/`, `src/types/`, `src/state/`, `src/components/layout/`, `src/features/auth/`, `src/features/overview/`, `src/features/settings/`, `src/features/investments/`, `docs/`  
> **Governança:** TypeScript Estrito (Zero `any`/`@ts-ignore`) · Zero Emojis (`local/no-decorative-unicode`) · Regra 18 (Modais Canônicos) · Mobile-First · Transições de Estado Sem Page Reload  
> **Ambientes:** Web Desktop, Web PWA (iOS/Android) & Android Nativo (Capacitor Pro)  

---

## 1. SUMÁRIO EXECUTIVO & VISÃO DO PRODUTO

O Áxis Finance possui um ecossistema financeiro denso e profissional. Para evitar a sobrecarga cognitiva (*Cockpit Overload*) de novos usuários que chegam buscando apenas organizar as contas do mês e as faturas do cartão de crédito, este plano projeta a **divulgação progressiva de funcionalidades (*Progressive Disclosure*)**.

A premissa não é limitar recursos nem criar paywalls artificiais, mas sim **respeitar a maturidade financeira do usuário no tempo**:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│               EXPERIÊNCIA ADAPTATIVA & JORNADA DE EVOLUÇÃO PATRIMONIAL                                 │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                 ┌──────────────────────────────────┴──────────────────────────────────┐
                 ▼                                                                     ▼
   [MODO ESSENCIAL: CONTROLE DO DIA A DIA]                               [MODO INVESTIDOR: PATRIMÔNIO COMPLETO]
   (Foco: Organização, Faturas e Contas)                                 (Foco: Alocação, Aportes, TIR e Proventos)
   
   • Contas Bancárias & Safe-to-Spend                                    • Carteira Completa de Ativos
   • Cartões de Crédito & Faturas Futuras                                • Rebalanceamento & Sugestão de Aporte
   • Despesas, Receitas & Racha com Pix                                  • Proventos B3 / Internacionais
   • Orçamento Mensal & Teto de Gastos                                   • Dossiê Fiscal / DARF
   • Dívidas & Modo Família                                              • Termômetro da Reserva da Casa
                 │                                                                     ▲
                 └───────────────────────────[GATILHOS INTELIGENTES]───────────────────┘
                                             - Reserva de 3 meses atingida
                                             - Fechou 2 meses consecutivos no azul
                                             - Botão de ativação com 1 clique nas Configurações
```

---

## 2. PILARES ARQUITETURAIS & REQUISITOS DE ENGENHARIA

### 2.1 Modelo de Dados & Persistência Reativa
- Adicionar coluna em `user_preferences`: `app_mode text not null default 'investor' check (app_mode in ('essential', 'investor'))`.
- O valor padrão para contas existentes é `'investor'`, garantindo retrocompatibilidade estrita (nenhum usuário atual tem sua tela alterada involuntariamente).
- Sincronização reativa via `useUserPreferences` sem necessidade de recarregar a página (*zero page reload*).

### 2.2 Governança de Navegação (Sidebar, BottomNav & MoreMenu)
- Os componentes [`sidebar.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/components/layout/sidebar.tsx), [`bottom-nav.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/components/layout/bottom-nav.tsx) e [`more-menu-sheet.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/components/layout/more-menu-sheet.tsx) verificam `app_mode === 'investor'` para exibir o item de menu "Investimentos".
- O Dashboard inicial oculta widgets de patrimônio investido quando em modo Essencial, dando destaque absoluto ao *Safe-to-Spend* e ao gráfico de fluxo diário.

### 2.3 Guardas de Rota Graciosas (Zero Telas 404)
- Se um usuário em modo Essencial acessar diretamente a rota `/investments` ou clicar em um link profundo:
  - É proibido exibir erro 404 ou fazer redirecionamento seco para `/`.
  - O app renderiza uma página de acolhimento amigável ([`InvestorModePromoView`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/)):
    * Explica em 3 pontos o que o módulo de investimentos oferece (Metas, Rebalanceamento, Proventos).
    * Botão primário com feedback sensorial: **`Ativar Módulo de Investimentos`** (atualiza `app_mode` para `'investor'` e carrega a tela instantaneamente).
    * Botão secundário: *"Voltar para o Início"*.

### 2.4 Gatilhos Comportamentais de Transição ("Subida de Nível")
- O app identifica marcos financeiros positivos para convidar o usuário a dar o próximo passo:
  1. *Marco da Sobra:* Se o usuário fechar 2 meses consecutivos com saldo positivo.
  2. *Marco da Reserva:* Se a reserva de emergência atingir a meta recomendada.
- O convite aparece no carrossel de alertas ou como card acolhedor: *"Você organizou sua rotina e está pronto para investir. Deseja habilitar a carteira de ativos?"*.

---

## 3. FASES EXECUTADAS COM SUCESSO

- [x] **Fase 1: Migration & Tipagem em `user_preferences`**
  - Migration adicionando `app_mode`.
  - Atualização de contratos em `src/types/settings.ts` e `schema.ts`.
- [x] **Fase 2: Condicionamento da Navegação & Dashboard**
  - Sidebar, BottomNav e MoreMenuSheet adaptativos.
  - Ocultação de widgets de investimento no Dashboard quando em modo Essencial.
- [x] **Fase 3: Tela de Acolhimento e Guarda de Rota (`InvestorModePromoView`)**
  - Componente de transição amigável ao acessar `/investments` em modo Essencial.
- [x] **Fase 4: Configurações & Seletor de Modo**
  - Toggle na aba Aparência / Preferências com alternância instantânea.
- [x] **Fase 5: Onboarding Inicial Leve**
  - Pergunta opcional de 1 clique no cadastro ("Qual seu foco hoje? Organizar Contas ou Gerenciar Carteira?").
- [x] **Fase 6: Homologação, Testes E2E & DoD**
  - Suíte de testes verificando alternância sem perda de dados e zero vazamento de rotas.

---

## 4. DEFINITION OF DONE (DoD)

1. Usuários existentes permanecem no modo Investidor por padrão com zero alteração de comportamento.
2. Modo Essencial oculta investimentos da navegação e exibe tela de acolhimento em rotas diretas.
3. Transição de modo com 1 clique atualiza a interface instantaneamente sem recarregar a janela.
4. 100% dos testes unitários e de integração verdes, com zero violações de acessibilidade e linter.
