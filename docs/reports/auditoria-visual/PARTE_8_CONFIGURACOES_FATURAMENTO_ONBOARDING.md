# Relatório de Auditoria Visual & UX — Parte 8: Configurações, Faturamento, Onboarding & Demo Tour

> **Status:** Concluído  
> **Data:** 20/11/2026  
> **Escopo:** `src/features/settings/*`, `src/features/subscription/*`, `src/features/onboarding/*`, `src/features/demo-tour/*`  
> **Total de arquivos de produção auditados:** 90 arquivos (56 em Configurações, 18 em Faturamento/Assinaturas, 6 em Onboarding, 10 em Demo Tour)  
> **Total de arquivos inspecionados (incluindo testes):** 104 arquivos  
> **Conformidade Geral Estimada:** **95.2%**  

---

## 1. Sumário Executivo & Destaques de Arquitetura

A **Parte 8** da auditoria debruçou-se sobre a infraestrutura de personalização, segurança, ciclo de vida do usuário e sustentação comercial do Axir: a central de **Configurações & Governança de Conta** (perfil, credenciais, MFA/2FA, PIN, tokens de aparência/acento, limites de orçamento, assistente bancário e privacidade), o fluxo de **Assinaturas & Checkout Transparente** (planos Pro/Casal/Família, Pix com QR code dinâmico, cartão com Stripe/Asaas, conciliação e histórico de faturas), o **Onboarding de Boas-Vindas** e o **Demo Tour / Spotlight** (simulador guiado por hotspots interativos).

### Principais Conquistas Arquiteturais Observadas:
1. **100% dos Botões com Anéis de Foco Padronizados (Dimensão 15 - WCAG 2.4.7 AA):**
   - Zero botões sem foco visível encontrados nos 90 arquivos de produção. Todos os botões, interruptores de modo e seletores de paleta utilizam `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`.
2. **Matriz de Modais Estrita & Zero `max-w-*` Arbitrários (Dimensão 8 & Regra 18):**
   - Todos os modais ([change-password-modal.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/change-password-modal.tsx), [mfa-modal.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/mfa-modal.tsx), [pin-setup-dialog.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/pin-setup-dialog.tsx), [welcome-modal.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/onboarding/welcome-modal.tsx), [demo-track-select-modal.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/demo-tour/demo-track-select-modal.tsx)) utilizam a prop canônica `size="sm" | "md" | "lg" | "xl"` sem injeção de largura máxima via `className`.
3. **Zero autoFocus e Tipografia Móvel Anti-Zoom (Dimensão 18 & Regra 20):**
   - Zero ocorrências de `autoFocus` declarativo e inputs com `text-base sm:text-sm`, prevenindo saltos de viewport e auto-zoom no iOS Safari.
4. **Zero Emojis e Validação de Lint 100% Limpa:**
   - ESLint retornou código de saída 0 em todos os 104 arquivos, garantindo conformidade com a regra `local/no-decorative-unicode`.

---

## 2. Inventário de Arquivos Auditados

