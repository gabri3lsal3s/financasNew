# Laboratório Forense de Auditoria Quantitativa, Sintética e Contínua

> **Status:** Ativo e Homologado (Portão 5 Concluído) · **Ambiente:** Híbrido (CLI + Painel Admin) · **Versão:** 1.0.0 · **Conformidade:** AGENTS.md, FINANCIAL_MATH_SPEC.md, LGPD

---

## 1. Visão Geral e Propósito

O **Laboratório Forense de Auditoria Quantitativa** do Axir é uma infraestrutura de grau institucional projetada para certificar, comprovar matematicamente e auditar de forma contínua a exatidão numérica de todas as regras de negócio e motores de cálculo do sistema.

Operando de maneira **híbrida** — via linha de comando no terminal e via tela administrativa no navegador —, o laboratório submete o ecossistema financeiro do produto a uma suíte exaustiva de testes de estresse em memória, cobrindo:

- **Investimentos & Carteira:** Partida dobrada patrimonial, PTAX histórica lote a lote, continuidade temporal com interpolação de meses sem movimentação (Ago/2026), cotização TWR/TIR, proventos segregados e rebalanceamento de metas.
- **Cartões de Crédito & Crédito:** Dízimas periódicas de parcelamento (conservação estrita de centavos), corte de fatura e competência temporal, estornos futuros, juros rotativos e multa legal (CDC).
- **Empréstimos & Financiamentos:** Tabelas SAC e Price (amortização e juros), zeragem de saldo devedor e cálculo de amortização antecipada com desconto a valor presente (CDC art. 52 § 2º).
- **Modo Viagem & Racha de Despesas:** Balanço zero-sum entre múltiplos participantes, divisões fixas e ponderadas, multimoeda e algoritmo de simplificação ótima de transferências (*Min-Cash-Flow*).
- **Orçamento Familiar & Provisões:** Rateio de despesas compartilhado proporcional à renda, envelope orçamentário 50/30/20 e provisões anuais com acúmulo contábil 1/12 ao mês.
- **Inteligência Financeira (Insights):** Triagem estrita por severidade, respeito ao cooldown de 30 dias em dispensas qualificadas e radar de saturação de limite de crédito.
- **Módulos Auxiliares:** Padrão EMV TLV e checksum CRC-16 (0x1021) de Pix do BACEN, pista de liquidez de emergência D+0/D+1, comparador ótimo de quitação de dívidas (Avalanche vs Bola de Neve) e hashing SHA-256 de backups.

---

## 2. Diretrizes Arquiteturais Inegociáveis

1. **Isolamento Modular Absoluto:** Todo o código do laboratório reside exclusivamente no diretório `src/features/admin/forensics/`, desacoplado do código de produção dos usuários comuns.
2. **Núcleo Isomórfico em TypeScript Puro:** Todas as personas teóricas, asserções de invariantes e geradores de relatórios foram escritos em TypeScript estrito, livres de acoplamento com o DOM, React ou chamadas de rede/Supabase durante a execução sintética.
3. **Impacto Zero no Pacote do Usuário (Zero Bundle Bloat):**
   - A rota administrativa `/admin/laboratorio-forense` é carregada sob demanda (*lazy-loaded*) em chunk dedicado (`admin-forensics-page-*.js`).
   - O chunk administrativo e as ferramentas de auditoria são **expressamente excluídos** do manifesto de pré-cache do Service Worker (`sw.js` via Workbox), garantindo zero bytes adicionais baixados pelos usuários finais do PWA.
4. **Proteção Estrita de Acesso Admin:** O acesso à rota visual exige dupla proteção: guarda de autenticação `RequireAdminSession` (verificando o papel administrativo no token JWT) e flag de controle de funcionalidades.
5. **Execução Limpa (Zero DB Writes):** A bateria sintética de testes é executada 100% em memória volátil, processando os motores de domínio sem gerar um único insert, update ou delete no banco de dados Supabase de produção.
6. **Precisão Numérica de Grau Bancário:** Aplica-se a regra de ouro de matemática financeira: valores monetários operam internamente como números inteiros de centavos (`*Cents`), e taxas/pesos operam com precisão total de ponto flutuante de 64 bits (IEEE 754), sendo proibidos arredondamentos intermediários prematuros ao longo do pipeline.

