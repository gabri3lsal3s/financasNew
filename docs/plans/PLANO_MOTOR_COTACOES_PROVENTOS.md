# Plano canônico do motor de proventos provisionados e a receber

**Revisão de 26/11/2026 · Fluxo Completo (Plano) · Especificado para implementação.** O roteiro abaixo rege os próximos trabalhos de proventos. O registro de 23/11, com os aceites de cotações, fechamento e custódia, está preservado ao final. Os aceites históricos referem-se exclusivamente ao escopo daquela entrega.

## 0. Decisão arquitetural antes da implementação

Um evento global descreve um direito anunciado por unidade. A custódia na Data COM determina o direito individual. Um lançamento no extrato comprova recebimento. Cada fato tem identidade, dono e ciclo de vida próprios. Para uma carteira pequena, corrigir uma data e conciliar um lançamento já resolve o problema. O benefício coletivo só aparece quando outra carteira encontra o mesmo evento. Por isso a primeira entrega funciona com zero votos e a promoção global é a última capacidade habilitada.

| Critério de aceite do desenho | Consequência verificável |
|---|---|
| Uma fonte de verdade por fato | Catálogo resolve os termos públicos, evento individual governa a fila e extrato governa o realizado. React Query guarda uma projeção descartável. |
| Integridade de data e valor | O calendário pode pedir revisão. Só uma data conhecida e um valor validado podem criar recebimento. O saldo histórico inicial continua separado por ativo. |
| Consenso independente, auditável e reversível | Aceites da própria sugestão valem zero. Evidência de um campo não certifica outros campos. Promoção e rebaixamento deixam o extrato liquidado intacto. |
| Idempotência por identidade | Mesmo evento, usuário e repetição produzem no máximo um crédito. Conciliação vincula o crédito existente. |
| Simplicidade operacional | Um catálogo, um processador, os dois crons existentes e uma tabela privada de evidências. A falta de quórum mantém o fluxo individual disponível. |

**Referência de faturas.** A migration 0156 separa `statement_layout_blueprints` de `statement_layout_blueprint_votes`, usa chave composta por fingerprint e hash do votante e RPCs com validação. A 0158 redefine `upsert_statement_layout_blueprint` e `record_statement_blueprint_outcome`, verifica titularidade/escopo, conta contas distintas qualificadas e permite suspensão. O helper `is_trusted_blueprint_voter` usa perfil administrativo ou assinatura elegível. Reaproveitar a convenção de elegibilidade como barreira a contas descartáveis, sem tratar assinatura como prova financeira. `src/data/repositories/statement-blueprints.ts` encapsula o acesso; `src/services/statement-tabular-blueprints.ts` mantém modelos tabulares locais. Proventos usam somente a parte transacional online. Os votos são dados pseudonimizados sujeitos à LGPD.

## 1. Diagnóstico validado e invariantes

| Bloco | Evidência no checkout | Efeito e decisão |
|---|---|---|
| 1 · Corte | 0027 cria `accumulated_dividends` sem data. 0143 mantém cadastro legado sem timestamp. Em `quotes-core.ts:1099` a ausência de transações e de criação devolve a quantidade atual. `quotes/index.ts:1415` aceita toda data de pagamento nula. `listCorporateDividends` pagina por ID, sem janela nas consultas. | Separar período de acompanhamento, prova de custódia e janela operacional. Aplicar o mesmo predicado ao catálogo no servidor e nas duas variantes do repositório. |
| 2 · Fontes | 0087 cria catálogo e dispensas. 0143 protege parcelas com chave exata e promoção in-place de taxa compatível. `parseBrapiDividends` aceita COM derivada de aprovação/pagamento e tipo normalizado. `parseYahooDividends` lê pagamento explícito quando disponível e deriva COM da ex-date no calendário da bolsa. O lote Brapi com falha abre tentativas individuais sem distinguir escopo. | Cobertura e confiança são por evento. Campo ausente é desconhecido. O código permite data explícita no Yahoo; o checkout não mede sua frequência real. |
| 3 · Estados | `quotes/index.ts:1673–1736` provisiona sem data e sai antes de deduplicar. O ramo posterior ignora pendentes existentes, mas tenta dedup antes de verificar revisão. | Aplicar proteção de revisão primeiro, conciliar elegíveis e promover pela idade sem criar data. |
| 4 · Conciliação | `dividend-deduplication.ts` e `isFuzzyDuplicateManualDividend` exigem pagamento e usam tolerância fixa. `dividends.ts` grava competência no dia 01 e marca a nota. O hook chega a usar COM como pagamento. Editar e excluir em `use-portfolio-dividend-mutations.ts` combina cache e escritas sucessivas. | Tratar mês como mês, conciliar em moeda nativa e executar vínculos, reversão e Caixa na mesma transação. |
| 5 · Custódia | `dividend-suggester.ts` normaliza ticker mas emite item por lote; Edge soma lotes e escolhe o maior. `use-corporate-dividends.ts` mistura eventos persistidos e sugestões e infere provedor pelo flag fiscal. Os jobs `dividends-sync-global` e `dividends-process-user` estão em `supabase/quotes-cron.sql` (10:00 e 11:30 UTC). | Determinar o ativo principal por regra estável. Consumir a identidade e a procedência persistidas. Reusar o processamento no refresh individual. |
| 6 · Conferência | `pending-dividends-dialog.tsx:297` substitui nulo por hoje e pode antecipar data futura; 0143 faz coalesce semelhante nos RPCs. O builder do carrossel chama o total projetado de mensal. O relatório já usa `computeProjectedPatrimonyWithProvisioned` no rodapé. | Corrigir todos os pontos de aprovação, filtrar a competência antes da soma e preservar o fechamento. |
| Transversal · Restauração | 0143 restaura FKs circulares em três passos. A definição posterior de `restore_backup` em 0154 insere os proventos sem `source_event_id`. A lista `BACKUP_TABLE_KEYS` em `src/domain/export/backup.ts` também omite eventos e dispensas. | Evoluir exportador, leitor de versões antigas e definição SQL vigente preservando rollovers e outros módulos; testar ida e volta com dedup, saldo inicial, dispensas e vínculo de origem. |

**Invariantes financeiros.** `PROVISIONED` e `PENDING_CONFIRMATION` não alimentam Caixa, patrimônio de fechamento, custo médio, YoC realizado ou DRE. Liquidação insere um lançamento nativo e opcionalmente credita BRL uma vez. Dedup só estabelece o vínculo. O total histórico de recebidos usa acumulado inicial + extrato; o calendário mensal usa apenas movimentos datados. As bases são ESPECIFICACAO_TECNICA §§1.6 e 3, ARCHITECTURE §§3, 5 e 12 e FINANCIAL_MATH_SPEC §§3.3, 8 e 9.

## 2. Modelo persistido e fronteiras de confiança

