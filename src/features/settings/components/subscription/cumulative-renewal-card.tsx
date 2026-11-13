import { useState, useMemo, useEffect } from "react";
import { Sparkles, QrCode, Copy, Check, ShieldCheck, Clock, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Modal, ModalFooter } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  calculateCumulativePrice,
  addCivilMonths,
} from "@/domain/subscription";
import { useCumulativeCheckoutMutation } from "@/state";
import { useQueryClient } from "@tanstack/react-query";
import { USER_SUBSCRIPTION_KEY } from "@/state/queries/use-user-access";
import { cn } from "@/lib/utils";

interface CumulativeRenewalCardProps {
  currentPeriodEnd: string | null;
  onUpgradeToAnnual: () => void;
}

const MONTH_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

export function CumulativeRenewalCard({
  currentPeriodEnd,
  onUpgradeToAnnual,
}: CumulativeRenewalCardProps) {
  const [selectedMonths, setSelectedMonths] = useState<number>(3);
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [pixData, setPixData] = useState<{
    qrCodeBase64: string;
    copyPasteKey: string;
    expirationDate: string;
  } | null>(null);

  const queryClient = useQueryClient();
  const checkoutMutation = useCumulativeCheckoutMutation();

  const pricing = useMemo(() => {
    return calculateCumulativePrice(selectedMonths);
  }, [selectedMonths]);

  const newPeriodEndFormatted = useMemo(() => {
    const base = currentPeriodEnd ? new Date(currentPeriodEnd) : new Date();
    const target = addCivilMonths(base, selectedMonths);
    return target.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }, [currentPeriodEnd, selectedMonths]);

  const handleSelectMonths = (m: number) => {
    triggerSensory("selection");
    setSelectedMonths(m);
  };

  const handleGeneratePix = async () => {
    triggerSensory("selection");
    try {
      const result = await checkoutMutation.mutateAsync({
        months: selectedMonths,
        method: "pix",
      });

      if ("qrCodeBase64" in result && result.qrCodeBase64) {
        setPixData({
          qrCodeBase64: result.qrCodeBase64,
          copyPasteKey: result.copyPasteKey,
          expirationDate: result.expirationDate,
        });
        setPixModalOpen(true);
      }
    } catch {
      // Erro já notificado pela mutation
    }
  };

  const handleCopyPix = async () => {
    if (!pixData?.copyPasteKey) return;
    try {
      await navigator.clipboard.writeText(pixData.copyPasteKey);
      setCopiedKey(true);
      triggerSensory("success");
      pushToast({
        title: "Chave Copia e Cola copiada",
        description: "Cole no aplicativo do seu banco para pagar o Pix.",
        variant: "default",
      });
      setTimeout(() => setCopiedKey(false), 3000);
    } catch {
      pushToast({
        title: "Não foi possível copiar",
        description: "Copie a chave manualmente pelo campo.",
        variant: "destructive",
      });
    }
  };

  // Polling automático para detectar pagamento Pix enquanto o modal estiver aberto
  useEffect(() => {
    if (!pixModalOpen || !pixData) return;

    const intervalId = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: USER_SUBSCRIPTION_KEY });
    }, 4000);

    return () => clearInterval(intervalId);
  }, [pixModalOpen, pixData, queryClient]);

  return (
    <>
      <Card className="border-portfolio/30 bg-portfolio/5">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="size-4 text-portfolio" aria-hidden="true" />
              <span>Antecipação de Mensalidades com Desconto</span>
            </CardTitle>
            <Badge variant="default" size="sm" className="bg-portfolio/20 text-portfolio border-portfolio/30 self-start sm:self-auto">
              Até 20% OFF
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Pague de 2 a 11 meses antecipados via Pix à vista e receba descontos progressivos.
            Seu ciclo mensal continuará ativo e sua próxima cobrança no cartão será automaticamente pausada até o término dos meses pagos.
          </p>

          {/* Seletor de Meses em Chips fluidos */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-foreground">
              Selecione quantos meses deseja antecipar:
            </span>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {MONTH_OPTIONS.map((m) => {
                const isSelected = selectedMonths === m;
                const discount = m <= 3 ? "5%" : m <= 6 ? "10%" : m <= 9 ? "15%" : "20%";
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSelectMonths(m)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border flex items-center gap-1.5",
                      isSelected
                        ? "bg-portfolio text-portfolio-foreground border-portfolio shadow-xs"
                        : "bg-surface/80 border-border/80 text-foreground hover:bg-portfolio/10",
                    )}
                  >
                    <span>{m} meses</span>
                    <span className={cn(
                      "text-[10px] px-1 rounded-sm",
                      isSelected ? "bg-black/20 text-portfolio-foreground" : "text-portfolio font-semibold",
                    )}>
                      {discount} OFF
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resumo do Cenário Selecionado */}
          <div className="p-3.5 rounded-xl bg-surface/80 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Valor por mês:</span>
                <MoneyText
                  cents={pricing.monthlyEquivalentCents}
                  className="text-xs font-semibold text-foreground"
                />
                <Badge variant="positive" size="xs">
                  {pricing.discountPercentage}% de desconto
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Seu Pro será estendido até <span className="font-semibold text-foreground">{newPeriodEndFormatted}</span>.
              </p>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-center">
              <div className="text-right">
                <span className="text-[10px] text-muted-foreground block">Total com desconto:</span>
                <MoneyText
                  cents={pricing.totalCents}
                  className="text-base font-bold text-foreground"
                />
              </div>

              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleGeneratePix}
                disabled={checkoutMutation.isPending}
                className="gap-1.5 cursor-pointer shrink-0"
              >
                <QrCode className="size-3.5" aria-hidden="true" />
                <span>Pagar via Pix</span>
              </Button>
            </div>
          </div>

          {/* Card de Destaque para Migração ao Plano Anual (Ancoragem em 12 meses) */}
          <div className="p-3 rounded-xl bg-background border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-foreground">Quer assinar por 1 ano completo?</span>
                <Badge variant="default" size="xs" className="bg-positive/10 text-positive-strong border-positive/20">
                  40% OFF
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                O Plano Pro Anual sai por apenas R$ 143,88/ano (R$ 11,99/mês). É R$ 32,01 mais barato que antecipar 11 meses!
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onUpgradeToAnnual}
              className="gap-1.5 shrink-0 cursor-pointer self-start sm:self-auto"
            >
              <span>Mudar para o Anual</span>
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Pagamento Pix para Antecipação Acumulativa */}
      <Modal
        open={pixModalOpen}
        onOpenChange={(next) => {
          if (!next) setPixModalOpen(false);
        }}
        size="md"
        title="Pagamento Pix — Antecipação Pro"
        description={`Pague R$ ${(pricing.totalCents / 100).toFixed(2).replace(".", ",")} para estender seu plano por +${selectedMonths} meses.`}
      >
        <div className="space-y-4 py-2">
          {pixData?.qrCodeBase64 ? (
            <div className="flex flex-col items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white border border-border shadow-xs">
                <img
                  src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                  alt="QR Code Pix"
                  className="size-48 sm:size-52 object-contain"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5 text-warning-strong" aria-hidden="true" />
                <span>Válido por 30 minutos · Confirmação instantânea</span>
              </div>
            </div>
          ) : null}

          {pixData?.copyPasteKey ? (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-foreground">Código Pix Copia e Cola:</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={pixData.copyPasteKey}
                  className="w-full text-xs font-mono bg-muted/40 border border-border/80 rounded-lg px-2.5 py-2 text-foreground truncate select-all"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPix}
                  className="gap-1.5 shrink-0 cursor-pointer"
                >
                  {copiedKey ? <Check className="size-3.5 text-positive-strong" /> : <Copy className="size-3.5" />}
                  <span>{copiedKey ? "Copiado" : "Copiar"}</span>
                </Button>
              </div>
            </div>
          ) : null}

          <div className="p-3 rounded-lg bg-surface/80 border border-border/80 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
            <span>Assim que o pagamento for confirmado, seu novo vencimento será atualizado automaticamente.</span>
          </div>
        </div>

        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPixModalOpen(false)}
            className="w-full sm:w-auto cursor-pointer"
          >
            Fechar
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