---

## 3. Matriz de Personas Teóricas Determinísticas (Golden Seeds)

O gerador de personas (`src/features/admin/forensics/core/personas/`) produz cenários determinísticos puros (sem uso de `Math.random()`), gerando estados idênticos em menos de 15ms em cada execução:

| Persona | ID | Escopo & Propósito Forense | Módulos Auditados |
|---|---|---|---|
| **Investidor 6445** | `persona-investor-6445` | Reprodução fiel do caso forense de auditoria quantitativa BR-20261118-6445: 26 ativos, 6 ETFs internacionais em USD com conversão PTAX histórica lote a lote, R$ 1.794,47 em proventos segregados, R$ 17.503,68 em patrimônio final. | Investimentos, Custódia, Câmbio |
| **Estresse Temporal** | `persona-temporal-stress` | Validação de buracos temporais (Ago/2026 em carry-forward estrito), fluxos intra-mês com pesos proporcionais $W_i$ no Modified Dietz e estresse extremo de resgate de 98% com proteção contra colapso de denominador. | Cotização TWR/TIR, Séries Históricas |
| **Cartões & Empréstimos** | `persona-cards-loans` | Dízimas periódicas (R$ 100 em 3x e R$ 10.000 em 7x), compra no dia exato de fechamento com competência postergada, estorno de parcelas futuras, rotativo com 2% de multa legal e contratos SAC vs Price. | Cartões, Faturas, Empréstimos |
| **Viagem & Racha** | `persona-trips-split` | Racha entre 4 viajantes com divisões por valor fixo e percentual, despesas em BRL, USD e EUR, algoritmo *Min-Cash-Flow* para redução de transações e liquidações parciais via Pix. | Modo Viagem, Racha de Despesas |
| **Orçamento Familiar** | `persona-family-budget` | Família com rendas desiguais (R$ 12.000 e R$ 8.000) com rateio 60%/40% rigorosamente conservativo, orçamento 50/30/20 e provisões anuais (IPVA/IPTU) com acúmulo contábil de 1/12 ao mês. | Orçamento Familiar, Provisões |
| **Limites & Casos Extremos** | `persona-boundary-zero` | Usuário recém-cadastrado com patrimônio R$ 0,00 (proteção contra divisão por zero em Sharpe, volatilidade, CDI e equilíbrio), lançamentos no último segundo do mês, anos bissextos (29/02/2028) e Sats com 8 decimais. | Risco, Benchmarks, Criptoativos |
| **Sobrecarga de Insights** | `persona-insights-stress` | Sobrecarga de 100 gatilhos analíticos simultâneos, ordenação estrita por severidade (crítico > aviso > info), cooldown legal de 30 dias em dispensas qualificadas e radar de comprometimento de limite de cartão $\ge 90\%$. | SmartAdvisor, Notificações |
| **Módulos Auxiliares** | `persona-advanced-modules` | Emissão de Pix com payload EMV TLV e checksum CRC-16 BACEN, pista de liquidez D+0/D+1 (reserva de emergência), otimização de quitação Avalanche vs Bola de Neve e hash SHA-256 de backup. | Pix, Liquidez, Quitação, Backup |

---

## 4. Motor de Invariantes Matemáticas e Contábeis

O motor de asserções (`src/features/admin/forensics/core/invariants/`) executa **23 asserções contábeis e matemáticas rigorosas**, com tolerância zero de desvio numérico:

