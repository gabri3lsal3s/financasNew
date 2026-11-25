import { Cpu, FileSpreadsheet, Lock, ReceiptText, Search, Sparkles } from "lucide-react";
import { Badge, Card } from "@/components/ui";

const AI_CAPABILITIES = [
  {
    title: "Importação Universal de Faturas",
    badge: "PDF, XLS & CSV",
    description:
      "Leia faturas e extratos de múltiplos bancos, inclusive PDFs protegidos por senha e planilhas antigas (.xls), com conciliação inline.",
    icon: FileSpreadsheet,
  },
  {
    title: "Leitura Multimodal de Cupons & Pix",
    badge: "IA Vision",
    description:
      "Envie foto do cupom fiscal, boleto ou comprovante Pix: valor, data, estabelecimento e categoria chegam prontos para confirmar.",
    icon: ReceiptText,
  },
  {
    title: "Categorização Semântica & Aprendizado",
    badge: "Memória local",
    description:
      "A micro-IA classifica lotes inteiros de lançamentos e memoriza seus estabelecimentos para acertar ainda mais rápido no mês seguinte.",
    icon: Sparkles,
  },
  {
    title: "Busca Inteligente em Linguagem Natural",
    badge: "Radar rápido",
    description:
      "Encontre gastos, faturas, ativos e metas digitando como você pensa, com agrupamento automático de contexto.",
    icon: Search,
  },
] as const;

export function AiIntelligencePreview() {
  return (
    <Card className="border-border/80 bg-surface shadow-xs p-5 sm:p-8 rounded-2xl sm:rounded-3xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-start gap-2.5">
          <Cpu className="size-4 text-muted-foreground shrink-0 mt-1" aria-hidden="true" />
          <div>
            <h3 className="font-display text-lg sm:text-xl font-bold text-foreground">
              Micro-IA Financeira Integrada em Todo o Fluxo
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Menos digitação manual, mais precisão técnica — já incluída no Teste de 30 Dias e no Plano Pro.
            </p>
          </div>
        </div>
        <Badge variant="default" size="sm" className="self-start sm:self-center shrink-0">
          Inclusa sem custo extra
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
        {AI_CAPABILITIES.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-xl border border-border/80 bg-surface-raised/40 p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="size-4 text-primary-strong shrink-0" aria-hidden="true" />
                  <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                </div>
                <Badge variant="muted" size="xs" className="shrink-0">
                  {item.badge}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2.5 rounded-xl border border-primary/25 bg-primary/5 p-3.5 text-xs text-muted-foreground">
        <Lock className="size-4 text-primary-strong shrink-0" aria-hidden="true" />
        <span>
          <strong className="text-foreground">Privacidade antes da nuvem:</strong> dados pessoais
          sensíveis são mascarados automaticamente antes de qualquer análise, com cotas mensais e diárias inclusas.
        </span>
      </div>
    </Card>
  );
}
