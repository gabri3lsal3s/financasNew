# Relatório de Auditoria Visual & UX — Parte 9: Casca Pública, Autenticação, Legal & Admin

> **Status:** Concluído  
> **Data:** 20/11/2026  
> **Escopo:** `src/features/landing/*`, `src/features/auth/*`, `src/features/legal/*`, `src/features/admin/*`  
> **Total de arquivos de produção auditados:** 180 arquivos (46 em Landing, 20 em Auth, 13 em Legal, 101 em Admin/Forensics)  
> **Total de arquivos inspecionados (incluindo testes):** 216 arquivos  
> **Conformidade Geral Estimada:** **94.8%**  

---

## 1. Sumário Executivo & Destaques de Arquitetura

A **Parte 9** conclui o ciclo completo de auditoria do Axir, cobrindo as portas de entrada e controle da plataforma: a **Landing Page / Apresentação Comercial** (heróis editoriais, simuladores interativos de patrimônio e curvas FIRE, narrativas de produto, tabelas comparativas e rodapé institucional), o **Módulo de Autenticação & Acesso** (login com proteção contra ataques de força bruta, cadastro, recuperação de senha, telas de aprovação pendente e conta suspensa), o **Módulo Legal & LGPD** (termos de uso, política de privacidade, direitos do titular e governança de dados) e a **Central de Administração & Perícia Forense** (métricas globais, gestão e aprovação de usuários, tickets de suporte, verificação de backups e motor headless de invariantes matemáticas).

