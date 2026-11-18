import { FileCheck2, Lock, Mail, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui";
import { LegalPageShell } from "@/features/legal/components";
import { INSTITUTIONAL_CONFIG } from "@/lib/institutional";
import { PrivacyHighlightsGrid } from "../components/privacy-highlights-grid";
import { PrivacyRightsAndCookiesSections } from "../components/privacy-rights-and-cookies-sections";
import { PrivacySelfServiceSection } from "../components/privacy-self-service-section";

export function PrivacyPage() {
  return (
    <LegalPageShell
      activeTab="privacy"
      title="Política de Privacidade e Proteção de Dados (LGPD)"
      description="Diretrizes de transparência, bases legais, medidas de segurança, direitos dos titulares e procedimentos de descarte de dados do Axir em estrita conformidade com a Lei nº 13.709/2018."
      lastUpdated="23 de Outubro de 2026"
      version="2.0"
    >
      <PrivacyHighlightsGrid />

      <section aria-labelledby="secao-1" className="space-y-3 pt-2">
        <h2
          id="secao-1"
          className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2"
        >
          <UserCheck className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>SEÇÃO 1 — IDENTIFICAÇÃO DO CONTROLADOR E DO ENCARREGADO (DPO)</span>
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>1.1. Identificação do Controlador:</strong>{" "}
            {INSTITUTIONAL_CONFIG.cnpj ? (
              <>
                O controlador do tratamento de dados pessoais no âmbito da plataforma{" "}
                {INSTITUTIONAL_CONFIG.appName} é a{" "}
                <strong>{INSTITUTIONAL_CONFIG.companyName}</strong>, pessoa jurídica de direito
                privado inscrita no CNPJ sob o nº <strong>{INSTITUTIONAL_CONFIG.cnpj}</strong>, com
                sede em {INSTITUTIONAL_CONFIG.address}.
              </>
            ) : (
              <>
                O controlador do tratamento de dados pessoais no âmbito da plataforma{" "}
                <strong>{INSTITUTIONAL_CONFIG.appName}</strong> é a pessoa natural de{" "}
                <strong>{INSTITUTIONAL_CONFIG.developerName}</strong>, desenvolvedor independente e
                responsável técnico pela aplicação, com domicílio profissional em{" "}
                {INSTITUTIONAL_CONFIG.address}.
              </>
            )}
          </p>
          <p>
            <strong>1.2. Encarregado pelo Tratamento de Dados Pessoais (DPO):</strong> Em estrito
            cumprimento ao Artigo 41 da Lei Geral de Proteção de Dados (Lei nº 13.709/2018),
            nomeamos Encarregado de Dados para atuar como canal de comunicação entre o controlador,
            os titulares de dados pessoais e a Autoridade Nacional de Proteção de Dados (ANPD). O
            contato oficial e formal com o DPO é realizado exclusivamente através do canal
            permanente:
          </p>
          <div className="p-3 rounded-xl border border-border/80 bg-surface shadow-xs flex items-center gap-3">
            <Mail className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <div className="text-xs">
              <span className="text-muted-foreground">
                E-mail do Encarregado de Proteção de Dados (DPO):
              </span>{" "}
              <a
                href={`mailto:${INSTITUTIONAL_CONFIG.dpoEmail}`}
                className="font-semibold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
              >
                {INSTITUTIONAL_CONFIG.dpoEmail}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="secao-2" className="space-y-3 border-t border-border/60 pt-6">
        <h2
          id="secao-2"
          className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2"
        >
          <FileCheck2 className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>SEÇÃO 2 — BASES LEGAIS E FINALIDADES DO TRATAMENTO (LGPD ART. 7º E 11)</span>
        </h2>
        <div className="space-y-3 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            Todo e qualquer tratamento de dados pessoais realizado pelo{" "}
            {INSTITUTIONAL_CONFIG.appName} fundamenta-se expressamente nas hipóteses autorizativas
            do Artigo 7º e Artigo 11 da LGPD:
          </p>
          <ol className="list-decimal list-inside space-y-2 pl-1 text-muted-foreground">
            <li>
              <strong className="text-foreground">
                Identificação, Autenticação e Gestão de Acesso:
              </strong>{" "}
              tratamento de nome, endereço eletrônico (e-mail) e credenciais de acesso para
              viabilizar a criação de conta, recuperação de senhas e segurança do serviço (
              <Badge variant="muted" size="xs">
                Execução de Contrato — Art. 7º, V
              </Badge>
              ).
            </li>
            <li>
              <strong className="text-foreground">Dados Financeiros e Patrimoniais:</strong>{" "}
              tratamento de registros de receitas, despesas, faturas de cartões de crédito, contratos
              de empréstimo/dívidas, limites orçamentários, ativos e posições de investimentos para
              consolidar gráficos, balanços e projeções solicitadas diretamente pelo usuário (
              <Badge variant="muted" size="xs">
                Execução de Contrato — Art. 7º, V
              </Badge>
              ).
            </li>
            <li>
              <strong className="text-foreground">
                Captura Passiva de Notificações Bancárias (Android):
              </strong>{" "}
              leitura automatizada e exclusivamente local de avisos de compras emitidos por bancos
              autorizados pelo usuário (
              <Badge variant="muted" size="xs">
                Consentimento Específico — Art. 7º, I
              </Badge>
              ).
            </li>
            <li>
              <strong className="text-foreground">Biometria e Bloqueio Local (App Lock):</strong>{" "}
              verificação de impressão digital ou reconhecimento facial gerenciada diretamente pelo
              hardware do smartphone para desbloqueio da interface (
              <Badge variant="muted" size="xs">
                Consentimento e Prevenção à Fraude — Art. 7º, IX e Art. 11, II, &quot;g&quot;
              </Badge>
              ).
            </li>
            <li>
              <strong className="text-foreground">
                Faturamento, Cobrança e Assinaturas Pro:
              </strong>{" "}
              tratamento de CPF e histórico de pagamentos nos gateways homologados (Asaas/Stripe)
              para emissão de notas fiscais e controle de assinaturas (
              <Badge variant="muted" size="xs">
                Obrigação Legal e Execução de Contrato — Art. 7º, II e V
              </Badge>
              ).
            </li>
            <li>
              <strong className="text-foreground">Registros de Acesso a Aplicações:</strong> coleta
              e armazenamento compulsório de endereço IP, data, hora (UTC) e ID de sessão (
              <Badge variant="muted" size="xs">
                Cumprimento de Obrigação Legal — Marco Civil Art. 15 e LGPD Art. 7º, II
              </Badge>
              ).
            </li>
          </ol>
        </div>
      </section>

      <section aria-labelledby="secao-3" className="space-y-3 border-t border-border/60 pt-6">
        <h2
          id="secao-3"
          className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2"
        >
          <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>SEÇÃO 3 — ARQUITETURA DE PRIVACIDADE POR DESIGN (PRIVACY BY DESIGN)</span>
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            A segurança da informação e a privacidade foram incorporadas desde a concepção
            arquitetural da plataforma, adotando salvaguardas técnicas avançadas:
          </p>
          <ul className="list-disc list-inside space-y-2 pl-1 text-muted-foreground">
            <li>
              <strong className="text-foreground">
                Isolamento Criptográfico via Row Level Security (RLS):
              </strong>{" "}
              todas as 34 tabelas do banco de dados contam com políticas ativas de isolamento em
              nível de linha atreladas estritamente a{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">
                (select auth.uid())
              </code>
              . Isso impede categoricamente que qualquer usuário ou script acesse registros
              pertencentes a outro titular.
            </li>
            <li>
              <strong className="text-foreground">
                Processamento 100% On-Device de Notificações:
              </strong>{" "}
              o motor de leitura e interpretação de notificações financeiras no aplicativo Android
              opera exclusivamente na CPU e memória RAM local do aparelho móvel. Os textos brutos de
              notificações jamais são transmitidos para a nuvem.
            </li>
            <li>
              <strong className="text-foreground">
                Proteção contra Captura de Tela (Privacy Shield):
              </strong>{" "}
              o aplicativo móvel emprega a diretiva de segurança nativa{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">
                FLAG_SECURE
              </code>
              , que impede a captura de tela (screenshots) e ofusca automaticamente a visualização de
              saldos no alternador de aplicativos do sistema operacional.
            </li>
            <li>
              <strong className="text-foreground">
                Sanitização de Telemetria e Erros (Redaction de PII):
              </strong>{" "}
              os registros de monitoramento e diagnósticos de erros (Sentry) contam com rotinas
              automáticas de filtragem que purgam senhas, dados de pagamento e mascaram números de
              CPF (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">
                [REDACTED_CPF]
              </code>
              ).
            </li>
          </ul>
        </div>
      </section>

      <PrivacyRightsAndCookiesSections />
      <PrivacySelfServiceSection />
    </LegalPageShell>
  );
}