```
[INV-PORT-01] Equação Fundamental da Partida Dobrada Patrimonial
              Patrimônio Final === Patrimônio Inicial + Fluxos Líquidos + Realizado + Variação Aberta + Proventos Líquidos
[INV-PORT-02] Congruência Estrita de Custódia e Alocação
              Soma(Ativos Individuais) === Patrimônio Total da Carteira
[INV-PORT-03] PTAX Histórica por Lote de Câmbio
              Custo em Reais = Soma(Qtd * Preço USD * PTAX da Data da Compra)
[INV-PORT-04] Continuidade Temporal e Interpolação de Séries Históricas
              Ausência de lacunas temporais entre a competência inicial e final
[INV-PORT-05] Fechamento Algebricamente Nulo de Metas de Rebalanceamento
              Soma(Gaps em Reais) === 0 e Soma(Metas Ativas) === 100%
[INV-PORT-06] Consistência de Cotização e Retorno Acumulado
              Cota Final reflete exatamente o produto acumulado das taxas periódicas
[INV-PORT-07] Segregação Contábil de Proventos Passados
              Soma dos proventos do período === Provento acumulado final (sem contaminação do marco zero)
[INV-CARD-01] Conservação Estrita de Centavos em Dízimas Periódicas
              Soma das Parcelas === Valor Original da Compra (absorção determinística na 1ª parcela)
[INV-CARD-02] Competência Temporal no Dia de Fechamento da Fatura
              Compras realizadas no closing_day devem cair na competência do mês subsequente
[INV-LOAN-01] Desconto Proporcional a Valor Presente em Amortização Antecipada
              Juros futuros expurgados em liquidação antecipada (CDC art. 52 § 2º)
[INV-LOAN-02] Zeragem do Saldo Devedor nos Sistemas SAC e Price
              Saldo residual na última parcela rigorosamente igual a R$ 0,00
[INV-DEBT-01] Teto Legal de Juros Rotativos e Multa Contratual
              Multa por impontualidade rigorosamente limitada a 2% do saldo devedor
[INV-TRIP-01] Equação de Balanço Zero-Sum em Racha de Despesas
              Soma(Saldos Líquidos dos Participantes) === R$ 0,00
[INV-TRIP-02] Conservação Contábil na Simplificação de Dívidas (Min-Cash-Flow)
              Nenhum centavo criado ou destruído pelo algoritmo de otimização
[INV-FAM-01]  Rateio Proporcional à Renda & Conservação Familiar
              Soma dos rateios individuais === Despesa Total
[INV-BUDG-01] Conservação do Envelope Orçamentário 50/30/20
              Necessidades + Desejos + Poupança === Renda Líquida Alocada
[INV-BUDG-02] Regime de Competência Contábil para Provisões Anuais
              Apropriação mensal de 1/12 de compromissos anuais (IPTU/IPVA)
[INV-CASH-01] Pista de Liquidez e Projeção de Cash Gap
              Cálculo exato de meses de sobrevivência baseado em despesas essenciais
[INV-ZERO-01] Imunidade a Divisão por Zero em Índices de Risco
              Sharpe, volatilidade amostral e índice de equilíbrio blindados contra patrimônio nulo
[INV-ZERO-02] Integridade Temporal em Anos Bissextos e Limites de Mês
              Preservação de timestamps e ordenação cronológica estrita
[INV-ZERO-03] Precisão Numérica de Criptoativos
              Conservação de 8 casas decimais sem arredondamento em frações de Satoshi
[INV-INSI-01] Precedência Estrita de Severidade do SmartAdvisor
              Insights críticos sempre ordenados à frente de avisos e informativos
[INV-INSI-02] Respeito ao Cooldown de 30 Dias em Dispensas Qualificadas
              Eventos dispensados silenciados até expirar o prazo legal
[INV-INSI-03] Radar Proativo de Estresse de Limite de Crédito
              Detecção compulsória de comprometimento de limite >= 90%
[INV-AUX-01]  Conformidade do Checksum CRC-16 de Pix EMV (BACEN)
              Validação pelo polinômio 0x1021 do Banco Central do Brasil
[INV-AUX-02]  Pista de Liquidez D+0 / D+1 da Reserva de Emergência
              Segregação estrita de ativos líquidos imediatos vs D+30
[INV-AUX-03]  Otimização Financeira da Quitação Avalanche
              Comprovação matemática de que o método Avalanche paga menos juros que a Bola de Neve
```

---

