import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Building2,
  CheckCircle2,
  Coins,
  HelpCircle,
  Receipt,
  RotateCcw,
  Scale,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  type TabItem,
} from "@/components/ui";
import { InteractivePlaybookModal } from "@/components/modules/playbooks";
import {
  DEFAULT_MEI_ANNUAL_CEILING_CENTS,
  DEFAULT_MEI_MONTHLY_DAS_CENTS,
  DEFAULT_TAX_PROVISION_RATE_PCT,
} from "@/domain/business";
import { BUSINESS_PROFILE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import type { BusinessProfileKind, BusinessProfileSettings } from "@/types";

export interface EducationalGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectProfile?: (
    kind: BusinessProfileKind,
    suggestedSettings?: Partial<BusinessProfileSettings>,
  ) => void;
}

type QuizStep = "structure" | "revenue" | "activity" | "result";

interface QuizAnswers {
  structure: "mei" | "autonomous" | "company";
  revenue: "low" | "medium" | "high";
  activity: "services" | "regulated" | "commerce" | "trucker";
}

const INITIAL_ANSWERS: QuizAnswers = {
  structure: "mei",
  revenue: "low",
  activity: "services",
};

export function EducationalGuideModal({
  open,
  onOpenChange,
  onSelectProfile,
}: EducationalGuideModalProps) {
  const [activeTab, setActiveTab] = useState<string>("quiz");
  const [quizStep, setQuizStep] = useState<QuizStep>("structure");
  const [answers, setAnswers] = useState<QuizAnswers>(INITIAL_ANSWERS);

  const resetQuiz = () => {
    setAnswers(INITIAL_ANSWERS);
    setQuizStep("structure");
  };

  // Avaliação do Quiz
  const getRecommendation = (): {
    kind: BusinessProfileKind;
    title: string;
    subtitle: string;
    reasons: string[];
    taxExplanation: string;
    suggestedSettings: Partial<BusinessProfileSettings>;
  } => {
    // Caso 1: Caminhoneiro
    if (answers.activity === "trucker") {
      return {
        kind: "mei",
        title: "MEI Caminhoneiro",
        subtitle: "Transportador autônomo de cargas com teto diferenciado.",
        reasons: [
          "Teto anual expandido de até R$ 251.600,00.",
          "Contribuição previdenciária diferenciada no DAS mensal.",
          "Segurança jurídica e emissão de notas de frete simplificada.",
        ],
        taxExplanation:
          "DAS mensal com alíquota previdenciária de 12% sobre o salário mínimo mais ICMS/ISS.",
        suggestedSettings: {
          profileKind: "mei",
          meiSubcategory: "trucker",
          annualCeilingCents: 25160000,
          monthlyDasCents: 18500,
        },
      };
    }

    // Caso 2: Profissão Regulamentada (médico, psicólogo, arquiteto, advogado, etc.)
    if (answers.activity === "regulated") {
      if (answers.structure === "company" || answers.revenue === "high") {
        return {
          kind: "micro_business",
          title: "Microempresa (Simples Nacional / Lucro Presumido)",
          subtitle: "Profissões intelectuais e regulamentadas não podem ser MEI.",
          reasons: [
            "Atividades intelectuais ou regulamentadas por conselho de classe são vedadas ao MEI (Lei Complementar nº 123/2006).",
            "Permite dedução de despesas operacionais e emissão de pró-labore formal.",
            "Tributação via Simples Nacional (Anexo III ou V com Fator R) ou Lucro Presumido.",
          ],
          taxExplanation:
            "Recomenda-se provisionar entre 6% e 15,5% do faturamento para impostos.",
          suggestedSettings: {
            profileKind: "micro_business",
            taxProvisionRatePct: 10,
          },
        };
      }
      return {
        kind: "liberal",
        title: "Profissional Liberal / Autônomo PF",
        subtitle: "Atuação como pessoa física com Livro Caixa e Carnê-Leão.",
        reasons: [
          "Ideal para profissionais que recebem de pessoas físicas (ex.: consultas, honorários).",
          "Permite deduzir despesas indispensáveis à profissão (Livro Caixa) para abater a base do IRPF.",
          "Sem custos de contabilidade PJ obrigatória no início.",
        ],
        taxExplanation:
          "Imposto calculado pela Tabela Progressiva do IRPF via Carnê-Leão sobre o lucro líquido após despesas dedutíveis.",
        suggestedSettings: {
          profileKind: "liberal",
          taxProvisionRatePct: 15,
        },
      };
    }

    // Caso 3: Faturamento alto (> R$ 144k) ou Empresa Formal
    if (answers.revenue === "high" || answers.structure === "company") {
      return {
        kind: "micro_business",
        title: "Microempresa / Simples Nacional",
        subtitle: "Faturamento acima do teto do MEI ou estrutura societária com sócios.",
        reasons: [
          "Faturamento projetado excede o teto MEI de R$ 81.000,00 (ou o teto futuro de R$ 144.000,00 da LC nº 238/2026).",
          "Permite contratar mais de 1 funcionário e ter múltiplos sócios.",
          "DRE estruturado com lucro retido e distribuição isenta de dividendos.",
        ],
        taxExplanation:
          "Tributação no Simples Nacional conforme a tabela de faixas de faturamento acumulado dos últimos 12 meses.",
        suggestedSettings: {
          profileKind: "micro_business",
          taxProvisionRatePct: DEFAULT_TAX_PROVISION_RATE_PCT,
        },
      };
    }

    // Caso 4: Padrão MEI
    return {
      kind: "mei",
      title: "Microempreendedor Individual (MEI)",
      subtitle: "Estrutura mais enxuta, barata e protegida para empreendedores individuais.",
      reasons: [
        "Custo fixo mensal reduzido via DAS (sem surpresas de impostos variáveis).",
        "Teto anual de faturamento de R$ 81.000,00 (com monitoramento proporcional no ano de abertura).",
        "Cobertura previdenciária (aposentadoria, auxílio-doença, salário-maternidade) para o titular.",
      ],
      taxExplanation:
        "Tributação fixa mensal pelo DAS (INSS + ICMS e/ou ISS), independentemente do faturamento do mês.",
      suggestedSettings: {
        profileKind: "mei",
        monthlyDasCents: DEFAULT_MEI_MONTHLY_DAS_CENTS,
        annualCeilingCents: DEFAULT_MEI_ANNUAL_CEILING_CENTS,
      },
    };
  };

  const recommendation = getRecommendation();

  const handleApplyRecommendation = () => {
    if (onSelectProfile) {
      onSelectProfile(recommendation.kind, recommendation.suggestedSettings);
    }
    triggerSensory("success");
    onOpenChange(false);
  };

  const tabItems: TabItem[] = [
    {
      value: "quiz",
      label: "Descobrir Perfil",
      icon: <Sparkles className="size-4" aria-hidden="true" />,
      content: (
        <div className="flex flex-col gap-4 py-2">
          {quizStep === "structure" ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-portfolio">Passo 1 de 3</span>
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  Como você formaliza ou pretende formalizar seus serviços?
                </h3>
                <p className="text-xs text-muted-foreground">
                  Selecione sua situação jurídica atual ou pretendida.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {[
                  {
                    key: "mei" as const,
                    title: "Tenho ou quero abrir MEI",
                    desc: "Atuo sozinho ou com até 1 funcionário, sem sócios e com faturamento enxuto.",
                    icon: Briefcase,
                  },
                  {
                    key: "autonomous" as const,
                    title: "Autônomo / Pessoa Física",
                    desc: "Atuo com meu CPF, emitindo recibos ou RPA sem empresa formalizada.",
                    icon: Stethoscope,
                  },
                  {
                    key: "company" as const,
                    title: "Tenho Microempresa / Simples Nacional",
                    desc: "Possuo contrato social, sócios ou faturamento acima do MEI.",
                    icon: Building2,
                  },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      triggerSensory("selection");
                      setAnswers((prev) => ({ ...prev, structure: item.key }));
                      setQuizStep("revenue");
                    }}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors cursor-pointer",
                      answers.structure === item.key
                        ? "border-portfolio bg-portfolio/5"
                        : "border-border/80 bg-surface hover:bg-surface-hover",
                    )}
                  >
                    <item.icon className="size-4.5 shrink-0 text-portfolio mt-0.5" aria-hidden="true" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs sm:text-sm font-semibold text-foreground">{item.title}</span>
                      <span className="text-[11px] text-muted-foreground">{item.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : quizStep === "revenue" ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-portfolio">Passo 2 de 3</span>
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  Qual é a sua estimativa de faturamento anual?
                </h3>
                <p className="text-xs text-muted-foreground">
                  O faturamento bruto total recebido pela sua atividade antes de descontar custos.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {[
                  {
                    key: "low" as const,
                    title: "Até R$ 81.000,00 por ano",
                    desc: "Média de até R$ 6.750,00 por mês (dentro do teto clássico do MEI).",
                  },
                  {
                    key: "medium" as const,
                    title: "Entre R$ 81.000,00 e R$ 144.000,00 por ano",
                    desc: "Média entre R$ 6.750,00 e R$ 12.000,00 por mês (em faixa de transição / LC 238/2026).",
                  },
                  {
                    key: "high" as const,
                    title: "Acima de R$ 144.000,00 por ano",
                    desc: "Mais de R$ 12.000,00 por mês (requer enquadramento como ME no Simples ou Presumido).",
                  },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      triggerSensory("selection");
                      setAnswers((prev) => ({ ...prev, revenue: item.key }));
                      setQuizStep("activity");
                    }}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors cursor-pointer",
                      answers.revenue === item.key
                        ? "border-portfolio bg-portfolio/5"
                        : "border-border/80 bg-surface hover:bg-surface-hover",
                    )}
                  >
                    <Coins className="size-4.5 shrink-0 text-portfolio mt-0.5" aria-hidden="true" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs sm:text-sm font-semibold text-foreground">{item.title}</span>
                      <span className="text-[11px] text-muted-foreground">{item.desc}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex justify-start pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuizStep("structure")}
                  className="text-xs gap-1"
                >
                  Voltar ao passo anterior
                </Button>
              </div>
            </div>
          ) : quizStep === "activity" ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-portfolio">Passo 3 de 3</span>
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  Qual é o ramo principal da sua atividade?
                </h3>
                <p className="text-xs text-muted-foreground">
                  Algumas profissões intelectuais possuem restrição legal para ser MEI.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {[
                  {
                    key: "services" as const,
                    title: "Serviços Gerais, Técnicos ou Digitais",
                    desc: "Desenvolvimento web, design, marketing, reparos, cabeleireiro, aulas, etc.",
                    icon: Briefcase,
                  },
                  {
                    key: "regulated" as const,
                    title: "Profissão Regulamentada / Conselho de Classe",
                    desc: "Médico, psicólogo, dentista, advogado, arquiteto, engenheiro, nutricionista.",
                    icon: Stethoscope,
                  },
                  {
                    key: "commerce" as const,
                    title: "Comércio ou Venda de Mercadorias",
                    desc: "Loja física ou virtual, revenda de produtos, artesanato ou confecção.",
                    icon: Receipt,
                  },
                  {
                    key: "trucker" as const,
                    title: "Transportador Autônomo de Cargas",
                    desc: "Frete rodoviário de cargas com veículo próprio (enquadramento MEI Caminhoneiro).",
                    icon: Building2,
                  },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      triggerSensory("selection");
                      setAnswers((prev) => ({ ...prev, activity: item.key }));
                      setQuizStep("result");
                    }}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors cursor-pointer",
                      answers.activity === item.key
                        ? "border-portfolio bg-portfolio/5"
                        : "border-border/80 bg-surface hover:bg-surface-hover",
                    )}
                  >
                    <item.icon className="size-4.5 shrink-0 text-portfolio mt-0.5" aria-hidden="true" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs sm:text-sm font-semibold text-foreground">{item.title}</span>
                      <span className="text-[11px] text-muted-foreground">{item.desc}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex justify-start pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuizStep("revenue")}
                  className="text-xs gap-1"
                >
                  Voltar ao passo anterior
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Card className="border-portfolio/30 bg-portfolio/5 shadow-xs">
                <CardContent className="p-4 sm:p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="portfolio" size="sm">
                      Perfil Recomendado
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={resetQuiz}
                      className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="size-3" aria-hidden="true" />
                      Refazer teste
                    </Button>
                  </div>

                  <div>
                    <h4 className="text-base sm:text-lg font-bold text-foreground">
                      {recommendation.title}
                    </h4>
                    <p className="text-xs text-muted-foreground">{recommendation.subtitle}</p>
                  </div>

                  <div className="flex flex-col gap-1.5 pt-1">
                    <span className="text-xs font-semibold text-foreground">
                      Por que este perfil foi sugerido:
                    </span>
                    <ul className="space-y-1">
                      {recommendation.reasons.map((reason, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="size-3.5 shrink-0 text-portfolio mt-0.5" aria-hidden="true" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-lg bg-surface border border-border/80 p-3 flex flex-col gap-1">
                    <span className="text-xs font-semibold text-foreground">Regra Fiscal & Impostos:</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {recommendation.taxExplanation}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {onSelectProfile ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleApplyRecommendation}
                    className="gap-2 shadow-xs"
                  >
                    <span>Configurar como {BUSINESS_PROFILE_LABELS[recommendation.kind]}</span>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ),
    },
    {
      value: "separation",
      label: "PF × PJ na Prática",
      icon: <Scale className="size-4" aria-hidden="true" />,
      content: (
        <div className="flex flex-col gap-4 py-2 text-xs text-muted-foreground leading-relaxed">
          <div className="rounded-xl border border-border/80 bg-surface p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
              <ShieldCheck className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
              <span>A Regra de Ouro: Nunca misture contas bancárias</span>
            </div>
            <p>
              O erro mais comum do empreendedor é pagar supermercado ou despesas de casa com o dinheiro
              da empresa. Isso destrói a clareza do seu fluxo de caixa e pode gerar problemas com a Receita
              Federal (confusão patrimonial).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex flex-col gap-1.5">
              <span className="font-semibold text-foreground text-xs">Pró-labore (PJ &rarr; PF)</span>
              <p>
                É o seu &ldquo;salário&rdquo; como dono. Você transfere um valor fixo mensal da conta do
                negócio para sua conta pessoal. No app, registre como <strong>Transferência PF/PJ</strong> (tipo Pró-labore).
              </p>
            </div>

            <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex flex-col gap-1.5">
              <span className="font-semibold text-foreground text-xs">Aporte de Capital (PF &rarr; PJ)</span>
              <p>
                Quando você injeta dinheiro do seu bolso pessoal para abrir a empresa ou cobrir um período
                difícil. No app, entra como aumento de Caixa sem inflar a receita de vendas.
              </p>
            </div>

            <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex flex-col gap-1.5">
              <span className="font-semibold text-foreground text-xs">Reembolso de Cartão PF</span>
              <p>
                Comprou um equipamento da empresa no seu cartão de crédito pessoal? O Axir marca para
                reembolso. Quando a empresa te transferir de volta, o caixa é ajustado sem duplicidade.
              </p>
            </div>

            <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex flex-col gap-1.5">
              <span className="font-semibold text-foreground text-xs">Despesas Mistas (50/50)</span>
              <p>
                Conta de internet da sua casa que você também usa para trabalhar? Divida o lançamento
                em 50% pessoal e 50% operacional no Assistente com 1 clique.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      value: "deductible",
      label: "Despesas Dedutíveis",
      icon: <Receipt className="size-4" aria-hidden="true" />,
      content: (
        <div className="flex flex-col gap-4 py-2 text-xs text-muted-foreground leading-relaxed">
          <p>
            Despesas dedutíveis são aquelas necessárias para a execução do seu trabalho. Elas reduzem o
            lucro contábil ou abatem a base do Imposto de Renda no Livro Caixa (para autônomos).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-positive/30 bg-positive/5 p-3.5 flex flex-col gap-2">
              <span className="font-semibold text-positive-strong text-xs flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                Despesas Dedutíveis do Negócio
              </span>
              <ul className="space-y-1 list-disc list-inside">
                <li>Aluguel de consultório ou coworking</li>
                <li>Insumos e materiais de trabalho</li>
                <li>Softwares e licenças profissionais</li>
                <li>Internet e telefone (proporcional)</li>
                <li>Cursos e capacitações da área</li>
                <li>Anuidade de conselho profissional (CRM, CRP, OAB)</li>
              </ul>
            </div>

            <div className="rounded-xl border border-critical/30 bg-critical/5 p-3.5 flex flex-col gap-2">
              <span className="font-semibold text-critical-strong text-xs flex items-center gap-1.5">
                <HelpCircle className="size-3.5" aria-hidden="true" />
                Gastos que NÃO são da Empresa
              </span>
              <ul className="space-y-1 list-disc list-inside">
                <li>Supermercado e alimentação doméstica</li>
                <li>Roupas de uso pessoal</li>
                <li>Lazer, viagens e entretenimento</li>
                <li>Combustível para passeios da família</li>
                <li>Plano de saúde pessoal (declara-se no IRPF)</li>
                <li>Mensalidade escolar de filhos</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      value: "axir_shield",
      label: "Como o Axir te Protege",
      icon: <BookOpen className="size-4" aria-hidden="true" />,
      content: (
        <div className="flex flex-col gap-4 py-2 text-xs text-muted-foreground leading-relaxed">
          <div className="rounded-xl border border-border/80 bg-surface p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
              <ShieldCheck className="size-4 text-portfolio shrink-0" aria-hidden="true" />
              <span>Blindagem Patrimonial no App</span>
            </div>
            <p>
              O Axir foi desenhado para quem tem uma única conta bancária ou quer gerenciar tudo no mesmo lugar
              sem cometer erros contábeis clássicos.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="flex flex-col gap-1 border-t sm:border-t-0 sm:border-l border-border/80 pt-2 sm:pt-0 sm:pl-3">
                <span className="font-semibold text-foreground">1. Safe-to-Spend Pessoal</span>
                <p>
                  O saldo da PJ na conta bancária compartilhada é descontado do seu saldo livre para gastar na Home,
                  impedindo que você gaste o capital de giro da empresa em compras pessoais.
                </p>
              </div>
              <div className="flex flex-col gap-1 border-t sm:border-t-0 sm:border-l border-border/80 pt-2 sm:pt-0 sm:pl-3">
                <span className="font-semibold text-foreground">2. Reserva Doméstica</span>
                <p>
                  Sua Reserva de Emergência e Taxa de Poupança são calculadas exclusivamente sobre as despesas da
                  sua família, ignorando oscilações de custos da empresa.
                </p>
              </div>
              <div className="flex flex-col gap-1 border-t sm:border-t-0 sm:border-l border-border/80 pt-2 sm:pt-0 sm:pl-3">
                <span className="font-semibold text-foreground">3. Teto MEI Pro-Rata</span>
                <p>
                  Se abriu seu MEI no meio do ano, o termômetro calcula exatamente quantos meses você tem de limite
                  (R$ 6.750/mês), alertando antes de você desenquadrar.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <InteractivePlaybookModal
      open={open}
      onOpenChange={onOpenChange}
      moduleKey="business"
      title="Guia do Empreendedor & Enquadramento"
      description="Descubra seu perfil ideal e entenda as regras fiscais sem complicação contábil."
      tabs={tabItems}
      defaultTab={activeTab}
    />
  );
}
