# Especificação Técnica — Preço Teto, Valuation & Priorização Racional de Aporte

> **Status:** Aprovado para Implementação · **Versão:** 1.2.0 · **Data:** 2026-11-21  
> **Camada:** `domain/portfolio` · `features/investments` · `components/modules`  
> **Documentos Relacionados:** `ESPECIFICACAO_TECNICA.md` · `FINANCIAL_MATH_SPEC.md` · `AGENTS.md` · `DESIGN_SYSTEM.md`

---

## 1. Visão Geral e Fundamentos Filosóficos

### 1.1 O Fim da Falácia do Preço Médio (PM) na Tomada de Decisão
Historicamente, sistemas de controle financeiro exibem métricas como "Desconto de X% vs. Preço Médio". Na engenharia financeira do *Value Investing* (Benjamin Graham, Warren Buffett, Décio Bazin e Luiz Barsi), essa abordagem é contraproducente:
- **O Preço Médio é um dado estritamente contábil e pretérito:** serve exclusivamente para apuração de Imposto de Renda (DARF de Ganho de Capital) e auditoria de rentabilidade acumulada ($Pnl$).
- **O PM não expressa valor intrínseco, qualidade nem momento de compra:** ancorar aportes no PM induz o investidor ao erro comportamental de não comprar ativos excelentes porque "subiriam o PM", ou de comprar ativos em decadência apenas para "baixar o PM" (*averaging down* cego).

**Diretriz do Produto:**
O Preço Médio é **preservado onde tem função legal/contábil** (extratos de custódia e relatórios de fechamento fiscal), mas é **completamente expurgado dos radares de oportunidade, cards de alocação e decisões de aporte**. Em seu lugar, entra o conceito de **Preço Teto ($P_{\text{teto}}$)**.

---

### 1.2 O Dilema: Qualidade & Diversificação vs. Preço & Oportunidade
- **Visão Qualidade / Diversificação (Buffett / Alocação Estrutural):** *"É muito melhor comprar uma empresa maravilhosa a um preço justo do que uma empresa justa a um preço maravilhoso."* A carteira deve permanecer diversificada, priorizando notas altas de governança e respeito às metas das classes/setores.
- **Visão Oportunidade / Margem (Graham / Bazin / Deep Value):** Comprar ativos com assimetria de preço favorável maximiza o rendimento em dividendos e protege contra perdas permanentes de capital.

#### A Solução Canônica: O Modelo Hierárquico em 3 Camadas
O motor de investimentos harmoniza essas duas visões sem conflito através de uma divisão estrita de papéis:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Alocação Estrutural (Notas de Governança 0–10): "O QUE e QUANTO ter"      │
│    • A Nota define a META PERCENTUAL do ativo na carteira (Allocation Target)│
│    • Preserva a diversificação e o controle de risco estrutural             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. Necessidade da Carteira (Déficit em R$): "QUEM ESTÁ ATRASADO"           │
│    • Identifica os ativos e setores com maior defasagem relativa de meta    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. Modulador de Timing (Preço Teto & Margem): "QUANDO e QUEM COMPRAR HOJE" │
│    • Atua como filtro protetivo (evita comprar ativos sobreavaliados)       │
│    • Atua como desempate e priorização sutil entre ativos do mesmo setor   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Matriz de Elegibilidade por Classe de Ativo

Para garantir zero confusão cognitiva, os métodos de valuation são estritamente filtrados pela classe do ativo:

