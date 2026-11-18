import { HelpCircle, User, Users } from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTrigger, SegmentedControl } from "@/components/ui";

export interface BudgetsMetricToggleProps {
  spendMetric: "personal" | "household";
  onSpendMetricChange: (metric: "personal" | "household") => void;
}

/** Alternador de visualização de gastos (Minha Parte vs Total Bruto) com popover explicativo. */
export function BudgetsMetricToggle({
  spendMetric,
  onSpendMetricChange,
}: BudgetsMetricToggleProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p className="hidden text-xs text-muted-foreground sm:block sm:text-sm">
        Acompanhe os gastos por categoria e defina o teto mensal.
      </p>

      <div className="flex items-center gap-1.5 self-start sm:self-auto">
        <SegmentedControl
          value={spendMetric}
          onChange={onSpendMetricChange}
          options={[
            {
              value: "personal",
              label: "Minha Parte",
              icon: <User aria-hidden="true" />,
              title: "Considera apenas a sua participação pessoal efetiva nas compras (com rateios e reembolsos)",
            },
            {
              value: "household",
              label: "Total Bruto",
              icon: <Users aria-hidden="true" />,
              title: "Considera o valor bruto total nominal das compras (100% de cada despesa, sem rateios)",
            },
          ]}
          ariaLabel="Modo de cálculo dos gastos"
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              sensoryIntent="selection"
              className="w-8 px-0 text-muted-foreground hover:text-foreground shrink-0"
              aria-label="Informações sobre os modos de visualização"
              title="Informações sobre os modos de visualização"
            >
              <HelpCircle className="size-3.5" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] text-xs">
            <div className="flex flex-col gap-2">
              <p className="font-semibold text-foreground">Modos de Visualização do Orçamento</p>
              <div className="flex flex-col gap-1.5 text-muted-foreground text-[11px] leading-relaxed">
                <p>
                  <strong className="text-foreground font-medium">Minha Parte (Ponderado):</strong>{" "}
                  Considera exclusivamente a sua cota ou responsabilidade pessoal nos gastos compartilhados (despesas com taxa de rateio menor que 100% ou reembolsos). Ideal para o controle do seu consumo individual.
                </p>
                <p>
                  <strong className="text-foreground font-medium">Total Bruto (Nominal):</strong>{" "}
                  Considera 100% do valor nominal de cada compra, mesmo quando rateada com terceiros. Ideal para o controle do orçamento global de todas as despesas.
                </p>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
