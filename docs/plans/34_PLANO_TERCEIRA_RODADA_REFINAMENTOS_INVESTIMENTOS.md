# Plano Canônico — Terceira Rodada de Refinamentos de Investimentos

> **Versão Alvo:** v3.6.4 (Build 63)  
> **Data:** 13 de Novembro de 2026  
> **Objetivo:** Blindagem fiscal de criptoativos no motor DARF 6015, resolução precisa de cotas fracionárias em sugestões de aportes no Wizard, padronização canônica de rodapés de modais e blindagem contra duplo clique em eventos societários.

---

## 1. Escopo das Implementações

| ID | Área | Arquivos | Descrição |
|---|---|---|---|
| **AUDIT-06** | Apuração Fiscal & Criptoativos | `src/domain/portfolio/tax.ts`<br>`src/domain/portfolio/tax.test.ts` | Criação de `isCryptoAsset` e segregação estrita de alienações de criptoativos em `calculateMonthlyDarf` e `calculateHistoricalLossesCarryover`, impedindo contaminação do limite de R$ 20.000,00 de ações locais B3 e geração indevida de DARF 6015 (criptoativos sujeitos ao GCAP / DARF 4600 com isenção própria de R$ 35.000,00 da IN RFB 1.888). |
| **AUDIT-07** | Aportes & Wizard Fracionário | `src/features/investments/wizard/investment-wizard.tsx`<br>`src/features/investments/wizard/step-select.tsx` | Substituição do truncamento estático `Math.floor` por cálculo ponderado pela precisão do ativo (`resolveAssetPrecision`), permitindo que caixas parciais sugiram cotas fracionárias para Tesouro Direto, Criptoativos e Ativos Internacionais USD. |
| **AUDIT-08** | Governança de Modais (Regras 15 e 18) | `src/features/investments/components/contribution-form-dialog.tsx`<br>`src/features/investments/components/manual-price-dialog.tsx` | Migração dos rodapés para a prop canônica `destructiveAction` do `ModalFooter`, eliminando tags vazias `<span />` e cascas manuais `flex-col-reverse`. |
| **AUDIT-09** | Concorrência em Desdobramentos | `src/features/investments/components/asset-split-dialog.tsx` | Inclusão de `createTx.isPending` no estado desabilitado do botão de confirmação, prevenindo gravações duplicadas no ledger por duplo clique. |

---

## 2. Fases de Execução

- **Fase 1 (Domínio Fiscal):** Implementar `isCryptoAsset` e a segregação em `tax.ts`; criar testes em `tax.test.ts`.
- **Fase 2 (Wizard de Aportes):** Implementar precisão fracionária em `investment-wizard.tsx` e `step-select.tsx`; rodar testes do wizard.
- **Fase 3 (Ergonomia e Modais):** Atualizar `contribution-form-dialog.tsx`, `manual-price-dialog.tsx` e `asset-split-dialog.tsx`.
- **Fase 4 (Quality Gates & Release):** Executar bateria completa de testes de investimentos, auditoria de segurança, `tsc -b`, `npm run lint`, `npm run build`, bump para v3.6.4 (Build 63), commit, push e notificação Telegram.
