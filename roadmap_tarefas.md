# Roadmap de Refatoração e Melhorias

Este documento consolida as tarefas de aprimoramento do aplicativo, organizadas em 5 fases sequenciais.
Para rodar qualquer tarefa no CLI, instrua o agente:
> "Leia a Tarefa XX de @roadmap_tarefas.md, execute todas as implementações, testes, documentação, build, commit e push."

---

## Protocolo Geral de Entrega (Obrigatório para todas as tarefas)
1. **Documentação:** Atualizar a documentação técnica relevante e os comentários de arquitetura.
2. **Qualidade & Testes:** Rodar/criar testes unitários ou de integração e executar o build de produção (`npm run build` ou equivalente), garantindo zero erros de lint e tipagem.
3. **Controle de Versão:** Executar o commit semântico padronizado indicado na tarefa e realizar o push para a branch remota.

---

## FASE 1: Limpeza Estrutural, Autenticação e Design System Base

### Tarefa 01: Remoção Limpa da Autenticação em 2 Etapas (2FA) [Concluída]
- **Status:** ✅ Concluída
- **Objetivo:** Remover por completo a funcionalidade de autenticação em 2 etapas (2FA/MFA) do aplicativo, limpando código, dependências e interfaces.
- **Ações:**
  1. Frontend: remover tela/etapa de código 2FA no login e seção de ativação em Configurações/Perfil. (Concluído: remoção do card de 2FA em `security-tab.tsx`, preservação do status RLS e limpeza de aliases).
  2. Backend/Auth: desativar endpoints/triggers voltados para TOTP/MFA e garantir que nenhum usuário ativo fique bloqueado com status pendente de 2FA. (Concluído: `max_enrolled_factors = 0` em `supabase/config.toml`, remoção de `domain/auth` e validação de invariantes).
  3. Desinstalar bibliotecas exclusivas de 2FA (ex.: `otplib`, geradores de QR Code) e limpar o `package.json`. (Concluído: zero dependências residuais de 2FA no projeto).
- **Commit:** `refactor(auth): remove two-factor authentication flow and clean dependencies`

---

### Tarefa 02: Padronização e Limpeza de Pop-ups e Modais [Concluída]
- **Status:** ✅ Concluída
- **Objetivo:** Revisar todos os pop-ups e modais, garantindo herança da cor de destaque (accent) e tema ativo, eliminando redundâncias.
- **Ações:**
  1. Mapear e consolidar modais redundantes em um componente reutilizável padrão. (Concluído: `ResponsiveDialog` e `ConfirmDialog` consolidados utilizando o `ModalFooter` canônico do `Modal`, unificando safe-area padding e botões).
  2. Garantir que todos os modais herdem as variáveis do tema ativo (background, bordas, botões) e a cor de destaque definida pelo usuário. (Concluído: anéis de foco com `--ring` e `--primary`, hover states nos botões de calculadora e drag-handle, paleta de comando, seletores e date/color/icon pickers com `border-border/80`, `bg-surface` e `backdrop-blur-md`).
  3. Remover diálogos obsoletos que causem poluição visual e padronizar tipografia/bordas nos modais analíticos (Concluído: remoção de classes ad-hoc `text-[9.5px]` e `border-border/60` no modal explicativo de investimentos, alinhado às Regras 14 e 16 de `AGENTS.md`).
- **Commit:** `refactor(ui): standardize popups and modals to reflect active accent theme`

---

### Tarefa 03: Reposicionamento Responsivo de Modais e Pop-ups
- **Objetivo:** Ajustar a ancoragem de modais/pop-ups para não sobrepor barras de navegação (bottom bar no mobile e sidebar no desktop).
- **Ações:**
  1. Mobile: implementar safe areas inferiores e estratégia de Bottom Sheet ou modal centralizado com backdrop que não fique escondido sob a bottom navigation bar.
  2. Desktop: centralizar modais com margens adequadas e isolamento de foco.
  3. Padronizar a escala global de `z-index` (dropdowns < tooltips < bottom bar < modais < toasts).
