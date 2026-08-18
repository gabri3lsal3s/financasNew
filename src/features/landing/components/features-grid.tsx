import {
  CreditCard,
  PieChart,
  Flame,
  ShieldCheck,
  Zap,
  Repeat,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";

const features = [
  {
    icon: CreditCard,
    title: "Cartões & Faturas Sem Surpresas",
    description:
      "Fechamento automático de competências, parcelamentos calculados em centavos exatos e controle do limite comprometido mês a mês.",
    highlight: "Zero faturas estouradas",
  },
  {
    icon: PieChart,
    title: "Rebalanceamento Inteligente de Carteira",
    description:
      "Defina suas metas por classe de ativo (Ações, FIIs, Renda Fixa, Cripto). Nosso motor calcula exatamente onde aportar seu dinheiro para diminuir riscos.",
    highlight: "Compre na baixa sem emoção",
  },
  {
    icon: Flame,
    title: "Simulador de Independência FIRE",
    description:
      "Projeções determinísticas pela consagrada Regra dos 4%. Acompanhe sua taxa de poupança real e saiba com precisão quando você poderá viver de renda.",
    highlight: "Liberdade financeira planejada",
  },
  {
    icon: Zap,
    title: "Detector de Assinaturas & Gastos Ocultos",
    description:
      "Algoritmo nativo que identifica cobranças recorrentes e serviços esquecidos para sugerir cortes diretos no seu orçamento.",
    highlight: "Economia imediata no 1º mês",
  },
  {
    icon: Repeat,
    title: "Recorrências & Parcelamento de Rendas",
    description:
      "Cadastre rendas e despesas recorrentes com materialização automática e controle de quitação integrado.",
    highlight: "Previsibilidade total de caixa",
  },
  {
    icon: ShieldCheck,
    title: "Privacidade Bancária & Zero Anúncios",
    description:
      "Seus dados financeiros não são vendidos ou compartilhados. Isolamento de dados multi-inquilino com Row Level Security (RLS).",
    highlight: "Seus dados pertencem a você",
  },
];

export function FeaturesGrid() {
  return (
    <section id="recursos" className="py-16 md:py-24 bg-surface/40 border-y border-border/60">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-primary block">
            Engenharia Financeira de Precisão
          </span>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
            Tudo o que você precisa para assumir o controle do seu patrimônio
          </h2>
          <p className="mt-4 text-base text-muted-foreground leading-relaxed">
            Desenvolvido sob padrões rigorosos de finanças pessoais: sem dados imprecisos,
            sem fórmulas opacas e com foco absoluto na sua rentabilidade e segurança.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((item, index) => {
            const Icon = item.icon;
            return (
              <Card
                key={index}
                variant="interactive"
                className="flex flex-col justify-between border-border/80 bg-surface/90 hover:border-primary/40 transition-all duration-200"
              >
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-5" aria-hidden="true" />
                    </div>
                    <span className="text-[11px] font-semibold text-primary-strong">
                      {item.highlight}
                    </span>
                  </div>
                  <CardTitle className="text-lg font-bold text-foreground">
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
