# 28 — Captura Inteligente de Pix, Memória Adaptativa e Fricção Zero

> **Status:** Em execução
> **Classificação (AGENTS.md §10.5):** 🔵 Fluxo Completo (Feature/Plano)
> **Versão alvo:** 3.5.0
> **Quality gate previsto:** `npm run verify:full`

---

## 1. Visão Geral e Objetivos

Eliminar a fricção de lançamento de receitas e despesas realizadas via Pix ou bancos, permitindo que o usuário copie um código Pix (Copia e Cola BR Code EMV), uma chave Pix avulsa (CPF, CNPJ, e-mail, telefone, chave aleatória), um link de cobrança ou mensagem bancária compartilhada, e o aplicativo reconheça instantaneamente os dados e abra o **Wizard Rápido** pré-preenchido.

Além disso, introduzir o **motor de memória contínua de chaves Pix**, onde o sistema aprende a categoria e o tipo de lançamento a partir das decisões anteriores do usuário com aquele recebedor ou chave.

Corrigir também a falha na **calculadora**, onde a leitura da área de transferência gerava erros devido a falha de regex em frases e conflitos de modais.

---

## 2. Fases de Execução

| Fase | Escopo | Arquivos Principais | Critério de Aceite |
|---|---|---|---|
| **Fase 1** | Correção e blindagem da Calculadora | `src/domain/calculator/index.ts`, `floating-calculator.tsx` | Regex monetário tolerante a frases; remoção de colisão de modais; testes passando. |
| **Fase 2** | Motor Puro de Extração Pix Multiformato | `src/domain/notifications/pix-emv-parser.ts`, `pix-text-parser.ts`, `pix-clipboard.ts` | Extração de chave da tag 26 EMV, detecção de CPF/CNPJ/e-mail/celular/EVP, links e mensagens. |
| **Fase 3** | Memória Adaptativa com Chaves Pix | `src/domain/notifications/merchant-memory.ts`, `src/services/merchant-learning.ts` | Associação de chave Pix à categoria; busca por chave; aprendizado contínuo no submit. |
| **Fase 4** | Integração na Home e no Wizard Rápido | `OverviewPage`, `DashboardAlertsCarousel`, `LaunchWizard` | Banner/card de 1 toque na Home; colagem multiformato no Wizard; abertura rápida pré-preenchida. |
| **Fase 5** | Testes de regressão e Quality Gate | Suíte Vitest + ESLint | 100% testes verdes; zero emojis; zero erros de lint. |