- **Commit:** `fix(ui): reposition popups and modals to avoid overlapping navigation bars`

---

### Tarefa 04: Auditoria de Feedback Sonoro e Háptico
- **Objetivo:** Auditar todos os sons e vibrações do app, eliminando duplicidades e ruídos desnecessários.
- **Ações:**
  1. Mapear chamadas de áudio e vibração (`navigator.vibrate` / plugins nativos).
  2. Eliminar disparos concorrentes ao clicar rapidamente ou alternar telas.
  3. Criar utilitário centralizado (`soundManager` / `hapticsManager`) com controle de mute global e respeitando as configurações do usuário.
- **Commit:** `fix(audio): audit sound effects and haptics to eliminate duplicates and refine UX`

---

## FASE 2: Refinamento de UI/UX no Dashboard e Navegação

### Tarefa 05: Padronização dos Ícones Lucide nos Cards do Dashboard
- **Objetivo:** Padronizar os ícones do Dashboard em duas regras visuais rígidas.
- **Ações:**
  1. Ícones com fundo/cores contextuais: apenas em banners, carrossel inicial de informações ou cards contextuais (reagindo a receitas, despesas, investimentos).
  2. Ícones fixos (sem fundo): ícone Lucide puro, sem container circular/quadrado, herdando a cor do tema nos cards normais (orçamento do mês, saldo disponível, etc.).
  3. Exceção de resultado: "Saldo Líquido em Conta" e "Taxa de Poupança" devem ter o ícone puro seguindo a cor do resultado (verde para positivo, vermelho para negativo).
- **Commit:** `style(dashboard): standardize lucide icon styles for contextual banners vs clean metric cards`

---

### Tarefa 06: Condicional de Exibição do Card de Saldo no Dashboard
- **Objetivo:** Ocultar o card "Saldo Disponível na Conta" ao navegar em meses passados ou futuros.
- **Ações:**
  1. Comparar o mês/ano selecionado na navegação com o mês/ano corrente do sistema.
  2. Exibir o card de saldo disponível apenas no mês atual; ocultá-lo nos demais meses sem quebrar a grade responsiva do dashboard.
- **Commit:** `fix(dashboard): restrict account balance card visibility to current month only`

---

### Tarefa 07: Reordenação dos Filtros na Página de Extrato
- **Objetivo:** Ajustar a sequência dos filtros de transação na listagem de Extrato.
- **Ações:**
  1. Definir a ordem exata das abas: **Tudo**, **Receitas**, **Despesas**, **Parceladas**, **Recorrentes**.
  2. Preservar o estado do filtro ativo e garantir rolagem horizontal fluida no mobile.
- **Commit:** `refactor(statement): reorder transaction filter tabs to all, income, expense, installments, recurring`

---

## FASE 3: Módulos Financeiros (Cartões, Orçamentos e Insights)

### Tarefa 08: Preenchimento Automático do Valor da Fatura de Cartão
- **Objetivo:** Carregar automaticamente o valor total pendente da fatura ao abrir o fluxo de registrar pagamento.
- **Ações:**
  1. Identificar o modal de registrar pagamento de fatura na tela de Cartões.
  2. Pré-popular o input com o valor integral pendente por padrão, mantendo-o editável para pagamentos parciais.
  3. Tratar faturas zeradas ou já quitadas adequadamente.
- **Commit:** `feat(cards): autofill invoice amount on payment trigger`

---

### Tarefa 09: Ajuste Proporcional do Orçamento Global
- **Objetivo:** Adicionar a ferramenta de ajuste de orçamento em lote com redistribuição proporcional.
- **Ações:**
  1. Adicionar o botão "Ajustar Orçamento" ao lado do botão "Nova Categoria".
  2. Abrir modal que permita ajuste por percentual (+/- X%) ou por valor total pretendido.
  3. Redistribuir proporcionalmente entre as categorias: `Novo = Atual * (1 + delta%)`, com ajuste fino de centavos na soma final.
- **Commit:** `feat(budget): add proportional budget adjustment tool`

---

