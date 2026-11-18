import { Cpu, Lock, ShieldCheck, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui";

const PRIVACY_PILLARS = [
  {
    icon: ShieldCheck,
    title: "Canal do DPO",
    description:
      "Canal formal permanente com o Encarregado de Dados, com resposta legal em até 15 dias.",
  },
  {
    icon: Lock,
    title: "Privacy by Design",
    description:
      "Isolamento via Row Level Security (RLS) nas 34 tabelas e criptografia de ponta a ponta.",
  },
  {
    icon: Cpu,
    title: "100% On-Device",
    description:
      "Leitura passiva de notificações bancárias processada puramente no processador do celular.",
  },
  {
    icon: Trash2,
    title: "Direito ao Esquecimento",
    description:
      "Exclusão definitiva de conta em 1 clique na plataforma com purga de dados em cascata.",
  },
];

export function PrivacyHighlightsGrid() {
  return (
    <section aria-labelledby="secao-destaques-privacidade" className="not-prose">
      <h2 id="secao-destaques-privacidade" className="sr-only">
        Pilares da Política de Privacidade
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PRIVACY_PILLARS.map((item) => (
          <Card key={item.title} className="border-border/80 bg-surface shadow-xs">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                <item.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>{item.title}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