| Classe do Ativo | Métodos Disponíveis | Métodos Bloqueados / Ocultados | Rationale Financeiro |
| :--- | :--- | :--- | :--- |
| **Ações (B3 & Internacionais)** | • Décio Bazin ($\overline{\text{DPA}} / Y_{\text{alvo}}$)<br>• Benjamin Graham ($\sqrt{22{,}5 \times \text{LPA} \times \text{VPA}}$)<br>• Gordon / Crescimento ($\text{DPA} \times (1+g) / (k-g)$)<br>• Múltiplo Alvo ($P/L$ máx ou $P/VP$ máx)<br>• Preço Teto Manual | Métodos de cota patrimonial de FII ($P/VP$) | Ações possuem dinâmica corporativa de lucros, retenção patrimonial e projeção de crescimento de proventos. |
| **Fundos Imobiliários (FIIs & REITs)** | • Bazin Imobiliário ($(\text{Rend. Mensal} \times 12) / Y_{\text{alvo}}$)<br>• Preço Justo por $P/VP$ ($\text{VPA} \times P/VP_{\text{máx}}$)<br>• Modelo Híbrido ($DY$ alvo + Trava de $P/VP \le 1{,}02$)<br>• Preço Teto Manual | **Fórmula de Graham é expressamente bloqueada** | FIIs distribuem $>95\%$ do caixa, não retêm lucros como empresas e não operam sob múltiplos de $P/L$. |
| **Renda Fixa & Caixa** | **Nenhum (Campo Preço Teto ocultado)** | Todos os métodos | Títulos são geridos por taxa contratada, indexador (CDI/IPCA) e prazo. Não há conceito de cotação de mercado oscilante para teto de dividendos. |
| **Criptoativos** | • Preço Alvo de Compra Manual | Bazin e Graham bloqueados | Criptoativos não possuem balanço contábil auditado nem distribuição de proventos corporativos. |

---

## 3. Engenharia Matemática de Valuation (`src/domain/portfolio/ceiling-valuation.ts`)

Todas as funções são puras, sem efeitos colaterais e sem dependências de UI.

### 3.1 Método Décio Bazin (Ações)
$$P_{\text{teto Bazin}} = \frac{\overline{\text{DPA}}}{Y_{\text{mínimo}}}$$
- $\overline{\text{DPA}}$: Proventos médios anuais por ação (moeda nativa). Recomenda-se proventos líquidos de IR.
- $Y_{\text{mínimo}}$: Yield anual desejado (padrão canônico de Bazin: $6{,}0\%$ a.a., configurável).
- **Validação de Guarda:** Se $Y_{\text{mínimo}} \le 0$ ou $\overline{\text{DPA}} \le 0$, retorna `null`.

### 3.2 Método Benjamin Graham (Ações de Valor)
$$V_{\text{Graham}} = \sqrt{22{,}5 \times \text{LPA} \times \text{VPA}}$$
$$P_{\text{teto Graham}} = V_{\text{Graham}} \times (1 - \text{Margem de Segurança})$$
- $\text{LPA}$: Lucro por Ação (últimos 12 meses).
- $\text{VPA}$: Valor Patrimonial por Ação (últimos 12 meses).
- $22{,}5$: Constante empírica ($P/L \le 15$ e $P/VP \le 1{,}5$).
- $\text{Margem de Segurança}$: Default de $20\%$ ($0{,}20$).
- **Validação de Guarda (Anti-Crash):** Se $\text{LPA} \le 0$ ou $\text{VPA} \le 0$, a fórmula de Graham **não é calculável** (evita $\sqrt{-x} = \text{NaN}$). A UI sinaliza: *"Empresa com prejuízo ou PL negativo no período"*.

### 3.3 Modelo de Gordon / Proventos com Crescimento (DDM Simplificado)
$$P_{\text{teto Gordon}} = \frac{\text{DPA} \times (1 + g)}{k - g}$$
- $g$: Taxa de crescimento anual esperada dos proventos (ex: $2{,}0\%$ ou inflação).
- $k$: Taxa de retorno exigida pelo investidor (ex: $9{,}0\%$).
- **Validação de Guarda:** Exige $k > g$. Caso contrário, retorna `null`.

### 3.4 Modelo de Múltiplo Alvo ($P/L$ Máximo ou $P/VP$ Máximo)
$$P_{\text{teto P/L}} = \text{LPA} \times P/L_{\text{máximo}}$$
$$P_{\text{teto P/VP}} = \text{VPA} \times P/VP_{\text{máximo}}$$

### 3.5 Métodos de Fundos Imobiliários (FIIs)
1. **Bazin Imobiliário:**
   $$P_{\text{teto FII}} = \frac{\overline{\text{Rendimento Mensal}} \times 12}{Y_{\text{alvo FII}}}$$
2. **Preço Justo por P/VP:**
   $$P_{\text{teto VP}} = \text{VPA} \times \text{Multiplicador Máximo} \quad (\text{Default } 1{,}00).$$
