import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { Card } from "@/components/ui";
import { ScrollReveal } from "./scroll-reveal";

interface FaqItem {
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    question: "Preciso cadastrar meu cartão de crédito para testar?",
    answer:
      "Não. Você cria sua conta gratuitamente e tem 30 dias de Acesso Pro Total sem precisar inserir nenhum dado de cartão de crédito. Se optar por não assinar após o período, nenhuma cobrança é efetuada.",
  },
  {
    question: "O que acontece após o término dos 30 dias de teste?",
    answer:
      "Você não perde absolutamente nada. Seus saldos, cartões, despesas e faturas continuam salvos e disponíveis para consulta a qualquer momento em modo somente-leitura. Para adicionar novos lançamentos e continuar rebalanceando seus aportes, basta ativar o Plano Pro quando quiser.",
  },
  {
    question: "Como funciona o rebalanceamento de carteira de investimentos?",
    answer:
      "Você define suas metas percentuais ideais para cada classe de ativos (ex: 35% Ações, 25% FIIs, 30% Renda Fixa, 10% Internacional). Quando você for realizar um novo aporte financeiro, o motor algorítmico calcula exatamente para onde direcionar o valor para comprar na baixa e equilibrar a carteira sem vender ativos.",
  },
  {
    question: "Meus dados financeiros estão realmente seguros?",
    answer:
      "Sim. Utilizamos isolamento criptográfico por usuário (Row Level Security no PostgreSQL). Nenhuma informação sua é vendida a terceiros, compartilhada com bancos ou utilizada para anúncios. Você também pode exportar todos os seus dados em Excel ou fazer backup a qualquer momento.",
  },
  {
    question: "O que é o método de independência financeira FIRE?",
    answer:
      "FIRE significa 'Financial Independence, Retire Early' (Independência Financeira, Aposentadoria Antecipada). O aplicativo utiliza fórmulas determinísticas baseadas na sua taxa de poupança mensal e na consagrada Regra dos 4% para calcular o patrimônio necessário para que os rendimentos paguem todas as suas despesas vitalícias.",
  },
  {
    question: "Posso cancelar minha assinatura quando quiser?",
    answer:
      "Sim, com 1 clique direto no seu painel de configurações. Sem pegadinhas, taxas ocultas ou ligações. Você continuará tendo acesso completo até o último dia do período já contratado.",
  },
  {
    question: "O aplicativo funciona no celular como um app nativo?",
    answer:
      "Sim. O Guia Financeiro foi construído como um PWA (Progressive Web App) moderno. Você pode instalá-lo diretamente na tela inicial do seu iPhone ou Android, funcionando de forma ultra-rápida, com suporte tátil e sem ocupar espaço desnecessário.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-14 md:py-32 scroll-mt-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 xl:px-12">
        <ScrollReveal className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 sm:px-4 sm:py-1.5 text-xs sm:text-sm font-semibold text-primary">
            <HelpCircle className="size-3.5 sm:size-4" aria-hidden="true" />
            <span>Tire Suas Dúvidas</span>
          </div>
          <h2 className="mt-3 sm:mt-4 font-display text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Perguntas Frequentes
          </h2>
          <p className="mt-3 sm:mt-4 text-sm sm:text-lg lg:text-xl text-muted-foreground">
            Transparência total para você tomar a melhor decisão para o seu dinheiro.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={100} className="mt-8 sm:mt-10 flex flex-col gap-2.5 sm:gap-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <Card
                key={index}
                variant="flat"
                className={`border transition-all duration-200 rounded-xl sm:rounded-2xl ${
                  isOpen ? "border-primary/40 bg-surface/90 shadow-sm" : "border-border/70 bg-surface/50 hover:border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  className="flex w-full items-center justify-between p-4 sm:p-5 text-left font-medium text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm sm:text-base font-semibold pr-3">{faq.question}</span>
                  <ChevronDown
                    className={`size-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-primary" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {isOpen ? (
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 text-xs sm:text-sm text-muted-foreground leading-relaxed animate-fade-slide-in">
                    {faq.answer}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </ScrollReveal>
      </div>
    </section>
  );
}
