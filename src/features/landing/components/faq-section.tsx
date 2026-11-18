import { HelpCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui";
import { ScrollReveal } from "./scroll-reveal";

interface FaqItem {
  value: string;
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    value: "faq-0",
    question: "Preciso cadastrar meu cartão de crédito para testar?",
    answer:
      "Não. Você cria sua conta gratuitamente e tem 30 dias de Acesso Pro Total sem precisar inserir nenhum dado de cartão de crédito. Se optar por não assinar após o período, nenhuma cobrança é efetuada.",
  },
  {
    value: "faq-1",
    question: "O que acontece após o término dos 30 dias de teste gratuito?",
    answer:
      "Você não perde absolutamente nada. Seus saldos, cartões, dívidas e faturas continuam salvos e disponíveis para consulta permanente no Modo Somente-Leitura. Para adicionar novos lançamentos e continuar rebalanceando seus aportes, basta ativar o Plano Pro quando quiser.",
  },
  {
    value: "faq-2",
    question: "Como funciona o rebalanceamento de carteira de investimentos sem venda de ativos?",
    answer:
      "Você define suas metas percentuais ideais para cada classe de ativos (ex: Renda Fixa, Ações, FIIs, Internacional). Quando você for realizar um novo aporte financeiro, o motor determinístico calcula exatamente para onde direcionar o valor para comprar ativos defasados e equilibrar a carteira sem girar patrimônio e sem gerar DARF desnecessário.",
  },
  {
    value: "faq-3",
    question: "Meus dados financeiros estão realmente seguros?",
    answer:
      "Sim. Seus dados contam com isolamento criptográfico por usuário (Row Level Security no PostgreSQL) e o Axir não solicita senhas bancárias nem vende informações a terceiros. Além disso, você conta com o Escudo de Privacidade para ocultar valores na tela com 1 clique e pode exportar seu Dossiê Executivo em planilha Excel a qualquer momento.",
  },
  {
    value: "faq-4",
    question: "Funciona no iPhone e no Android como app nativo?",
    answer:
      "Sim. No iPhone e Android, o Axir opera com carregamento instantâneo e interface em tela cheia via PWA universal (adicionado à tela inicial em 1 toque sem ocupar memória). Para usuários de Android que desejam a experiência máxima de performance, disponibilizamos o Android App Pro Nativo oficial com biometria física, atalhos de launcher e escudo anti-captura FLAG_SECURE.",
  },
  {
    value: "faq-5",
    question: "Como funciona o Modo Viagem com amigos que não têm o aplicativo?",
    answer:
      "Funciona com zero atrito. Ao criar uma viagem em grupo, o Axir gera um link público seguro com senha opcional. Seus amigos abrem a página pelo navegador do celular, conferem o livro-razão em tempo real e lançam os gastos que pagaram — sem criar conta e sem baixar qualquer app. No fim, o algoritmo calcula o menor número de transferências Pix para zerar todos os saldos.",
  },
  {
    value: "faq-6",
    question: "Posso cancelar minha assinatura quando quiser?",
    answer:
      "Sim, com 1 clique direto no seu painel de configurações. Sem burocracia, taxas ocultas ou fidelidade. Você continuará tendo acesso completo até o último dia do período já contratado.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="py-14 md:py-32 scroll-mt-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 xl:px-12">
        <ScrollReveal className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 sm:px-4 sm:py-1.5 text-xs sm:text-sm font-semibold text-primary-strong dark:text-primary">
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

        <ScrollReveal delay={100} className="mt-8 sm:mt-10">
          <Accordion type="single" collapsible defaultValue="faq-0" className="gap-2.5 sm:gap-3">
            {FAQS.map((faq) => (
              <AccordionItem
                key={faq.value}
                value={faq.value}
                className="rounded-xl sm:rounded-2xl border-border/80 bg-surface shadow-xs data-[state=open]:border-primary/40"
              >
                <AccordionTrigger className="p-4 sm:p-5 text-sm sm:text-base font-semibold">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollReveal>
      </div>
    </section>
  );
}
