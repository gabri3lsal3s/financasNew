import { ArrowUpRight, CheckCircle2, Sparkles, XCircle } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { cn } from "@/lib/utils";

const COMPARISON_ROWS = [
  { feature: "Consulta de histórico, saldos e relatórios", readOnly: true, pro: true },
  { feature: "Exportação básica em planilhas (.csv)", readOnly: true, pro: true },
  { feature: "Dossiê Executivo Contábil de 5 abas (.xlsx nativo)", readOnly: false, pro: true },
  { feature: "Novos lançamentos de despesas e receitas ilimitados", readOnly: false, pro: true },
  { feature: "Leitor OCR de cupons fiscais NFC-e/SAT e boletos", readOnly: false, pro: true },
  { feature: "Múltiplos cartões de crédito e parcelamentos em até 60x", readOnly: false, pro: true },
  { feature: "Tetos de gastos e orçamentos com Safe-to-Spend diário", readOnly: false, pro: true },
  { feature: "Gestão completa de dívidas (Snowball / Avalanche)", readOnly: false, pro: true },
  { feature: "Espaço Família compartilhado e racha de contas Pix", readOnly: false, pro: true },
  { feature: "Planejador de viagens e controle de moedas", readOnly: false, pro: true },
  { feature: "Rebalanceamento determinístico de carteira sem DARF", readOnly: false, pro: true },
  { feature: "Radar Fiscal de IR e apuração contínua de tributos", readOnly: false, pro: true },
] as const;

export interface PlanComparisonCardProps {
  isFullAccess: boolean;
  showUpgradeCta: boolean;
  onUpgrade: () => void;
}

export function PlanComparisonCard({
  isFullAccess,
  showUpgradeCta,
  onUpgrade,
}: PlanComparisonCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowUpRight className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>Comparativo de Planos</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80">
          <table className="w-full min-w-[380px] sm:min-w-0 text-xs">
            <thead>
              <tr className="border-b border-border/80 bg-muted/30">
                <th className="py-2.5 pl-4 pr-2 text-left font-semibold text-muted-foreground">
                  Recurso
                </th>
                <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground w-24">
                  Leitura
                </th>
                <th className="px-3 py-2.5 text-center font-semibold text-primary-strong w-24">
                  Pro
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, i) => (
                <tr
                  key={row.feature}
                  className={cn(
                    "border-b border-border/80 last:border-b-0",
                    i % 2 === 0 ? "bg-surface" : "bg-muted/20",
                  )}
                >
                  <td className="py-2.5 pl-4 pr-2 text-foreground">{row.feature}</td>
                  <td className="px-3 py-2.5 text-center">
                    {row.readOnly ? (
                      <CheckCircle2
                        className="mx-auto size-4 text-positive-strong"
                        aria-label="Disponível"
                      />
                    ) : (
                      <XCircle
                        className="mx-auto size-4 text-negative-strong/60"
                        aria-label="Indisponível"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <CheckCircle2
                      className={cn(
                        "mx-auto size-4",
                        isFullAccess ? "text-positive-strong" : "text-muted-foreground/40",
                      )}
                      aria-label="Disponível no Pro"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showUpgradeCta ? (
          <div className="mt-5">
            <Button type="button" variant="solid" className="w-full gap-2" onClick={onUpgrade}>
              <Sparkles className="size-4" aria-hidden="true" />
              <span>Ativar Plano Pro</span>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