3. **Modelo Híbrido FII (Yield com Trava de P/VP):**
   $$P_{\text{teto Híbrido}} = \min\left(\frac{\text{Rend. Mensal} \times 12}{Y_{\text{alvo}}}, \text{VPA} \times 1{,}02\right)$$

---

## 4. A "Mesa de Consenso Multimodelo" (Resolução de Vários Modelos Simultâneos)

Quando o investidor preenche múltiplos modelos para o mesmo ativo (ex: Bazin R$ 53,00, Graham R$ 61,00, Gordon R$ 47,00, P/L R$ 45,00), o sistema consolida o resultado sem perda de dados:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Mesa de Valuation Multimodelo — BBAS3                                  │
├────────────────────────────────────────────────────────────────────────┤
│ Modelos Calculados:                                                    │
│  • Décio Bazin (Yield 6%):                 R$ 53,00                    │
│  • Benjamin Graham (Margem 20%):           R$ 61,00                    │
│  • Gordon (Crescimento 2%):                R$ 47,00                    │
│  • P/L Máximo (6x Lucro):                  R$ 45,00                    │
├────────────────────────────────────────────────────────────────────────┤
│ Qual Preço Teto Vigente você deseja adotar para este ativo?           │
│                                                                        │
│  (●) O Mais Conservador (Recomendado)     → R$ 45,00 (Menor risco)    │
│  ( ) A Média dos Modelos                  → R$ 51,50 (Consenso)       │
│  ( ) Escolher um Modelo Específico        → [ Selecionar: Bazin ▼ ]   │
├────────────────────────────────────────────────────────────────────────┤
│ [ Cancelar ]                                 [ ✓ Definir Preço Teto ]  │
└────────────────────────────────────────────────────────────────────────┘
```

### Regras de Resolução:
1. **O Mais Conservador (`conservative` — Recomendado):**
   $$P_{\text{teto vig}} = \min(P_1, P_2, \dots, P_n)$$
   Aplica o princípio de prudência: se a ação estiver barata pelo modelo mais exigente, estará com margem de segurança em todos os demais.
2. **A Média dos Modelos (`average`):**
   $$P_{\text{teto vig}} = \frac{1}{n} \sum_{i=1}^n P_i$$
   Neutraliza a volatilidade de um único indicador gerando o valor de consenso.
3. **Modelo Específico (`specific`):**
   O usuário elege um modelo preferido (ex: Bazin), preservando os outros no histórico auditável.

---

## 5. O Motor de Aporte Inteligente (`src/domain/portfolio/aporte.ts`)

### 5.1 Regras Rígidas de Soberania de Risco & Qualidade
1. **Soberania do Quality Lock (Filtro 1):**
   - Ativo com nota $\le 5$ entra em *Quality Lock* (bloqueado para aportes, salvo destravamento deliberado).
   - **Regra de Ouro:** A nota baixa prevalece sobre o Preço Teto! Mesmo que o preço de mercado esteja muito abaixo do teto, se o ativo for nota $\le 5$, ele **NÃO recebe aporte**. Evita armadilhas de valor (*Value Traps*).
2. **Soberania dos Tetos de Concentração (Filtro 2):**
   - Teto individual de 15% do portfólio total.
   - Teto setorial de 35% da classe.
3. **Déficit Relativo de Meta (Filtro 3):**
   - Guiado pelo peso das Notas ($\text{Weight} = \text{Score} / \sum \text{Scores}$).
4. **Modulador de Preço Teto (Filtro 4 — Desempate & Timing):**
   - Ativo na Zona de Oportunidade ($P \le P_{\text{teto}}$) ganha preferência na fila sobre ativo em Zona Esticada ($P > P_{\text{teto}}$).
   - Maior margem de segurança percentual desempata a primeira tranche de cotas.

### 5.2 Perfis de Sensibilidade do Rebalanceamento
- **Estratégia A: "Equilibrada (Qualidade & Diversificação)" [Padrão]:**
  - O déficit de meta conduz o aporte. O Preço Teto atua como desempate positivo de compras e alerta educativo.
- **Estratégia B: "Oportunidade (Margem Estrita)":**
  - Pausa temporariamente compras em ativos com $P_{\text{mercado}} > P_{\text{teto}}$.
  - A verba do setor transborda para outros ativos descontados do mesmo setor; se todos estiverem esticados, transborda para o próximo setor ou para a **Reserva de Oportunidade (Caixa / Tesouro Selic)**.

---

## 6. Blindagem de 11 Fragilidades Operacionais

| Fragilidade Identificada | Risco Real | Salvaguarda Canônica Implementada |
| :--- | :--- | :--- |
| **1. Ativos em Dólar (USD / Stocks)** | Misturar cotação em USD com câmbio em BRL distorceria a margem. | Preço Teto registrado na **moeda nativa** (`BRL` ou `USD`). Margem de segurança calculada estritamente na moeda do ativo. |
| **2. Desdobramentos / Splits (1:2, 1:10)** | Preço cai pela metade; sem ajuste, geraria falso sinal de 50% de desconto. | Handler de eventos societários (`lifecycle-invariants.ts`) divide automaticamente o `ceiling_price` pelo fator do split ($P_{\text{teto}} / \text{fator}$). |
| **3. Proventos com JCP (Bruto vs. Líquido)** | JCP bruto inflaria o teto Bazin em 15% por não descontar IR na fonte. | Popover didático orienta a utilizar **proventos líquidos de IR**. |
| **4. Envelhecimento do Teto (Aging)** | Preços tetos cadastrados há anos perdem validade com novos balanços. | Se $\Delta t > 6\text{ meses}$ da última revisão (`last_reviewed_at`), exibe badge discreto: *"Revisão de Teto Sugerida"*. |
| **5. Cotação Zerada ou Indisponível** | Divisão por zero ou cálculo de margem irreal. | Se $P_{\text{mercado}} \le 0$, retorna `marginOfSafetyPct: null` e a UI exibe: `Teto: R$ XX,XX (Aguardando cotação)`. |
| **6. Formatação Decimal (Vírgula vs. Ponto)** | Erro `NaN` ao digitar números no padrão brasileiro. | Parse robusto normalizando `,` para `.` e validando valores positivos com Zod. |
| **7. Ações Ordinárias vs. Preferenciais (ON vs. PN)** | Cotações diferentes para PETR3 e PETR4. | A margem de segurança compara o teto estritamente com a cotação do ticker da custódia do usuário. |
| **8. Transações Passadas e Fechamento** | Usuário temer que o Preço Teto altere rentabilidade histórica. | Preço Teto é métrica puramente prospectiva (ex-ante). Histórico de PM e DARFs passadas permanece intocado. |
| **9. Deterioração Fundamentalista** | Ativo barato mas com fundamentos em colapso. | Soberania do *Quality Lock*: nota $\le 5$ bloqueia compras mesmo com 50% de desconto aparente. |
| **10. Conflito entre Múltiplos Modelos** | Divergência entre Bazin e Graham gerando incerteza. | Mesa de Consenso com escolha de 1 clique: Mais Conservador, Média ou Específico. |
| **11. Transbordo do Aporte em Mercado Esticado** | Forçar compra em ações caras quando o setor todo subiu. | Transbordo elegante para a Reserva de Oportunidade (Caixa) até os preços corrigirem. |

---

## 7. Modularização do Código & Arquitetura de Componentes

Para respeitar rigorosamente a regra contra arquivos grandes e duplicação de código (AGENTS.md §3 e §4):

```
src/
├── domain/portfolio/
│   ├── ceiling-valuation.ts         # Motor puro de valuation (Bazin, Graham, Gordon, P/VP, Consenso)
│   ├── ceiling-valuation.test.ts    # 100% de cobertura Vitest colocalizada
│   └── ceiling-types.ts             # Contratos de tipos (CeilingMethod, CeilingModelConfig, etc.)
│
├── components/modules/investments/
│   └── ceiling-price-badge.tsx      # Componente DRY único de badge de margem de segurança
│
└── features/investments/components/valuation/
    ├── ceiling-valuation-dialog.tsx # Orquestrador do modal (Modal size="lg", responsive, sem autoFocus)
    ├── use-ceiling-valuation.ts     # Hook de estado reativo da calculadora
    ├── ceiling-model-tabs.tsx       # Seletor de abas de modelos filtrado por classe de ativo
    ├── ceiling-bazin-form.tsx       # Sub-formulário Bazin com campos e interrogação (?)
    ├── ceiling-graham-form.tsx      # Sub-formulário Graham com campos e interrogação (?)
    ├── ceiling-gordon-form.tsx      # Sub-formulário Gordon com campos e interrogação (?)
    ├── ceiling-fii-form.tsx         # Sub-formulário FII (Rendimento / P/VP / Híbrido)
    ├── ceiling-sensitivity-table.tsx# Tabela de sensibilidade de yield
    └── ceiling-consensus-panel.tsx  # Painel da Mesa de Consenso (Mais Conservador / Média)
