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
    question: "Preciso cadastrar meu cartão de crédito ou senha de banco para testar?",
    answer:
      "Não. Você cria sua conta gratuitamente com e-mail e tem 30 dias de Acesso Pro Total sem cartão de crédito e sem nunca informar senhas bancárias.",
  },
  {
    value: "faq-1",
    question: "O que acontece após o término dos 30 dias de teste gratuito?",
    answer:
      "Você não perde absolutamente nada. Seus saldos, cartões, dívidas, recebíveis e faturas continuam salvos e disponíveis no Modo Somente-Leitura. Quando quiser voltar a registrar novos lançamentos e rebalancear aportes, basta ativar o Plano Pro.",
  },
  {
    value: "faq-2",
    question: "Ainda não invisto na Bolsa. O Axir também serve para mim?",
    answer:
      "Sim. Você pode começar organizando apenas o gasto do dia a dia, seu Caixa Real disponível, faturas do cartão, contas a pagar e a receber ou divisão em grupo. Quando decidir começar sua reserva ou carteira, os módulos de metas e investimentos já estarão integrados.",
  },
  {
    value: "faq-3",
    question: "Como funciona a divisão de despesas e o Modo Viagem com amigos sem conta?",
    answer:
      "Com zero atrito. Ao criar uma viagem ou dividir um gasto em parcelas, o Axir gera um link compartilhável seguro. Seus amigos conferem os saldos pelo navegador do celular e visualizam o caminho mínimo em transferências Pix sem precisar baixar app ou criar conta.",
  },
  {
    value: "faq-4",
    question: "Como funcionam o Preço Teto e o rebalanceamento sem vender ativos?",
    answer:
      "Você define metas percentuais por classe e ativo, registra sua tese de governança e escolhe modelos transparentes (Bazin, Graham, Gordon e FIIs). A cada novo aporte, o sistema sugere onde comprar com margem de segurança para equilibrar a carteira sem girar patrimônio.",
  },
  {
    value: "faq-5",
    question: "Meus dados ficam protegidos? Funciona no iPhone e no Android?",
    answer:
      "Sim. Seus registros têm isolamento criptográfico por usuário (RLS no PostgreSQL), suporte a 2FA (MFA), gestão de dispositivos ativos, Escudo de Privacidade e exportação completa em Excel (.xlsx). Você acessa pelo navegador, PWA no iPhone/Android ou APK Nativo Android com PIN e biometria.",
  },
  {
    value: "faq-6",
    question: "Como funciona a Inteligência Artificial (Micro-IA) e meus dados ficam privados?",
    answer:
      "A Micro-IA atua de forma silenciosa na leitura de cupons e comprovantes Pix (Vision), na importação de faturas (inclusive PDFs com senha e planilhas .xls/.csv), na categorização inteligente e na busca em linguagem natural. Antes de qualquer análise, dados sensíveis são mascarados automaticamente no seu dispositivo e as cotas mensais já estão incluídas no Teste de 30 Dias e no Plano Pro sem custo extra.",
  },
  {
    value: "faq-7",
    question: "O Axir também serve para quem tem MEI ou pequeno negócio (PJ)?",
    answer:
      "Sim. O Modo Negócio mantém sua vida pessoal e empresarial organizadas no mesmo app sem misturar os saldos: você acompanha DRE gerencial, separa a reserva do DAS (Tax Shield), monitora o Teto Anual do MEI, calcula o Ponto de Equilíbrio e registra reembolsos entre cartão pessoal e caixa da empresa.",
  },
  {
    value: "faq-8",
    question: "Posso cancelar minha assinatura quando quiser?",
    answer:
      "Sim, em 1 clique dentro das configurações da sua conta. Sem fidelidade, sem multa e sem precisar falar com suporte, mantendo o acesso completo até o fim do ciclo vigente.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="py-14 md:py-24 border-t border-border/60 scroll-mt-20">
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
