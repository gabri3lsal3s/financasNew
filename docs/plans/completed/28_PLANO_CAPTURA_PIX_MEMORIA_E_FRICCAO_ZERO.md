# 28 — Captura Inteligente de Pix, Memória Adaptativa e Fricção Zero

> **Status:** Concluído com sucesso (Quality Gate 100% verde)
> **Classificação (AGENTS.md §10.5):** 🔵 Fluxo Completo (Feature/Plano)
> **Versão alvo:** 3.5.0
> **Quality gate:** `npm run lint` (0 erros) + `npx tsc --noEmit` (0 erros) + `vitest` (606 testes aprovados)

---

## 1. Visão Geral e Objetivos

Eliminar a fricção de lançamento de receitas e despesas realizadas via Pix ou bancos, permitindo que o usuário copie um código Pix (Copia e Cola BR Code EMV), uma chave Pix, um link de cobrança ou mensagem bancária compartilhada, e o aplicativo reconheça instantaneamente os dados e abra o **Wizard Rápido** pré-preenchido.

### Requisito Estrito da Home e do Wizard (Comportamento Reativo Fricção Zero)
- **Zero Card Fixo:** O card de Pix **NUNCA fica fixo** na tela inicial.
- **Detecção Exclusiva com Valor Válido (> R$ 0,00):** Chaves avulsas sem valor associado não poluem a Home. O card de sugestão só surge se houver um Pix com valor monetário detectado na área de transferência (ex: BR Code com valor, mensagem com valor ou link com valor).
- **Botão "Colar Pix" Condicional no Wizard:** O botão `[📋 Colar Pix]` no cabeçalho do `LaunchWizard` agora **só é exibido quando for identificado um Pix com valor válido na área de transferência**. Sem Pix válido ou com chave sem valor, apenas o botão `[📎 Anexar]` permanece visível, eliminando ruído visual.
- **Dispensável e Limpeza Automática:** Ao clicar em Lançar ou Dispensar, o estado é limpo ou gravado para não incomodar o usuário repetidamente.

Além disso, introduzir o **motor de memória contínua de chaves Pix**, onde o sistema aprende a categoria e o tipo de lançamento a partir das decisões anteriores do usuário com aquele recebedor ou chave.

Corrigir também a falha na **calculadora**, onde a leitura da área de transferência gerava erros devido a falha de regex em frases e conflitos de modais.

---

## 2. Fases Executadas

| Fase | Escopo | Arquivos Principais | Status |
|---|---|---|---|
| **Fase 1** | Correção e blindagem da Calculadora | `src/domain/calculator/index.ts`, `floating-calculator.tsx` | Concluído. Regex tolerante a frases (BRL e internacional); fallback elevado com feedback amigável; 18 testes passando. |
| **Fase 2** | Motor Puro de Extração Pix Multiformato | `src/domain/notifications/pix-emv-parser.ts`, `pix-text-parser.ts`, `pix-clipboard.ts` | Concluído. Decodificação de chave na tag 26 EMV, detecção de CPF/CNPJ/e-mail/celular/EVP, links e mensagens; 26 testes passando. |
| **Fase 3** | Memória Adaptativa com Chaves Pix | `src/domain/notifications/merchant-memory.ts`, `merchant-resolver.ts`, `merchant-learning.ts` | Concluído. Suporte a `pixKeys` e `defaultNature`; busca na Camada 1 por chave Pix; aprendizado contínuo no submit. |
| **Fase 4** | Detector Reativo e Card Não-Fixo na Home | `use-pix-clipboard-detector.ts`, `overview-page.tsx`, `dashboard-pix-clipboard-card.tsx` | Concluído. Hook passivo (`focus` / `visibilitychange`) que só ativa com `valueCents > 0`; card dinâmico no carrossel de alertas; botões adaptativos Lançar Receita/Despesa. |
| **Fase 5** | Testes de regressão e Quality Gate | Suíte Vitest + ESLint + TypeScript | Concluído. 606 testes passando (incluindo testes de unidade do hook e do card), 0 erros de lint, 0 erros de tipagem. |