## 5. Duplo Exportador de Contra-Prova

O laboratório conta com geradores independentes para auditoria forense off-line e submissão a órgãos reguladores ou peritos judiciais:

### 5.1. Dossiê Executivo em Markdown (`reports/forensics-audit-dossier.md`)
Relatório completo contendo:
- Metadados da execução (ID, timestamp ISO, ambiente, duração em ms, score global).
- Quadro resumo consolidado por módulo com status de aprovação.
- Tabela detalhada de todas as 23 asserções com valor esperado, valor encontrado, status e arquivo de origem no código.
- Termo de responsabilidade técnica atestando conformidade com as regras de negócio.

### 5.2. Planilha de Contra-Prova em Excel (`reports/forensics-contra-prova.xls`)
Arquivo gerado no padrão XML SpreadsheetML (compatível com Microsoft Excel, LibreOffice Calc e Google Sheets) com **fórmulas nativas do Excel**:
- **Aba "Resumo Executivo":** Scores consolidados com fórmulas `=SUM(...)` e `=AVERAGE(...)`.
- **Aba "Contra-Prova Investimentos":** Compara o custo calculado pelo Axir com a fórmula nativa do Excel `=RC[-3]*RC[-2]` e calcula a diferença com `=ABS(RC[-2]-RC[-1])`.
- **Aba "Contra-Prova Parcelas":** Valida a conservação de centavos em dízimas com a soma nativa `=SUM(R2C:R[-1]C)`.
- **Aba "Contra-Prova Racha":** Prova a soma zero dos participantes com a fórmula `=SUM(R2C:R[-1]C)`.
- **Aba "Todas Invariantes":** Listagem analítica de todas as asserções.
- **Formatação Condicional e Semáforos:** Estilos `DeltaOk` (verde suave) e `DeltaError` (vermelho vivo com preenchimento `#FEE2E2`), destacando qualquer divergência superior a R$ 0,01.

---

## 6. Painel Visual Administrativo (`/admin/laboratorio-forense`)

A interface visual administrativa (`ForensicsDashboard`) proporciona controle integral:

1. **Visão Geral & Scores:**
   - Cards de KPI: Confiabilidade Geral (100%), Asserções Aprovadas (23), Divergências Críticas (0), Tempo de Execução (< 15ms).
   - Grade responsiva de cobertura por módulo com badges semânticos de aprovação.
   - Painel integrado de download instantâneo do Dossiê Markdown e da Planilha de Contra-Prova.
2. **Invariantes Forenses:**
   - Lista interativa com busca em tempo real por nome/descrição/ID.
   - Filtros por módulo de negócio e por status (Aprovada / Reprovada).
   - Inspeção de detalhamento de asserções com desvio numérico e arquivo de origem.
3. **Matriz de Personas:**
   - Seletor de cenários de estresse para inspeção de parâmetros teóricos e disparo individualizado.
4. **Auditoria de Snapshot Real (Modo Somente Leitura):**
   - Seletor de usuários reais cadastrados no Supabase.
   - **Chave de Anonimização de PII (LGPD):** Ativada por padrão, oculta nomes, e-mails e dados de contato, exibindo identificadores pseudo-anonimizados.
   - **Garantia de Zero DB Writes:** Valida os dados reais contra os motores de invariantes sem executar nenhuma mutação no banco.

---

## 7. Instruções de Execução

### Execução via Terminal (CLI)
Para rodar toda a bateria de auditoria quantitativa e regenerar os relatórios em disco:
```bash
npm run audit:forensics
```
Arquivos gerados em:
- `reports/forensics-audit-dossier.md`
- `reports/forensics-contra-prova.xls`

### Execução via Testes Automatizados (Vitest)
Para rodar a suíte completa de testes unitários e de integração do laboratório:
```bash
npx vitest run src/features/admin/forensics/
```

### Acesso via Navegador (Web)
1. Inicie a aplicação (`npm run dev`).
2. Acesse `/admin/laboratorio-forense` logado como administrador.
3. Clique em **Disparar Auditoria Agora** ou selecione uma persona específica.
