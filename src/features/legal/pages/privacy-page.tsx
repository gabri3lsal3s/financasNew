import {
  ShieldCheck,
  Lock,
  Database,
  Cpu,
  Trash2,
  FileText,
  Cookie,
  UserCheck,
  Mail,
  Server,
  FileCheck2,
} from "lucide-react";
import { Link } from "react-router";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { LegalPageShell } from "@/features/legal/components";
import { INSTITUTIONAL_CONFIG } from "@/lib/institutional";

/**
 * Página pública de Política de Privacidade e Proteção de Dados (LGPD) do Áxis Finance.
 *
 * Materializa o Contrato 2 integralmente, em conformidade com:
 * - Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD)
 * - Marco Civil da Internet (Lei nº 12.965/2014 — Art. 15) e Decreto nº 8.771/2016
 * - Diretrizes de Privacidade da ANPD (Autoridade Nacional de Proteção de Dados)
 * - Requisitos de Privacidade Google Play Store e Apple App Store
 */
export function PrivacyPage() {
  return (
    <LegalPageShell
      activeTab="privacy"
      title="Política de Privacidade e Proteção de Dados (LGPD)"
      description="Diretrizes de transparência, bases legais, medidas de segurança, direitos dos titulares e procedimentos de descarte de dados do Áxis Finance em estrita conformidade com a Lei nº 13.709/2018."
      lastUpdated="23 de Outubro de 2026"
      version="2.0"
    >
      {/* Bloco de Destaques da Privacidade */}
      <section aria-labelledby="secao-destaques-privacidade" className="not-prose">
        <h2 id="secao-destaques-privacidade" className="sr-only">
          Pilares da Política de Privacidade
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-border/80 bg-surface shadow-xs">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>Canal do DPO</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Canal formal permanente com o Encarregado de Dados, com resposta legal em até 15 dias.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>Privacy by Design</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Isolamento via Row Level Security (RLS) nas 34 tabelas e criptografia de ponta a ponta.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                <Cpu className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>100% On-Device</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Leitura passiva de notificações bancárias processada puramente no processador do celular.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                <Trash2 className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>Direito ao Esquecimento</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Exclusão definitiva de conta em 1 clique na plataforma com purga de dados em cascata.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* SEÇÃO 1 */}
      <section aria-labelledby="secao-1" className="space-y-3 pt-2">
        <h2 id="secao-1" className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
          <UserCheck className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>SEÇÃO 1 — IDENTIFICAÇÃO DO CONTROLADOR E DO ENCARREGADO (DPO)</span>
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>1.1. Identificação do Controlador:</strong> O controlador do tratamento de dados pessoais no âmbito da plataforma {INSTITUTIONAL_CONFIG.appName} é a <strong>{INSTITUTIONAL_CONFIG.companyName}</strong>, pessoa jurídica de direito privado inscrita no CNPJ sob o nº <strong>{INSTITUTIONAL_CONFIG.cnpj}</strong>, com sede em {INSTITUTIONAL_CONFIG.address}.
          </p>
          <p>
            <strong>1.2. Encarregado pelo Tratamento de Dados Pessoais (DPO):</strong> Em estrito cumprimento ao Artigo 41 da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), nomeamos Encarregado de Dados para atuar como canal de comunicação entre o controlador, os titulares de dados pessoais e a Autoridade Nacional de Proteção de Dados (ANPD). O contato oficial e formal com o DPO é realizado exclusivamente através do canal permanente:
          </p>
          <div className="p-3 rounded-xl border border-border/80 bg-surface/80 flex items-center gap-3">
            <Mail className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <div className="text-xs">
              <span className="text-muted-foreground">E-mail do Encarregado de Proteção de Dados (DPO):</span>{" "}
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

      {/* SEÇÃO 2 */}
      <section aria-labelledby="secao-2" className="space-y-3 border-t border-border/60 pt-6">
        <h2 id="secao-2" className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
          <FileCheck2 className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>SEÇÃO 2 — BASES LEGAIS E FINALIDADES DO TRATAMENTO (LGPD ART. 7º E 11)</span>
        </h2>
        <div className="space-y-3 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            Todo e qualquer tratamento de dados pessoais realizado pelo {INSTITUTIONAL_CONFIG.appName} fundamenta-se expressamente nas hipóteses autorizativas do Artigo 7º e Artigo 11 da LGPD:
          </p>
          <ol className="list-decimal list-inside space-y-2 pl-1 text-muted-foreground">
            <li>
              <strong className="text-foreground">Identificação, Autenticação e Gestão de Acesso:</strong> tratamento de nome, endereço eletrônico (e-mail) e credenciais de acesso para viabilizar a criação de conta, recuperação de senhas e segurança do serviço (<Badge variant="muted" size="xs">Execução de Contrato — Art. 7º, V</Badge>).
            </li>
            <li>
              <strong className="text-foreground">Dados Financeiros e Patrimoniais:</strong> tratamento de registros de receitas, despesas, faturas de cartões de crédito, contratos de empréstimo/dívidas, limites orçamentários, ativos e posições de investimentos para consolidar gráficos, balanços e projeções solicitadas diretamente pelo usuário (<Badge variant="muted" size="xs">Execução de Contrato — Art. 7º, V</Badge>).
            </li>
            <li>
              <strong className="text-foreground">Captura Passiva de Notificações Bancárias (Android):</strong> leitura automatizada e exclusivamente local de avisos de compras emitidos por bancos autorizados pelo usuário (<Badge variant="muted" size="xs">Consentimento Específico — Art. 7º, I</Badge>).
            </li>
            <li>
              <strong className="text-foreground">Biometria e Bloqueio Local (App Lock):</strong> verificação de impressão digital ou reconhecimento facial gerenciada diretamente pelo hardware do smartphone para desbloqueio da interface (<Badge variant="muted" size="xs">Consentimento e Prevenção à Fraude — Art. 7º, IX e Art. 11, II, &quot;g&quot;</Badge>).
            </li>
            <li>
              <strong className="text-foreground">Faturamento, Cobrança e Assinaturas Pro:</strong> tratamento de CPF e histórico de pagamentos nos gateways homologados (Asaas/Stripe) para emissão de notas fiscais e controle de assinaturas (<Badge variant="muted" size="xs">Obrigação Legal e Execução de Contrato — Art. 7º, II e V</Badge>).
            </li>
            <li>
              <strong className="text-foreground">Registros de Acesso a Aplicações:</strong> coleta e armazenamento compulsório de endereço IP, data, hora (UTC) e ID de sessão (<Badge variant="muted" size="xs">Cumprimento de Obrigação Legal — Marco Civil Art. 15 e LGPD Art. 7º, II</Badge>).
            </li>
          </ol>
        </div>
      </section>

      {/* SEÇÃO 3 */}
      <section aria-labelledby="secao-3" className="space-y-3 border-t border-border/60 pt-6">
        <h2 id="secao-3" className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
          <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>SEÇÃO 3 — ARQUITETURA DE PRIVACIDADE POR DESIGN (PRIVACY BY DESIGN)</span>
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            A segurança da informação e a privacidade foram incorporadas desde a concepção arquitetural da plataforma, adotando salvaguardas técnicas avançadas:
          </p>
          <ul className="list-disc list-inside space-y-2 pl-1 text-muted-foreground">
            <li>
              <strong className="text-foreground">Isolamento Criptográfico via Row Level Security (RLS):</strong> todas as 34 tabelas do banco de dados contam com políticas ativas de isolamento em nível de linha atreladas estritamente a <code>(select auth.uid())</code>. Isso impede categoricamente que qualquer usuário ou script acesse registros pertencentes a outro titular.
            </li>
            <li>
              <strong className="text-foreground">Processamento 100% On-Device de Notificações:</strong> o motor de leitura e interpretação de notificações financeiras no aplicativo Android opera exclusivamente na CPU e memória RAM local do aparelho móvel. Os textos brutos de notificações jamais são transmitidos para a nuvem.
            </li>
            <li>
              <strong className="text-foreground">Proteção contra Captura de Tela (Privacy Shield):</strong> o aplicativo móvel emprega a diretiva de segurança nativa <code>FLAG_SECURE</code>, que impede a captura de tela (screenshots) e ofusca automaticamente a visualização de saldos no alternador de aplicativos do sistema operacional.
            </li>
            <li>
              <strong className="text-foreground">Sanitização de Telemetria e Erros (Redaction de PII):</strong> os registros de monitoramento e diagnósticos de erros (Sentry) contam com rotinas automáticas de filtragem que purgam senhas, dados de pagamento e mascaram números de CPF (<code>[REDACTED_CPF]</code>).
            </li>
          </ul>
        </div>
      </section>

      {/* SEÇÃO 4 */}
      <section aria-labelledby="secao-4" className="space-y-3 border-t border-border/60 pt-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 id="secao-4" className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
            <Database className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>SEÇÃO 4 — DOS DIREITOS DO TITULAR DE DADOS (LGPD ART. 18)</span>
          </h2>
          <Badge variant="positive" size="sm">
            Garantia LGPD Art. 18
          </Badge>
        </div>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            O titular de dados pessoais possui direitos fundamentais assegurados pelo Artigo 18 da LGPD, os quais podem ser exercidos a qualquer momento mediante requisição formal:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-1 text-muted-foreground">
            <li>Confirmação da existência de tratamento e acesso facilitado aos dados;</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos;</li>
            <li>Portabilidade dos dados a outro fornecedor em formatos interoperáveis e abertos (.csv e .json);</li>
            <li>Eliminação definitiva dos dados tratados com base no consentimento;</li>
            <li>Informação sobre as entidades com as quais o controlador compartilhou dados;</li>
            <li>Informação sobre a possibilidade de não fornecer consentimento e sobre as consequências da negativa;</li>
            <li>Revogação expressa do consentimento a qualquer tempo.</li>
          </ul>
          <p className="mt-2 text-muted-foreground">
            As requisições serão respondidas prontamente em formato simplificado, ou por meio de declaração clara e completa no prazo improrrogável de <strong>até 15 (quinze) dias</strong> a contar da solicitação do titular (LGPD Art. 19, II).
          </p>
        </div>
      </section>

      {/* SEÇÃO 5 */}
      <section id="exclusao" aria-labelledby="secao-5" className="space-y-3 border-t border-border/60 pt-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 id="secao-5" className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
            <Trash2 className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>SEÇÃO 5 — DO DIREITO AO ESQUECIMENTO E RETENÇÃO LEGAL COMPULSÓRIA</span>
          </h2>
          <Badge variant="critical" size="sm">
            Exclusão Definitiva
          </Badge>
        </div>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            <strong>5.1. Autoatendimento de Exclusão de Conta:</strong> Em cumprimento aos princípios da autodeterminação informativa e do direito ao esquecimento (LGPD Art. 18, VI) e às diretrizes obrigatórias da Google Play Store e Apple App Store, o usuário poderá a qualquer momento solicitar o encerramento de sua conta e a destruição integral de seus dados diretamente na aba &quot;Segurança&quot; das Configurações do aplicativo ou através do painel de autoatendimento nesta página.
          </p>
          <p>
            <strong>5.2. Efeito do Expurgo em Cascata:</strong> O acionamento do procedimento de exclusão dispara rotinas transacionais no banco de dados que eliminam de forma irrevogável e definitiva todo o histórico financeiro, orçamentos, cartões, dívidas, proventos, notas fiscais e credenciais associadas.
          </p>
          <p>
            <strong>5.3. Retenção Compulsoria sob o Marco Civil da Internet:</strong> Nos termos autorizados pelo Artigo 16, I da LGPD, a plataforma é legalmente obrigada a conservar sob sigilo absoluto e em ambiente restrito e controlado os registros técnicos de conexão e acesso a aplicações de internet (endereço IP, data e hora UTC de conexão e IDs de sessão) pelo prazo improrrogável de <strong>6 (seis) meses</strong>, em cumprimento estrito ao Artigo 15 da Lei Federal nº 12.965/2014 (Marco Civil da Internet), procedendo-se ao descarte automático e definitivo findo este intervalo.
          </p>
        </div>
      </section>

      {/* SEÇÃO 6 */}
      <section aria-labelledby="secao-6" className="space-y-3 border-t border-border/60 pt-6">
        <h2 id="secao-6" className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
          <Cookie className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>SEÇÃO 6 — POLÍTICA DE COOKIES E DADOS LOCAIS</span>
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
          <p>
            O {INSTITUTIONAL_CONFIG.appName} utiliza unicamente armazenamento local (<code>localStorage</code> e cookies técnicos essenciais) estritamente necessários à autenticação, manutenção da sessão de login criptografada, prevenção contra ataques CSRF e preferências visuais de interface (tema claro/escuro e paleta de cores).
          </p>
          <p>
            A plataforma <strong>não comercializa dados de seus usuários com terceiros e não utiliza cookies de publicidade comportamental ou rastreadores de anúncios invasivos</strong>.
          </p>
        </div>
      </section>

      {/* SEÇÃO 7 — AUTOATENDIMENTO DO TITULAR E DPO */}
      <section aria-labelledby="secao-7" className="space-y-4 border-t border-border/60 pt-6 not-prose">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 id="secao-7" className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
            <Server className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>SEÇÃO 7 — CANAL DE AUTOATENDIMENTO DO TITULAR E CONTATO DO DPO</span>
          </h2>
          <Badge variant="default" size="sm">
            Autoatendimento
          </Badge>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Disponibilizamos atalhos diretos para que você exerça seus direitos garantidos pela LGPD sem intermediários ou formulários burocráticos:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="border-border/80 bg-surface shadow-xs">
            <CardContent className="p-4 flex flex-col justify-between h-full gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                  <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span>Portabilidade de Dados</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Exporte todo o seu histórico financeiro e patrimonial em formato estruturado (.csv e .json).
                </p>
              </div>
              <Link to="/relatorios">
                <Button variant="outline" size="sm" className="w-full text-xs cursor-pointer">
                  Exportar Meus Dados
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardContent className="p-4 flex flex-col justify-between h-full gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                  <Trash2 className="size-4 text-critical-strong" aria-hidden="true" />
                  <span>Excluir Minha Conta</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Acesse a Zona de Perigo nas Configurações para realizar o expurgo definitivo dos dados.
                </p>
              </div>
              <Link to="/configuracoes">
                <Button variant="outline" size="sm" className="w-full text-xs text-critical-strong hover:text-critical-strong cursor-pointer">
                  Gerenciar Exclusão
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardContent className="p-4 flex flex-col justify-between h-full gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                  <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span>Falar com o DPO</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Envie requerimento formal com o assunto &quot;[LGPD] Requisição de Direitos do Titular&quot;.
                </p>
              </div>
              <a href={`mailto:${INSTITUTIONAL_CONFIG.dpoEmail}?subject=%5BLGPD%5D%20Requisicao%20de%20Direitos%20do%20Titular`}>
                <Button variant="outline" size="sm" className="w-full text-xs cursor-pointer">
                  Enviar Requerimento
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </section>
    </LegalPageShell>
  );
}