```

### Regras de Ouro de UI/UX Atendidas:
1. **Zero Emojis (Regra 8):** Uso exclusivo de ícones `lucide-react` com `aria-hidden` (`Check`, `HelpCircle`, `TrendingDown`, `ShieldCheck`).
2. **Zero Controles Nativos (Regra 7):** Apenas componentes primitivos de `components/ui/` (`Modal`, `Tabs`, `Input`, `MoneyInput`, `NumericInput`, `Button`, `Badge`).
3. **Anatomia do Modal (Regra 18 & 20):** `<Modal size="lg">`, sem classes `max-w-*` arbitrárias, sem `autoFocus`, com alça tátil no mobile e rodapé com `ModalFooter` simétrico (`grid grid-cols-2 gap-2 sm:flex sm:justify-end`).
4. **Semáforo Cognitivo (Regra 13 & 14):** Badges padronizados com variantes (`positive`, `warning`, `muted`), sem padding manual ad-hoc.
5. **Gateway Sensorial (Regra 17):** Feedback tátil apenas ao concluir a aplicação do teto via `triggerSensory`.

---

## 8. Roadmap de Execução Faseado

### Fase 1: Domínio Matemático, Schema & Persistência
- [ ] Criar migração Supabase adicionando em `portfolio_assets`:
  - `ceiling_price` (`numeric(15,4)`).
  - `ceiling_method` (`text` — `'manual' | 'bazin' | 'graham' | 'gordon' | 'multiple' | 'pvp' | 'hybrid_fii' | 'conservative' | 'average'`).
  - `ceiling_metadata` (`jsonb` — snapshot completo dos modelos preenchidos).
- [ ] Atualizar tipos TypeScript em `src/types/schema.ts` e `src/types/database.ts`.
- [ ] Implementar `src/domain/portfolio/ceiling-types.ts` e `ceiling-valuation.ts`.
- [ ] Cobertura de 100% de testes unitários em `ceiling-valuation.test.ts`.

### Fase 2: Limpeza do Preço Médio e Componente Compartilhado
- [ ] Criar `src/components/modules/investments/ceiling-price-badge.tsx` (DRY).
- [ ] Remover comparações de "vs PM" em:
  - `src/features/investments/components/asset-detail/asset-allocation-card.tsx`.
  - `src/features/investments/wizard/asset-sector-radar-list.tsx`.
  - `src/domain/portfolio/aporte.ts`.
- [ ] Integrar `CeilingPriceBadge` nos cards de diagnóstico de alocação.

### Fase 3: Diálogo Modular de Valuation
- [ ] Implementar os sub-formulários modulares em `src/features/investments/components/valuation/`.
- [ ] Implementar a Mesa de Consenso em `ceiling-consensus-panel.tsx`.
- [ ] Montar `CeilingValuationDialog` integrado ao botão de ação nos formulários de edição do ativo.

### Fase 4: Integração com o Motor de Aporte e Simulador
- [ ] Atualizar o desempate do setor em `src/domain/portfolio/aporte.ts`:
  - Desempate favorável para ativos em zona de oportunidade com maior margem de segurança.
  - Soberania estrita do *Quality Lock* (nota $\le 5$).
- [ ] Adicionar seletor de sensibilidade (Equilibrado vs Oportunidade) no simulador de rebalanceamento.

### Fase 5: Alerta da Home & Homologação Forense
- [ ] Adicionar card de oportunidade no carrossel da Home (`DashboardAlertsCarousel`).
- [ ] Executar suíte completa de testes (`npm run test:run`) e verificação de linting (`npm run lint`).
