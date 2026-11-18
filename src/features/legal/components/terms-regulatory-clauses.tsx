import { AlertTriangle, HelpCircle, MousePointerClick, Scale } from "lucide-react";
import { Badge } from "@/components/ui";
import { INSTITUTIONAL_CONFIG } from "@/lib/institutional";

export function TermsRegulatoryClauses() {
  return (
    <>
      <section aria-labelledby="clausula-6" className="space-y-3 border-t border-border/60 pt-6">
        <h2
          id="clausula-6"
          className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2"
        >
          <MousePointerClick className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>CLÁUSULA SEXTA — DO CANCELAMENTO SEM BUROCRACIA E SEM MULTAS</span>
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>6.1.</strong> O usuário possui a prerrogativa incondicional de cancelar a
            renovação automática de sua assinatura a qualquer momento com <strong>1 clique</strong>{" "}
            diretamente na aba &quot;Plano&quot; dentro das Configurações do aplicativo, sem
            necessidade de contato telefônico, chat com atendente ou justificativa.
          </p>
          <p>
            <strong>6.2.</strong> O cancelamento não gera multas rescisórias, penalidades, cobranças
            residuais ou cláusulas de fidelidade. Ao cancelar, o acesso a todas as funcionalidades Pro
            permanecerá plenamente ativo até o término do ciclo de faturamento já quitado.
          </p>
        </div>
      </section>

      <section aria-labelledby="clausula-7" className="space-y-3 border-t border-border/60 pt-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2
            id="clausula-7"
            className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2"
          >
            <Scale className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>CLÁUSULA SÉTIMA — DA ISENÇÃO DE CUSTÓDIA, INTERMEDIAÇÃO E CONSULTORIA (CVM)</span>
          </h2>
          <Badge variant="warning" size="sm">
            Isenção Regulatória CVM
          </Badge>
        </div>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>7.1.</strong> O {INSTITUTIONAL_CONFIG.appName}{" "}
            <strong>
              não é instituição financeira, sociedade de crédito, cooperativa, corretora de valores ou
              distribuidora de títulos e valores mobiliários (DTVM)
            </strong>
            . A plataforma não realiza custódia de moeda corrente nacional ou estrangeira, não
            recebe depósitos, não efetua transferências bancárias em nome de terceiros e não executa
            ordens de compra e venda no mercado de capitais.
          </p>
          <p>
            <strong>7.2.</strong> As ferramentas de cálculo patrimonial, balanceamento e sugestão de
            aporte operam segundo modelo <strong>estritamente matemático e automatizado</strong>,
            baseando-se única e exclusivamente nas metas percentuais, tetos setoriais e parâmetros
            de alocação configurados livre e discricionariamente pelo próprio usuário.
          </p>
          <p>
            <strong>7.3.</strong> O software não presta serviços de consultoria de valores mobiliários
            (Resolução CVM nº 19/2021) nem elabora relatórios de análise, recomendações de
            investimento ou juízos de valor sobre ativos financeiros (Resolução CVM nº 20/2021). A
            rentabilidade pretérita demonstrada em consolidações não constitui garantia de retorno
            futuro.
          </p>
          <p>
            <strong>7.4.</strong> O usuário reconhece expressamente que qualquer cálculo de
            rebalanceamento, defasagem ou alocação numérica de aportes gerado pela plataforma tem
            natureza estritamente instrumental, contábil e ilustrativa. A decisão final de
            investimento, seleção de ativos e transmissão de quaisquer ordens de compra e venda
            constitui prerrogativa exclusiva e indelegável do usuário perante sua respectiva
            corretora de valores autorizada.
          </p>
        </div>
      </section>

      <section aria-labelledby="clausula-8" className="space-y-3 border-t border-border/60 pt-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2
            id="clausula-8"
            className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2"
          >
            <AlertTriangle className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>CLÁUSULA OITAVA — DA ISENÇÃO DE RESPONSABILIDADE TRIBUTÁRIA E CONTÁBIL</span>
          </h2>
          <Badge variant="muted" size="sm">
            Contábil & RFB
          </Badge>
        </div>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>8.1.</strong> As rotinas de apuração fiscal, simulação de ganho de capital em
            operações de bolsa, cálculo de DARF (código 6015) e regimes fiscais de investimentos no
            exterior (Lei Federal nº 14.754/2023) possuem finalidade{" "}
            <strong>estritamente estimativa, didática e informativa</strong>.
          </p>
          <p>
            <strong>8.2.</strong> O {INSTITUTIONAL_CONFIG.appName} não substitui a escrituração
            contábil profissional habilitada perante o Conselho Federal de Contabilidade (CFC) nem a
            elaboração da Declaração de Ajuste Anual do Imposto de Renda perante a Receita Federal do
            Brasil (RFB). O usuário é o único e indelegável responsável perante o Fisco pela
            verificação das notas de corretagem, informes de rendimentos oficiais e recolhimento
            tempestivo de seus tributos.
          </p>
        </div>
      </section>

      <section aria-labelledby="clausula-9" className="space-y-3 border-t border-border/60 pt-6">
        <h2
          id="clausula-9"
          className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2"
        >
          <HelpCircle className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>CLÁUSULA NONA — DO FORO DE ELEIÇÃO</span>
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>9.1.</strong> Para dirimir quaisquer controvérsias ou litígios decorrentes da
            interpretação ou execução deste contrato de adesão, as partes elegem o{" "}
            <strong>{INSTITUTIONAL_CONFIG.legalJurisdiction}</strong>, com expressa renúncia a
            qualquer outro, por mais privilegiado que seja, ressalvada a faculdade legal assegurada
            ao consumidor de ajuizar demanda no foro da comarca de seu próprio domicílio, nos termos
            da legislação consumerista brasileira aplicável.
          </p>
        </div>
      </section>
    </>
  );
}
