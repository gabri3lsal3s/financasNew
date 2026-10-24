import {
  ShieldCheck,
  RotateCcw,
  MousePointerClick,
  Scale,
  Sparkles,
  CreditCard,
  AlertTriangle,
  HelpCircle,
  Clock,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, Badge } from "@/components/ui";
import { LegalPageShell } from "@/features/legal/components";
import { INSTITUTIONAL_CONFIG } from "@/lib/institutional";

/**
 * Página pública de Termos de Serviço e Contrato de Adesão SaaS do Áxis Finance.
 *
 * Materializa o Contrato 1 integralmente, em conformidade com:
 * - Código de Defesa do Consumidor (Lei nº 8.078/1990 — CDC Art. 49)
 * - Decreto do Comércio Eletrônico (Decreto nº 7.962/2013)
 * - Marco Civil da Internet (Lei nº 12.965/2014)
 * - Resoluções CVM nº 19/2021 e nº 20/2021
 * - Legislação Fiscal e Normas do Conselho Federal de Contabilidade (CFC)
 */
export function TermsPage() {
  return (
    <LegalPageShell
      activeTab="terms"
      title="Termos de Serviço e Contrato de Adesão SaaS"
      description="Instrumento contratual vinculante que disciplina o uso do software Áxis Finance, direitos do consumidor, planos de assinatura, período de avaliação e isenções regulatórias."
      lastUpdated="23 de Outubro de 2026"
      version="2.0"
    >
      {/* Bloco de Destaques para Máxima Transparência (CDC & Decreto 7.962/2013) */}
      <section aria-labelledby="secao-destaques-contratuais" className="not-prose">
        <h2 id="secao-destaques-contratuais" className="sr-only">
          Destaques e Garantias Contratuais
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-border/80 bg-surface shadow-xs">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>30 Dias de Teste</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Acesso Pro completo sem pedir cartão de crédito. Seus dados nunca são sequestrados.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                <RotateCcw className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>Arrependimento em 7 Dias</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Estorno integral e imediato nos termos do Art. 49 do CDC, com solicitação simplificada.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                <MousePointerClick className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>Cancelamento em 1 Clique</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Sem carência, sem contratos de fidelidade e sem burocracia na aba de Assinatura.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                <Scale className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>Isenção CVM 19 e 20</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Cálculos de rebalanceamento puramente matemáticos baseados nas metas do titular.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CLÁUSULA PRIMEIRA */}
      <section aria-labelledby="clausula-1" className="space-y-3 pt-2">
        <h2 id="clausula-1" className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
          <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>CLÁUSULA PRIMEIRA — DO OBJETO E DA NATUREZA DOS SERVIÇOS</span>
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>1.1.</strong> O presente instrumento regula a licença de uso do software <strong>{INSTITUTIONAL_CONFIG.appName}</strong>, disponibilizado sob o modelo de <em>Software as a Service</em> (SaaS), destinado à organização financeira pessoal, controle de receitas e despesas, gestão de cartões de crédito, dívidas, orçamentos e consolidação numérica e matemática de carteiras de investimentos.
          </p>
          <p>
            <strong>1.2.</strong> O {INSTITUTIONAL_CONFIG.appName} é uma plataforma 100% <em>Online First</em>, funcionando com sincronização em nuvem e armazenamento criptografado sob rigorosos padrões de segurança da informação.
          </p>
          <p>
            <strong>1.3.</strong> O serviço é prestado por <strong>{INSTITUTIONAL_CONFIG.companyName}</strong>, pessoa jurídica de direito privado inscrita no CNPJ sob o nº <strong>{INSTITUTIONAL_CONFIG.cnpj}</strong>, com sede em {INSTITUTIONAL_CONFIG.address}.
          </p>
        </div>
      </section>

      {/* CLÁUSULA SEGUNDA */}
      <section aria-labelledby="clausula-2" className="space-y-3 border-t border-border/60 pt-6">
        <h2 id="clausula-2" className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>CLÁUSULA SEGUNDA — DA CAPACIDADE E DO CADASTRO</span>
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>2.1.</strong> O cadastro e utilização da plataforma são restritos a pessoas naturais plenamente capazes, maiores de 18 (dezoito) anos de idade nos termos do Código Civil Brasileiro.
          </p>
          <p>
            <strong>2.2.</strong> O usuário é o único responsável pela veracidade, exatidão e atualização dos dados informados no cadastro, bem como pela guarda confidencial, sigilosa e intransferível de suas credenciais de autenticação (e-mail, senha e tokens de acesso).
          </p>
        </div>
      </section>

      {/* CLÁUSULA TERCEIRA */}
      <section aria-labelledby="clausula-3" className="space-y-3 border-t border-border/60 pt-6">
        <h2 id="clausula-3" className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>CLÁUSULA TERCEIRA — DO PERÍODO DE AVALIAÇÃO GRATUITA (TRIAL)</span>
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>3.1.</strong> Todo novo usuário cadastrado na plataforma tem direito irrevogável a <strong>30 (trinta) dias de avaliação gratuita</strong> com acesso integral e irrestrito a todos os recursos e funcionalidades do Plano Pro.
          </p>
          <p>
            <strong>3.2.</strong> O início do período de teste gratuito <strong>não exige a inserção de dados de cartão de crédito</strong> ou qualquer compromisso financeiro. Encerrados os 30 dias de avaliação, caso o usuário opte por não contratar um plano pago, a conta migrará automaticamente para o <strong>Modo Somente-Leitura</strong>, garantindo a visualização e preservação integral de todo o histórico financeiro e relatórios cadastrados, sem qualquer risco de perda ou sequestro de dados.
          </p>
        </div>
      </section>

      {/* CLÁUSULA QUARTA */}
      <section aria-labelledby="clausula-4" className="space-y-3 border-t border-border/60 pt-6">
        <h2 id="clausula-4" className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
          <CreditCard className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>CLÁUSULA QUARTA — DOS PLANOS PAGOS, PREÇOS E FATURAMENTO</span>
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>4.1.</strong> O usuário poderá optar pela contratação do serviço mediante assinatura nos seguintes modelos:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2 text-muted-foreground">
            <li>
              <strong className="text-foreground">Plano Pro Mensal:</strong> cobrança recorrente no valor de <strong>R$ 19,90 por mês</strong>.
            </li>
            <li>
              <strong className="text-foreground">Plano Pro Anual:</strong> cobrança em parcela única anual no valor de <strong>R$ 178,80 por ano</strong> (equivalente a R$ 14,90/mês, com desconto promocional integrado).
            </li>
          </ul>
          <p>
            <strong>4.2.</strong> Os pagamentos são processados de forma segura através de gateways de pagamento terceirizados devidamente homologados pelo Banco Central do Brasil (Asaas e Stripe), admitindo modalidades de cartão de crédito (com renovação periódica automática) e PIX dinâmico (no plano anual).
          </p>
          <p>
            <strong>4.3.</strong> Os preços dos planos poderão sofrer reajustes anuais fundamentados na variação de índices oficiais de inflação (IPCA/IBGE) ou expansão da infraestrutura, mediante aviso prévio por correio eletrônico com antecedência mínima de 30 (trinta) dias.
          </p>
        </div>
      </section>

      {/* CLÁUSULA QUINTA — CDC ART. 49 */}
      <section aria-labelledby="clausula-5" className="space-y-3 border-t border-border/60 pt-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 id="clausula-5" className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
            <RotateCcw className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>CLÁUSULA QUINTA — DO DIREITO DE ARREPENDIMENTO (CDC ART. 49)</span>
          </h2>
          <Badge variant="positive" size="sm">
            Garantia Legal CDC
          </Badge>
        </div>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>5.1.</strong> Em estrito cumprimento ao Artigo 49 da Lei Federal nº 8.078/1990 (Código de Defesa do Consumidor) e às diretrizes do Decreto Federal nº 7.962/2013 (Decreto do Comércio Eletrônico), o usuário poderá desistir da contratação no prazo improrrogável de <strong>7 (sete) dias corridos</strong> a contar da confirmação do pagamento inicial ou de qualquer renovação de ciclo.
          </p>
          <p>
            <strong>5.2.</strong> O exercício do direito de arrependimento garante a devolução e <strong>reembolso integral e imediato de todos os valores cobrados</strong>, sem qualquer retenção ou incidência de taxas administrativas, podendo ser solicitado formalmente via canal de suporte eletrônico (<code>{INSTITUTIONAL_CONFIG.supportEmail}</code>) ou diretamente no fluxo de autoatendimento da plataforma.
          </p>
        </div>
      </section>

      {/* CLÁUSULA SEXTA */}
      <section aria-labelledby="clausula-6" className="space-y-3 border-t border-border/60 pt-6">
        <h2 id="clausula-6" className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
          <MousePointerClick className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>CLÁUSULA SEXTA — DO CANCELAMENTO SEM BUROCRACIA E SEM MULTAS</span>
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>6.1.</strong> O usuário possui a prerrogativa incondicional de cancelar a renovação automática de sua assinatura a qualquer momento com <strong>1 clique</strong> diretamente na aba "Assinatura" dentro das Configurações do aplicativo, sem necessidade de contato telefônico, chat com atendente ou justificativa.
          </p>
          <p>
            <strong>6.2.</strong> O cancelamento não gera multas rescisórias, penalidades, cobranças residuais ou cláusulas de fidelidade. Ao cancelar, o acesso a todas as funcionalidades Pro permanecerá plenamente ativo até o término do ciclo de faturamento já quitado.
          </p>
        </div>
      </section>

      {/* CLÁUSULA SÉTIMA — CVM 19 E 20 */}
      <section aria-labelledby="clausula-7" className="space-y-3 border-t border-border/60 pt-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 id="clausula-7" className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
            <Scale className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>CLÁUSULA SÉTIMA — DA ISENÇÃO DE CUSTÓDIA, INTERMEDIAÇÃO E CONSULTORIA (CVM)</span>
          </h2>
          <Badge variant="warning" size="sm">
            Isenção Regulatória CVM
          </Badge>
        </div>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>7.1.</strong> O {INSTITUTIONAL_CONFIG.appName} <strong>não é instituição financeira, sociedade de crédito, cooperativa, corretora de valores ou distribuidora de títulos e valores mobiliários (DTVM)</strong>. A plataforma não realiza custódia de moeda corrente nacional ou estrangeira, não recebe depósitos, não efetua transferências bancárias em nome de terceiros e não executa ordens de compra e venda no mercado de capitais.
          </p>
          <p>
            <strong>7.2.</strong> As ferramentas de cálculo patrimonial, balanceamento e sugestão de aporte operam segundo modelo <strong>estritamente matemático e automatizado</strong>, baseando-se única e exclusivamente nas metas percentuais, tetos setoriais e parâmetros de alocação configurados livre e discricionariamente pelo próprio usuário.
          </p>
          <p>
            <strong>7.3.</strong> O software não presta serviços de consultoria de valores mobiliários (Resolução CVM nº 19/2021) nem elabora relatórios de análise, recomendações de investimento ou juízos de valor sobre ativos financeiros (Resolução CVM nº 20/2021). A rentabilidade pretérita demonstrada em consolidações não constitui garantia de retorno futuro.
          </p>
        </div>
      </section>

      {/* CLÁUSULA OITAVA — CFC E RECEITA FEDERAL */}
      <section aria-labelledby="clausula-8" className="space-y-3 border-t border-border/60 pt-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 id="clausula-8" className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
            <AlertTriangle className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>CLÁUSULA OITAVA — DA ISENÇÃO DE RESPONSABILIDADE TRIBUTÁRIA E CONTÁBIL</span>
          </h2>
          <Badge variant="muted" size="sm">
            Contábil & RFB
          </Badge>
        </div>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>8.1.</strong> As rotinas de apuração fiscal, simulação de ganho de capital em operações de bolsa, cálculo de DARF (código 6015) e regimes fiscais de investimentos no exterior (Lei Federal nº 14.754/2023) possuem finalidade <strong>estritamente estimativa, didática e informativa</strong>.
          </p>
          <p>
            <strong>8.2.</strong> O {INSTITUTIONAL_CONFIG.appName} não substitui a escrituração contábil profissional habilitada perante o Conselho Federal de Contabilidade (CFC) nem a elaboração da Declaração de Ajuste Anual do Imposto de Renda perante a Receita Federal do Brasil (RFB). O usuário é o único e indelegável responsável perante o Fisco pela verificação das notas de corretagem, informes de rendimentos oficiais e recolhimento tempestivo de seus tributos.
          </p>
        </div>
      </section>

      {/* CLÁUSULA NONA — FORO */}
      <section aria-labelledby="clausula-9" className="space-y-3 border-t border-border/60 pt-6">
        <h2 id="clausula-9" className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
          <HelpCircle className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>CLÁUSULA NONA — DO FORO DE ELEIÇÃO</span>
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>9.1.</strong> Para dirimir quaisquer controvérsias ou litígios decorrentes da interpretação ou execução deste contrato de adesão, as partes elegem o <strong>{INSTITUTIONAL_CONFIG.legalJurisdiction}</strong>, com expressa renúncia a qualquer outro, por mais privilegiado que seja, ressalvada a faculdade legal assegurada ao consumidor de ajuizar demanda no foro da comarca de seu próprio domicílio, nos termos da legislação consumerista brasileira aplicável.
          </p>
        </div>
      </section>
    </LegalPageShell>
  );
}