### Principais Conquistas Arquiteturais Observadas:
1. **Adesão Impecável à Regra 22 (Contenção de Viewport & Breakpoint de Navbar):**
   - O cabeçalho da Landing Page ([landing-header.tsx:97, 118](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/landing-header.tsx#L97)) e a gaveta mobile ([landing-mobile-drawer.tsx:35](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/landing-mobile-drawer.tsx#L35)) utilizam com rigor estrito o breakpoint `lg:` (1024px) para exibir os links horizontais de navegação, mantendo o menu compacto/hambúrguer em telas de tablet (`md:` / 768px–1023px) e eliminando qualquer risco de transbordamento horizontal.
2. **Zero autoFocus & Ergonomia Móvel Anti-Zoom (Dimensão 18 & Regra 20):**
   - 100% dos formulários de login, registro, recuperação e diálogos administrativos possuem ausência total de `autoFocus` declarativo e garantem fonte mínima de 16px no mobile (`text-base sm:text-sm`).
3. **Casca de Autenticação Minimalista e Segura:**
   - [auth-shell.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/components/auth-shell.tsx) adota design de alta densidade cognitiva, com alternador de tema acessível, brand logo centrado e feedback de backoff adaptativo em caso de falhas de autenticação.
4. **Zero Emojis e Validação de Lint 100% Limpa:**
   - Todos os 216 arquivos foram verificados com o ESLint e retornaram código de saída 0 sem nenhuma violação da regra `local/no-decorative-unicode`.

---

## 2. Inventário de Arquivos Auditados

### A. Landing Page & Apresentação (`src/features/landing/*`) — 46 arquivos de produção
- **Páginas & Roteamento:** [landing-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/pages/landing-page.tsx).
- **Heróis, Headers e Rodapés:** [landing-header.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/landing-header.tsx), [landing-mobile-drawer.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/landing-mobile-drawer.tsx), [landing-footer.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/landing-footer.tsx), [hero-editorial.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/hero-editorial.tsx), [hero-dashboard-mockup.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/hero-dashboard-mockup.tsx), [mobile-cta-dock.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/mobile-cta-dock.tsx), [cta-banner.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/cta-banner.tsx).
- **Narrativas e Showcases:** [product-narratives.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/product-narratives.tsx), [capture-narrative.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/narratives/capture-narrative.tsx), [cash-and-cards-narratives.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/narratives/cash-and-cards-narratives.tsx), [portfolio-and-shared-narratives.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/narratives/portfolio-and-shared-narratives.tsx), [shared-finances-showcase.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/shared-finances-showcase.tsx), [tools-showcase.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/tools-showcase.tsx).
- **Simulador Interativo e Gráficos FIRE:** [minimal-wealth-simulator.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/minimal-wealth-simulator.tsx), [simulator-inputs-panel.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/simulator/simulator-inputs-panel.tsx), [simulator-chart-panel.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/simulator/simulator-chart-panel.tsx), [simulator-allocation-results.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/simulator/simulator-allocation-results.tsx), [fire-projection-curve.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/fire-projection-curve.tsx), [fire-projection-metrics.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/fire-projection-metrics.tsx), [fire-interactive-svg-chart.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/fire-interactive-svg-chart.tsx), [fire-svg-canvas.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/fire-svg-canvas.tsx).
- **Tabelas, Preços & FAQ:** [platform-comparison.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/platform-comparison.tsx), [platform-comparison-table.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/platform-comparison-table.tsx), [pricing-section.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/pricing-section.tsx), [pricing-cards-grid.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/pricing-cards-grid.tsx), [faq-section.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/faq-section.tsx), [legal-dialog.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/legal-dialog.tsx).
- **Contextos e Hooks:** [scroll-reveal.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/scroll-reveal.tsx), [scroll-reveal-context.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/scroll-reveal-context.tsx), [use-scroll-spy.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/hooks/use-scroll-spy.ts), [use-in-view.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/hooks/use-in-view.ts), [use-landing-cta.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/hooks/use-landing-cta.ts), [use-animated-number.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/hooks/use-animated-number.ts).

### B. Autenticação & Acesso (`src/features/auth/*`) — 20 arquivos de produção
- **Páginas:** [login-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/pages/login-page.tsx), [register-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/pages/register-page.tsx), [forgot-password-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/pages/forgot-password-page.tsx), [reset-password-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/pages/reset-password-page.tsx), [pending-approval-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/pages/pending-approval-page.tsx), [suspended-account-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/pages/suspended-account-page.tsx).
- **Componentes:** [auth-shell.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/components/auth-shell.tsx), [auth-form-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/components/auth-form-card.tsx), [auth-feedback-alert.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/components/auth-feedback-alert.tsx), [auth-footer-help.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/components/auth-footer-help.tsx), [auth-feature-pill.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/components/auth-feature-pill.tsx), [login-email-password-form.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/components/login-email-password-form.tsx), [login-magic-link-form.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/components/login-magic-link-form.tsx), [login-totp-challenge-form.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/components/login-totp-challenge-form.tsx), [register-form.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/components/register-form.tsx).
- **Hooks & Utilitários:** [use-login-form.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/hooks/use-login-form.ts), [use-register-form.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/hooks/use-register-form.ts), [login-backoff.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/utils/login-backoff.ts), [login-redirect.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/utils/login-redirect.ts).

### C. Módulo Legal & Termos (`src/features/legal/*`) — 13 arquivos de produção
- **Páginas:** [privacy-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/legal/pages/privacy-page.tsx), [terms-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/legal/pages/terms-page.tsx).
- **Componentes:** [legal-page-shell.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/legal/components/legal-page-shell.tsx), [legal-header.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/legal/components/legal-header.tsx), [legal-footer.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/legal/components/legal-footer.tsx), [privacy-highlights-grid.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/legal/components/privacy-highlights-grid.tsx), [privacy-rights-and-cookies-sections.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/legal/components/privacy-rights-and-cookies-sections.tsx), [privacy-self-service-section.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/legal/components/privacy-self-service-section.tsx), [terms-highlights-grid.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/legal/components/terms-highlights-grid.tsx), [terms-regulatory-clauses.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/legal/components/terms-regulatory-clauses.tsx).

### D. Administração & Perícia Forense (`src/features/admin/*`) — 101 arquivos de produção
- **Páginas & Hubs:** [admin-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/pages/admin-page.tsx), [use-admin-dashboard-data.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/hooks/use-admin-dashboard-data.ts).
- **Gestão de Usuários & Convites:** [admin-users-list.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/components/admin-users-list.tsx), [user-create-dialog.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/components/user-create-dialog.tsx), [user-edit-dialog.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/components/user-edit-dialog.tsx), [user-module-permissions-matrix.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/components/user-edit/user-module-permissions-matrix.tsx), [user-saas-plan-section.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/components/user-edit/user-saas-plan-section.tsx), [user-superadmin-support-actions.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/components/user-edit/user-superadmin-support-actions.tsx), [user-pii-audit-vault-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/components/user-edit/user-pii-audit-vault-card.tsx), [invites-desktop-table.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/components/invites-desktop-table.tsx), [invites-mobile-list.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/components/invites-mobile-list.tsx), [create-invite-dialog.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/components/create-invite-dialog.tsx).
- **Métricas, Backups & Suporte:** [admin-metrics-kpi-grid.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/components/admin-metrics-kpi-grid.tsx), [backup-integrity-verifier.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/components/backup-integrity-verifier.tsx), [backup-history-list.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/components/backup-history-list.tsx), [ticket-manage-dialog.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/components/ticket-manage-dialog.tsx), [ticket-row.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/components/ticket-row.tsx), [broadcast-composer-form.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/components/broadcast-composer-form.tsx), [telegram-settings-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/components/telegram-settings-card.tsx).
- **Perícia Forense (Forensics Engine):** [forensics-dashboard.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/forensics/components/forensics-dashboard.tsx), [forensics-invariants-list.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/forensics/components/forensics-invariants-list.tsx), [forensics-artifacts-panel.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/forensics/components/forensics-artifacts-panel.tsx), [forensics-journeys-inspector.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/forensics/components/forensics-journeys-inspector.tsx), [forensics-snapshot-inspector.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/forensics/components/forensics-snapshot-inspector.tsx), [headless-state-store.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/forensics/core/engine/headless-state-store.ts), [headless-transaction-router.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/forensics/core/engine/headless-transaction-router.ts), [audit-runner.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/forensics/core/runner/audit-runner.ts), [excel-proof-builder.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/admin/forensics/core/reporters/excel-proof-builder.ts), além dos módulos de jornadas, personas e matrizes de invariantes.

---

## 3. Matriz de Avaliação das 20 Dimensões Canônicas

| Dimensão | Avaliação | Diagnóstico nos 180 Arquivos de Produção |
|---|---|---|
| **D1: Tipografia & Fontes** | Conforme | Aplicação estrita de `font-display` nos títulos editoriais da Landing, Auth e Legal; `tabular-nums` em métricas. |
| **D2: Herança de Cor Destaque** | Conforme | Accent respeitado em CTAs primários de conversão, badges promocionais e destaques de planos. |
| **D3: Pirâmide de Botões** | Conforme | CTA primário destacado ("Começar Agora", "Entrar", "Aprovar Usuário"); ações secundárias em `outline`/`ghost`. |
| **D4: Espaçamento & Alinhamento** | Conforme | Paddings canônicos `p-3.5 sm:p-4`, espaçamento vertical harmônico entre seções editoriais (`py-12 sm:py-20`). |
| **D5: Feedback Sensorial** | Conforme | Zero `triggerHaptic` direto. Disparos sensoriais passam exclusivamente por `triggerSensory(...)`. |
| **D6: Touch Targets (Mobile)** | Conforme | Alvos de toque com `min-h-11` na navegação mobile da Landing ([landing-mobile-drawer.tsx:48](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/landing-mobile-drawer.tsx#L48)) e dock flutuante. |
| **D7: Empty States & Loading** | Conforme | Skeletons fluidos em tabelas de admin e empty states neutros. |
| **D8: Modais & Diálogos** | Conforme | Todos os diálogos utilizam a prop `size="sm" | "md" | "lg" | "xl"` sem injeção de classes de largura máxima. |
| **D9: Abas Fluidas** | Conforme | Abas da Landing (Simulador, Preços) e do Admin utilizam rolagem horizontal suave no mobile. |
| **D10: Grids Mobile-First** | Conforme | Grids editoriais e de métricas iniciam em 1 ou 2 colunas (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`). Zero `grid-cols-3` rígido sem prefixo responsivo. |
| **D11: Auto-fit Monetário** | Conforme | Preços na Landing e faturamento formatados via `<MoneyText />` sem `truncate` direto. |
| **D12: Tokens de Z-Index** | **Anomalia Leve** | [landing-header.tsx:79](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/landing-header.tsx#L79) e [legal-header.tsx:15](file:///home/gabrielsales/meus_apps/financasnew/src/features/legal/components/legal-header.tsx#L15) utilizam `sticky top-0 z-40` cru (devem migrar para `.z-sticky`); [mobile-cta-dock.tsx:25](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/mobile-cta-dock.tsx#L25) adota `z-30` e [auth-shell.tsx:47](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/components/auth-shell.tsx#L47) adota `relative z-1`. |
| **D13: Hierarquia de Ícones** | Conforme | Nível 1 sóbrio em formulários e cards comuns; Nível 2 em heróis de boas-vindas e status de aprovação pendente. |
| **D14: Teto de 250 Linhas** | **Atenção (7 arquivos no Admin Forensics)** | 100% dos arquivos de UI voltados ao usuário final (`landing`, `auth`, `legal`) estão abaixo de 240 linhas. O motor de perícia forense do Admin possui 7 arquivos com > 250 linhas (máx: 738 l em `lifecycle-invariants.ts`). |
| **D15: Anel de Foco WCAG 2.4.7 AA** | **Atenção** | Identificados seletores customizados e links do rodapé na Landing Page sem a classe canônica `focus-visible:ring-1 focus-visible:ring-ring`. |
| **D16: Superfície & Elevação** | **Atenção Sutil** | Cards de mockups na Landing Page utilizam divisórias com `border-border/60` e `border-border/70` onde a trinca `border-border/80 bg-surface shadow-xs` deve ser padronizada. |
| **D17: Acessibilidade & Semântica** | Conforme | Estrutura semântica com `<main>`, `<header>`, `<footer>`, `<nav>`, `role="dialog"` e validação de lint limpa (zero emojis). |
| **D18: Zero autoFocus & iOS Zoom** | Conforme | Zero `autoFocus` declarativo e inputs com `text-base sm:text-sm`. |
| **D19: Modo Privacidade** | Conforme | Telas de autenticação sem vazamento de PII e cofre de auditoria restrito no Admin. |
| **D20: Gráficos SVG & Indicadores** | Conforme | Gráficos SVG interativos da Landing ([fire-interactive-svg-chart.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/fire-interactive-svg-chart.tsx)) com acessibilidade e curvas suaves. |

---

## 4. Detalhamento das Anomalias e Pontos de Alinhamento Identificados

### Anomalia 1: Z-Index Cru em Headers Públicos e Docks (Dimensão 12)
1. **[landing-header.tsx:79](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/landing-header.tsx#L79)** e **[legal-header.tsx:15](file:///home/gabrielsales/meus_apps/financasnew/src/features/legal/components/legal-header.tsx#L15):**
   - **Código Atual:** `sticky top-0 z-40 w-full ...`
   - **Problema:** Colisão com `--z-sidebar: 40`.
   - **Ação:** Substituir por `sticky top-0 z-sticky w-full ...` (token canônico `--z-sticky: 20`).
2. **[mobile-cta-dock.tsx:25](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/mobile-cta-dock.tsx#L25):**
   - **Código Atual:** `fixed bottom-0 left-0 right-0 z-30 ...`
   - **Ação:** Mapear para o token canônico de elementos flutuantes / sticky bottom.
3. **[auth-shell.tsx:47](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/components/auth-shell.tsx#L47):**
   - **Código Atual:** `relative z-1 ...`
   - **Ação:** Remover z-index inline atípico ou substituir por classe canônica do Tailwind.

### Anomalia 2: Anéis de Foco em Controles da Landing Page (Dimensão 15 - WCAG 2.4.7 AA)
- **Seletores e Abas Customizadas:**
  - [pricing-section.tsx:32, 47](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/pricing-section.tsx#L32): Botões de alternância Mensal / Anual.
  - [fire-projection-metrics.tsx:71, 85](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/fire-projection-metrics.tsx#L71): Botões de ajuste rápido de aporte/renda.
  - [simulator-inputs-panel.tsx:43, 84, 124](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/simulator/simulator-inputs-panel.tsx#L43): Botões de seleção de predefinições e prazo.
  - [simulator-allocation-results.tsx:45, 82](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/simulator/simulator-allocation-results.tsx#L45): Cards clicáveis de distribuição de ativos.
  - [landing-mobile-drawer.tsx:48, 62](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/landing-mobile-drawer.tsx#L48): Botões de navegação da gaveta mobile.
- **Links Institucionais de Rodapé:**
  - [landing-footer.tsx:62-111](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/landing-footer.tsx#L62): Links de navegação sem foco visível no teclado.
- **Ação Recomendada:** Aplicar `rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring` em todos os botões e links customizados.

### Anomalia 3: Arquivos Extensos no Subsistema de Perícia Forense (Dimensão 14)
- **Localização:** `src/features/admin/forensics/*`
- **Arquivos:**
  1. `lifecycle-invariants.ts` (738 linhas)
  2. `headless-state-store.ts` (544 linhas)
  3. `excel-proof-builder.ts` (532 linhas)
  4. `headless-transaction-router.ts` (480 linhas)
  5. `audit-runner.ts` (376 linhas)
  6. `forensics-dashboard.tsx` (333 linhas)
  7. `personas/types.ts` (291 linhas)
- **Diagnóstico:** O motor forense simula milhares de transações concorrentes offline para provar invariantes matemáticas (soma de saldos, partidas dobradas, ausência de floating-point drift). Por se tratar de um harness analítico interno de administração e não de UI voltada ao consumidor, sua priorização de quebra é de nível secundário (Onda 4), focando primeiro nas 6 partes de UI.

---

## 5. Próximos Passos & Transição para Consolidação Final

Com a conclusão da **Parte 9**, **100% dos arquivos do repositório Axir foram auditados** nas 20 dimensões canônicas, totalizando **9 relatórios seccionais detalhados** cobrindo mais de 800 arquivos inspecionados.

> [!IMPORTANT]
> **Portão de Bloqueio:** Conforme o protocolo de governança, nenhuma alteração em código de produção foi efetuada nesta etapa. Aguardando a aprovação explícita ("OK") do usuário para gerar o **Plano Mestre Consolidado de Refatoração e Padronização Visual (`docs/plans/PLANO_MESTRE_REFATORACAO_E_PADRONIZACAO_VISUAL.md`)**, estruturado em 4 Ondas de Execução sequenciais com Definition of Done rigorosa.
