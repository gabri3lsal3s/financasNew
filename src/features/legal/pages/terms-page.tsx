import { BookOpen, Clock, CreditCard, RotateCcw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui";
import { LegalPageShell } from "@/features/legal/components";
import { INSTITUTIONAL_CONFIG } from "@/lib/institutional";
import { TermsHighlightsGrid } from "../components/terms-highlights-grid";
import { TermsRegulatoryClauses } from "../components/terms-regulatory-clauses";

export function TermsPage() {
  return (
    <LegalPageShell
      activeTab="terms"
      title="Termos de Serviço e Contrato de Adesão SaaS"
      description="Instrumento contratual vinculante que disciplina o uso do software Axir, direitos do consumidor, planos de assinatura, período de avaliação e isenções regulatórias."
      lastUpdated="23 de Outubro de 2026"
      version="2.0"
    >
      <TermsHighlightsGrid />

      <section aria-labelledby="clausula-1" className="space-y-3 pt-2">
        <h2
          id="clausula-1"
          className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2"
        >
          <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>CLÁUSULA PRIMEIRA — DO OBJETO E DA NATUREZA DOS SERVIÇOS</span>
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>1.1.</strong> O presente instrumento regula a licença de uso do software{" "}
            <strong>{INSTITUTIONAL_CONFIG.appName}</strong>, disponibilizado sob o modelo de{" "}
            <em>Software as a Service</em> (SaaS), destinado à organização financeira pessoal,
            controle de receitas e despesas, gestão de cartões de crédito, dívidas, orçamentos e
            consolidação numérica e matemática de carteiras de investimentos.
          </p>
          <p>
            <strong>1.2.</strong> O {INSTITUTIONAL_CONFIG.appName} é uma plataforma 100%{" "}
            <em>Online First</em>, funcionando com sincronização em nuvem e armazenamento
            criptografado sob rigorosos padrões de segurança da informação.
          </p>
          <p>
            <strong>1.3.</strong>{" "}
            {INSTITUTIONAL_CONFIG.cnpj ? (
              <>
                O serviço é prestado por <strong>{INSTITUTIONAL_CONFIG.companyName}</strong>, pessoa
                jurídica de direito privado inscrita no CNPJ sob o nº{" "}
                <strong>{INSTITUTIONAL_CONFIG.cnpj}</strong>, com sede em{" "}
                {INSTITUTIONAL_CONFIG.address}.
              </>
            ) : (
              <>
                O serviço é desenvolvido, mantido e operado por{" "}
                <strong>{INSTITUTIONAL_CONFIG.developerName}</strong>, desenvolvedor independente e
                responsável técnico pela plataforma <strong>{INSTITUTIONAL_CONFIG.appName}</strong>,
                com domicílio e sede de desenvolvimento em {INSTITUTIONAL_CONFIG.address}.
              </>
            )}
          </p>
        </div>
      </section>

      <section aria-labelledby="clausula-2" className="space-y-3 border-t border-border/60 pt-6">
        <h2
          id="clausula-2"
          className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2"
        >
          <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>CLÁUSULA SEGUNDA — DA CAPACIDADE E DO CADASTRO</span>
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>2.1.</strong> O cadastro e utilização da plataforma são restritos a pessoas
            naturais plenamente capazes, maiores de 18 (dezoito) anos de idade nos termos do Código
            Civil Brasileiro.
          </p>
          <p>
            <strong>2.2.</strong> O usuário é o único responsável pela veracidade, exatidão e
            atualização dos dados informados no cadastro, bem como pela guarda confidencial, sigilosa
            e intransferível de suas credenciais de autenticação (e-mail, senha e tokens de acesso).
          </p>
        </div>
      </section>

      <section aria-labelledby="clausula-3" className="space-y-3 border-t border-border/60 pt-6">
        <h2
          id="clausula-3"
          className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2"
        >
          <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>CLÁUSULA TERCEIRA — DO PERÍODO DE AVALIAÇÃO GRATUITA (TRIAL)</span>
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>3.1.</strong> Todo novo usuário cadastrado na plataforma tem direito irrevogável a{" "}
            <strong>30 (trinta) dias de avaliação gratuita</strong> com acesso integral e irrestrito
            a todos os recursos e funcionalidades do Plano Pro.
          </p>
          <p>
            <strong>3.2.</strong> O início do período de teste gratuito{" "}
            <strong>não exige a inserção de dados de cartão de crédito</strong> ou qualquer
            compromisso financeiro. Encerrados os 30 dias de avaliação, caso o usuário opte por não
            contratar um plano pago, a conta migrará automaticamente para o{" "}
            <strong>Modo Somente-Leitura</strong>, garantindo a visualização e preservação integral
            de todo o histórico financeiro e relatórios cadastrados, sem qualquer risco de perda ou
            sequestro de dados.
          </p>
        </div>
      </section>

      <section aria-labelledby="clausula-4" className="space-y-3 border-t border-border/60 pt-6">
        <h2
          id="clausula-4"
          className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2"
        >
          <CreditCard className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>CLÁUSULA QUARTA — DOS PLANOS PAGOS, PREÇOS E FATURAMENTO</span>
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>4.1.</strong> O usuário poderá optar pela contratação do serviço mediante
            assinatura nos seguintes modelos:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2 text-muted-foreground">
            <li>
              <strong className="text-foreground">Plano Pro Mensal:</strong> cobrança recorrente no
              valor de <strong>R$ 19,99 por mês</strong>.
            </li>
            <li>
              <strong className="text-foreground">Plano Pro Anual:</strong> cobrança em parcela única
              anual no valor de <strong>R$ 143,88 por ano</strong> (equivalente a R$ 11,99/mês, com
              desconto promocional integrado).
            </li>
          </ul>
          <p>
            <strong>4.2.</strong> Os pagamentos são processados de forma segura através de gateways
            de pagamento terceirizados devidamente homologados pelo Banco Central do Brasil (Asaas e
            Stripe), admitindo modalidades de cartão de crédito (com renovação periódica automática)
            e PIX dinâmico (no plano anual).
          </p>
          <p>
            <strong>4.3.</strong> Os preços dos planos poderão sofrer reajustes anuais fundamentados
            na variação de índices oficiais de inflação (IPCA/IBGE) ou expansão da infraestrutura,
            mediante aviso prévio por correio eletrônico com antecedência mínima de 30 (trinta) dias.
          </p>
        </div>
      </section>

      <section aria-labelledby="clausula-5" className="space-y-3 border-t border-border/60 pt-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2
            id="clausula-5"
            className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2"
          >
            <RotateCcw className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>CLÁUSULA QUINTA — DO DIREITO DE ARREPENDIMENTO (CDC ART. 49)</span>
          </h2>
          <Badge variant="positive" size="sm">
            Garantia Legal CDC
          </Badge>
        </div>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>5.1.</strong> Em estrito cumprimento ao Artigo 49 da Lei Federal nº 8.078/1990
            (Código de Defesa do Consumidor) e às diretrizes do Decreto Federal nº 7.962/2013
            (Decreto do Comércio Eletrônico), o usuário poderá desistir da contratação no prazo
            improrrogável de <strong>7 (sete) dias corridos</strong> a contar da confirmação do
            pagamento inicial ou de qualquer renovação de ciclo.
          </p>
          <p>
            <strong>5.2.</strong> O exercício do direito de arrependimento garante a devolução e{" "}
            <strong>reembolso integral e imediato de todos os valores cobrados</strong>, sem qualquer
            retenção ou incidência de taxas administrativas, podendo ser solicitado formalmente via
            canal de suporte eletrônico (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">
              {INSTITUTIONAL_CONFIG.supportEmail}
            </code>
            ) ou diretamente no fluxo de autoatendimento da plataforma.
          </p>
        </div>
      </section>

      <TermsRegulatoryClauses />
    </LegalPageShell>
  );
}
