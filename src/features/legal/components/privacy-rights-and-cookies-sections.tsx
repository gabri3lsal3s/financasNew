import { Cookie, Database, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui";
import { INSTITUTIONAL_CONFIG } from "@/lib/institutional";

export function PrivacyRightsAndCookiesSections() {
  return (
    <>
      <section aria-labelledby="secao-4" className="space-y-3 border-t border-border/60 pt-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2
            id="secao-4"
            className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2"
          >
            <Database className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>SEÇÃO 4 — DOS DIREITOS DO TITULAR DE DADOS (LGPD ART. 18)</span>
          </h2>
          <Badge variant="positive" size="sm">
            Garantia LGPD Art. 18
          </Badge>
        </div>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            O titular de dados pessoais possui direitos fundamentais assegurados pelo Artigo 18 da
            LGPD, os quais podem ser exercidos a qualquer momento mediante requisição formal:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-1 text-muted-foreground">
            <li>Confirmação da existência de tratamento e acesso facilitado aos dados;</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos;</li>
            <li>
              Portabilidade dos dados a outro fornecedor em formatos interoperáveis e abertos (.csv,
              .xlsx e PDF);
            </li>
            <li>Eliminação definitiva dos dados tratados com base no consentimento;</li>
            <li>Informação sobre as entidades com as quais o controlador compartilhou dados;</li>
            <li>
              Informação sobre a possibilidade de não fornecer consentimento e sobre as
              consequências da negativa;
            </li>
            <li>Revogação expressa do consentimento a qualquer tempo.</li>
          </ul>
          <p className="mt-2 text-muted-foreground">
            As requisições serão respondidas prontamente em formato simplificado, ou por meio de
            declaração clara e completa no prazo improrrogável de <strong>até 15 (quinze) dias</strong>{" "}
            a contar da solicitação do titular (LGPD Art. 19, II).
          </p>
        </div>
      </section>

      <section
        id="exclusao"
        aria-labelledby="secao-5"
        className="space-y-3 border-t border-border/60 pt-6"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2
            id="secao-5"
            className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2"
          >
            <Trash2 className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>SEÇÃO 5 — DO DIREITO AO ESQUECIMENTO E RETENÇÃO LEGAL COMPULSÓRIA</span>
          </h2>
          <Badge variant="critical" size="sm">
            Exclusão Definitiva
          </Badge>
        </div>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>5.1. Autoatendimento de Exclusão de Conta:</strong> Em cumprimento aos princípios
            da autodeterminação informativa e do direito ao esquecimento (LGPD Art. 18, VI) e às
            diretrizes obrigatórias da Google Play Store e Apple App Store, o usuário poderá a
            qualquer momento solicitar o encerramento de sua conta e a destruição integral de seus
            dados diretamente na aba &quot;Dados &amp; Privacidade&quot; das Configurações do
            aplicativo ou através do painel de autoatendimento nesta página.
          </p>
          <p>
            <strong>5.2. Efeito do Expurgo em Cascata:</strong> O acionamento do procedimento de
            exclusão dispara rotinas transacionais no banco de dados que eliminam de forma
            irrevogável e definitiva todo o histórico financeiro, orçamentos, cartões, dívidas,
            proventos, notas fiscais e credenciais associadas.
          </p>
          <p>
            <strong>5.3. Retenção Compulsória sob o Marco Civil da Internet:</strong> Nos termos
            autorizados pelo Artigo 16, I da LGPD, a plataforma é legalmente obrigada a conservar
            sob sigilo absoluto e em ambiente restrito e controlado os registros técnicos de conexão
            e acesso a aplicações de internet (endereço IP, data e hora UTC de conexão e IDs de
            sessão) pelo prazo improrrogável de <strong>6 (seis) meses</strong>, em cumprimento
            estrito ao Artigo 15 da Lei Federal nº 12.965/2014 (Marco Civil da Internet),
            procedendo-se ao descarte automático e definitivo findo este intervalo.
          </p>
        </div>
      </section>

      <section aria-labelledby="secao-6" className="space-y-3 border-t border-border/60 pt-6">
        <h2
          id="secao-6"
          className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2"
        >
          <Cookie className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>SEÇÃO 6 — POLÍTICA DE COOKIES E DADOS LOCAIS</span>
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            O {INSTITUTIONAL_CONFIG.appName} utiliza unicamente armazenamento local (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">
              localStorage
            </code>{" "}
            e cookies técnicos essenciais) estritamente necessários à autenticação, manutenção da
            sessão de login criptografada, prevenção contra ataques CSRF e preferências visuais de
            interface (tema claro/escuro e paleta de cores).
          </p>
          <p>
            A plataforma{" "}
            <strong>
              não comercializa dados de seus usuários com terceiros e não utiliza cookies de
              publicidade comportamental ou rastreadores de anúncios invasivos
            </strong>
            .
          </p>
        </div>
      </section>
    </>
  );
}
