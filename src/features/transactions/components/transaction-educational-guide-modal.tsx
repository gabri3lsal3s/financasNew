import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  FileSpreadsheet,
  HelpCircle,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Wallet,
  XCircle,
} from "lucide-react";
import { Badge, Button, Card, CardContent, type TabItem } from "@/components/ui";
import { InteractivePlaybookModal } from "@/components/modules/playbooks";
import {
  evaluateTransactionQuiz,
  INITIAL_TRANSACTION_QUIZ_ANSWERS,
  type TransactionQuizAnswers,
  type TransactionQuizFrequency,
  type TransactionQuizPaymentMethod,
} from "@/domain/playbooks/transaction-playbook";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";

export interface TransactionEducationalGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenImport?: () => void;
  onOpenPixScanner?: () => void;
  onOpenNewTransaction?: () => void;
}

type QuizStep = "frequency" | "payment" | "result";

export function TransactionEducationalGuideModal({
  open,
  onOpenChange,
  onOpenImport,
  onOpenPixScanner,
  onOpenNewTransaction,
}: TransactionEducationalGuideModalProps) {
  const [quizStep, setQuizStep] = useState<QuizStep>("frequency");
  const [answers, setAnswers] = useState<TransactionQuizAnswers>(
    INITIAL_TRANSACTION_QUIZ_ANSWERS,
  );
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const recommendation = evaluateTransactionQuiz(answers);

  const resetQuiz = () => {
    triggerSensory("selection");
    setAnswers(INITIAL_TRANSACTION_QUIZ_ANSWERS);
    setQuizStep("frequency");
  };

  const handleApplyCta = () => {
    triggerSensory("success");
    onOpenChange(false);
    if (recommendation.ctaType === "import_statement" && onOpenImport) {
      onOpenImport();
    } else if (recommendation.ctaType === "scan_pix" && onOpenPixScanner) {
      onOpenPixScanner();
    } else if (recommendation.ctaType === "new_transaction" && onOpenNewTransaction) {
      onOpenNewTransaction();
    }
  };

  const tabs: TabItem[] = [
    {
      value: "quiz",
      label: "Rotina Ideal",
      icon: <Sparkles className="size-4" aria-hidden="true" />,
      content: (
        <div className="flex flex-col gap-4 py-2">
          {quizStep === "frequency" ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-primary">Passo 1 de 2</span>
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  Com que frequência você prefere registrar seus gastos?
                </h3>
                <p className="text-xs text-muted-foreground">
                  Escolha o ritmo que cabe na sua rotina real sem te sobrecarregar.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {[
                  {
                    key: "realtime" as TransactionQuizFrequency,
                    title: "No momento da compra (Tempo real)",
                    desc: "Registro instantâneo em 5 segundos logo após passar o cartão ou fazer o Pix.",
                    icon: Clock,
                  },
                  {
                    key: "weekly" as TransactionQuizFrequency,
                    title: "Uma vez por semana (Final de semana)",
                    desc: "Revisão tranquila de 5 minutos para conferir faturas e saldo do extrato.",
                    icon: Calendar,
                  },
                  {
                    key: "monthly" as TransactionQuizFrequency,
                    title: "Uma vez por mês (Fechamento de contas)",
                    desc: "Importação consolidada da fatura e conciliação bancária de uma só vez.",
                    icon: FileSpreadsheet,
                  },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      triggerSensory("selection");
                      setAnswers((prev) => ({ ...prev, frequency: item.key }));
                      setQuizStep("payment");
                    }}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors cursor-pointer",
                      answers.frequency === item.key
                        ? "border-primary bg-primary/5"
                        : "border-border/80 bg-surface hover:bg-surface-hover",
                    )}
                  >
                    <item.icon className="size-4.5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs sm:text-sm font-semibold text-foreground">{item.title}</span>
                      <span className="text-[11px] text-muted-foreground">{item.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : quizStep === "payment" ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-primary">Passo 2 de 2</span>
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  Qual é a forma de pagamento que você mais usa no dia a dia?
                </h3>
                <p className="text-xs text-muted-foreground">
                  Isso ajuda a apontar a ferramenta de automação mais rápida para o seu perfil.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {[
                  {
                    key: "credit_card" as TransactionQuizPaymentMethod,
                    title: "Quase tudo no Cartão de Crédito",
                    desc: "Uso cartão para mercado, farmácia, transporte e assinaturas recorrentes.",
                    icon: CreditCard,
                  },
                  {
                    key: "pix_debit" as TransactionQuizPaymentMethod,
                    title: "Muito Pix e Débito no dia a dia",
                    desc: "Transfiro direto da conta corrente para comércio, feira e prestadores.",
                    icon: QrCode,
                  },
                  {
                    key: "mixed" as TransactionQuizPaymentMethod,
                    title: "Misto (Cartão, Pix, Boleto e Dinheiro)",
                    desc: "Uso várias formas diferentes e preciso de um fluxo equilibrado.",
                    icon: Wallet,
                  },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      triggerSensory("selection");
                      setAnswers((prev) => ({ ...prev, paymentMethod: item.key }));
                      setQuizStep("result");
                    }}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors cursor-pointer",
                      answers.paymentMethod === item.key
                        ? "border-primary bg-primary/5"
                        : "border-border/80 bg-surface hover:bg-surface-hover",
                    )}
                  >
                    <item.icon className="size-4.5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
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
                  onClick={() => setQuizStep("frequency")}
                  className="text-xs gap-1"
                >
                  Voltar ao passo anterior
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Card className="border-primary/30 bg-primary/5 shadow-xs">
                <CardContent className="p-4 sm:p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="default" size="sm">
                      Rotina Sugerida
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
                      Por que este fluxo é mais leve para você:
                    </span>
                    <ul className="space-y-1">
                      {recommendation.reasons.map((reason, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="size-3.5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-lg bg-surface border border-border/80 p-3 flex flex-col gap-1">
                    <span className="text-xs font-semibold text-foreground">Conselho de Rotina:</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {recommendation.routineAdvice}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleApplyCta}
                  className="gap-2 shadow-xs"
                >
                  <span>{recommendation.ctaLabel}</span>
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      value: "start_today",
      label: "Comece de Hoje",
      icon: <Clock className="size-4" aria-hidden="true" />,
      content: (
        <div className="flex flex-col gap-4 py-2 text-xs text-muted-foreground leading-relaxed">
          <div className="rounded-xl border border-positive/30 bg-positive/5 p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
              <CheckCircle2 className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
              <span>A Regra do Marco Zero: Esqueça o passado</span>
            </div>
            <p>
              O maior erro de quem começa um aplicativo financeiro é tentar cadastrar extratos e notas fiscais de
              meses atrás. Isso gera cansaço mental imediato e quase sempre leva à desistência em poucos dias.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex flex-col gap-1.5">
              <span className="font-semibold text-foreground text-xs">1. Saldo de Hoje</span>
              <p>
                Abra o aplicativo do seu banco, veja o saldo atual disponível e informe esse valor exato no Axir.
                Não precisa justificar de onde veio.
              </p>
            </div>

            <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex flex-col gap-1.5">
              <span className="font-semibold text-foreground text-xs">2. Registro do Presente</span>
              <p>
                A partir de hoje, cada novo café, mercado ou almoço entra no app. O que passou já aconteceu; o seu
                controle financeiro começa no presente.
              </p>
            </div>

            <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex flex-col gap-1.5">
              <span className="font-semibold text-foreground text-xs">3. Sem Culpa por Trocos</span>
              <p>
                Esqueceu de anotar um troco de R$ 3,00? Sem pânico. Mantenha o hábito dos gastos relevantes; a
                perfeição não é necessária para ter paz financeira.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      value: "clarity",
      label: "Categoria × Descrição",
      icon: <BookOpen className="size-4" aria-hidden="true" />,
      content: (
        <div className="flex flex-col gap-4 py-2 text-xs text-muted-foreground leading-relaxed">
          <p>
            A inteligência do Axir depende da separação entre o que o motor estatístico precisa e o que serve para
            a sua memória.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-positive/30 bg-positive/5 p-3.5 flex flex-col gap-2">
              <span className="font-semibold text-positive-strong text-xs flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                O Jeito Claro e Eficiente
              </span>
              <ul className="space-y-1.5">
                <li>
                  <strong>Categoria forte:</strong> Selecione <em>Alimentação</em>, <em>Transporte</em> ou <em>Saúde</em>. É ela que alimenta seus gráficos e orçamentos.
                </li>
                <li>
                  <strong>Descrição enxuta:</strong> Escreva apenas o local em 2 ou 3 palavras (ex.: <em>Padaria Estrela</em>, <em>Posto Ipiranga</em>, <em>Uber</em>).
                </li>
                <li>
                  <strong>Contexto estruturado:</strong> Use os campos próprios de <em>Meio de pagamento</em>, <em>Cartão</em>, <em>Viagem</em>, <em>Família</em> ou <em>Pessoal/Profissional</em> em vez de misturar isso na descrição.
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-critical/30 bg-critical/5 p-3.5 flex flex-col gap-2">
              <span className="font-semibold text-critical-strong text-xs flex items-center gap-1.5">
                <HelpCircle className="size-3.5" aria-hidden="true" />
                O que Evitar (Gera Poluição)
              </span>
              <ul className="space-y-1.5">
                <li className="flex items-start gap-1.5">
                  <XCircle className="size-3.5 shrink-0 mt-0.5 text-critical-strong" aria-hidden="true" />
                  <span>
                    <em>"Almoço de domingo com meu primo que comi lasanha"</em> (Quebra linhas, corta na tela do celular e polui relatórios).
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <XCircle className="size-3.5 shrink-0 mt-0.5 text-critical-strong" aria-hidden="true" />
                  <span>
                    Cadastrar a forma de pagamento ou o nome do cartão na descrição (ex.: <em>"Nubank débito"</em>). Para isso existem os campos de Meio de pagamento e Cartão.
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <XCircle className="size-3.5 shrink-0 mt-0.5 text-critical-strong" aria-hidden="true" />
                  <span>
                    Criar 40 categorias hiper-específicas (ex.: <em>Almoço de Terça</em>). Mantenha categorias simples.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      value: "credit_card",
      label: "Cartão Desmistificado",
      icon: <CreditCard className="size-4" aria-hidden="true" />,
      content: (
        <div className="flex flex-col gap-4 py-2 text-xs text-muted-foreground leading-relaxed">
          <div className="rounded-xl border border-border/80 bg-surface p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
              <ShieldCheck className="size-4 text-primary shrink-0" aria-hidden="true" />
              <span>O Cartão é Meio de Pagamento, Não Despesa Única</span>
            </div>
            <p>
              O maior erro de iniciantes é criar no fim do mês uma despesa única chamada <strong>Fatura Nubank R$ 3.500</strong>.
              Isso destrói o histórico de quanto você comeu no supermercado, quanto gastou de gasolina e quebra todos os
              orçamentos do app.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex flex-col gap-1.5">
              <span className="font-semibold text-foreground text-xs">O Gasto Entra na Compra</span>
              <p>
                Quando você passa o cartão no mercado, o gasto de <strong>Alimentação</strong> ocorreu naquele dia. O Axir
                aloca a despesa na fatura da competência certa.
              </p>
            </div>

            <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex flex-col gap-1.5">
              <span className="font-semibold text-foreground text-xs">Pagar Fatura é Mover Dinheiro</span>
              <p>
                Quando você paga o boleto do cartão da sua conta corrente, isso é uma <strong>Transferência Interna</strong>.
                O saldo bancário reduz sem duplicar os gastos que já foram computados!
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                triggerSensory("selection");
                setShowTechnicalDetails((prev) => !prev);
              }}
              className="flex items-center justify-between text-xs font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
            >
              <span>Ver detalhe técnico: Compras parceladas e competência</span>
              {showTechnicalDetails ? (
                <ChevronUp className="size-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="size-4" aria-hidden="true" />
              )}
            </button>

            {showTechnicalDetails && (
              <div className="pt-2 border-t border-border/60 flex flex-col gap-1.5 text-xs text-muted-foreground">
                <p>
                  Quando você compra um item de R$ 1.200 em 10x de R$ 120 no cartão de crédito:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>O Axir registra a parcela 1/10 na fatura aberta atual;</li>
                  <li>As parcelas 2 a 10 são projetadas automaticamente nas faturas dos próximos 9 meses;</li>
                  <li>Seu saldo livre para gastar (Safe-to-Spend) já provisiona os pagamentos futuros sem surpresas.</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <InteractivePlaybookModal
      open={open}
      onOpenChange={onOpenChange}
      moduleKey="transactions"
      title="Guia de Lançamentos & Gestão de Cartões"
      description="Descubra a rotina de registro ideal e entenda a relação entre conta, cartão e faturas."
      tabs={tabs}
    />
  );
}