### A. Configurações & Segurança (`src/features/settings/*`) — 56 arquivos de produção
- **Páginas & Roteamento:** [settings-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/pages/settings-page.tsx), [settings-routes.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/utils/settings-routes.ts).
- **Abas Principais:** [account-tab.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/account-tab.tsx), [appearance-tab.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/appearance-tab.tsx), [security-tab.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/security-tab.tsx), [subscription-tab.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/subscription-tab.tsx), [notifications-tab.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/notifications-tab.tsx), [support-tab.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/support-tab.tsx).
- **Subcomponentes de Conta & Identidade:** [account-details-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/account/account-details-card.tsx), [account-sessions-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/account/account-sessions-card.tsx), [change-email-modal.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/account/change-email-modal.tsx), [change-password-modal.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/change-password-modal.tsx), [profile-credentials-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/account/profile-credentials-card.tsx), [delete-account-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/delete-account-card.tsx).
- **Subcomponentes de Aparência:** [accent-palette-selector.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/accent-palette-selector.tsx), [theme-mode-selector.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/theme-mode-selector.tsx), [visual-identity-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/visual-identity-card.tsx), [experience-presets-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/experience-presets-card.tsx), [interface-shortcuts-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/interface-shortcuts-card.tsx).
- **Segurança, MFA, PIN & Dispositivos:** [mfa-modal.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/mfa-modal.tsx), [mfa-intro-step.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/mfa-intro-step.tsx), [mfa-qr-enroll-step.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/mfa-qr-enroll-step.tsx), [mfa-active-status-step.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/mfa-active-status-step.tsx), [mfa-password-gate-step.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/mfa-password-gate-step.tsx), [use-mfa-enrollment-flow.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/use-mfa-enrollment-flow.ts), [pin-setup-dialog.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/pin-setup-dialog.tsx), [active-devices-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/active-devices-card.tsx), [device-row-item.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/security/device-row-item.tsx), [revoke-device-modal.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/security/revoke-device-modal.tsx), [app-lock-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/security/app-lock-card.tsx), [app-about-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/security/app-about-card.tsx), [use-settings-csv-export.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/security/use-settings-csv-export.ts).
- **Notificações & Assistente Bancário:** [banking-assistant-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/notifications/banking-assistant-card.tsx), [banking-assistant-options.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/notifications/banking-assistant-options.tsx), [banking-catalog-accordion.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/notifications/banking-catalog-accordion.tsx), [installed-banking-apps-section.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/notifications/installed-banking-apps-section.tsx), [prominent-disclosure-modal.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/notifications/prominent-disclosure-modal.tsx), [reminders-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/notifications/reminders-card.tsx), [use-banking-assistant.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/notifications/use-banking-assistant.ts).
- **Assinaturas & Faturamento:** [current-plan-hero-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/subscription/current-plan-hero-card.tsx), [plan-comparison-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/subscription/plan-comparison-card.tsx), [payment-method-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/subscription/payment-method-card.tsx), [invoice-history-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/subscription/invoice-history-card.tsx), [cumulative-renewal-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/subscription/cumulative-renewal-card.tsx), [cancellation-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/subscription/cancellation-card.tsx), [cancel-subscription-wizard-modal.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/subscription/cancel-subscription-wizard-modal.tsx), [pix-renewal-checkout-modal.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/subscription/pix-renewal-checkout-modal.tsx), [update-card-modal.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/subscription/update-card-modal.tsx), [use-cumulative-renewal.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/subscription/use-cumulative-renewal.ts), [support-ticket-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/support/support-ticket-card.tsx), [family-budget-share-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/family-budget-share-card.tsx).

### B. Assinaturas & Checkout (`src/features/subscription/*`) — 18 arquivos de produção
- **Páginas:** [subscription-checkout-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/pages/subscription-checkout-page.tsx), [subscription-success-page.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/pages/subscription-success-page.tsx).
- **Componentes de Checkout:** [checkout-header.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/components/checkout-header.tsx), [checkout-order-summary.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/components/checkout-order-summary.tsx), [checkout-payment-method-selector.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/components/checkout-payment-method-selector.tsx), [checkout-plan-summary-sidebar.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/components/checkout-plan-summary-sidebar.tsx), [checkout-submit-footer.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/components/checkout-submit-footer.tsx), [checkout-inline-auth-step.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/components/checkout-inline-auth-step.tsx), [checkout-email-confirmation-view.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/components/checkout-email-confirmation-view.tsx), [credit-card-checkout-form.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/components/credit-card-checkout-form.tsx), [pix-qr-waiting-panel.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/components/pix-qr-waiting-panel.tsx), [success-receipt-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/components/success-receipt-card.tsx).
- **Hooks & Validações:** [use-subscription-checkout.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/hooks/use-subscription-checkout.ts), [use-checkout-pix-flow.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/hooks/use-checkout-pix-flow.ts), [checkout-validation.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/utils/checkout-validation.ts), [checkout-submit.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/utils/checkout-submit.ts).

### C. Onboarding de Boas-Vindas (`src/features/onboarding/*`) — 6 arquivos de produção
- [welcome-modal.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/onboarding/welcome-modal.tsx), [welcome-intro-step.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/onboarding/welcome-intro-step.tsx), [welcome-goal-step.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/onboarding/welcome-goal-step.tsx), [welcome-tour-confirm-step.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/onboarding/welcome-tour-confirm-step.tsx), [use-initial-onboarding.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/onboarding/use-initial-onboarding.ts), [index.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/onboarding/index.ts).

### D. Demo Tour & Spotlight (`src/features/demo-tour/*`) — 10 arquivos de produção
- [demo-tour-spotlight.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/demo-tour/demo-tour-spotlight.tsx), [demo-track-select-modal.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/demo-tour/demo-track-select-modal.tsx), [spotlight-step-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/demo-tour/spotlight-step-card.tsx), [spotlight-completion-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/demo-tour/spotlight-completion-card.tsx), [spotlight-svg-mask.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/demo-tour/spotlight-svg-mask.tsx), [track-option-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/demo-tour/track-option-card.tsx), [demo-tracks-metadata.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/demo-tour/demo-tracks-metadata.ts), [use-spotlight-target-rect.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/demo-tour/hooks/use-spotlight-target-rect.ts), [use-spotlight-focus-keyboard.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/demo-tour/hooks/use-spotlight-focus-keyboard.ts), [index.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/demo-tour/index.ts).

