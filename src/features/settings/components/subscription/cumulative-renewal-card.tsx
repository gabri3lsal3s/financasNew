import { ArrowUpRight, QrCode, Sparkles } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  MoneyText,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { PixRenewalCheckoutModal } from "./pix-renewal-checkout-modal";
import { useCumulativeRenewal } from "./use-cumulative-renewal";

interface CumulativeRenewalCardProps {
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd?: boolean;
  onUpgradeToAnnual: () => void;
}

const MONTH_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

export function CumulativeRenewalCard({
  currentPeriodEnd,
  cancelAtPeriodEnd = false,
  onUpgradeToAnnual,
}: CumulativeRenewalCardProps) {
  const renewal = useCumulativeRenewal(currentPeriodEnd);
  const canAnticipate = renewal.maxAllowedMonths >= 2;

  return (
    <>
      <Card className="border-portfolio/30 bg-portfolio/5 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-row items-center justify-between gap-2.5">
            <CardTitle className="text-base flex items-center gap-2 min-w-0">
              <Sparkles className="size-4 text-portfolio shrink-0" aria-hidden="true" />
              <span className="sm:hidden truncate">Antecipação</span>
              <span className="hidden sm:inline truncate">Antecipação de Mensalidades com Desconto</span>
            </CardTitle>
            <Badge variant="portfolio" size="sm" className="shrink-0">
              Até 20% OFF
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {cancelAtPeriodEnd
              ? "Pague de 2 a 11 meses antecipados via Pix à vista e receba descontos progressivos para estender sua vigência sem reativar cobrança automática no cartão."
              : "Pague de 2 a 11 meses antecipados via Pix à vista e receba descontos progressivos. Seu ciclo mensal continuará ativo e sua próxima cobrança no cartão será automaticamente pausada até o término dos meses pagos."}
          </p>

          {canAnticipate ? (
            <>
              <div className="space-y-2">
                <span className="text-xs font-semibold text-foreground block">
                  Selecione quantos meses deseja antecipar:
                </span>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {MONTH_OPTIONS.map((m) => {
                    const isDisabled = m > renewal.maxAllowedMonths;
                    const isSelected = !isDisabled && renewal.selectedMonths === m;
                    const discount = m <= 3 ? "5%" : m <= 6 ? "10%" : m <= 9 ? "15%" : "20%";
                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={isDisabled}
                        aria-pressed={isSelected}
                        onClick={() => renewal.handleSelectMonths(m)}
                        className={cn(
                          "min-h-10 sm:min-h-8 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                          isDisabled
                            ? "bg-muted/40 border-border/50 text-muted-foreground opacity-50 cursor-not-allowed"
                            : isSelected
                              ? "bg-portfolio text-portfolio-foreground border-portfolio shadow-xs cursor-pointer"
                              : "bg-surface border-border/80 text-foreground hover:bg-portfolio/10 cursor-pointer",
                        )}
                      >
                        <span>{m} meses</span>
                        <span
                          className={cn(
                            "text-[10px] px-1 rounded-sm font-semibold",
                            isSelected
                              ? "bg-portfolio-foreground/20 text-portfolio-foreground"
                              : "text-portfolio",
                          )}
                        >
                          {discount} OFF
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Valor por mês:</span>
                    <MoneyText
                      cents={renewal.pricing.monthlyEquivalentCents}
                      variant="caption"
                      tone="default"
                      className="font-semibold"
                    />
                    <Badge variant="positive" size="xs">
                      {renewal.pricing.discountPercentage}% de desconto
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Seu Pro será estendido até{" "}
                    <span className="font-semibold text-foreground">{renewal.newPeriodEndFormatted}</span>.
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <div className="sm:text-right">
                    <span className="text-[10px] text-muted-foreground block">Total com desconto:</span>
                    <MoneyText
                      cents={renewal.pricing.totalCents}
                      tone="default"
                      className="text-base font-bold"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    sensoryIntent="selection"
                    onClick={() => {
                      void renewal.handleGeneratePix();
                    }}
                    disabled={renewal.isPending}
                    className="gap-1.5 shrink-0"
                  >
                    <QrCode className="size-3.5" aria-hidden="true" />
                    <span>Pagar via Pix</span>
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-3 rounded-xl bg-surface border border-border/80 text-xs text-muted-foreground">
              Você já atingiu o limite máximo de 11 meses antecipados na sua vigência atual.
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-surface-raised/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-foreground">
                  Quer assinar por 1 ano completo?
                </span>
                <Badge variant="positive" size="xs">
                  40% OFF
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                O Plano Pro Anual sai por apenas{" "}
                <MoneyText cents={14388} variant="caption" tone="default" className="text-[11px]" />
                /ano (
                <MoneyText cents={1199} variant="caption" tone="default" className="text-[11px]" />
                /mês). É{" "}
                <MoneyText cents={3201} variant="caption" tone="default" className="text-[11px]" />{" "}
                mais barato que antecipar 11 meses!
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onUpgradeToAnnual}
              className="gap-1.5 shrink-0 self-start sm:self-auto"
            >
              <span>Mudar para o Anual</span>
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <PixRenewalCheckoutModal
        open={renewal.pixModalOpen}
        totalCents={renewal.pricing.totalCents}
        selectedMonths={renewal.selectedMonths}
        copiedKey={renewal.copiedKey}
        pixData={renewal.pixData}
        onClose={() => renewal.setPixModalOpen(false)}
        onCopyPix={() => {
          void renewal.handleCopyPix();
        }}
      />
    </>
  );
}