~~~mermaid
erDiagram
    CORPORATE_DIVIDENDS ||--o{ USER_DIVIDEND_EVENTS : anuncia
    PORTFOLIO_ASSETS ||--o{ USER_DIVIDEND_EVENTS : representa_lotes
    USER_PREFERENCES ||..o{ PORTFOLIO_ASSETS : piso_por_carteira
    PORTFOLIO_DIVIDENDS o|--o{ USER_DIVIDEND_EVENTS : settled_dividend_id
    USER_DIVIDEND_EVENTS o|--o| PORTFOLIO_DIVIDENDS : source_event_id
    CORPORATE_DIVIDENDS o|..o{ CORPORATE_DIVIDEND_VOTES : identifica_evento
~~~

A RPC `set_dividend_tracking_atomic` da 0159 e o saneamento sobre as linhas existentes usam o contrato de §3.1. A 0160 implementa os comandos de §4.3, a 0161 governa votos e publicação e a 0162 encerra a compatibilidade de dispensas conforme §6.

DDL **proposto** para migrations progressivas. Nomes 0159–0162 reservados neste roteiro a partir da última migration observada, 0158; renumerar monotonamente se a branch avançar. Cada alteração é aditiva até a troca dos leitores. Tipos monetários e enumerações de evento continuam os de 0143.

~~~sql
-- 0159: cortes inclusivos e revisão otimista
ALTER TABLE public.portfolio_assets ADD COLUMN dividends_start_date date
  CHECK (dividends_start_date >= DATE '2000-01-01');
ALTER TABLE public.user_dividend_events ADD COLUMN revision bigint NOT NULL DEFAULT 0;
-- updated_at já existe. Incrementar revision em todo UPDATE por trigger BEFORE UPDATE.
CREATE INDEX idx_dividend_manual_asset_date
  ON public.portfolio_dividends(user_id, asset_id, date, id);
-- 0160: identidade de operação de extrato (inclusive retries de criação)
ALTER TABLE public.portfolio_dividends
  ADD COLUMN request_id uuid,
  ADD COLUMN entry_origin text NOT NULL DEFAULT 'legacy'
    CHECK (entry_origin IN ('legacy','manual','engine','restore'));
-- Atribuição pelo escritor no servidor. Restore força restore em qualquer versão.
-- created_at usado como evidência de precedência é atribuído pelo banco em novas entradas.
CREATE UNIQUE INDEX uq_dividend_manual_request
  ON public.portfolio_dividends(user_id, request_id) WHERE request_id IS NOT NULL;
ALTER TABLE public.portfolio_transactions ADD COLUMN linked_dividend_id uuid
  REFERENCES public.portfolio_dividends(id) ON DELETE SET NULL;
CREATE INDEX idx_dividend_tx_link ON public.portfolio_transactions(linked_dividend_id)
  WHERE linked_dividend_id IS NOT NULL;
-- 0159: armazenar procedência desde a primeira classificação externa (S2)
ALTER TABLE public.corporate_dividends
  ADD COLUMN trust_tier text NOT NULL DEFAULT 'raw_fallback'
    CHECK (trust_tier IN ('official','community_verified','enriched_fallback','raw_fallback')),
  ADD COLUMN external_terms jsonb,
  ADD COLUMN published boolean NOT NULL DEFAULT true;
-- external_terms = campos públicos validados do melhor payload externo normalizado,
-- com tier/provedor, COM, ex-date se houver, pagamento, tipo, moeda, taxa bruta e IR.
-- NULL identifica candidato sem observação externa. Sem payload bruto do usuário.
-- 0161: evidências privadas; política de publicação só é ativada nesta fase
CREATE TABLE public.corporate_dividend_votes (
  event_key uuid NOT NULL,
  anchor_terms jsonb NOT NULL CHECK (jsonb_typeof(anchor_terms) = 'object'),
  voter_hash text NOT NULL CHECK (voter_hash ~ '^[0-9a-f]{64}$'),
  corporate_id uuid REFERENCES public.corporate_dividends(id) ON DELETE RESTRICT,
  ticker text NOT NULL, currency text NOT NULL CHECK (currency IN ('BRL','USD')),
  com_date date NOT NULL, payment_date date NOT NULL CHECK (payment_date >= com_date),
  type text NOT NULL CHECK (type IN ('DIVIDENDO','JCP','RENDIMENTO','SOBRA','AMORTIZACAO','OUTROS')),
  gross_rate numeric(16,8) NOT NULL CHECK (gross_rate > 0 AND gross_rate <> 'NaN'::numeric),
  tax_rate_pct numeric(5,2) NOT NULL CHECK (tax_rate_pct BETWEEN 0 AND 100),
  signal text NOT NULL CHECK (signal IN ('dedup','edited','reverted')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_key, voter_hash)
);
CREATE INDEX idx_dividend_vote_lookup ON public.corporate_dividend_votes
  (ticker,currency,com_date,payment_date);
ALTER TABLE public.corporate_dividend_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_dividend_votes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.corporate_dividend_votes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corporate_dividend_votes TO service_role;
~~~

**Políticas e migração.** Manter a policy autenticada da 0087 para SELECT do catálogo acrescentando `published AND` às condições de usuário ativo + leitura de investimentos. Nenhum INSERT/UPDATE/DELETE do cliente no catálogo ou nos votos. A observação externa é gravada por escritor de serviço e os metadados de origem do extrato são imutáveis para o cliente. Para eventos e extratos, SELECT do próprio titular e módulo legível; trocar as policies/DML diretos de escrita por RPC ao migrar todos os chamadores. Bloquear também alteração direta de origem, quantidade calculada, FK de conciliação e sinal via rotas legadas/restore. `SECURITY DEFINER SET search_path = public, pg_temp`, objetos qualificados, revogar EXECUTE de PUBLIC/anon em cada assinatura. RPC de usuário deriva `auth.uid()`, exige conta ativa e escrita em investments e valida *todas* as FKs pelo mesmo dono. Helpers de publicação, votação e processamento recebem EXECUTE só para service_role ou são privados à função proprietária. RLS no catálogo não protege colunas de uma linha visível: armazenar ali exclusivamente termos públicos. Nenhum voto, hash, identificador pessoal, montante individual, nota, corretora ou dado de custódia nas respostas coletivas.

Preservar `UNIQUE NULLS NOT DISTINCT(ticker,com_date,type,payment_date)`, `UNIQUE(user_id,corporate_dividend_id)` e índice parcial `(user_id,source_event_id)`. A FK inversa `settled_dividend_id` já suporta N:1. Não criar tabela de lançamentos espelho. Migrar linhas antigas como raw, reclassificar com observação verificável, sem inferir oficialidade do `provider='brapi'` preenchido pela 0143. Copiar a observação anterior a qualquer promoção. Em colisão de chave entre parcelas, preservar os dois IDs e mandar para revisão operacional; jamais excluir uma linha referenciada para fazer o upsert passar. No restore, validar dados como entrada externa, reconstruir FKs do próprio usuário e nunca aceitar votos, tiers ou privilégios do backup.

**Contrato SQL de leitura do catálogo na 0161.** A policy permissiva antiga deve ser substituída. Duas policies permissivas seriam combinadas por OR e revelariam candidatos retirados.

~~~sql
DROP POLICY IF EXISTS corporate_dividends_select ON public.corporate_dividends;
CREATE POLICY corporate_dividends_select ON public.corporate_dividends
  FOR SELECT TO authenticated USING (
    published AND (SELECT auth.uid()) IS NOT NULL
    AND (SELECT public.is_current_user_active())
    AND (SELECT public.can_current_user_read_module('investments'))
  );
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.corporate_dividends
  FROM PUBLIC, anon, authenticated;
~~~

Para evitar uma segunda verdade sobre a pontuação, calcular `reliability_score` na consulta interna agrupada por event_key e variante, com `SUM(CASE signal WHEN 'dedup' THEN 10 WHEN 'edited' THEN 8 ELSE -15 END)/10.0`. O sinal zero não grava linha. Somente o resultado da publicação precisa ser persistido. Se o catálogo for enriquecido, preservar `external_terms` separadamente do valor efetivo e reaplicar a hierarquia quando o provedor atualizar a observação. A identificação do instrumento e a evidência fiscal de cada evento seguem os critérios de §4.1.

## 3. Motores puros e contratos de execução

Contrato de fronteira após validação Zod. Datas são dias civis válidos, taxas por unidade têm oito decimais, alíquota em pontos-base (1500 = 15%) e montantes são inteiros seguros em centavos **da moeda indicada**. Nos contratos abaixo, `bruto`, `liquido` e `erroCentavos` já representam totais nativos em centavos. Validar escala/faixa e arredondar o produto quantidade × taxa uma vez, no fechamento do total do evento. Usar decimal escalado/inteiro largo internamente para não perder precisão em produtos grandes.

~~~ts
type Dia = string
type Moeda = 'BRL' | 'USD'
type Classe = 'fundoBR' | 'acaoBR' | 'exterior'
type Estado = 'PROVISIONED' | 'PENDING_CONFIRMATION' | 'SETTLED' | 'DISMISSED'
type Tipo = 'DIVIDENDO' | 'JCP' | 'RENDIMENTO' | 'SOBRA' | 'AMORTIZACAO' | 'OUTROS'
type Evento = {
  id: string, ticker: string, moeda: Moeda, classe: Classe, com: Dia,
  pagamento: Dia | null, bruto: number, liquido: number, tipo: Tipo,
  tipoIncerto: boolean, revisaoManual: boolean, estado: Estado
}
type Manual = {
  id: string, ticker: string, moeda: Moeda, data: Dia, mensal: boolean,
  centavos: number, sourceEventId: string | null, vinculado: boolean
}
type Corte = {
  trackingStartDate: Dia, dividendsStartDate: Dia | null,
  acumuladoCentavos: number, primeiroDiaCustodiaComprovada: Dia | null
}
type Vinculo = { eventos: readonly string[], manual: string, erroCentavos: number }
type Conciliacao = { aplicar: readonly Vinculo[], sugerir: readonly Vinculo[] }
declare function effectiveStartDate(c: Corte): Dia | null
declare function estadoAberto(e: Evento, hoje: Dia): 'PROVISIONED' | 'PENDING_CONFIRMATION'
declare function reconcileCorporateWithManualDividends(
  eventosDoTitular: readonly Evento[], extratoDoTitular: readonly Manual[], hoje: Dia
): Conciliacao
type Sinal = { votante: string, sinal: 'dedup' | 'edited' | 'reverted' }
declare function pontuar(sinaisDaVariante: readonly Sinal[], ancorado: boolean):
  { decimos: number, positivosDistintos: number, elegivel: boolean }
~~~

### 3.1 Marco zero e custódia (blocos 1 e 5)

1. `trackingStartDate` em `custom_settings.dividendAutomation` é piso inclusivo em COM. Inicializar uma única vez ao aderir (para legado usar data de ativação válida ou dia fixo da migração em São Paulo, nunca “hoje” móvel). Preservar demais chaves ao atualizar preferências. A migration 0042 substituiu o piso de 2026 da 0022 por 01/01/2000 em proventos, transações e aportes históricos; a aprovação da 0143 também aceita esse piso. Validar ambos os cortes entre 01/01/2000 e amanhã em São Paulo, inclusive. O limite superior é verificado na escrita pela RPC, sem CHECK dependente do relógio. `APP_START_DATE` mantém o papel de padrão de navegação e limite nas operações descritas na especificação técnica §§3 e 4; `clampAppDate` usa `APP_MIN_DATE` na construção da posição inicial. Preservar esses contratos e receber a data histórica de acompanhamento sem clamp. `activatedAt` continua um controle de liquidação automática independente.
2. Para cada lote com corte explícito: `max(trackingStartDate, dividends_start_date)`. Com acumulado positivo e corte ausente retornar **null / requer corte**. Perguntar pelo primeiro dia ainda não coberto ao cadastrar/editar o acumulado. A soma em dinheiro jamais permite inferir uma data. Antes de aceitar retroação com saldo inicial, mostrar qual intervalo já foi incorporado e exigir ajuste explícito do corte/acumulado. Não recalcular o acumulado a partir de palpites.
3. Sem acumulado nem corte, usar o piso global se existir custódia demonstrável naquele dia; o primeiro dia elegível é o maior entre piso e início comprovado. Cadastro datado comprova baseline apenas a partir do cadastro; compras documentadas anteriores podem comprovar a parcela de ledger antes dele. Baseline residual sem data pode começar em corte individual **declarado como início da posição** ou em criação válida; nunca projetar essa quantidade para trás até a primeira compra de outro lote. Legado sem data nem ledger fica em revisão até declaração explícita. Antecipar apenas o piso global permite reconstruir ativos sem acumulado e com ledger anterior.
4. Processar ticker/mercado/moeda por titular; por lote aplicar o corte e reproduzir buy/subscription/sell/split/reverse_split até COM inclusiva, na ordem intradiária canônica e por ID no empate. Somar quantidades elegíveis antes do arredondamento monetário. Preferir lote padrão existente do grupo como `asset_id`, depois menor ID estável. Não remover o F de um ticker americano. Venda total antes de COM exclui; depois de COM preserva o direito, mesmo com saldo atual zero.
5. Consulta operacional: `com_date <= hoje AND (com_date >= D OR payment_date >= D)`, D = hoje − 120 dias corridos. Restringir por ticker quando fornecido e paginar ambos os caminhos, inclusive o sem lista, depois piso de cada lote. Pendências persistidas são lidas por titular e status independentemente da janela; incluir ativos zerados referenciados por elas. Para pagamento tardio ainda não materializado, buscar também lotes zerados do ticker com ledger cobrindo a COM, inclusive venda anterior a D; limitar esses candidatos apenas a vendas recentes perderia o direito. Retroação solicitada abre backfill por ticker e páginas de 120 dias desde o piso, limitado ao histórico disponível do catálogo. Indicar lacunas de cobertura do provedor. Recuar o corte nunca liquida o passado em lote. Avançá-lo retira apenas sugestões abertas inelegíveis das projeções; preservar histórico, dispensas e edições.
6. Recalcular abertos automáticos em alteração de ledger, corte ou fonte (inclusive quantidade reduzida a zero, que sai da fila econômica). Condição de escrita sob lock: aberto, revisão esperada, `!is_manual && !manual_review_required`. Toda edição individual ou Undo marca revisão antes de novo processamento. Para quantidade zero persistir valores zero em aberto automático, sem confundir com dispensa humana, permitindo recuperação em correção posterior. Liquidado e dispensado permanecem históricos.

**Calibração e saneamento (S1, migration 0159).** No topo da conferência, inclusive quando as duas filas estiverem vazias, mostrar “Calibrar N ativos” se houver lotes com acumulado positivo sem corte. A aba Proventos abre o mesmo diálogo. Listar ticker e acumulado com Checkbox e MoneyText, seleção inicial dos pendentes, um FormField/DatePicker comum e exceção de data por linha. Mostrar quantos ativos receberão cada data e o primeiro dia coberto pela automação. Um clique em “Aplicar aos selecionados” confirma. Sem abertura em cascata de AssetEditDialog ou autoFocus. O editor individual continua disponível.

Hoje, useUpdatePortfolioAsset chama updatePortfolioAsset para um único ID. Para cortes, preferências, editor individual e ação coletiva devem chamar a mesma RPC autenticada da 0159: `set_dividend_tracking_atomic(p_tracking_start date, p_assets jsonb, p_expected_tracking_start date) returns jsonb`. Data global nula conserva o valor existente; array vazio permite alterar apenas o piso global. Cada item contém `asset_id, expected_start, start_date` (data comum já expandida com as exceções). Deduplicar IDs na UI e rejeitar duplicados, datas inválidas, titularidade alheia ou escrita bloqueada no servidor. Bloquear a preferência por titular e os ativos em ordem de ID, comparar valores esperados inclusive NULL e atualizar só a chave de preferência pertinente. Repetição com o mesmo estado final é sucesso; conflito real ou erro em uma linha reverte o lote inteiro. O primeiro comando cria a preferência do titular se ausente, respeitando os defaults existentes. Aplicar as mesmas regras de autorização de §2. Ao salvar outras preferências de automação, preservar o corte vigente via merge no servidor para evitar que uma aba com cache antigo desfaça a calibração. A 0159 inclui o novo campo, com validação de datas compatível e preservação do JSON das preferências, na lista explícita de ativos do `restore_backup(jsonb)` vigente (0154); backup antigo traz NULL e retorna à calibração. A restauração completa dos vínculos de extrato segue em S3.

Na mesma transação, reavaliar **todos** os eventos do titular atingidos, inclusive fora dos 120 dias: todos os tickers se o piso global mudou, grupos canônicos dos lotes editados nos demais casos. Predicado obrigatório: `status IN ('PROVISIONED','PENDING_CONFIRMATION') AND NOT is_manual AND NOT manual_review_required AND settled_dividend_id IS NULL`. O patch individual atual em `updateUserDividendEvent` não marca revisão: em S1, toda edição humana passa a marcá-la atomicamente. Antes do saneamento, proteger linhas legadas com override identificável ou divergência superior à tolerância operacional de `0,02` em moeda nativa frente aos termos de origem (`set_dividend_tracking_atomic`). Preservar para revisão (`manual_review_required = true`) quando a autoria da divergência for incerta. Para COM anterior a todos os cortes válidos ou sem lote calibrado elegível, zerar quantidade e totais derivados (§3.1.6), mantendo ID, datas, taxas e estado. COM igual ao corte participa. Em grupo com elegibilidade parcial alterada, invalidar o total agregado antigo da mesma forma e recalcular pelos lotes elegíveis com o replay já existente em `quotes-core.ts`; nunca decidir pelo corte apenas do ativo principal. Essa invalidação exclui o valor obsoleto já no commit. O processador agendado existente recompõe somente os montantes que voltaram a ser elegíveis, inclusive pendentes zeradas fora da consulta de descoberta, com atualização condicionada à revisão. Essa recomposição de lotes mistos pode ocorrer no ciclo seguinte; a exclusão dos totais obsoletos já ocorreu ao salvar. Recuar o piso permite recompor linhas zeradas. Cron, dedup e confirmação devem reler os cortes sob o mesmo bloqueio por titular, respeitar cálculo invalidado e impedir que um snapshot anterior republique ou credite o item. Preservar SETTLED, DISMISSED, manuais e edições protegidas, bem como Caixa, extrato e fechamento.

Retornar pisos gravados, IDs de eventos invalidados e contagens de ativos alterados/eventos afetados. No sucesso, aplicar os pisos e IDs invalidados ao cache da carteira antes do refetch, atualizar a seleção visível e invalidar preferências, carteira e consumidores do Hub. Em `use-corporate-dividends.ts`, aplicar o corte às linhas automáticas desprotegidas e à sugestão legada **antes** de formar available/projected, contagens e resumo; reservar IDs corporativos materializados inclusive quando zerados. O modal e ProventosTab consomem essas listas, e `summarizeProvisionedDividends` só agrega linhas elegíveis. Isso impede a reaparição pelo fallback durante o refetch. Falha preserva seleções e valores anteriores com “Tentar novamente”.

**Exemplo de aceite.** Carteira inicia em 01/02, ativo A tem acumulado de R$ 300 e corte em 01/04, ativo B tem acumulado zero e compra documentada em 10/01. Ao retroagir o piso global a 01/01, A continua elegível só a partir de 01/04 e B pode recuperar eventos desde 10/01. O saldo de R$ 300 permanece fora do extrato mensal. Se A perder a informação de corte em um restore legado, mostrar “Informe o início do acompanhamento” e interromper novas sugestões desse lote até a correção.

### 3.2 Estado e calendário (bloco 3)

~~~mermaid
stateDiagram-v2
    [*] --> PROVISIONED: direito na COM
    PROVISIONED --> PENDING_CONFIRMATION: pagamento venceu ou prazo ultrapassado
    PENDING_CONFIRMATION --> PROVISIONED: fonte corrigiu data futura em aberto automático
    PROVISIONED --> SETTLED: extrato independente conciliado
    PENDING_CONFIRMATION --> SETTLED: vínculo ou liquidação validada
    PROVISIONED --> DISMISSED: dispensa
    PENDING_CONFIRMATION --> DISMISSED: dispensa
    SETTLED --> PENDING_CONFIRMATION: estorno com revisão e prazo vencido
    SETTLED --> PROVISIONED: estorno com revisão antes do prazo
    DISMISSED --> PROVISIONED: desfazer e reclassificar
    DISMISSED --> PENDING_CONFIRMATION: desfazer e reclassificar
~~~

Pagamento conhecido futuro provisiona; conhecido até hoje vai para conferência. Sem pagamento, contar (COM, hoje] em dias de pregão BR para fundos e US para exterior: promover **após** 15 e 22 respectivamente; para ações BR após 35 dias civis. Ex.: fundo no 15º pregão continua provisionado; no 16º pede revisão, mantendo pagamento NULL. Usar calendário B3/NYSE para COM/ex-date e janelas úteis; converter timestamps do mercado antes de obter o dia. O dia operacional do produto para “hoje” é America/Sao_Paulo. Sem data após 120 dias desde COM, continuar acessível em A Conferir / antigas, fora das somas projetadas e alertas futuros. Sem descarte de histórico ou estado EXPIRED adicional.

Modo auto só liquida evento aberto sem intervenção/ambiguidade, data real não futura, fiscal confirmado, modo ativo e pagamento ≥ `max(activatedAt, hoje−7)`, respeitando opção de Caixa. Exigir fonte estruturada validada para crédito **automático**; comunidade enriquece a fila e requer confirmação individual. Eventos sem data só podem ser ligados a recebimento preexistente verificável ou confirmados com data explicitamente informada. Essa ligação não cria movimento financeiro. Nunca usar o dia 01 de um lançamento mensal como prova de dia de pagamento.

### 3.3 Conciliação e reconciliação bidirecional (bloco 4)

Particionar por titular, ticker canônico e moeda nativa comprovada (moeda de ativo vinculado para legados). Excluir dispensados, eventos travados para revisão automática, manuais já consumidos, gerados por outro evento ou sem identificação unívoca. Bloco de dados incompleto produz sugestão. Reservar vínculos exatos existentes primeiro. Verificar `manual_review_required` também no ramo de dedup, antes de qualquer aplicação. Para 1:1, montar grafo de candidatos admissíveis:

| Dimensão | Regra |
|---|---|
| Valor | Para cada candidato v em centavos, diferença absoluta ≤ max(10, floor(0,015 × v)). Comparar líquido esperado. Acrescentar bruto e 85% do bruto para BRL com possível JCP; em USD, bruto e 70% do bruto. Arredondar cada candidato para centavos, eliminar repetidos. Fatores são hipóteses deste motor, nunca retificação fiscal automática. |
| Data conhecida | Até cinco dias úteis de distância no mercado da posição, para ambos os lados. |
| Sem data | Exigir lançamento entre COM e fim da janela típica inclusivos. Após a janela oferecer revisão individual. Para mensal identificado pela tag legada ou modo explícito, usar competência do pagamento ou interseção com meses da janela provável. Dia 01 sem tag mantém precisão diária. |
| Escolha | Maximizar cardinalidade de vínculos 1:1 e depois minimizar soma dos erros em centavos, distância temporal e dependência de hipóteses fiscais, nesta ordem. Resolver por componente conexo, preservando IDs estáveis para apresentação. Se duas soluções tiverem o mesmo custo, mostrar as alternativas conflitantes; nenhuma gravação automática nesse componente. Vínculos que dependam apenas de hipótese fiscal ou de mês estimado exigem aceite. |
| N:1 | Só depois de retirar 1:1 resolvidos e componentes ambíguos. Examinar subconjuntos de 2 a 4 eventos do mesmo ticker, moeda e competência contra um único manual. Diferença ≤ max(10, floor(0,01 × soma)). Até 12 eventos remanescentes por grupo; acima disso, revisão sem enumeração. Segunda combinação elegível ou competência incerta implica sugestão. Conciliação agregada requer confirmação e não comprova dia/tipo por evento para o consenso. |

Um link aceito grava em cada evento `SETTLED, settlement_origin='dedup', settled_dividend_id=<manual>` e mantém `source_event_id` do lançamento manual livre. Para competência mensal, permitir evento conciliado com pagamento desconhecido; a data civil efetiva permanece desconhecida. A reversão recupera todos os eventos vinculados antes do DELETE/ON DELETE SET NULL.

**Escrita normal.** O caminho curto de §4.3 trata partições sem candidatos ou vínculos. Nas demais, a criação, edição, retificação e exclusão do manual passam por comando transacional; incluir QuickTransactionSheet, drawer de ordens e Undo. Bloquear por chave (titular, ticker, moeda) em ordem estável na mudança de ativo, depois por ID de linha. Gravar alteração do extrato, vínculo explícito com transação e delta real do Caixa; invalidar vínculos incompatíveis e reconciliar antes de retornar. Deno calcula o plano sobre snapshot com o manual proposto; o RPC interno compara sob lock o conjunto completo de IDs e valores relevantes dos candidatos, ativos e movimentos com o snapshot (também detecta novas linhas). Divergência retorna conflito e recalcula a partir do banco, até duas tentativas, depois erro com retry. Todos os escritores da partição, inclusive cron e edição de custódia, participam do mesmo protocolo. Nada de matching financeiro duplicado em SQL ou de callbacks obrigatórios do browser.

No DELETE, descobrir por ID autenticado os vínculos nos dois sentidos, capturar o crédito histórico `cash_amount` em BRL antes de apagar, respeitar opção contratada de estorno e salvaguarda de caixa já reinvestido, devolver estornado e diferença. Não recalcular PTAX no Undo. Apagar a transação associada por FK; para pares legados sem FK só vincular após identificação inequívoca, caso ambíguo pedir revisão e preservar linhas. Reabrir todos os eventos com `manual_review_required=true`, limpar a dispensa legada correspondente e registrar retração elegível na mesma transação. Editar um manual que muda data/valor/ativo desfaz os vínculos afetados antes de avaliar novos candidatos, sem emitir segundo crédito. Undo de conciliação **desvincula** e preserva o extrato manual; excluir o lançamento e desfazer a criação de um lançamento automático são intenções distintas.

## 4. Fontes, consenso colaborativo e sincronização

~~~mermaid
flowchart TD
    A[Cron global por mercado] --> B[Brapi estruturada e cache externo]
    B --> C{Evento completo e validado?}
    C -->|Sim| G[Upsert por identidade estável]
    C -->|Não| D{Catálogo tem variante verificada?}
    D -->|Sim| H[Usar campos promovidos]
    D -->|Não| E[Yahoo Chart e enriquecimento compatível]
    H --> I[Processador puro por titular]
    E --> G
    G --> I
    J[Cron individual ou sync autenticada] --> I
    I --> K[Evento individual e fila de revisão]
    K --> L[Conferência ou conciliação com extrato]
    L --> M[RPC transacional com lock]
    M --> N[Extrato e eventual crédito único]
    M --> O[Evidência independente privada]
    O --> P[Recontagem e quórum]
    P -->|Promover ou rebaixar| G
    K --> Q[KPIs e Notification Hub]
~~~

### 4.1 Resolução do evento (bloco 2)

| Prioridade | Quando aceitar | Quando continuar ou parar |
|---|---|---|
| 1 · official | Brapi completa com ticker/moeda, taxa positiva, COM de direito comprovada, tipo **explícito** e pagamento válido; ou feed equivalente identificado. O selo significa dado estruturado validado no produto; mostrar também o nome do provedor. | Aprovação societária usada como COM, label desconhecido ou pagamento inconsistente impedem essa classificação. Correção oficial vence consenso e reavalia apenas eventos abertos não editados. |
| 2 · community_verified | Ler a variante publicada para o evento identificado e com quórum vigente. Preservar provedor da âncora. | Evitar enriquecimento externo repetido **desse evento**. Continuar a descoberta periódica de novos dividendos/parcelas e revisão de fonte superior por ticker. |
| 3 · enriched_fallback | Yahoo + metadado independente de instrumento e natureza da distribuição. Para distribuição ordinária comprovada de FII/Fiagro/FI-Infra elegível, usar RENDIMENTO, alíquota padrão 0 e tipo certo para esse regime. EUA: tentar calendarEvents e aceitar data apenas quando ticker, moeda e ex-date correspondem inequivocamente à distribuição. | Sufixo 11, classe editável pelo usuário ou categoria “fundo” isolada não provam isenção, amortização ou tratamento universal. Investidor/regime excepcional conserva revisão individual; nunca publicar a alíquota pessoal como corporativa. CalendarEvents pode descrever apenas o próximo pagamento ou exigir autenticação; cachear ausência e seguir com NULL. |
| 4 · raw_fallback | Chart informa ex-date e valor unitário; converter ex-date → pregão anterior para COM. Ações BR sem natureza identificada mantêm tipo incerto. | Sem atribuição confiável por evento, conservar NULL, flag fiscal e revisão. Não extrapolar um calendário futuro sobre eventos históricos. |

**Cobertura real de fundos em S2.** Consultar por ticker B3 exato o `CURATED_TICKERS_CATALOG` versionado em `src/domain/portfolio/tickers-catalog.ts` para identificar o instrumento na conferência (p. ex. MXRF11, VGIA11 e o ETF BOVA11). É catálogo de autocomplete, com classe e setor, sem documento do evento. Os parsers atuais de cotação Brapi/Yahoo extraem preço, moeda e tempo; nomes ou quoteType/instrumentType eventualmente presentes não comprovam rendimento ordinário. Para enriquecer, exigir observação pública do **mesmo evento** no catálogo externo (§2), com label explícito de rendimento ordinário, ticker, moeda, COM e taxa compatíveis, ainda que falte pagamento. Registrar provedor e termos em external_terms. Com evento apenas no Yahoo, inclusive de FII conhecido, a linha fica em raw_fallback, “Estimado — conferir”, com edição individual imediata. Amortização explícita mantém sua natureza; ETF, unit, FI-Infra sem identificação comprovada ou label genérico nunca recebem isenção por heurística. A cobertura será parcial até haver evidência independente, sem chamada extra por usuário.

Upsert sob lock por mercado/ticker. Priorizar identidade exata e parcela/data/taxa compatíveis conforme 0143. Para fontes diferentes, pesquisar COM ±1 pregão; ampliar para ±2 apenas com mesma ex-date de origem verificável ou ID externo idêntico. Exigir moeda, taxa compatível (até 1%), tipos compatíveis ou explicitamente incertos e pagamento igual ou previamente nulo. Apenas candidato único pode ser enriquecido mantendo UUID, FKs e dispensas. Duas datas de pagamento explícitas distintas preservam parcelas separadas; buscar similaridade nunca implica merge transitivo. Uma observação inferior não sobrescreve campos superiores. Em 401/403 de escopo, abrir circuito Brapi até a próxima execução global, ir ao cache/Yahoo sem fan-out individual; 400/404 de lote podem isolar símbolos, 429/5xx respeitam Retry-After e orçamento do job.

### 4.2 Evidência e publicação

1. O backend deriva titular, campos efetivamente alterados e linhagem do evento a partir do estado bloqueado. Votante elegível pela convenção de 0156, com escrita autorizada e posição ou lançamento verificável. Não aceitar um endpoint público que receba peso, hash, tier ou indicação de independência. Um voto por titular e evento, independentemente de quantos lotes, aparelhos, dias ou ações. Usar HMAC-SHA256 com chave de servidor sobre titular e event_key, hash distinto por evento. Segredo estável no cofre; rotação recalcula/revoga votos sob manutenção antes da troca.
2. Identidade ancorada usa o UUID global. Para caso não ancorado, transação sob lock por ticker/moeda busca grupo privado por COM ±1 pregão, pagamento exato, tipo, tributação e taxa bruta ±1% em relação ao representante **fixo**; conferir limites também entre extremos do grupo para evitar encadeamento. Se não houver grupo, atribuir UUID estável. Congelar o representante inicial em `anchor_terms` com a tupla normalizada (ticker/moeda/COM/taxa e discriminante de parcela), idêntica em todas as linhas de event_key e imutável no helper. A primeira evidência pode assim ser retificada ou expurgada sem deslocar a âncora. Se houver dois compatíveis suspender promoção. Consolidar variantes concorrentes do mesmo direito no mesmo event_key antes de contar; dias/parcelas distintos sobrevivem. Criar linha global apenas ao atingir quórum e gravar corporate_id nas evidências. Rebaixar evento sem fonte externa via published=false, preservando ID e referências individuais.
3. Pontuar somente variante com tupla pública completa comprovada. Aceite de sugestão, automático, lote sem edição, replay, Undo sem voto anterior, backup e dedup de lançamento derivado do próprio motor valem **0**. Dedup 1:1 independente vale **+1,0** quando houver prova do extrato e dos termos relevantes; registro do mesmo dia e montante isolados não provam tipo/IR. Usar `entry_origin=manual`, `source_event_id IS NULL`, data exata e precedência gravada pelo servidor em relação à primeira disponibilização da sugestão. O processamento atual carrega só id/ativo/ticker/data/valor; incluir origem, vínculo, created_at e marca mensal. Ausência de prova de precedência ou de registro independente limita o resultado à carteira individual. Após materializar as sugestões exclusivamente no banco, a criação do evento individual delimita a primeira disponibilização; antes do corte do fallback cliente, aceitar apenas evidências comprovadamente anteriores ao próprio catálogo. Edição explícita vale **+0,8** quando corrige termos com base independente. Na conferência solicitar que o usuário indique quais termos conferiu no informe; campos herdados só completam a tupla se já verificados por fonte externa estruturada. Se faltarem dados, aplicar a correção apenas individualmente. Mensal, N:1 e retenção individual jamais fabricam evidência de um termo global. No caso não ancorado exigir taxa por cota conhecida, COM informada e evento manual independente; valor total ÷ posição atual não estabelece taxa pública.
4. Usar inteiros em décimos. Para uma variante, S = 10 × dedups + 8 × edições − 15 × retrações, contando **o último sinal por pessoa**. Estorno com revisão substitui o voto positivo anterior da mesma variante por −15 (não acumular débitos em retries). Se o titular corrigir a variante, retirar o voto antigo e avaliar a nova no mesmo lock. O índice exibível internamente é S/10, sem interpretação probabilística. Ancorado exige ≥2 positivos distintos, pagamento/tipo/alíquota exatos e S≥16. Não ancorado exige ≥3, S≥24, além da concordância de taxa e COM acima. Exemplos: cinco aceites → 0; duas edições independentes ancoradas → 16; três edições não ancoradas → 24. Estorno de uma das duas edições → −7 e apenas um positivo.
5. Recalcular por grupo na mesma transação da mudança de sinal. Empate ou duas variantes que passam → suspender promoção. Em perda de quórum restaurar `external_terms` ou ocultar candidato puramente comunitário; se chegou oficial, manter oficial. Nenhuma promoção dispara liquidação retroativa. Retificar filas não editadas no próximo processamento e exibir conflito nos itens em revisão. Publicar apenas os termos vencedores, tier e provedor. Registrar troca de tier, motivo, versão e data em auditoria operacional sem payload pessoal; métricas por mercado/tier e agregado, sem expor grupos pequenos por usuário.
6. Gate LGPD: finalidade restrita a corrigir termos públicos; informar a contribuição na conferência, permitir conferência privada. Purgar evidência quando houver exclusão do titular calculando seus hashes por event_key antes da exclusão da identidade; recontar em lote e auditar somente resultados agregados. Não exportar votos no backup pessoal nem reaplicá-los em restore. Pseudônimo e contador global isolado não substituem um registro revogável.

**Risco residual e custo-benefício.** Dois titulares elegíveis ainda podem estar em conluio ou copiar o mesmo informe incorreto. O quórum expressa concordância observada. Ele não autentica a corretora. Conter o impacto com aceite individual, prioridade da fonte estruturada, reversibilidade e suspensão da promoção por evento contestado. No piloto, manter as publicações em simulação por pelo menos um ciclo mensal; comparar, para cada mercado, eventos com quórum / eventos revisados, chamadas de enriquecimento evitáveis / tentativas e conflitos com fonte estruturada / eventos posteriormente cobertos. Medir chamadas evitadas apenas quando o cache substituir uma tentativa que seria feita. Com denominador zero registrar “sem amostra”. Habilitar por mercado depois de verificar economia observada e revisar todos os conflitos; manter o modo individual para os tickers sem evidência. Esse critério evita impor uma meta de cobertura que o checkout não permite estimar.

### 4.3 Divisão de responsabilidades e operações (blocos 1, 4 e 5)

O comando de corte e saneamento `set_dividend_tracking_atomic` é uma RPC direta da 0159 (§3.1). A ação Edge de escrita manual, a conciliação e a sync interativa de S3 usam os RPCs da 0160. A promoção pública só é habilitada com a 0161.

- **Motor único.** Manter as regras puras em `src/domain/portfolio/dividend-engine.ts` e calendário/normalização em dependências puras portáveis (sem `@/`, DOM, rede, relógio global ou SDK). Usar imports relativos resolvíveis por Deno e pelo projeto TS. `quotes-core.ts` passa a adaptar o payload Deno e o cliente reutiliza o mesmo arquivo. Gate anterior à troca: empacotar a Edge localmente, executar fixtures nos dois runtimes e build Vite. Caso o empacotador Supabase não inclua fontes fora de functions, gerar cópia determinística no bundle de deploy e conferir hash no CI; jamais manter duas implementações manuais. Após materialização confiável, remover o fallback de escrita/sugestão paralela; React Query lê eventos e deriva agrupamentos de exibição.
- **API.** Manter `confirm_user_dividend_events_atomic(jsonb,boolean)`, `settle_user_dividend_event_system`, `dismiss_user_dividend_event_atomic` e `revert_confirmed_dividend_events_atomic` como portas compatíveis. Exigir ID do evento materializado, revisão esperada, data explícita ou persistida, e validar data entre COM e hoje para liquidação. Nenhum default “hoje”. A assinatura legada `approve_dividends_batch_atomic` deve resolver o evento e delegar às mesmas guardas ou recusar a linha. Impedir que compatibilidade, Undo ou dedup contornem revisão. Todas as linhas de lote são validadas antes de aplicar. Repetição já liquidada retorna o ID original sem dinheiro adicional.
- **Comandos novos.** Ação autenticada `write_user_dividend` na Edge Function `quotes` existente recebe operação create/update/delete, request_id, ID/patch, opção Caixa e eventual revisão. Ela chama RPC privada `apply_dividend_reconciliation_system(p_user_id uuid,p_command jsonb,p_snapshot jsonb,p_links jsonb)`; serviço verifica identidade antes, SQL revalida dono, permissão, unicidade, centavos e snapshot sob lock. Para delete repetido, ausente do titular resulta em no-op sem revelar existência externa. Para create repetido comparar conteúdo do request_id; divergência é conflito. Para UPDATE usar snapshot anterior como precondição. Na 0160, RPC `dismiss_user_dividend_events_atomic(p_ids uuid[],p_revisions bigint[],p_reason text)` grava tudo ou nada e retorna IDs/revisões para Undo. A partir da 0161, retração e promoção ficam em helper privado na transação, sem trigger de aprendizagem em inserts genéricos/restore.
- **Caminho curto e orçamento (S3, 0160).** O primeiro passo da ação é chamar a mesma `apply_dividend_reconciliation_system` com snapshot nulo e links vazios. Sob o lock da partição antiga e nova, o banco procura eventos abertos e vínculos anteriores nos dois sentidos. Se não houver candidatos nem vínculos, aplica o comando e o delta de Caixa nessa transação, sem carregar histórico ou executar matching em Deno. Havendo candidatos, retorna `needs_reconciliation` sem escrita e segue §3.3. A identidade de criação e as precondições de edição/exclusão valem nos dois caminhos. Não consultar provedores no comando manual. Medir de submit até resposta, separando execução quente/fria; metas propostas p95 ≤1,5 s quente e ≤4 s fria para o caso trivial, timeout cliente de 10 s. Cron periódico não garante instância aquecida.
- **Rede e feedback (S3).** PWA_GUIDELINES (cache e estado offline) reserva o cache à casca e aos assets. `src/app/providers.tsx` já define mutations.retry=false; as mutations de carteira invalidam no sucesso e usam o gateway de erros. Usar `useNetworkStatus()` na tela, verificar novamente a conectividade no comando e definir `networkMode: "always", retry: false` nesta mutation para que o TanStack execute a guarda mesmo offline, sem pausar para envio na reconexão. Sem rede, preservar o formulário em memória e exibir “Sem conexão. Conecte-se para salvar.” Durante o envio mostrar estado pendente e impedir duplo toque. Timeout após despacho significa resultado desconhecido: refetch do extrato/evento antes de oferecer “Tentar novamente”, mantendo request_id na criação e precondição original na edição. Reconectar atualiza leituras; nova escrita exige ação do usuário. As duas tentativas internas de §3.3 aplicam-se somente a conflito de snapshot com rollback confirmado dentro do orçamento.
- **On demand.** `quotes` aceita `{action:"sync_user_dividends"}` via JWT validado, verifica escrita e deriva uid; corpo não seleciona carteira alheia. Executa o mesmo processador do cron para um titular, a partir do catálogo, sem fetch externo por clique. Usar lock single-flight isolado por escopo/uid no padrão 0142 e cooldown de 60 s após início; até 6 pedidos/hora. Criar na 0160 buckets dedicados ampliando CHECK de `quote_refresh_rate_limits.bucket_kind` para `minute,hour,dividend_minute,dividend_hour`; RPC de serviço com UPSERT atômico, limite de janela horária e lease de 60 s para garantir intervalo real entre cliques mesmo entre dois minutos civis. Renovar o lock de processamento em lotes longos. Respostas 200 com contagens e janela processada, 429 com retry_after, acesso inválido 401/403, falha transitória com retry manual. Cron não consome cota interativa. Após commit usar `invalidatePortfolioSuite` e atualizar o centro de notificações.
- **Custo e concorrência.** Paginar por chave estável, pré-carregar transações uma vez por grupo, buscar candidatos por ticker/data/tenant e somente estados abertos. Para lotes e backfill, usar cursor reproduzível e limite de duração por invocação; repetir última página é seguro. Usar EXPLAIN (ANALYZE, BUFFERS) com eventos sem data, usuários com venda total e catálogo de 1 ano. Conferir uso dos índices de 0143 antes de adicionar outro; testar 10 mil eventos/100 tickers e limitar pesquisa combinatória pelo teto do §3.3.
- **Dispensas legadas.** Backfill paginado de `portfolio_dividend_dismissals` em eventos individuais usando (user_id,corporate_dividend_id), preservando razão e estados SETTLED. IDs sem lote comprovável permanecem na tabela legada como supressão. Comparar exclusões e contagens por usuário em leitura dupla; manter compatibilidade para leitores antigos. Trocar leituras, depois desligar escrita dupla. Somente em release posterior, após migração de restores, zero órfãos e zero chamadas legadas em um ciclo completo de release, remover tabela/RPCs obsoletas.

## 5. Experiência de conferência e indicadores (bloco 6)

Usar o host global já aberto por `openDividendReviewModal` e deep link de investimentos. Um único editor tipado serve as duas filas. Em **A Conferir** ficam pagamentos vencidos e prazos excedidos; em **Provisionados**, futuros e sem data ainda dentro do prazo; em **Provisionar Manual**, cadastro particular com ticker, COM, pagamento opcional, taxa/quantidade, moeda e origem Manual. Incluir filtro de antigas na primeira aba. Usar busca por ticker e filtros de moeda, origem e data ausente; seleção por ID persistido, “selecionar visíveis” e contagem explícita. Dispensa em lote usa razão e Undo de 5 s; dispensa da linha é distinta de silenciar o banner por 7/30 dias.

“Confirmar agora” em item sem data abre editor com DatePicker vazio, rótulo obrigatório e descrição; o botão de confirmar permanece desabilitado até data civil válida. Sem autoFocus, sem preencher hoje ou reduzir pagamento futuro. Aceitar um pagamento antecipado somente com correção explícita da data real. Na edição mostrar valores bruto/líquido, moeda, tipo, alíquota e destino do Caixa; indicar a procedência real via Badge com texto “Oficial”, “Verificado pela Comunidade”, “Estimado — conferir” ou “Manual”. Mostrar o provedor e os campos estimados nos detalhes. Em lote exigir data, tipo e valores revisados de **todos** os selecionados; se houver pendência, identificá-la e abrir revisão antes de enviar. Erro de conflito recarrega a linha e preserva o rascunho para reconferência.

Reusar Modal/ResponsiveDialog, FormField, DatePicker, MoneyText, Checkbox, Tabs, Badge, ModalFooter, Skeleton, EmptyState, ErrorState e ações pelo gateway sensorial. Sem scroll vertical aninhado, valores truncados ou teclado automático no celular. Em DividendAutomationCard separar início do acompanhamento, ativação do auto e atualização da fila; em AssetEditDialog expor primeiro dia descoberto quando houver saldo inicial. Mudar corte mostra impacto nos itens abertos antes de aplicar. Alertas da Overview e PortfolioInsightsCarousel saem do mesmo seletor integrado ao Notification Hub, com IDs/referências deduplicadas. Manter o carrossel e o popover de dispensa existentes. Trocar “creditados na corretora” por “Proventos a conferir” quando ainda só houver expectativa.

| Indicador | População e competência | Consumidores |
|---|---|---|
| Previstos no mês M | Abertos com payment_date conhecida em M, de hoje em diante inclusive. Pagamento vencido anterior a hoje vai para a fila, não para previsão futura. Escolher M pelo calendário local. | Carrossel e agenda; mês selecionado explícito. |
| Provisionados | Somente PROVISIONED elegíveis, inclusive futuros de outros meses e sem data dentro do prazo. Exibir quantidade sem data em separado. | ProventosTab e Overview. |
| A conferir | PENDING_CONFIRMATION; distinguir data conhecida, prazo excedido e antigas >120 dias sem data. Contagem operacional inclui antigas. | Modal e alertas de revisão. |
| A receber | Soma dos dois estados abertos elegíveis, excluindo antigos sem data >120 dias das projeções. Converter cada linha USD a centavos BRL com FX canônico identificado e somar inteiros. Preservar subtotais nativos. | Rodapé auxiliar do CustodyReconciliationCard, PDF e memória de cálculo. |
| Recebidos no mês | Somente extrato no mês, incluindo manual conciliado uma única vez. Saldo inicial fora da série; YoC usa moeda nativa. | Histórico, fechamento e extrato. |

Implementar filtros e somas em `provisioned-dividends.ts`, com datas presentes no input e um mesmo resultado para cards, relatório e memória. A projeção auxiliar “fechamento + a receber” mantém rótulo e cálculo separados do fechamento certificado. FX de projeção é informativo; para liquidação registrar FX aplicado e valor efetivo em BRL, identificar fallback e pedir confirmação se a conversão automática carecer de taxa confiável. Teste de centavos deve cobrir divergência entre arredondar por evento e converter a soma USD no final.

## 6. Sequência de entrega e critérios de saída

Cada fatia tem aceite próprio; S1 e S2 podem ter desenho/testes em paralelo. Concluir S1–S4 antes da retirada da leitura legada. S5 é opcional em operação e pode permanecer desligada sem prejudicar o usuário individual. As migrations abaixo são futuras, não executadas por este plano. Caminhos relativos à raiz.

| Fatia e dependência | Arquivos de implementação | Aceite e reversibilidade |
|---|---|---|
| S1 · Proteção imediata, calibração e saneamento | `supabase/migrations/20260101000159_dividend_tracking_and_confirmation.sql`, `src/types/schema.ts`, `src/data/repositories/portfolio.ts`, `supabase/functions/quotes/index.ts`, `src/features/investments/components/pending-dividends-dialog.tsx`, `src/features/settings/components/tabs/notifications/dividend-automation-card.tsx`, `src/features/investments/components/asset-edit-dialog.tsx`, `src/features/investments/pages/proventos-tab.tsx`, `src/data/rpc/portfolio.ts`, `src/state/mutations/portfolio/use-portfolio-asset-mutations.ts`, `src/state/queries/use-corporate-dividends.ts`, `src/domain/portfolio/dividend-engine.ts` (corte puro), `src/domain/portfolio/dividend-suggester.ts` | Uma confirmação via set_dividend_tracking_atomic calibra o lote e saneia filas/KPIs no commit, inclusive histórico anterior à janela do cron. Aceitar cortes desde 2000 e preservar corte em restore. Validar corte e pagamento nas aprovações, manter paginação limitada. Aceite independente de S2–S5 conforme §3.1 e matriz. |
| S2 · Custódia, prazo e fontes externas (usa corte de S1) | Referência de instrumentos: `src/domain/portfolio/tickers-catalog.ts`; implementação: `src/domain/portfolio/dividend-engine.ts`, `src/domain/portfolio/dividend-suggester.ts`, `src/domain/portfolio/dividend-deduplication.ts`, `src/domain/portfolio/market-calendar.ts`, `src/domain/portfolio/index.ts`, `supabase/functions/_shared/quotes-core.ts`, `supabase/functions/quotes/index.ts`, `src/state/queries/use-corporate-dividends.ts` | Usar o catálogo curado de §4.1 e distinguir instrumento de natureza da distribuição. Fixtures iguais Deno/Vitest, um evento por ticker, pendência reprocessável, nenhuma liquidação por prazo. Executar em comparação sem escrita antes de trocar o escritor. |
| S3 · Escrita atômica, Undo e sync (S1/S2) | `supabase/migrations/20260101000160_dividend_reconciliation.sql`, `supabase/functions/quotes/index.ts`, `src/data/rpc/portfolio.ts`, `src/data/repositories/portfolio.ts`, `src/state/mutations/portfolio/use-portfolio-dividend-mutations.ts`, `src/state/mutations/portfolio/use-portfolio-order-mutations.ts`, `src/state/mutations/portfolio/use-portfolio-transaction-mutations.ts`, `src/state/mutations/portfolio/portfolio-keys.ts`, `src/features/investments/components/shared-forms/quick-transaction-submit.ts`, `src/domain/export/backup.ts` | Medir caminho curto quente/frio da ação write_user_dividend; comprovar bloqueio offline e retry manual. Auditar todas as portas de escrita incluindo ordem rápida e restore vigente; duas sessões, cache vazio e erro no meio preservam invariantes. Acionar sync após alterações retroativas; se falhar mostrar retry e manter cron como recuperação. Comparar resultados 1:1/N:1 em simulação. |
| S4 · Revisão, KPIs e alertas (S1–S3) | `src/domain/portfolio/provisioned-dividends.ts`, `src/services/dividend-review-modal.ts`, `src/state/queries/use-corporate-dividends.ts`, `src/features/investments/components/pending-dividends-dialog.tsx`, `src/features/investments/pages/proventos-tab.tsx`, `src/features/investments/components/proventos/dividends-calendar-panel.tsx`, `src/features/investments/components/proventos/dividends-history-panel.tsx`, `src/features/investments/components/portfolio-insights-carousel.tsx`, `src/features/investments/components/insights-carousel/build-dividend-insight-items.tsx`, `src/features/overview/components/corporate-dividends-banner.tsx`, `src/features/overview/components/build-overview-alerts.tsx`, `src/domain/notifications/hub/build-notification-center.ts`, `src/components/modules/reports/custody-reconciliation-card.tsx`, `src/domain/calculation-memory/builders/portfolio-breakdown.ts` | Navegação pelas três abas, lote misto bloqueado, mês ≠ todos os previstos; comparar totais do modal, notificação e PDF por conjunto de IDs. |
| S5 · Consenso progressivo (S3) | `supabase/migrations/20260101000161_dividend_consensus.sql`, `supabase/functions/quotes/index.ts`, `supabase/functions/_shared/quotes-core.ts`, `src/types/schema.ts`, `src/data/repositories/portfolio.ts`, `src/features/investments/components/pending-dividends-dialog.tsx` | Ativar primeiro coleta privada com publicação desligada. Comparar promoções simuladas com fonte superior quando chegar; medir por mercado cobertura, divergências, retrações e chamadas externas evitadas. Habilitar publicação somente após testes de independência, revisão de divergências e exercício de rebaixamento. Aferir a taxa de divergência com a fonte superior sobre eventos comparáveis, registrando numerador e denominador; uma divergência de parcela/data retira a variante de circulação até revisão. Kill switch desativa publicação, restaura melhores termos externos e preserva extrato. |
| S6 · Corte definitivo (S3/S4, compatível com S5 desligada) | `supabase/migrations/20260101000162_dividend_legacy_cutover.sql`, `src/state/queries/use-corporate-dividends.ts`, `src/data/repositories/portfolio.ts`, `src/data/rpc/portfolio.ts`, `src/state/mutations/portfolio/use-portfolio-dividend-mutations.ts`, `src/state/mutations/portfolio/portfolio-keys.ts` | Validar restauração em base limpa, fila e totais por titular, desligar fallback/dual-write após paridade. Se houver diferença, manter leitura compatível e identificar IDs antes da remoção física. Manter horários de quotes-cron.sql. |

### Matriz de verificação para a implementação

| Camada / local | Casos mínimos e resultado esperado |
|---|---|
| Domínio · `src/domain/portfolio/dividend-engine.test.ts` | Piso global/individual inclusive, acumulado com/sem corte, legado sem data, compra documentada anterior ao cadastro, baseline misto, retroação paginada. Sem evidência → nenhuma sugestão. |
| S1 · SQL, hook e componentes nas suítes abaixo | Fixture com 20 ativos e 165 eventos antigos; aplicação global, comum e por exceção, COM na véspera/no corte, lote parcial PETR4/F, cron concorrente, recuo, replay e rollback integral em ID de outro dono. No primeiro render após sucesso e após refetch, zero linhas inelegíveis em lista, contagem, banner e KPI. Preservar manuais, editados, SETTLED, DISMISSED, Caixa e extrato. Testar 1999 rejeitado, 2000/2025 aceitos, amanhã aceito e depois de amanhã rejeitado, backup com/sem corte e formulário sem autoFocus. |
| Custódia/paridade · `src/domain/portfolio/dividend-suggester.test.ts`, `src/tests/quotes-core.test.ts` e Deno | PETR4/PETR4F com lote F maior; só F; ticker EUA terminado em F; compras/venda total antes, no dia e após COM; split e grupamento no mesmo dia; valor fracionário; cache/cron idênticos em quantidade, ativo, estado, cents e data civil. |
| Calendário/fontes · `src/tests/quotes-core.test.ts` | 15/16 BR, 22/23 US, 35/36 corridos, feriados divergentes, DST de NY e virada UTC; pagamento ausente, futuro ou tardio com COM antiga. Brapi sem label/COM, 401/403 sem fan-out, 429 limitado, calendarEvents de outra ex-date, MXRF11/VGIA11 com Chart isolado exigem revisão; observação pública compatível com label de rendimento permite enriquecimento. Cobrir amortização, ETF BOVA11, unit ENGI11 e fundo fora do catálogo. Parcelas preservadas a ±2 pregões. |
| Conciliação · `src/domain/portfolio/dividend-deduplication.test.ts` | Fronteiras 10 centavos/1,5%, erros positivos e negativos, USD bruto/líquido e JCP, mês 01 com e sem tag, moeda diferente, grafo em que escolha gulosa perderia um par, empate, N=4/5, teto de busca, lançamento já vinculado e replay. |
| SQL · `supabase/tests/database/01_rls_and_rollback.test.sql` | A não lê nem altera B, anon/readonly sem escrita, chamadas sistêmicas negadas, vínculos cruzados rejeitados. Dois confirms concorrentes e cron vs usuário → um extrato/crédito; insert/edit/delete concorrentes; falha entre writes → rollback de caixa, extrato, revisão, dispensa e voto. Undo com caixa reinvestido, FX congelado, dedup N:1 reabre todos; backup 0143/0154 e novo com FKs recompostas. |
| Consenso · mesma suíte SQL e testes do motor | 5 aceites = 0, mesma pessoa repetida = 1 pessoa, 2×0,8 e 3×0,8 nos respectivos modos, abaixo/acima dos limites de COM e taxa, contas não elegíveis, edições só de um campo, dedup de origem circular, retração repetida, variantes concorrentes, posterior oficial e exclusão LGPD. Sem votos/hash/PII no SELECT de cliente; primeira carteira pode sempre concluir. |
| Repositório/estado · `src/data/repositories/portfolio.test.ts`, testes colocalizados dos hooks | Caminhos com/sem lista, paginação e seletor de encerrados, cache vazio no DELETE, auth trocada, duas requisições entre minutos, retry após 429, refetch após retroação e remoção da dispensa. Isolamento da query key por uid, intervalo e filtros. S3: offline antes do submit, queda após commit, reconnect sem reenvio, retry manual idempotente, dois cliques; medir caminho trivial e simular novo candidato concorrente ao lock. |
| KPIs · `src/domain/portfolio/provisioned-dividends.test.ts` | Hoje, virada de mês, pagamento desconhecido com 120/121 dias, evento de mês seguinte, estados terminais, duas linhas USD com arredondamento e ausência de taxa oficial. Recebidos, Caixa e fechamento invariantes ao provisionar, votar e rebaixar. |
| Componentes · `src/features/investments/components/pending-dividends-dialog.test.tsx`, `src/features/investments/pages/proventos-tab.test.tsx`, `src/features/investments/components/portfolio-insights-carousel.test.tsx`, `src/features/overview/components/corporate-dividends-banner.test.tsx` | Data obrigatória no editor de ambas as filas, zero submit sem data, filtro/seleção/dispensa/Undo, conflito e retry, origem real e selo manual, loading/vazio/erro, paridade dos títulos, acessibilidade de teclado. Conferir mobile <400 px, desktop e três temas. |
| E2E · `e2e/smoke.spec.ts` | Abrir investimentos, abrir revisão pelo banner/deep link e voltar, sem tela branca, overflow global ou exceções em desktop/mobile. Regras fiscais e aritméticas ficam nas suítes anteriores. |

Em cada fatia rodar verify e as suítes direcionadas fora de src/domain; para release, verify:full, testes SQL em banco descartável e smoke do bundle Deno. A prova de integridade usa fixtures com saldo de Caixa, valor de fechamento e extrato antes/depois, além de EXPLAIN e teste em duas sessões para locks reais. O fechamento de implementação inclui SemVer, docs canônicos, roadmap e arquivamento segundo AGENTS.md. Esta revisão entrega a especificação; nenhum aceite futuro está marcado como executado.

### Registro de execução — Fatia S1 (26/11/2026)

- **Status da Fatia S1:** `CONCLUÍDO` (**somente S1** concluída; fatias **S2–S6** permanecem pendentes, sendo **S2** a próxima etapa).
- **Escopo entregue em S1:**
  - Migration `supabase/migrations/20260101000159_dividend_tracking_and_confirmation.sql`: `portfolio_assets.dividends_start_date` (`>= 2000-01-01` + trigger de limite amanhã BRT), `user_dividend_events.revision` (`bigint`, auto-incremento em `BEFORE UPDATE`), `idx_dividend_manual_asset_date`, metadados `trust_tier`/`external_terms`/`published` em `corporate_dividends`, trigger `trg_preserve_dividend_tracking_start` + backfill único em `user_preferences`, helper interno `evaluate_user_dividend_group_cutoff`, RPC `set_dividend_tracking_atomic(date, jsonb, date)` com proteção de overrides legados (`0,02` em moeda nativa), endurecimento de `settle_user_dividend_event_system` / `confirm_user_dividend_events_atomic` / `approve_dividends_batch_atomic` (exigindo data real em `[com_date, hoje_br]`, `expected_revision` e guarda de corte sob lock) e `restore_backup(jsonb)` atualizado a partir da `0154`.
  - Domínio, tipos, dados e Edge Function: `src/domain/portfolio/dividend-engine.ts` (puro e portável), `dividend-suggester.ts`, `schemas.ts`, `src/types/schema.ts`, `src/types/database.ts`, `src/data/repositories/portfolio.ts` (janela operacional de 120d paginada em ambos os caminhos e `manual_review_required: true` em `updateUserDividendEvent`), `src/data/rpc/portfolio.ts`, `src/state/mutations/portfolio/use-portfolio-asset-mutations.ts` (`useSetDividendTracking` com atualização síncrona de cache antes do refetch), `src/state/queries/use-corporate-dividends.ts` e `supabase/functions/quotes/index.ts` (`process_user_dividends`).
  - UI e fluxos de calibração/conferência: painel `"Calibrar N ativos"` + editor com `DatePicker` de pagamento obrigatório em `pending-dividends-dialog.tsx`, callout na `proventos-tab.tsx`, Marco Zero global em `dividend-automation-card.tsx` e corte individual + aviso de recuo em `asset-edit-dialog.tsx` / `asset-metadata-accordion.tsx`.
- **Verificações executadas após a última edição de código:**
  - `npm run verify`: aprovado (`tsc -b` com 0 erros; `eslint .` com 0 erros e apenas 9 warnings pré-existentes em `scripts/sample-reports-entry.tsx`; `vitest run src/domain/` com `276 passed (276)` suítes / `3589 passed (3589)` testes).
  - `npm run build`: aprovado (`vite build` + PWA v1.3.0 em `3.96s`, 0 erros).
  - Suíte direcionada S1 (`npx vitest run` em 13 arquivos): `13 passed (13)` arquivos / `253 passed (253)` testes (`dividend-engine.test.ts`, `dividend-suggester.test.ts`, `data/repositories/portfolio.test.ts`, `use-corporate-dividends.test.tsx`, `use-portfolio-mutations.test.tsx`, `pending-dividends-dialog.test.tsx`, `proventos-tab.test.tsx`, `asset-edit-dialog.test.tsx`, `portfolio-insights-carousel.test.tsx`, `corporate-dividends-banner.test.tsx`, `notifications-tab.test.tsx`, `security-audit.test.ts`, `quotes-core.test.ts`).
- **Pendências de ambiente (fora desta sandbox):** `psql` e `deno` não estão no `PATH`; portanto, a execução viva em banco PostgreSQL da suíte pgTAP (`supabase/tests/database/02_dividend_tracking_s1.test.sql`) e do empacotamento/runtime Deno da Edge Function `quotes` não foi rodada neste ambiente (os contratos estruturais da migration `0159` foram validados estaticamente em `src/tests/security-audit.test.ts`).

### Registro de execução — Fatia S2 (26/11/2026)

- **Status da Fatia S2:** `CONCLUÍDO` (**somente S1 e S2** concluídas; fatias **S3–S6** permanecem pendentes, sendo **S3** a próxima etapa).
- **Escopo entregue em S2:**
  - Domínio e catálogo (`src/domain/portfolio/dividend-engine.ts`, `tickers-catalog.ts`, `market-calendar.ts`, `dividend-deduplication.ts`, `dividend-suggester.ts`): seleção determinística de lote principal (`selectPrimaryLotForGroup`: lote padrão não-fracionário primeiro em BR, depois menor `id`, preservando `F` em USD), soma de custódia por grupo antes do arredondamento monetário e emissão de 1 evento por `(tickerCanônico, moeda)`, classificação de instrumento via `CURATED_TICKERS_CATALOG` (`getCuratedDividendInstrument` sem heurística de isenção por sufixo `11`), máquina de prazos sem pagamento (`resolveOpenDividendEventStatus`: 15 pregões BR para fundos, 22 pregões US para exterior, 35 dias civis para ações BR/outros, regressão `PENDING_CONFIRMATION -> PROVISIONED` quando fonte anuncia data futura, e flag `> 120` dias sem criar estado `EXPIRED` nem liquidar por prazo), resolução de fontes/natureza (`resolveExternalDistributionTerms`) e similaridade `±1 / ±2` pregões (`findCompatibleCorporateCandidate`) com prioridade de `trust_tier`.
  - Edge Function e estado (`supabase/functions/_shared/quotes-core.ts`, `supabase/functions/quotes/index.ts`, `src/state/queries/use-corporate-dividends.ts`): endurecimento de `parseBrapiDividends` (exigindo `lastDatePrior` real, `label` explícito e pagamento consistente para `official`), `parseYahooDividends` (mantendo FIIs B3 como `MXRF11`/`VGIA11` em `raw_fallback` incerto quando isolados e suportando `calendarEvents` US apenas com `ex-date` coincidente), circuit breaker Brapi em `401/403` sem fan-out individual, isolamento apenas em `400/404`, similaridade `±1/±2` pregões e persistência de `trust_tier`/`external_terms` sem degradar tiers superiores em `sync_corporate_dividends`, além de `selectPrimaryLotForGroupEdge` + prazos 15/22/35 em `process_user_dividends` e `useCorporateDividends` preservando `trustTier` e `provider` reais.
- **Verificações executadas após a última edição de código:**
  - `npm run verify`: aprovado (`tsc -b` com 0 erros; `eslint .` com 0 erros e 9 warnings pré-existentes em `scripts/sample-reports-entry.tsx`; `vitest run src/domain/` com `276 passed (276)` arquivos / `3596 passed (3596)` testes).
  - `npm run build`: aprovado (`tsc -b && vite build` + PWA, 0 erros).
  - Suíte direcionada S2 fora de `src/domain/` (`npx vitest run` em 9 arquivos): `9 passed (9)` arquivos / `199 passed (199)` testes (`quotes-core.test.ts`, `use-corporate-dividends.test.tsx`, `data/repositories/portfolio.test.ts`, `use-portfolio-mutations.test.tsx`, `pending-dividends-dialog.test.tsx`, `proventos-tab.test.tsx`, `portfolio-insights-carousel.test.tsx`, `corporate-dividends-banner.test.tsx`, `security-audit.test.ts`).
- **Pendências de ambiente:** `deno` não está no `PATH` desta sandbox; a paridade lógica Deno/Vitest foi verificada via Vitest em `src/tests/quotes-core.test.ts` (42/42 testes), ficando o empacotamento/smoke no runtime Deno pendente de ambiente com Deno CLI.

### Registro de execução — Fatia S3 (26/11/2026)

- **Status da Fatia S3:** `CONCLUÍDO` (**somente S1, S2 e S3** concluídas; fatias **S4–S6** permanecem pendentes, sendo **S4** a próxima etapa).
- **Escopo entregue em S3:**
  - Migration `supabase/migrations/20260101000160_dividend_reconciliation.sql`: colunas `portfolio_dividends.request_id` (uuid + índice único parcial `uq_dividend_manual_request`), `entry_origin` (`'legacy'|'manual'|'engine'|'restore'`), `portfolio_transactions.linked_dividend_id` (`ON DELETE SET NULL` + `idx_dividend_tx_link`), expansão de `quote_refresh_rate_limits.bucket_kind` (`'dividend_minute'|'dividend_hour'`), RPC `check_dividend_sync_rate_limit` (`service_role`, lease 60s e teto 6/h), RPC `apply_dividend_reconciliation_system` (`service_role`, lock transacional por usuário, caminho curto e snapshot completo, idempotência por `request_id`, delta atômico em Caixa BRL sem saldo negativo e retorno de `cash_shortfall_brl`, reabertura de `user_dividend_events` com `manual_review_required = true`), RPC `dismiss_user_dividend_events_atomic` (`authenticated`, `can_current_user_write_module('investments')`, `expected_revision`) e atualização de `restore_backup(jsonb)` forçando `entry_origin = 'restore'` e restaurando `request_id`, `source_event_id`, `linked_dividend_id`, `user_dividend_events` e `portfolio_dividend_dismissals`.
  - Domínio e Edge Function: motor puro `reconcileCorporateWithManualDividends` em `src/domain/portfolio/dividend-deduplication.ts` (matching bipartido ótimo 1:1 por componente conexo com critérios `cardinalidade > erro em centavos > distância em pregões > hipótese fiscal`, fronteiras `max(10 centavos, 1,5%)`, hipóteses JCP 85% / USD bruto e consolidado mensal apenas como sugestão, empate como `sugerir` e N:1 2..4 com teto de 12 eventos), espelho `reconcilePartition1to1Edge` em `supabase/functions/_shared/quotes-core.ts`, e actions `write_user_dividend` (caminho curto + retry de snapshot em 2 tentativas retornando HTTP 409 em conflito) e `sync_user_dividends` (HTTP 429 com `retry_after`, zero fetch externo) em `supabase/functions/quotes/index.ts`.
  - Camada cliente e backup: `src/types/schema.ts`, `src/types/database.ts`, `src/data/repositories/portfolio.ts`, `src/data/rpc/portfolio.ts` (`writeUserDividendEdge` com timeout 10s e guarda offline, `syncUserDividendsEdge`, `dismissUserDividendEventsAtomicRpc`), `src/state/mutations/portfolio/portfolio-keys.ts` (`triggerUserDividendsSync`), `use-portfolio-dividend-mutations.ts` (`networkMode: "always"`, `retry: false`, Undo com alerta de shortfall e `useDismissUserDividendEventsBatch`), `use-portfolio-order-mutations.ts` (ordem de provento atômica via `writeUserDividendEdge` e `triggerUserDividendsSync` em ordens retroativas), `use-portfolio-transaction-mutations.ts`, `src/features/investments/components/shared-forms/quick-transaction-submit.ts` (`expected_updated_at`) e `src/domain/export/backup.ts` (round-trip e `validateIntegrity` para `linked_dividend_id`, `user_dividend_events` e `portfolio_dividend_dismissals`, preservando compatibilidade com backups legados).
- **Verificações executadas após a última edição de código:**
  - `npm run typecheck`: aprovado (`tsc -b`, 0 erros).
  - `npm run lint`: aprovado (`eslint .`, 0 erros; 9 warnings pré-existentes em `scripts/sample-reports-entry.tsx`).
  - `npm run build`: aprovado (`tsc -b && vite build` + PWA v1.3.0 em `3.27s`, 0 erros).
  - Suítes Vitest: `src/domain/` (`276 passed (276)` arquivos na execução anterior sem alterações posteriores em `src/domain/`), `src/data/repositories/export.test.ts` (aprovado), e reexecução após a última edição em `src/tests/quotes-core.test.ts` (`43 passed (43)`), `src/tests/security-audit.test.ts` (`74 passed (74)`) e `src/state/mutations/use-portfolio-mutations.test.tsx` (`24 passed (24)`).
- **Pendências de ambiente:** `psql` e `deno` não estão disponíveis no `PATH` desta sandbox; testes vivos pgTAP em PostgreSQL e smoke runtime em Deno permanecem pendentes de ambiente com essas ferramentas.

### Implantação e Verificação em Produção (26/11/2026)

- **Banco de Dados (Supabase):** Migrations `0159`, `0160`, `0161` e `0162` aplicadas com sucesso via `supabase db push` no projeto vinculado (`lnsfcajcfofgvpvabwbi`). Ajustes aplicados durante o push real: remoção de coluna inexistente `updated_at` no backfill de `user_preferences` (`0159`) e de `d.created_at` no backfill de `portfolio_dividend_dismissals` (`0162`).
- **Edge Function:** `quotes` compilada e implantada via `npx supabase functions deploy quotes --no-verify-jwt --use-api`.
- **E2E (`e2e/smoke.spec.ts`):** `8 passed (16.4s)` (Desktop + Mobile).

### Registro de execução — Fatia S4 (26/11/2026)

- **Status da Fatia S4:** `CONCLUÍDO` (**S1–S4** concluídas; fatias **S5–S6** permanecem pendentes, sendo **S5** a próxima etapa).
- **Escopo entregue em S4:**
  - Domínio e KPIs ([`src/domain/portfolio/provisioned-dividends.ts`](file:///home/gabrielsales/meus_apps/financasnew/src/domain/portfolio/provisioned-dividends.ts)): adicionados `filterMonthlyForecastDividends` e `computeMonthlyForecastSummary` (`paymentDate >= today` na competência M, nunca incluindo vencidos na previsão futura), exclusão de antigos `>120d` sem data das projeções monetárias mantendo contagem operacional em `pendingCount` / `over120DaysWithoutPaymentCount`, contagem separada de `datelessProvisionedCount` e conversão USD → BRL linha a linha em centavos inteiros.
  - Estado e modal ([`src/services/dividend-review-modal.ts`](file:///home/gabrielsales/meus_apps/financasnew/src/services/dividend-review-modal.ts), [`src/state/queries/use-corporate-dividends.ts`](file:///home/gabrielsales/meus_apps/financasnew/src/state/queries/use-corporate-dividends.ts), [`src/features/investments/components/proventos/use-proventos-tab-controller.ts`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/proventos/use-proventos-tab-controller.ts)): exposto `monthlyForecast` no seletor único, alinhados os totais BRL/USD por linha e aplicada a regra de previsão mensal no controller da `ProventosTab`.
  - Experiência de conferência e alertas ([`src/features/investments/components/pending-dividends-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/pending-dividends-dialog.tsx), [`build-dividend-insight-items.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/insights-carousel/build-dividend-insight-items.tsx), [`portfolio-insights-carousel.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/portfolio-insights-carousel.tsx), [`corporate-dividends-banner.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/corporate-dividends-banner.tsx)): 3 abas (`A Conferir`, `Provisionados` com contagem separada sem data, `Provisionar Manual`), busca por ticker + filtros de moeda/origem/sem data/antigas `>120d`, seleção visível e dispensa em lote via `useDismissUserDividendEventsBatch` com Undo, badges reais de procedência (`Oficial`, `Verificado pela Comunidade`, `Estimado — conferir`, `Manual`), trava explícita de data válida em `Confirmar agora` / `Confirmar recebimento`, reload preservando rascunho em conflito e troca de `"Proventos Creditados na Corretora"` para `"Proventos a Conferir"`.
- **Verificações executadas após a última edição:**
  - `npm run typecheck`: aprovado (`tsc -b`, 0 erros).
  - `npm run lint`: aprovado (`eslint .`, 0 erros; 9 warnings pré-existentes em `scripts/sample-reports-entry.tsx`).
  - `npm run build`: aprovado (`tsc -b && vite build` + PWA v1.3.0, 0 erros).
  - Vitest: [`pending-dividends-dialog.test.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/pending-dividends-dialog.test.tsx) (`4 passed`), [`portfolio-insights-carousel.test.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/portfolio-insights-carousel.test.tsx) (`14 passed`), e na execução imediatamente anterior sem alterações nesses alvos: `src/domain/` (`276` arquivos, incluindo `provisioned-dividends.test.ts` e `notifications/hub/index.test.ts`), `corporate-dividends-banner.test.tsx` e `proventos-tab.test.tsx`.

### Registro de execução — Fatia S5 (26/11/2026)

- **Status da Fatia S5:** `CONCLUÍDO` (**S1–S5** concluídas; **S6 · Corte definitivo** é a única fatia restante).
- **Escopo entregue em S5:**
  - Migration `supabase/migrations/20260101000161_dividend_consensus.sql`: tabela privada `corporate_dividend_votes` (`FORCE RLS`, `REVOKE ALL` de `PUBLIC`/`anon`/`authenticated`, policy explícita negando acesso cliente), `dividend_consensus_settings` (iniciando com `publication_enabled = false` por mercado `BR`/`US`), auditoria agregada sem PII `corporate_dividend_consensus_audit`, atualização da policy `corporate_dividends_select` exigindo `published AND is_current_user_active() AND can_current_user_read_module('investments')`, e funções `service_role` com guarda `auth.uid() IS NOT NULL` (`compute_dividend_voter_hash_internal`, `recount_dividend_consensus_event_internal`, `record_dividend_consensus_signal_system`, `purge_user_dividend_votes_system` e kill switch `toggle_dividend_consensus_publication_system`).
  - Domínio e Edge Function: motor puro [`src/domain/portfolio/dividend-consensus.ts`](file:///home/gabrielsales/meus_apps/financasnew/src/domain/portfolio/dividend-consensus.ts) (`pontuar`, `isIndependentEvidenceEligible`, `isVariantCompatibleWithAnchor`, `evaluateConsensusVariants`), espelho `scoreConsensusSignalsEdge` em [`supabase/functions/_shared/quotes-core.ts`](file:///home/gabrielsales/meus_apps/financasnew/supabase/functions/_shared/quotes-core.ts) e coleta privada não-bloqueante em `write_user_dividend` ([`supabase/functions/quotes/index.ts`](file:///home/gabrielsales/meus_apps/financasnew/supabase/functions/quotes/index.ts)).
  - Cliente LGPD: campo opcional `allow_consensus_contribution` em [`src/types/schema.ts`](file:///home/gabrielsales/meus_apps/financasnew/src/types/schema.ts) e opt-out explícito de conferência privada em [`src/features/investments/components/pending-dividends-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/pending-dividends-dialog.tsx).
- **Verificações executadas após a última edição:**
  - `npm run typecheck`: aprovado (`tsc -b`, 0 erros).
  - `npm run lint`: aprovado (`eslint .`, 0 erros; 9 warnings pré-existentes em `scripts/sample-reports-entry.tsx`).
  - `npm run build`: aprovado (`tsc -b && vite build` + PWA v1.3.0, 0 erros).
  - Vitest: [`dividend-consensus.test.ts`](file:///home/gabrielsales/meus_apps/financasnew/src/domain/portfolio/dividend-consensus.test.ts) (`4 passed`), [`quotes-core.test.ts`](file:///home/gabrielsales/meus_apps/financasnew/src/tests/quotes-core.test.ts) (`44 passed`), [`security-audit.test.ts`](file:///home/gabrielsales/meus_apps/financasnew/src/tests/security-audit.test.ts) (`76 passed`) e [`pending-dividends-dialog.test.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/pending-dividends-dialog.test.tsx) (`4 passed`).
- **Pendências de ambiente:** `psql` e `deno` não estão disponíveis no `PATH` desta sandbox; testes vivos pgTAP em PostgreSQL e smoke runtime em Deno permanecem pendentes de ambiente com essas ferramentas.

### Registro de execução — Fatia S6 (26/11/2026)

- **Status da Fatia S6:** `CONCLUÍDO` (**todas as fatias S1–S6** do plano estão concluídas e aprovadas; nenhuma fatia pendente).
- **Escopo entregue em S6:**
  - Migration `supabase/migrations/20260101000162_dividend_legacy_cutover.sql`: trigger `trg_guard_dividend_immutable_metadata` (`BEFORE INSERT OR UPDATE ON public.portfolio_dividends`) bloqueando alteração direta de `entry_origin`, `request_id` e `source_event_id` por DML cliente; `backfill_legacy_dividend_dismissals_system(integer)` (`service_role`, paginado/idempotente, preservando `SETTLED` e mantendo sem lote comprovável em supressão legada); `compare_dividend_dismissal_parity_system(uuid)` (`service_role`, auditoria de paridade por titular); preservação integral dos horários em [`supabase/quotes-cron.sql`](file:///home/gabrielsales/meus_apps/financasnew/supabase/quotes-cron.sql).
  - Corte de fallback e rotas legadas: [`src/state/queries/use-corporate-dividends.ts`](file:///home/gabrielsales/meus_apps/financasnew/src/state/queries/use-corporate-dividends.ts) desliga o fallback cliente (`clientFallback`) para usuários autenticados com `user_dividend_events` materializados (mantendo apenas modo demo e carteiras virgens sem materialização); [`src/state/mutations/portfolio/use-portfolio-dividend-mutations.ts`](file:///home/gabrielsales/meus_apps/financasnew/src/state/mutations/portfolio/use-portfolio-dividend-mutations.ts) migra `useDismissCorporateDividend` para `dismissUserDividendEventRpc`.
- **Verificações executadas após a última edição de código:**
  - `npm run verify`: aprovado (`tsc -b` com 0 erros; `eslint .` com 0 erros e 9 warnings pré-existentes em `scripts/sample-reports-entry.tsx`; `vitest run src/domain/` com `277 passed (277)` arquivos).
  - `npm run build`: aprovado (`tsc -b && vite build` + PWA v1.3.0 em `2.82s`, 0 erros).
  - Vitest direcionado S6: [`use-corporate-dividends.test.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/state/queries/use-corporate-dividends.test.tsx) (`4 passed`), [`security-audit.test.ts`](file:///home/gabrielsales/meus_apps/financasnew/src/tests/security-audit.test.ts) (`78 passed`) e [`use-portfolio-mutations.test.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/state/mutations/use-portfolio-mutations.test.tsx) (`24 passed`).
- **Pendências de ambiente:** `psql` e `deno` não estão disponíveis no `PATH` desta sandbox; testes vivos pgTAP em PostgreSQL e smoke runtime em Deno permanecem pendentes de ambiente com essas ferramentas.

---

## Histórico preservado · Entrega de 23/11/2026

# Plano Mestre de Arquitetura e Execução — Motor Global de Cotações (SWR + EOD/EOM), Stale Quote Guard, Custódia BRL/USD e Proventos Automatizados

> **Documento Vivo de Governança e Execução (`Fluxo Completo — Feature / Plano`, `AGENTS.md` §10.5)**
> - **Status Atual:** `CONCLUÍDO (BLOCOS A, B E C APROVADOS)`
> - **Última Atualização:** 2026-11-23
> - **Ordem de Execução:** `Bloco A` → `[Portão A]` → `Bloco B` → `[Portão B]` → `Bloco C` → `[Portão C]`

---

## 0. TRAVA INVIOLÁVEL DE NÃO-REGRESSÃO

Em **nenhuma** etapa dos Blocos A, B ou C é permitido alterar:
1. Regras contábeis de **Reserva de Caixa** (`CAIXA`);
2. Regras de **liquidação/baixa de ordens** (compra/venda/aporte);
3. Cálculo de **preço médio** (BRL e USD);
4. Motores de cálculo de **Renda Fixa (CDBs/LCIs/LCAs)** (`src/domain/portfolio/fixed-income.ts`) e **Tesouro Direto**.

Regras de governança obrigatórias (`AGENTS.md`):
- TypeScript estrito (zero `any`, zero `@ts-ignore`);
- Funções puras de cálculo em `src/domain/` com testes unitários colocalizados (`*.test.ts`) e moeda em **centavos inteiros** nos motores;
- UI 100% DRY com primitivos de `components/ui` e `components/modules`, **zero controles nativos**, **zero `autoFocus`**, **zero emojis/Unicode decorativo** (`local/no-decorative-unicode`);
- Datas em fuso local `America/Sao_Paulo` (proibido `toISOString().slice(0, 10)` para intervalos/datas civis);
- Percentuais via `formatPercent` (pt-BR, vírgula) e monetários via `<MoneyText />` (zero `truncate` em dinheiro);
- Integração obrigatória de eventos de proventos ao **Notification Hub** (`AGENTS.md` §4.35).

---

## 1. META-ANÁLISE CRÍTICA CONTRA O CÓDIGO REAL (FASE 0.1)

A auditoria contra o repositório real (migrations `0001`–`0131`, `supabase/.temp/postgres-version`, Edge Functions, `src/domain/`, `src/data/`, `src/state/`, `src/features/` e suítes `security-audit.test.ts` / `quotes-core.test.ts`) confirmou **100% de viabilidade** na stack atual (PostgreSQL **17.6.1.155**, Supabase Edge Functions Deno, React 18+, TanStack Query, Vitest) e identificou **10 riscos ocultos e lacunas** resolvidos preventivamente abaixo:

| # | Risco / Lacuna Detectada no Código Real | Evidência no Repositório | Refinamento Incorporado no Plano |
|---|---|---|---|
| **1** | **Quebra dupla no `restore_backup` ao endurecer `asset_prices`:** (a) o `ON CONFLICT (ticker, user_id)` falharia com erro `42P10` após trocar a constraint única por índices parciais; (b) backups legados contêm `user_id = v_uid` com `source = 'api'`, violando o novo `CHECK`. | `20260101000127` L995–1012 + `src/data/repositories/export.ts` L19–20 | Atualizar `restore_backup` no Bloco A para filtrar `ap.user_id = v_uid AND (ap.source = 'manual' OR ap.manual_price IS NOT NULL)`, normalizar `source = 'manual'` e usar `ON CONFLICT (ticker, user_id) WHERE user_id IS NOT NULL DO UPDATE`. |
| **2** | **Bug oculto em `restore_backup` com `trg_portfolio_snapshot_immutability`:** a migration `0130` passou a bloquear `INSERT` de snapshots `< mês corrente` sem `app.snapshot_rpc = 'on'`, mas `restore_backup` (`0127`) não ativa essa GUC. | `20260101000130` L42–51 vs. `20260101000127` L929–951 | Adicionar `perform set_config('app.snapshot_rpc', 'on', true);` em `restore_backup` (Bloco A), garantindo restauração íntegra de snapshots históricos. |
| **3** | **Compatibilidade com RPC de Patrimônio Familiar:** a RPC familiar consulta `asset_prices` com prioridade de usuário sobre global. | `20260101000084` L212–216 | Validado 100% compatível (`order by (ap.user_id is not null) desc limit 1` + `coalesce(ap.manual_price, ap.price)`): override manual vence o cache global único sem alteração na RPC familiar. |
| **4** | **Paridade SSOT no `close_month_global` sem duplicar fórmulas de Renda Fixa/Tesouro:** `fixed-income.ts` usa `@/` (Vite) e é protegido pela Trava de Não-Regressão; reescrever fórmulas aproximadas no Deno causaria divergência. | `src/domain/portfolio/fixed-income.ts`, `supabase/functions/` (0 leituras server-side de `portfolio_snapshots`) | Arquitetura EOM em 2 camadas: **(1) Nuvem (`close_month_global`)** congela eternamente 100% das cotações EOM + `USDBRL=X` PTAX oficial em `market_price_history` (`is_month_end = true`) e hidrata `portfolio_monthly_prices` de todos os usuários (preservando `manual`); fecha `portfolio_snapshots` diretamente na nuvem via `commit_monthly_closing_system` para carteiras sem RF paramétrica; **(2) Carteiras com RF paramétrica/Tesouro** fecham automaticamente no próximo acesso via `commit_monthly_closing_atomic` usando **exatamente** `canonical-engine.ts` + `fixed-income.ts` na data de corte EOM + os preços já congelados em `market_price_history` (0% divergência, 0% dependência de preço do dia atual). |
| **5** | **Vazamento entre meses e ausência de `USDBRL=X` em `usePortfolioMonthlyPosition`:** `apiQuotesMap` é indexado só por `ticker` (vaza preços ao trocar de mês) e `missingTickers` nunca inclui `USDBRL=X`. | `src/state/queries/use-portfolio-monthly-position.ts` L64, L76–83, L113 | Substituir leitura histórica por `useMarketPriceHistory(month)` (incluindo `USDBRL=X` EOM) e indexar qualquer enrichment sob demanda por `${month}:${ticker}`. |
| **6** | **`ReportDocumentLayout.onBeforePrint` síncrono e gesto de usuário para `window.print()`:** abrir modal de confirmação assíncrono em `onBeforePrint` quebraria o fluxo síncrono e bloquearia `window.print()` no Safari/iOS WebKit. | `src/components/modules/reports/report-document-layout.tsx` L20, L51–56 | Adicionar suporte nativo a `printWarning` no `ReportDocumentLayout`: ao clicar em "Imprimir / Salvar PDF" com alertas ativos, abre `<ConfirmDialog />` (sem `autoFocus`) e o botão "Emitir PDF mesmo assim" chama `triggerPrint(suggestedTitle)` diretamente no `onClick` (gesto de usuário preservado). |
| **7** | **Schema real de `corporate_dividends` e promoção `payment_date NULL → DATE`:** (a) `payment_date` hoje é `NOT NULL`; (b) `type` usa enum maiúsculo (`DIVIDENDO`, `JCP`, etc.); (c) `INSERT ... ON CONFLICT` com `UNIQUE NULLS NOT DISTINCT` criaria linha duplicada ao anunciar `payment_date` depois; (d) `portfolio_dividend_dismissals` já existe com dispensas prévias. | `20260101000087` L15–54 + PG `17.6.1.155` | (a) `ALTER COLUMN payment_date DROP NOT NULL` + `UNIQUE NULLS NOT DISTINCT (ticker, com_date, type, payment_date)`; (b) preservar enum maiúsculo + adicionar `is_type_uncertain boolean NOT NULL DEFAULT false`; (c) criar RPC `upsert_corporate_dividend_system` que promove in-place `(ticker, com_date, type)` com `payment_date IS NULL` (e taxa compatível `±0,005`, suportando múltiplas parcelas na mesma `data-com` como PETR4); (d) migrar dispensas de `portfolio_dividend_dismissals` para `user_dividend_events (status = 'DISMISSED')`. |
| **8** | **Feriados e fusos distintos (B3 vs. NYSE/NASDAQ + DST EUA):** `business-days.ts` cobre apenas feriados BR; feriado só nos EUA ou horário de verão americano (EDT UTC-4 vs. EST UTC-5) distorceria o EOD Guard se avaliado em bloco único. | `src/domain/portfolio/business-days.ts`, `market-calendar.ts` | Criar calendário puro multi-mercado (`BR` = B3/ANBIMA em `America/Sao_Paulo`, `US` = NYSE/NASDAQ em `America/New_York` via `Intl.DateTimeFormat` para DST exato + feriados federais/NYSE, `CRYPTO` = 24/7, `FX` = dias úteis BR/BCB PTAX), avaliado **por ticker**. |
| **9** | **`VITE_BRAPI_TOKEN` no cliente e preservação de `fetchPtaxForDate`:** `security-audit.test.ts` L493 libera `VITE_BRAPI_TOKEN` hoje; `use-quick-transaction-form.ts` depende de `fetchPtaxForDate` para ordens USD históricas. | `src/services/quotes.ts` L88–145, `src/tests/security-audit.test.ts` L493 | Remover `fetchBrapi`, `fetchAwesomeApi`, `setAssetPriceFromApi`, `setAssetPricesBatchFromApi` e `VITE_BRAPI_TOKEN` do cliente (e da allowlist de `security-audit.test.ts`). Manter `fetchPtaxForDate` (consultando `market_price_history` → BCB SGS Série 1) apenas para preenchimento assistido de data histórica no formulário de ordem. |
| **10** | **Modo Offline / PWA e resiliência de rede:** SWR não deve disparar erros nem loops quando o usuário estiver sem internet (`!navigator.onLine`) ou com aba em background. | `AGENTS.md` + `docs/platforms/PWA_GUIDELINES.md` | SWR só dispara quando `navigator.onLine === true`, `document.visibilityState === 'visible'` e houver ao menos 1 ticker elegível; offline renderiza silenciosamente do cache local/TanStack Query sem toast de erro. |

---

## 2. ARQUITETURA FINAL DETALHADA

### 2.1 Visão de Camadas (Estado Alvo)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ CAMADA 1 — BANCO DE DADOS & RLS (PostgreSQL 17 / Supabase)                │
│ • public.asset_prices (user_id NULL = cache global único API;             │
│   user_id NOT NULL = override manual exclusivo; índices parciais + CHECK) │
│ • public.market_price_history (PK ticker + reference_date; 90d EOD + EOM) │
│ • public.market_fetch_locks (Single-Flight lock por ticker, TTL 45s)      │
│ • public.quote_refresh_rate_limits (Rate limit por usuário/janela)        │
│ • public.corporate_dividends (global, payment_date nullable,              │
│   UNIQUE NULLS NOT DISTINCT, provider, tax_rate_pct, is_type_uncertain)   │
│ • public.user_dividend_events (por usuário, ciclo de vida completo)       │
│ • public.portfolio_dividends (+ source_event_id único idempotente)        │
│ • RPCs System (service_role): upsert_global_asset_prices,                 │
│   try_acquire_quote_locks, check_quote_refresh_rate_limit,                │
│   commit_monthly_closing_system, upsert_corporate_dividend_system,        │
│   settle_user_dividend_event_system                                       │
│ • RPCs User (authenticated): confirm_user_dividend_events_atomic,         │
│   restore_backup (atualizado e blindado)                                  │
├────────────────────────────────────────────────────────────────────────────┤
│ CAMADA 2 — EDGE FUNCTIONS & CRONS (Deno / pg_cron — Custo Zero)           │
│ • supabase/functions/_shared/quotes-core.ts (normalização, parsers c/     │
│   timestamps reais, calendário BR/US/FX, PTAX parser, spike guardrail     │
│   split-aware, fiscal proventos B3/US — 100% testado no Vitest)           │
│ • supabase/functions/quotes/index.ts:                                     │
│   - default (SWR / on-demand autenticado + EOD Guard + cooldown 15m/5m    │
│     + Single-Flight + rate limit + validação anti-envenenamento)          │
│   - action: 'eod_close' (cron 22:00 UTC seg–sex)                          │
│   - action: 'close_month_global' (cron 22:30 UTC seg–sex c/ auto-healing) │
│   - action: 'sync_corporate_dividends' (cron 10:00 UTC diário)            │
│   - action: 'process_user_dividends' (cron 11:30 UTC diário)              │
│ • supabase/quotes-cron.sql (somente 4 agendamentos enxutos, 0 intradiário)│
├────────────────────────────────────────────────────────────────────────────┤
│ CAMADA 3 — DOMÍNIO PURO / SSOT (`src/domain/portfolio/`)                  │
│ • market-calendar.ts (calendário BR/B3 + US/NYSE + DST + janela pregão)   │
│ • quotes.ts (normalização, classificação de mercado, helpers puros)       │
│ • canonical-engine.ts + canonical-types.ts (preserva source, manual_price,│
│   market_price_at, fetched_at, provider + fxMetadata SSOT único)          │
│ • stale-quote-guard.ts (post_trade_stale, missing_or_fallback,            │
│   stale_market_data por mercado, fxWarning)                               │
│ • custody-reconciliation.ts (Custódia Brasil BRL vs. Exterior USD em      │
│   centavos inteiros; invariante soma === Patrimônio no Fechamento)        │
│ • provisioned-dividends.ts (isolamento contábil estrito: A Receber +      │
│   Total Projetado nunca somam ao Patrimônio nem ao Caixa)                 │
│ • dividend-suggester.ts (reconstrução data-com c/ baseline+ordens+splits, │
│   fuso America/Sao_Paulo, fiscal B3/EUA, anti-flood, dedup fuzzy)         │
├────────────────────────────────────────────────────────────────────────────┤
│ CAMADA 4 — ESTADO, UI PASSIVA, PDFs & NOTIFICATION HUB                    │
│ • useMarketQuotesSwr (SWR sob demanda em Home/Investimentos + 15 min se   │
│   visible & mercado aberto + sync cirúrgico cache miss & D+0)             │
│ • useExecutiveReportRefresh (pré-relatório com EOD Guard + cooldown 5m)   │
│ • CustodySectionCard (indicador editorial passivo; SEM botão manual;      │
│   "Tentar novamente" apenas quando houver ativo degradado/erro)           │
│ • ReportHeader + ReportEquityClassTable + CustodyReconciliationCard (DRY) │
│   + ReportDocumentLayout (alerta + ConfirmDialog no printWarning)         │
│ • DividendEventsModal único + DividendsCalendarPanel evoluído +           │
│   Notification Hub (PROVISIONED / PENDING_CONFIRMATION / SETTLED) +       │
│   Configurações > Notificações & Automações (preferência de proventos)    │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Estratégia de Cotações (Sem Botão Manual) & Anti-Spam

| Cenário | Comportamento | Chamadas Externas |
|---|---|---|
| **Mercado fechado + EOD já capturado** (noite, fim de semana, feriado local do ativo) | Edge Function identifica `fetched_at >= lastMarketClose` e devolve cache global imediatamente | **0** |
| **Pregão aberto — entrada na Home ou Investimentos** | Renderiza instantaneamente do Postgres (`asset_prices`). Cliente identifica apenas tickers da carteira com `now - fetched_at >= 15 min` cujo mercado está aberto e envia só esse subconjunto | Apenas tickers vencidos (1x a cada 15 min compartilhado entre **todos** os usuários) |
| **Usuário ativo na aba Investimentos** | Timer silencioso a cada 15 min **apenas** se `visibilityState === 'visible'`, `navigator.onLine === true` e houver mercado aberto | Somente tickers vencidos |
| **Cadastro de ativo inédito (`cache miss`)** | Sync cirúrgico imediato apenas daquele ticker (inclusive fim de semana/feriado, 1 única vez) para capturar último fechamento oficial e popular cache global | 1 (bypass de EOD Guard exclusivo para `cache miss`) |
| **Ordem D+0 registrada** | Invalida `asset_prices` e dispara sync cirúrgico apenas do ticker negociado + `USDBRL=X` (bypass de cooldown se `post_trade_stale` e mercado aberto) | 1–2 |
| **Abertura do Relatório Executivo / Tear Sheet (mês atual)** | `useExecutiveReportRefresh` aplica EOD Guard + cooldown de **5 min** (`mode: 'report_preflight'`) e envia só tickers vencidos | 0 (mercado fechado ou <5m) ou apenas vencidos |
| **Proteção contra abuso / concorrência** | Validação contra tickers existentes em `portfolio_assets` (ou `USDBRL=X`), `check_quote_refresh_rate_limit` (10 req/min e 60/h por usuário), `try_acquire_quote_locks` (Single-Flight 45s por ticker) e pool máx. 6 req simultâneas com backoff+jitter em 429/5xx | Protegido contra stampede e cache poisoning |

### 2.3 Orçamento Técnico Custo Zero (Supabase Free + Brapi + Yahoo + BCB)

| Métrica / Recurso | Limite Gratuito | 10 usuários (~40 tickers únicos) | 100 usuários (~150 tickers únicos) | 1.000 usuários (~400 tickers únicos) |
|---|---|---|---|---|
| **Crons/dia** | Ilimitado (`pg_cron`) | 4 execuções/dia | 4 execuções/dia | 4 execuções/dia |
| **Invocações Edge Function/mês** | 500.000/mês | ~600 (~0,1%) | ~3.500 (~0,7%) | ~22.000 (~4,4%) |
| **Chamadas externas/mês (deduplicado global)** | Brapi/Yahoo free + BCB ilimitado | ~4.500 | ~15.000 | ~38.000 (compartilhamento reduz >95%) |
| **Armazenamento Postgres (cotações + histórico 90d EOD + EOM eterno)** | 500 MB | < 1 MB | < 3 MB | < 12 MB |

### 2.4 Regras Críticas Detalhadas

#### A. Câmbio Oficial `USDBRL=X` (PTAX)
1. Primário: **BCB Olinda PTAX** (`CotacaoDolarDia` / `CotacaoDolarPeriodo` — campo `cotacaoVenda`, paridade exata com SGS Série 1) com **lookback de até 7 dias corridos** (cobrindo fins de semana e feriados prolongados como Carnaval).
2. Fallback 1: Yahoo Finance (`USDBRL=X`).
3. Fallback 2: AwesomeAPI (`USD-BRL`).
4. `USDBRL=X` entra obrigatoriamente no cron `eod_close`, `close_month_global` e no `fxMetadata` único (`rate`, `source`, `provider`, `fxRateAt`, `isFallback`).
5. Rótulo no PDF exibe a fonte real (`PTAX Oficial BCB`, `Yahoo Finance`, `AwesomeAPI`, `Manual` ou `Taxa Estimada (Fallback)` — nunca afirma "PTAX Oficial" para fallback/Yahoo).

#### B. `applySpikeGuardrail` Split-Aware
Ao detectar variação > 50% entre novo preço e preço anterior:
1. **Eventos de Split/Inplit (Yahoo `events.splits`):** se houve evento de desdobramento/grupamento nos últimos 5 dias úteis e o novo preço bate com `prevPrice / splitRatio` (±20%), **aceita imediatamente** e atualiza `market_price_at` e `provider`.
2. **Consenso por `chartPreviousClose` / provedor secundário:** se o preço coincide com `chartPreviousClose` (±15%) ou é confirmado por provedor secundário (Brapi/Yahoo cruzado, ±5%), **aceita imediatamente**.
3. **Cache velho (> 5 dias úteis):** se `prev.market_price_at` tem mais de 5 dias úteis, aceita novo preço (não congela ativo que ficou meses sem atualizar).
4. **Auto-destravamento via confirmação dupla (`pending_spike_price` / `pending_spike_at`):** na 1ª ocorrência suspeita sem split/consenso, preserva preço, `market_price_at` e `provider` antigos e grava `pending_spike_price` + `pending_spike_at = now()`. Se nova leitura ≥ 10 min depois confirmar o mesmo patamar (±5%), destrava e aceita automaticamente.

#### C. Pipeline de Proventos na Nuvem (B3 vs. EUA, Anti-Flood e Isolamento Contábil)
1. **Coleta Global (`10:00 UTC` / `07:00 BRT`, diário):** lista tickers distintos de renda variável com custódia > 0 (excluindo Caixa e Renda Fixa):
   - **B3 (primário):** Brapi (`BRAPI_TOKEN`, `modules=cashDividends`) — distingue explicitamente `DIVIDENDO` (0% IR) vs. `JCP` (15% IRRF) vs. `RENDIMENTO` (FIIs 0% IR) e retorna `lastDatePrior` (`com_date`) e `paymentDate` (opcional/nullable).
   - **B3 (fallback Yahoo `events=div`):** quando Brapi falhar ou não retornar o ativo, coleta via Yahoo marcando `is_type_uncertain = true` → **força `PENDING_CONFIRMATION`** (jamais assume alíquota silenciosamente).
   - **EUA:** Yahoo `events=div` com `currency = 'USD'`, `tax_rate_pct = 30` (withholding tax), `net_rate = rate * 0.70`, `com_date` = dia útil anterior NYSE à `ex-date`.
   - Persistência via RPC `upsert_corporate_dividend_system`: antes de promover uma linha `payment_date IS NULL` para a data confirmada, verificar explicitamente se já existe registro com aquela `payment_date` exata (evitando colisão de chave única em parcelas múltiplas); promover in-place apenas quando não houver conflito, preservando os `user_dividend_events` já vinculados.
2. **Materialização & Efetivação (`11:30 UTC` / `08:30 BRT`, diário):**
   - Para cada usuário elegível, reconstrói `quantity_on_com_date` via custódia completa (`baseline + compras/vendas + splits/inplits` até o fechamento da `com_date` em `America/Sao_Paulo`). Se `qty <= 0`, ignora.
   - Se `payment_date IS NULL` ou `payment_date > hoje (BRT)` → cria/atualiza `user_dividend_events` com `status = 'PROVISIONED'`.
   - Quando `payment_date <= hoje (BRT)`:
     - **Anti-Flood na Ativação:** calcula `cutoffDate = max(dividendAutomation.activatedAt, hoje - 7 dias)`. Eventos com `payment_date < cutoffDate` **NUNCA** são liquidados automaticamente (ficam como `PENDING_CONFIRMATION` ou ignorados se anteriores à custódia, impedindo despejo retroativo).
     - **Deduplicação Fuzzy:** verifica `portfolio_dividends` manuais existentes para o ativo em `±3 dias úteis` e `±R\$ 0,05` (ou `±US\$ 0,05`). Se houver match, vincula `settled_dividend_id` e marca `SETTLED` sem duplicar.
     - **Efetivação:** se `is_type_uncertain = true` OU `settlementMode = 'manual_confirm'`, marca `PENDING_CONFIRMATION`. Se `settlementMode = 'auto'` (padrão) e dentro da janela segura, chama `settle_user_dividend_event_system`: insere em `portfolio_dividends` (com `source_event_id` único), atualiza `accumulated_dividends`, e se `autoCreditCash = true`, credita `CAIXA` convertendo USD→BRL pela taxa oficial `USDBRL=X` vigente (PTAX/EOD) e registrando `fx_rate_applied`.
3. **Isolamento Contábil Estrito (`provisioned-dividends.ts`):**
   - Eventos `PROVISIONED` e `PENDING_CONFIRMATION` **nunca** entram em `totalBRL`, `cashBRL`, TWR, rentabilidade ou Patrimônio no Fechamento.
   - São exibidos exclusivamente como linhas auxiliares destacadas (*Proventos Provisionados — A Receber* e *Total Projetado c/ Provisionados*) no `CustodyReconciliationCard` (UI e PDF).

---

#### D. Guardas de Integridade SQL e Feriado Cruzado EOM
1. **Never-Degrade SQL em `upsert_global_asset_prices`:** na cláusula `ON CONFLICT (ticker) WHERE user_id IS NULL DO UPDATE`, uma cotação global `source = 'api'` válida (`price > 0`) **nunca** pode ser sobrescrita por `price <= 0`, `source = 'fallback'` ou `market_price_at` mais antigo que o existente (preservando dados de preço/timestamp/provedor e permitindo atualizar apenas metadados de revalidação como `fetched_at` e `pending_spike_*`).
2. **Feriado Cruzado no `is_month_end` (`eod_close`):** no último dia útil do mês no calendário BR, caso algum mercado estrangeiro esteja em feriado naquela data (ex.: EUA) ou falhe na coleta, `eod_close` persiste em `market_price_history` com `is_month_end = true` o último preço oficial válido de `asset_prices` daquele ticker, evitando lacunas no fechamento mensal.

---

## 3. PLANO DE EXECUÇÃO GRANULAR E CHECKLIST VIVO

### BLOCO A — Motor Global de Cotações, Câmbio Oficial PTAX, Anti-Spam e Fechamento EOD/EOM na Nuvem

#### A.1 Banco de Dados, RLS e RPCs (`supabase/migrations/`)
- [x] **Criar** `supabase/migrations/20260101000142_global_market_quotes_engine.sql`:
  - [x] Limpar linhas legadas `user_id IS NOT NULL AND source <> 'manual'` em `asset_prices` e deduplicar `user_id IS NULL` mantendo o registro mais recente (`updated_at desc, id desc`).
  - [x] Dropar constraint legada `asset_prices_ticker_user_id_key` (se existir) e criar índices únicos parciais: `uq_asset_prices_global_ticker (ticker) WHERE user_id IS NULL` e `uq_asset_prices_user_manual_ticker (user_id, ticker) WHERE user_id IS NOT NULL`.
  - [x] Adicionar colunas `market_price_at timestamptz`, `fetched_at timestamptz`, `provider text`, `pending_spike_price numeric(18,8)`, `pending_spike_at timestamptz` + índice `idx_asset_prices_ticker_updated (ticker, updated_at desc)` em `asset_prices`.
  - [x] Adicionar `CHECK ((user_id IS NULL AND source IN ('api', 'fallback')) OR (user_id IS NOT NULL AND source = 'manual'))` e endurecer políticas RLS em `asset_prices` (`authenticated` só escreve com `user_id = auth.uid() AND source = 'manual'`; global exclusivo `service_role`).
  - [x] Criar RPC `public.upsert_global_asset_prices(p_rows jsonb)` (`SECURITY DEFINER`, `service_role` apenas, `ON CONFLICT (ticker) WHERE user_id IS NULL DO UPDATE` com trava **Never-Degrade**: não sobrescreve `source = 'api'` válida por `price <= 0`, `source = 'fallback'` ou `market_price_at` mais antigo).
  - [x] Atualizar `public.restore_backup(p_backup jsonb)`: ativar `set_config('app.snapshot_rpc', 'on', true)`, filtrar `asset_prices` para manter apenas `user_id IS NOT NULL AND (source = 'manual' OR manual_price IS NOT NULL)` com deduplicação `DISTINCT ON`, `source = 'manual'` e `ON CONFLICT (user_id, ticker) WHERE user_id IS NOT NULL DO UPDATE`.
  - [x] Criar `public.market_price_history` (`PK (ticker, reference_date)`, `price`, `currency`, `provider`, `market_price_at`, `month`, `is_month_end`, RLS leitura para `authenticated` ativo, escrita apenas `service_role` + rotina de retenção 90d EOD / permanente EOM).
  - [x] Criar `public.market_fetch_locks` + RPC `public.try_acquire_quote_locks(p_tickers text[], p_ttl_seconds int default 45)` (`service_role`).
  - [x] Criar `public.quote_refresh_rate_limits` + RPC `public.check_quote_refresh_rate_limit(p_user_id uuid, p_max_per_min int default 10, p_max_per_hour int default 60)` (`service_role`).
  - [x] Criar RPC `public.commit_monthly_closing_system(...)` (`service_role`, `set_config('app.snapshot_rpc', 'on', true)`, preservando `is_manually_calibrated = true` e `source = 'manual'` em `portfolio_monthly_prices`).

#### A.2 Edge Function, Motor Puro Compartilhado e Cron (`supabase/`)
- [x] **Alterar** `supabase/functions/_shared/quotes-core.ts`:
  - [x] Normalização de tickers: fracionário B3 (`PETR4F` → `PETR4.SA` / `PETR4`), ações EUA com ponto (`BRK.B` → `BRK-B`), BDRs/ETFs B3 (`.SA`) e tickers EUA curtos sem `.SA`, preservando ticker original no retorno.
  - [x] Classificador de mercado por ticker (`BR`, `US`, `FX`, `CRYPTO`) + calendário de feriados BR (ANBIMA/B3) e US (NYSE/NASDAQ) + horário de pregão com DST via `America/Sao_Paulo` e `America/New_York` + `isMarketOpenForTicker` e `getLastMarketCloseUtc`.
  - [x] Parsers preservando timestamps reais (`market_price_at`, `provider`) e `events.splits` + `chartPreviousClose` (Yahoo), `parseBrapiResponse` (timestamp real), `parseBcbPtaxResponse` (`cotacaoVenda`, paridade SGS Série 1) e `parseAwesomeApiResponse` (`create_date`).
  - [x] Evoluir `applySpikeGuardrail` (`evaluateSpikeGuardrail`) para modo split-aware (splits 5d úteis, consenso `chartPreviousClose`/provedor secundário, cache > 5d úteis, `pending_spike_price`/`pending_spike_at`, preservando `market_price_at` e `provider` quando bloqueado).
- [x] **Alterar** `supabase/functions/quotes/index.ts`:
  - [x] Ler `BRAPI_TOKEN` via `Deno.env.get("BRAPI_TOKEN")`.
  - [x] Pool de concorrência (máx. 6 simultâneas) + retry com backoff exponencial + jitter em HTTP 429/5xx/timeout.
  - [x] Cadeia `USDBRL=X`: BCB PTAX (lookback até 7 dias corridos) → Yahoo → AwesomeAPI.
  - [x] Validar tickers contra `portfolio_assets` (ou `USDBRL=X`) anti-envenenamento.
  - [x] Implementar EOD Guard por mercado (com trava anti-spoofing de `cache_miss`) + Cooldown (15 min padrão / 5 min `mode: 'report_preflight'`, bypass apenas `cache_miss` ou `post_trade_stale`) + `try_acquire_quote_locks` + `check_quote_refresh_rate_limit` + persistência via `upsert_global_asset_prices`.
  - [x] Implementar histórico mensal real (`month`: lê `market_price_history` c/ `is_month_end = true` primeiro; fallback Yahoo `period1`/`period2` reais + BCB PTAX último dia útil do mês e grava em `market_price_history`).
  - [x] Implementar `action: 'eod_close'` (todos tickers ativos + `USDBRL=X` → `asset_prices` + `market_price_history` + purge EOD > 90d; no último dia útil do mês BR, gravar `is_month_end = true` usando último preço oficial válido de `asset_prices` caso algum mercado estrangeiro esteja em feriado) e `action: 'close_month_global'` (congelamento EOM em `market_price_history` + hidratação `portfolio_monthly_prices` + fechamento `portfolio_snapshots` para carteiras elegíveis sem duplicar RF/Tesouro + auto-healing nos 3 primeiros dias úteis).
- [x] **Alterar** `supabase/quotes-cron.sql` (e `scripts/deploy-quotes.mjs` / `supabase/.env.example`):
  - [x] Remover crons intradiários (4x/dia); manter apenas `eod_close` (`22:00 UTC` seg–sex) e `close_month_global` (`22:30 UTC` seg–sex).

#### A.3 Camada Cliente (SWR Automático, Metadados, FX SSOT e Limpeza Client-Side)
- [x] **Alterar** `src/domain/portfolio/market-calendar.ts` (adicionar helpers multi-mercado BR/US/FX/CRYPTO para SWR no cliente).
- [x] **Alterar** `src/domain/portfolio/canonical-types.ts` e `src/domain/portfolio/canonical-engine.ts`:
  - [x] Preservar `source`, `manual_price`, `market_price_at`, `fetched_at` e `provider` em `evaluateInstantState` (fim do mascaramento de fallback/manual como `"Oficial API"`).
  - [x] Unificar `fxMetadata` (`rate`, `source`, `provider`, `fxRateAt`, `isFallback`) como SSOT em `CanonicalPortfolioState` (distinguindo PTAX real `5.25` de fallback estático `5.25`).
- [x] **Alterar** `src/data/repositories/asset-prices.ts` e `src/data/repositories/asset-prices.test.ts`:
  - [x] Remover `setAssetPriceFromApi` e `setAssetPricesBatchFromApi`.
  - [x] Selecionar `user_id`, `updated_at`, `fetched_at`, `market_price_at`, `provider` em `listAssetPrices` com ordenação determinística; corrigir `consolidateAssetPrices` (manual do dono > global mais recente).
  - [x] Adicionar `listMarketPriceHistoryByMonth(month)` em `src/data/repositories/asset-prices.ts`.
- [x] **Alterar** `src/services/quotes.ts` e `src/services/quotes.test.ts`:
  - [x] Remover `fetchBrapi`, `fetchAwesomeApi`, `VITE_BRAPI_TOKEN` e escrita em `asset_prices` pelo cliente.
  - [x] Manter `fetchPtaxForDate` (consultando `market_price_history` primeiro → BCB SGS Série 1) para o formulário de ordens históricas.
  - [x] Atualizar `syncMarketQuotesBatch` / `syncQuoteForTicker` / `syncQuotesForAssets` / `fetchOnlineQuote` para delegar 100% à Edge Function (`mode`, `reason`) e retornar metadados estruturados (incluindo cache hits / skipped / failed).
  - [x] Corrigir `fetchHistoricalMonthlyQuotes` para consultar `market_price_history` primeiro antes da Edge Function.
- [x] **Alterar** `src/tests/security-audit.test.ts`: remover `VITE_BRAPI_TOKEN` de `ALLOWED_CLIENT_ENV_VARS`, atualizar contagem de tabelas (`64` → `67`) e validar hardening multi-tenant da migration `000142`.
- [x] **Criar** `src/state/queries/use-market-quotes-swr.ts` (e exportar em `src/state/index.ts`):
  - [x] Motor SWR automático sob demanda: dispara na entrada de Home/Investimentos apenas para tickers vencidos (`>= 15 min` com mercado aberto) ou `cache miss` (1x mesmo fora do pregão), separa lotes `cache_miss` vs. `swr`, pausa offline / em background, revalida a cada 15 min enquanto ativo na aba de Investimentos com pregão aberto, e invalida `asset_prices` apenas se houver atualização real.
- [x] **Alterar** `src/state/queries/use-portfolio-position.ts`, `use-portfolio-monthly-position.ts`, `src/features/reports/hooks/use-investment-report-data.ts`:
  - [x] Consumir `fxMetadata` SSOT (preservando procedência do câmbio e metadados de cotação nas posições).
  - [x] Corrigir `usePortfolioMonthlyPosition` para usar `market_price_history` do mês (incluindo `USDBRL=X`), isolar estado por `${month}:${ticker}` e respeitar `isEstimate` / `fallbackQuotesCount` reais no mês atual.
- [x] **Alterar** `src/features/overview/pages/overview-page.tsx` e `src/features/investments/pages/investments-page.tsx`: conectar `useMarketQuotesSwr` (Home em modo entrada; Investimentos em modo entrada + intervalo ativo).
- [x] **Alterar / Criar testes Bloco A:** `src/tests/quotes-core.test.ts`, `src/data/repositories/asset-prices.test.ts`, `src/services/quotes.test.ts`, `src/domain/portfolio/canonical-engine.test.ts`, `src/domain/portfolio/market-calendar.test.ts` (e mocks de `@/state` em `overview-page.test.tsx`, `investments-page.test.tsx`, `accessibility-audit.test.tsx`).
- [x] **Portão de Segurança A:** rodar `npm run verify` + 8 suítes relacionadas + auditoria forense do diff + registrar resultado na Seção 4.

---

### BLOCO B — Stale Quote Guard, UI Passiva (Sem Botão Manual), Metadados no PDF e Conciliação por Custódia (BRL vs. USD)

#### B.1 Domínio Puro (Stale Quote Guard & Conciliação por Custódia)
- [x] **Criar** `src/domain/portfolio/stale-quote-guard.ts` + `src/domain/portfolio/stale-quote-guard.test.ts`:
  - [x] Detectar por ativo: `post_trade_stale` (ordem D+0 com data > `market_price_at` em `America/Sao_Paulo`), `missing_or_fallback`, `stale_market_data` (> 1 dia útil no calendário do respectivo mercado BR/US) e `fxWarning` quando houver custódia em USD.
- [x] **Criar** `src/domain/portfolio/custody-reconciliation.ts` + `src/domain/portfolio/custody-reconciliation.test.ts`:
  - [x] Cálculo em **centavos inteiros**: Custódia Brasil (BRL — incluindo `IVVB11`/ETFs B3, preservando-os na classe Internacional nos gráficos estratégicos) vs. Custódia Exterior (USD — subtotal exato em `US\$` + equivalente em `R\$` pelo mesmo `fxMetadata.rate` do cabeçalho).
  - [x] Garantir invariante `custodyBrazilCents + custodyForeignBRLCents === closingPatrimonyCents` (com ajuste de arredondamento explícito se necessário, nunca divergindo 1 centavo).
- [x] **Exportar** novos módulos em `src/domain/portfolio/index.ts`.

#### B.2 Proteção D+0 e Snapshot Provisional
- [x] **Alterar** `src/state/mutations/portfolio/use-portfolio-order-mutations.ts` e `use-portfolio-transaction-mutations.ts` (e `use-portfolio-asset-mutations.ts` / `portfolio-keys.ts`):
  - [x] Após ordem D+0 (`buy`/`sell`/`subscription`) ou cadastro de ativo novo (`cache miss`), invalidar `asset_prices` e disparar sync cirúrgico apenas do ticker + `USDBRL=X` (`reason: 'post_trade_stale' | 'cache_miss'`).
- [x] **Alterar** `src/hooks/use-auto-portfolio-snapshot.ts`:
  - [x] Bloquear gravação de snapshot provisional enquanto houver `post_trade_stale` ativo; manter estritamente restrito ao mês corrente provisional (e auto-reconciliação determinística de mês anterior fechado apenas quando `market_price_history` EOM já estiver congelado na nuvem).

#### B.3 UI Passiva (Remoção do Botão Manual) & Tooltips
- [x] **Alterar** `src/features/investments/components/resumo/use-resumo-tab-controller.ts`, `use-resumo-deep-links.ts`, `src/features/investments/pages/resumo-tab.tsx`, `src/features/investments/components/resumo/custody-section-card.tsx`:
  - [x] Remover o botão fixo "Atualizar Cotações" e handlers manuais redundantes (`useSyncQuotes`).
  - [x] Exibir indicador editorial discreto de referência/frescor no `CustodySectionCard` (B3, USD quando aplicável e câmbio USD/BRL com fonte real + micro-indicador silencioso durante revalidação SWR) e botão contextual discreto *"Tentar novamente"* **somente** quando houver ativo degradado/em erro.
- [x] **Alterar** `src/components/modules/position-table/position-columns.tsx`, `position-mobile-card-metrics.tsx` e `position-types.ts`:
  - [x] Enriquecer tooltip da coluna de preço com `market_price_at`, `provider`, status real (`Oficial`, `Manual`, `Fallback`) e eventual alerta do `StaleQuoteGuard`.

#### B.4 Refresh Pré-Relatório, Metadados no PDF e Conciliação DRY
- [x] **Criar** `src/features/investments/hooks/use-executive-report-refresh.ts`:
  - [x] Executa refresh pré-relatório (`mode: 'report_preflight'`, respeitando EOD Guard e cooldown de 5 min) ao abrir `PortfolioExecutiveReport` (mês atual) e `WealthTearSheetModal`, expondo progresso e diagnóstico final do `StaleQuoteGuard`.
- [x] **Criar** `src/components/modules/reports/custody-reconciliation-card.tsx` (DRY, `variant="ui"` e `variant="report"`):
  - [x] Reutilizado na aba Patrimônio (`ResumoTab`) e nos relatórios PDF (`ExecutiveReportDocument` e `WealthTearSheetModal`).
- [x] **Alterar** `src/components/modules/reports/report-document-layout.tsx`:
  - [x] Adicionar prop opcional `printWarning` abrindo `<ConfirmDialog />` (sem `autoFocus`) antes de imprimir, com confirmação disparando `triggerPrint` no gesto de clique.
- [x] **Alterar** `src/components/modules/reports/report-header.tsx`, `report-equity-class-table.tsx`, `report-class-table-parts.tsx`:
  - [x] Adicionar faixa editorial discreta no `ReportHeader` (Cotações B3, Cotações Exterior USD quando aplicável e Câmbio USD/BRL com 4 casas pt-BR, fonte real e data/hora).
  - [x] Corrigir legenda fixa de `ReportEquityClassTable` para exibir a fonte real do câmbio (eliminando texto fixo "PTAX Oficial BCB").
  - [x] Estender `ReportClassTableItem` com `quoteStatusFlag ("fallback" | "stale" | "manual" | null)` e `marketPriceAt`, exibindo marcador tipográfico discreto (sem emojis) + nota de rodapé compacta.
- [x] **Alterar** `src/domain/portfolio/executive-report-builder.ts` (+ `.test.ts`), `src/domain/reports/build-tear-sheet-model.ts`, `src/features/investments/components/portfolio-executive-report.tsx`, `executive-report/executive-report-document.tsx`, `src/features/reports/components/wealth-tear-sheet-modal.tsx`, `TearSheetCustodyAndBreakdowns.tsx`:
  - [x] Integrar `useExecutiveReportRefresh`, banner de alerta no preview quando degradado (`ReportQuoteStatusBanner`), `printWarning` no `ReportDocumentLayout`, metadados no `ReportHeader`, flags por linha e `CustodyReconciliationCard`.
- [x] **Portão de Segurança B:** testes unitários (`stale-quote-guard`, `custody-reconciliation`, `executive-report-builder`) + simulação de falha de API + auditoria `AGENTS.md` (zero `autoFocus`, zero emojis, zero nativos) + `npm run verify` + auditoria forense do diff + registrar resultado na Seção 4.

---

### BLOCO C — Limpeza da "Colcha de Retalhos" e Motor Unificado de Proventos Automatizados na Nuvem

#### C.1 Banco de Dados, RLS e RPCs de Proventos (`supabase/migrations/`)
- [x] **Criar** `supabase/migrations/20260101000143_automated_dividends_engine.sql`:
  - [x] Evoluir `public.corporate_dividends`: `ALTER COLUMN payment_date DROP NOT NULL`, adicionar `provider text`, `tax_rate_pct numeric(5,2) NOT NULL DEFAULT 0`, `is_type_uncertain boolean NOT NULL DEFAULT false`, `updated_at timestamptz NOT NULL DEFAULT now()`; substituir `uq_corporate_dividends` por `UNIQUE NULLS NOT DISTINCT (ticker, com_date, type, payment_date)`.
  - [x] Criar RPC `public.upsert_corporate_dividend_system(...)` (`service_role`): antes de promover uma linha `payment_date IS NULL` para a data confirmada, verificar se já existe registro com aquela `payment_date` exata (evitando colisão de chave única em parcelas múltiplas), promovendo in-place por `(ticker, com_date, type)` + taxa compatível `±0,005` sem duplicar `user_dividend_events`.
  - [x] Criar `public.user_dividend_events` (RLS do dono; `status IN ('PROVISIONED', 'PENDING_CONFIRMATION', 'SETTLED', 'DISMISSED')`, `corporate_dividend_id`, `asset_id`, `ticker`, `type`, `com_date`, `payment_date`, `quantity_on_com_date`, `gross_rate`, `net_rate`, `tax_rate_pct`, `gross_amount`, `net_amount`, `currency`, `fx_rate_applied`, `settled_dividend_id`, `is_manual boolean`, `is_type_uncertain boolean`, `UNIQUE (user_id, corporate_dividend_id) WHERE corporate_dividend_id IS NOT NULL`) + migrar dispensas existentes de `portfolio_dividend_dismissals`.
  - [x] Adicionar `source_event_id uuid` + `UNIQUE (user_id, source_event_id) WHERE source_event_id IS NOT NULL` em `public.portfolio_dividends` (e atualizar `restore_backup` se necessário para preservar colunas).
  - [x] Criar RPCs transacionais `public.settle_user_dividend_event_system(...)` (`service_role`) e `public.confirm_user_dividend_events_atomic(...)` (`authenticated` ativo + write `investments`): remover trava `< 2026-01-01`, aplicar conversão cambial oficial USD→BRL ao creditar `CAIXA` quando `currency = 'USD'`, e garantir idempotência via `source_event_id`.

#### C.2 Pipeline de Proventos na Nuvem & Domínio Puro
- [x] **Alterar** `supabase/functions/_shared/quotes-core.ts` (parsers de proventos B3 Brapi `cashDividends` + Yahoo `events=div` B3 fallback com `isTypeUncertain: true` e EUA 30% IR + cálculo `com_date` dia útil NYSE anterior).
- [x] **Alterar** `supabase/functions/quotes/index.ts` e `supabase/quotes-cron.sql`:
  - [x] Corrigir `action: 'sync_corporate_dividends'` (cron `10:00 UTC` diário): somente tickers de renda variável ativos (excluir Caixa/RF), B3 via Brapi (`BRAPI_TOKEN`) com fallback Yahoo incerto, EUA via Yahoo 30%, upsert via `upsert_corporate_dividend_system`.
  - [x] Implementar `action: 'process_user_dividends'` (cron `11:30 UTC` diário): reconstrução `data-com`, anti-flood (`activatedAt` / janela segura 7 dias), deduplicação fuzzy (`±3 dias úteis`, `±0,05`), respeito a `user_preferences.custom_settings.dividendAutomation` e efetivação via `settle_user_dividend_event_system`.
- [x] **Alterar** `src/domain/portfolio/dividend-suggester.ts` (+ `.test.ts`):
  - [x] Corrigir `getCustodyAtComDate` (custódia baseline + compras/vendas + splits/inplits até fechamento da `com_date` em `America/Sao_Paulo`, sem UTC `toISOString`), separar totais BRL vs. USD com câmbio oficial e exportar helpers de deduplicação fuzzy e anti-flood.
- [x] **Criar** `src/domain/portfolio/provisioned-dividends.ts` + `src/domain/portfolio/provisioned-dividends.test.ts`:
  - [x] Agregação pura de `PROVISIONED` + `PENDING_CONFIRMATION` (BRL + USD convertido pelo `fxMetadata.rate`), com testes garantindo **isolamento contábil estrito** (nunca altera Patrimônio no Fechamento nem Caixa).
- [x] **Alterar** `src/data/repositories/portfolio.ts` e `src/data/rpc/portfolio.ts`:
  - [x] Corrigir `listCorporateDividends` (filtrar pelos tickers da carteira, sem `.limit(200)` global cego).
  - [x] Adicionar repositório/RPCs de `user_dividend_events` (listagem, criação/edição de provisionado manual, confirmação em lote, dispensa).
- [x] **Alterar** `src/state/queries/use-corporate-dividends.ts` (ou evoluir para `use-user-dividend-events.ts`) e `src/state/mutations/portfolio/use-portfolio-dividend-mutations.ts`.

#### C.3 Limpeza da "Colcha de Retalhos", UI, Notification Hub & Preferências
- [x] **Remover** `src/features/investments/components/reinvest-dividends-banner.tsx` (código morto) e limpar código morto (`reinvestmentOpportunities`, `handleReinvest`, `handleReinvestCash`) em `src/features/investments/components/proventos/use-proventos-tab-controller.ts`.
- [x] **Eliminar as 3 instâncias duplicadas** de `PendingDividendsDialog` (`OverviewModalsHost`, `PortfolioInsightsCarousel`, `ProventosTab`) substituindo por um **modal único unificado** (sincronização reativa de `selectedIds`, edição de centavos/IR antes da confirmação, suporte a cadastro/conversão de provisionado manual, zero `autoFocus`, 100% primitivos `components/ui`).
- [x] **Integrar ao Notification Hub:** atualizar `src/domain/notifications/hub/event-detectors.ts`, `build-notification-center.ts`, `src/hooks/use-notification-center.ts` e `supabase/functions/push-dispatcher/index.ts` para eventos `PROVISIONED`, `PENDING_CONFIRMATION` e `SETTLED` (respeitando Horário Silencioso e preferências do usuário).
- [x] **Unificar banners/carrossel:** remover duplicidade entre `src/features/overview/components/corporate-dividends-banner.tsx` e `src/features/investments/components/insights-carousel/build-dividend-insight-items.tsx`, padronizando dispensa via `CarouselDismissPopover`.
- [x] **Corrigir e evoluir painéis de Proventos:**
  - [x] `src/features/investments/components/proventos/dividends-by-asset-panel.tsx`: formatar YoC com `formatPercent` (pt-BR).
  - [x] `src/features/investments/components/proventos/dividends-calendar-panel.tsx`: detalhar `PROVISIONED` vs. `PENDING_CONFIRMATION` por ativo, indicando alíquota/incerteza e data "a definir" quando `payment_date` for nula.
  - [x] `src/features/settings/components/tabs/notifications-tab.tsx` (novo card ou seção em `notifications/`): expor preferência `dividendAutomation` (`settlementMode: "auto" | "manual_confirm"`, `autoCreditCash`, `notifyOnProvisioned`, `notifyOnPayment`, gravando `activatedAt`).
  - [x] `src/components/modules/reports/custody-reconciliation-card.tsx`: adicionar linhas auxiliares (*Proventos Provisionados — A Receber* e *Total Projetado c/ Provisionados*) tanto na UI quanto nos PDFs executivos.

#### C.4 Documentação & Portão de Segurança Final (Bloco C)
- [x] **Atualizar** `docs/roadmap/ROADMAP.md`, `docs/architecture/ESPECIFICACAO_TECNICA.md` e `docs/architecture/PROJECT_STRUCTURE.md`.
- [x] **Rodar testes completos Bloco C + `npm run verify:full`** (custódia `data-com` com baseline/split, fiscal JCP/EUA, fallback Yahoo B3 → `PENDING_CONFIRMATION`, anti-flood retroativo, conversão USD→BRL no Caixa, deduplicação/idempotência, isolamento contábil de provisionados).
- [x] **Auditoria forense ponta a ponta** comparando 100% deste documento com o código implementado + registrar Portão C na Seção 4 e marcar plano como `CONCLUÍDO`.

---

## 4. CRITÉRIOS DE ACEITE E REGISTRO DOS PORTÕES DE SEGURANÇA

| Portão | Bloco | Verificações Obrigatórias | Status | Achados / Correções | Data |
|---|---|---|---|---|---|
| **Portão A** | Bloco A | Testes (`quotes-core`, `asset-prices`, EOD Guard BR/US, spike split-aware, PTAX lookback, paridade EOM, câmbio SSOT) + `npm run verify` + auditoria forense do diff (RLS, `restore_backup`, race conditions) | `APROVADO` | `npm run verify` ok (`tsc -b` 0 erros, `eslint .` 0 erros / 9 warnings pré-existentes, `221/221` suítes / `3171/3171` testes de domínio); 8 suítes focadas ok (`8/8` arquivos, `186/186` testes incl. `security-audit.test.ts` 63/63, `quotes-core.test.ts` 33/33, `asset-prices.test.ts` 12/12, `quotes.test.ts` 9/9). Auditoria forense resolveu colisão de timestamp (`000141` → `000142`), deduplicação `DISTINCT ON` em `restore_backup`, filtro `.eq("is_month_end", true)` em consultas EOM, trava anti-spoofing de `cache_miss` no servidor e separação `cache_miss`/`swr` + merge `degradedTickers` no SWR. | 2026-11-23 |
| **Portão B** | Bloco B | Testes (`stale-quote-guard`, `custody-reconciliation`, `executive-report-builder`) + simulação de falha de API + zero botão manual + zero `autoFocus`/emojis + `npm run verify` + auditoria forense do diff | `APROVADO` | `npm run verify` ok (`tsc -b` 0 erros, `eslint .` 0 erros / 9 warnings pré-existentes fora de `src/`, `223/223` suítes / `3180/3180` testes de domínio); 7 suítes focadas UI/PDF/segurança/a11y ok (`7/7` arquivos, `122/122` testes incl. `resumo-tab` 7/7, `investments-page` 9/9, `portfolio-executive-report` 8/8, `wealth-tear-sheet-modal` 7/7, `reports-page` 13/13, `accessibility-audit` 13/13, `security-audit` 63/63 e `portfolio-audit-gate-v3` na suíte de domínio). Removido `useSyncQuotes` e botão manual fixo; integrado `StaleQuoteGuard`, `CustodyReconciliationCard` DRY, flags `[M]`/`[D]`/`[E]`, `ConfirmDialog` de impressão sem `autoFocus` e `useMemo` em `effectiveFxMetadata`. | 2026-11-23 |
| **Portão C** | Bloco C | Testes (custódia `data-com`, fiscal JCP/EUA, fallback Yahoo B3 incerto, anti-flood, USD→BRL no Caixa, deduplicação/idempotência, isolamento provisionados) + `npm run verify:full` + auditoria forense final ponta a ponta | `APROVADO` | `npm run verify` ok (`tsc -b` 0 erros, `eslint .` 0 erros / 9 warnings pré-existentes em `scripts/sample-reports-entry.tsx`, `224/224` suítes / `3187/3187` testes de domínio); `17/17` suítes focadas ok (`302/302` testes incl. `quotes-core` 37/37, `security-audit` 64/64, `accessibility-audit` 13/13, `notifications-tab` 29/29); `npm run verify:full` (`8/8` testes Playwright E2E) exit 0. Antes do Portão C foram corrigidas 2 asserções desatualizadas: fixture baseline + novo caso em `dividend-suggester.test.ts` e nome `uq_corporate_dividends` em `security-audit.test.ts`. | 2026-11-23 |
| **Hardening Pós-Auditoria** | Blocos A, B & C | Revisão forense profunda em 4 frentes (SQL/Crons, Edge Functions/Data, Domínio/State/Hooks e UI/Modais/PDFs) + expansão de testes unitários + `npm run verify:full` + build Android `v3.17.1` (`Build 106`) | `APROVADO` | Hardening completo aplicado em SQL (`0142`/`0143`, `quotes-cron.sql`), Edge Functions (`quotes-core.ts`, `quotes/index.ts`, `push-dispatcher/index.ts` com timeouts 5s e claim atômico `in_flight`), repositórios (`asset-prices.ts` paginado, `user-preferences.ts` fila serializada + upsert, `portfolio.ts` chunks 150 + RPCs revert/dismiss), domínio puro (`canonical-engine`, `stale-quote-guard`, `dividends-analytics`, `custody-reconciliation`, `market-calendar`), hooks SWR/PIT/Snapshots (`useSyncExternalStore`, sem dupla contagem de `CAIXA`) e UI/PDF (`use-print` síncrono com `flushSync` para Safari/iOS, `PendingDividendsDialog`, `ReportEquityClassTable`, `PortfolioExecutiveReport`, `WealthTearSheetModal`, `DividendAutomationCard`). Verificado com `224/224` suítes de domínio (`3.193/3.193` testes), `190/190` suítes de infra/estado/segurança (`1.688/1.688` testes), `221/221` suítes de componentes/features (`1.551/1.551` testes) e `8/8` testes E2E Playwright. Push remoto ao Supabase (`db push` / `functions deploy`) pendente de `npx supabase login` devido a `401 Invalid access token` no CLI local. | 2026-11-23 |

---

## 5. LOG DE EXECUÇÃO E DECISÕES

- **2026-11-22 (Fase 0):** Meta-análise crítica concluída contra o código real (PG 17.6.1.155 confirmado; 10 refinamentos de risco/lacuna incorporados). Arquivo mestre criado. Aguardando aprovação explícita do usuário para iniciar o **Bloco A**.
- **2026-11-22 (Início Bloco A):** Plano aprovado pelo usuário com 3 ajustes incorporados (feriado cruzado no `is_month_end` via `asset_prices`, Never-Degrade SQL em `upsert_global_asset_prices` e checagem de colisão em parcelas múltiplas no `upsert_corporate_dividend_system` do Bloco C). Numeração das migrations ajustada para `000141` (Bloco A) e `000142` (Bloco C). Iniciando implementação do Bloco A.
- **2026-11-23 (Portão A Aprovado):** Bloco A concluído. Migration renomeada para `000142_global_market_quotes_engine.sql` (e Bloco C ajustado para `000143_automated_dividends_engine.sql`) devido à coexistência de `000141_new_user_default_preferences_refinement.sql` no workspace. Todos os checks do Portão A passaram após os ajustes finais (`npm run verify` + 8 suítes integradas com 0 falhas). Aguardando confirmação do usuário para iniciar o Bloco B.
- **2026-11-23 (Portão B Aprovado — Início Bloco C):** Bloco B implementado e validado (`npm run verify` + 7 suítes integradas, 0 erros de lint/TS, zero botão manual, zero `autoFocus`/emojis, invariante centavos 100% preservada). Seguindo plano mestre aprovado, iniciando **Bloco C** (`20260101000143_automated_dividends_engine.sql`, pipeline de proventos B3/EUA, modal único e Notification Hub).
- **2026-11-23 (Portão C Aprovado — Release v3.17.0 · Build 105):** Bloco C concluído e Portão C aprovado (`npm run verify`, `17/17` suítes focadas e `npm run verify:full` com `8/8` E2E Playwright aprovados). Documentação atualizada (`ESPECIFICACAO_TECNICA.md`, `PROJECT_STRUCTURE.md`, `ROADMAP.md`, `PLANO_MOTOR_COTACOES_PROVENTOS.md`), versão promovida para `3.17.0` (`Build 105`) com migrations `000142`/`000143` e Edge Functions `quotes`/`push-dispatcher` preparadas para push/deploy remoto (CLI Supabase retornou `401 Invalid access token` nesta sessão) e build do APK assinada.
- **2026-11-23 (Hardening Forense Pós-Auditoria — Release v3.17.1 · Build 106):** Auditoria forense em 4 subagentes especializados seguida de correção integral de todas as fragilidades identificadas em SQL, Edge Functions, camada de dados, domínio puro, React Query hooks, Notification Hub, relatórios A4/PDF e UI (`224/224` suítes de domínio / `3.193` testes, `190/190` suítes de infra/estado / `1.688` testes, `221/221` suítes de UI/features / `1.551` testes e `8/8` E2E Playwright aprovados), geração do APK assinado `v3.17.1` (`Build 106`), commit/push em `origin/main` e envio do relatório executivo ao bot ARGOS no Telegram.