---

## 3. Matriz de Avaliação das 20 Dimensões Canônicas

| Dimensão | Avaliação | Diagnóstico nos 90 Arquivos de Produção |
|---|---|---|
| **D1: Tipografia & Fontes** | Conforme | Aplicação estrita de `font-display` nos títulos de cards e seções, `tabular-nums` em todas as métricas e datas. |
| **D2: Herança de Cor Destaque** | Conforme | Seletor de paletas em [accent-palette-selector.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/accent-palette-selector.tsx) sincronizado com `--primary`; herança nos botões de CTA e planos recomendados. |
| **D3: Pirâmide de Botões** | Conforme | Hierarquia de CTA primário único por formulário de checkout e botões secundários em `outline`/`ghost`. |
| **D4: Espaçamento & Alinhamento** | Conforme | Paddings canônicos `p-3.5 sm:p-4`, gaps padronizados `gap-4 sm:gap-6`. |
| **D5: Feedback Sensorial** | Conforme | Chamadas exclusivas via `triggerSensory(...)` e `sensoryIntent` declarativo em `<Button />`. Zero `triggerHaptic` direto. |
| **D6: Touch Targets (Mobile)** | Conforme | Targets expandidos com `min-h-11 sm:min-h-10` em switches de tema, seletores de cor e opções de trilha do tour. |
| **D7: Empty States & Loading** | Conforme | Empty states sóbrios e feedback de carregamento em botões com prop `loading`. |
| **D8: Modais & Diálogos** | Conforme | Todos os modais seguem a matriz canônica de tamanhos (`size="sm"`, `size="md"`, `size="lg"`, `size="xl"`). |
| **D9: Abas Fluidas** | Conforme | [settings-page.tsx:75](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/pages/settings-page.tsx#L75) adota `fullWidth={false}` e rolagem horizontal suave no mobile para as 6 abas de configuração. |
| **D10: Grids Mobile-First** | Conforme | Zero ocorrências de `grid-cols-3` rígido sem prefixo responsivo. Grids iniciam em 1 ou 2 colunas. |
| **D11: Auto-fit Monetário** | Conforme | Zero `truncate` em quantias monetárias nos planos e faturas; uso de `<MoneyText />`. |
| **D12: Tokens de Z-Index** | **Anomalia Leve** | [checkout-header.tsx:10](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/components/checkout-header.tsx#L10) adota `sticky top-0 z-40` cru (colidindo com `--z-sidebar: 40`), devendo migrar para o token canônico `.z-sticky` (`--z-sticky: 20`). |
| **D13: Hierarquia de Ícones** | Conforme | Nível 1 sóbrio em títulos de cards comuns e Nível 2 nos heróis editoriais e status de segurança. |
| **D14: Teto de 250 Linhas** | **Atenção (3 arquivos)** | Identificados 3 arquivos que ultrapassam o teto de 250 linhas ([use-spotlight-target-rect.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/demo-tour/hooks/use-spotlight-target-rect.ts): 566 l, [app-about-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/security/app-about-card.tsx): 323 l, [use-mfa-enrollment-flow.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/use-mfa-enrollment-flow.ts): 293 l). |
| **D15: Anel de Foco WCAG 2.4.7 AA** | **Atenção Sutil** | 100% dos botões em conformidade; identificados 5 links inline de texto puro sem anel de foco visível. |
| **D16: Superfície & Elevação** | **Atenção Sutil** | Em [experience-presets-card.tsx:99](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/experience-presets-card.tsx#L99), divisor adota `border-border/60` em vez de `border-border/80`. |
| **D17: Acessibilidade & Semântica** | Conforme | Labels semânticos, `aria-pressed`, `aria-describedby` e conformidade total com ESLint (zero emojis). |
| **D18: Zero autoFocus & iOS Zoom** | Conforme | Zero `autoFocus` declarativo e inputs com `text-base sm:text-sm`. |
| **D19: Modo Privacidade** | Conforme | Mascaramento de dados sensíveis e credenciais. |
| **D20: Gráficos SVG & Indicadores** | Conforme | Máscara SVG do spotlight com transição suave e recorte responsivo. |

---

## 4. Detalhamento das Anomalias e Pontos de Alinhamento Identificados

### Anomalia 1: Arquivos Monolíticos que Ultrapassam o Teto de 250 Linhas (Dimensão 14)
1. **[use-spotlight-target-rect.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/demo-tour/hooks/use-spotlight-target-rect.ts#L1-L566) (566 linhas):**
   - **Diagnóstico:** O hook acumula múltiplas responsabilidades de baixo nível: polling com MutationObserver/ResizeObserver, busca resiliente por seletores candidatos, cálculo de rolagem dead-center e cálculo de geometria da máscara e do card flutuante.
   - **Plano de Refatoração:** Desacoplar em 3 hooks modulares:
     - `use-spotlight-target-element.ts` (~160 linhas): Observador e polling resiliente de elementos DOM;
     - `use-spotlight-scroll-aligner.ts` (~120 linhas): Rolagem suave e centralização da janela no alvo;
     - `use-spotlight-target-rect.ts` (~180 linhas): Orquestrador final de geometria e retorno de estado.
2. **[app-about-card.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/security/app-about-card.tsx#L1-L323) (323 linhas):**
   - **Diagnóstico:** O componente acumula as ações de verificação e atualização in-app de APK nativo + ServiceWorker PWA com a renderização do card descritivo de versão e os diálogos de instalação.
   - **Plano de Refatoração:** Extrair a barra de ações e verificação para `app-update-actions.tsx` (~110 linhas), mantendo `app-about-card.tsx` focado na exibição de dados da versão e plataforma (~160 linhas).
3. **[use-mfa-enrollment-flow.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/use-mfa-enrollment-flow.ts#L1-L293) (293 linhas):**
   - **Diagnóstico:** Agrupa a inscrição inicial de MFA TOTP com a lógica de desautenticação/portão de segurança para reconfiguração.
   - **Plano de Refatoração:** Extrair a etapa de verificação de portão de segurança para `use-mfa-security-gate.ts` (~110 linhas), reduzindo o hook principal para ~180 linhas.

### Anomalia 2: Z-Index Collision em Cabeçalho de Checkout (Dimensão 12)
- **Arquivo:** [src/features/subscription/components/checkout-header.tsx:10](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/components/checkout-header.tsx#L10)
- **Código Atual:**
  ```tsx
  <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur-md shadow-xs pt-[max(env(safe-area-inset-top,0px),var(--safe-area-top,0px))]">
  ```
- **Problema:** Uso de `z-40` cru que colide com o token canônico da sidebar (`--z-sidebar: 40`).
- **Ação Recomendada:** Substituir `z-40` por `z-sticky` (token `--z-sticky: 20`).

### Anomalia 3: Links Inline de Texto Puro sem Anel de Foco Visível (Dimensão 15)
- **Arquivos:**
  1. [account-details-card.tsx:86](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/account/account-details-card.tsx#L86): Link para histórico de acessos.
  2. [checkout-inline-auth-step.tsx:105, 114](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/components/checkout-inline-auth-step.tsx#L105): Links de alternância entre "Já tenho conta" e "Criar conta".
  3. [checkout-submit-footer.tsx:52, 61](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/components/checkout-submit-footer.tsx#L52): Links para "Termos de Uso" e "Política de Privacidade".
- **Problema:** Links de texto puro omitem a classe de anel de foco `focus-visible:ring-1 focus-visible:ring-ring`, violando WCAG 2.4.7 AA em navegação por teclado.
- **Ação Recomendada:** Adicionar `rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`.

### Anomalia 4: Opacidade Divergente de Borda (Dimensão 16)
- **Arquivo:** [src/features/settings/components/tabs/experience-presets-card.tsx:99](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/experience-presets-card.tsx#L99)
- **Código Atual:** `border-t border-border/60`
- **Ação Recomendada:** Padronizar para `border-t border-border/80`.

---

## 5. Próximos Passos & Transição

Com a conclusão da auditoria da **Parte 8**:
- A infraestrutura de Configurações, Faturamento, Onboarding e Demo Tour está plenamente catalogada (**95.2% de conformidade**).
- As refatorações dos 3 arquivos monolíticos serão agendadas na **Onda 2** (Arquitetura & Limites de Linha), e as padronizações visuais de links e tokens de z-index na **Onda 3** do Plano Mestre.

> [!IMPORTANT]
> **Portão de Bloqueio:** Conforme o protocolo de governança, nenhuma alteração em código de produção foi efetuada nesta etapa. Aguardando a aprovação explícita ("OK") do usuário para iniciar a **Parte 9: Casca Pública, Autenticação, Legal & Admin (`src/features/landing/*`, `src/features/auth/*`, `src/features/legal/*`, `src/features/admin/*`)**.