### Tarefa 10: Desacoplamento Modular da Aba de Insights
- **Objetivo:** Remover o bloco agregador genérico e estruturar a aba exclusivamente em cards analíticos isolados.
- **Ações:**
  1. Remover o componente monolítico com o resumo consolidado de tudo.
  2. Isolar visualizações modulares: Bloco de Ocorrências e Gastos Frequentes, Bloco de Projeção Financeira e Runway, e demais métricas em componentes autônomos.
- **Commit:** `refactor(insights): decouple monolithic summary into modular analytics blocks`

---

## FASE 4: Investimentos e Relatórios Temporais

### Tarefa 11: Sincronização Temporal dos Relatórios de Investimentos e Snapshots
- **Objetivo:** Garantir que composição, métricas e relatórios de investimentos reflitam fielmente o mês/ano selecionado.
- **Ações:**
  1. Parametrizar todos os cálculos do relatório de investimentos para consumir estritamente o mês/ano filtrado, sem apontar estaticamente para o mês corrente.
  2. Validar persistência e recuperação de snapshots mensais de carteira.
  3. Exibir empty state informativo se não houver dados no mês selecionado, sem fazer fallback involuntário para o mês atual.
  4. Garantir que exportações/impressões do relatório usem os dados do período ativo.
- **Commit:** `fix(investments): align monthly reports with selected period and enforce historical snapshots`

---

## FASE 5: Engenharia de Dados (Importadores, Exportação e Backup)

### Tarefa 12: Modernização da Importação de Faturas e Extratos (OFX/CSV)
- **Objetivo:** Criar staging area interativa para arquivos de extratos e faturas.
- **Ações:**
  1. Reforçar parsing de `.ofx` e `.csv` dos bancos brasileiros mais comuns.
  2. Criar tabela intermediária de pré-visualização permitindo editar campos, remover itens indesejados e adicionar linhas manuais antes de gravar no banco.
  3. Adicionar detecção visual de potenciais duplicidades antes do salvamento final.
- **Commit:** `feat(import): enhance statement and invoice parsing with interactive staging table`

---

### Tarefa 13: Parser Inteligente de Texto Colado (Paste Import) Global
- **Objetivo:** Otimizar a importação por colagem de texto em Extratos, Faturas e Investimentos.
- **Ações:**
  1. Aprimorar regex e heurísticas para datas (`DD/MM/AAAA`), valores (`R$ 1.234,56`), descrição e sinal (+/-).
  2. Em investimentos: detectar ticker de ativos, quantidade e valores unitários/totais.
  3. Ignorar automaticamente cabeçalhos e linhas ruidosas, abrindo a tabela de revisão antes da confirmação.
- **Commit:** `feat(import): revamp text paste import across transactions and investments with smart regex parsing`

---

### Tarefa 14: Validação e Fidelidade na Exportação de CSV
- **Objetivo:** Garantir integridade total na geração de planilhas CSV em todas as telas.
- **Ações:**
  1. Configurar BOM UTF-8 (`\uFEFF`) e ponto e vírgula (`;`) para abertura correta no Excel brasileiro.
  2. Tratar escapes de aspas, quebras de linha e caracteres especiais.
  3. Garantir correspondência rigorosa entre os filtros ativos em tela e os dados exportados.
- **Commit:** `fix(export): audit and harden CSV generator for full data fidelity and UTF-8 encoding`

---

### Tarefa 15: Wizard de Backup Completo e Importação com Desduplicação
- **Objetivo:** Criar rotina de backup abrangente e um Wizard passo a passo para restauração com desduplicação.
- **Ações:**
  1. Backup completo: exportar contas, categorias, transações, orçamentos e snapshots de investimentos em JSON estruturado com metadados e checksum.
  2. Wizard de importação:
     - Etapa 1: Validação do arquivo.
     - Etapa 2: Seleção granular dos módulos a restaurar.
     - Etapa 3: Identificação de duplicados com opções de ação (Pular, Sobrescrever ou Manter ambos).
     - Etapa 4: Resumo e confirmação transacional.
- **Commit:** `feat(backup): implement full-scope backup and interactive restore wizard with deduplication`
