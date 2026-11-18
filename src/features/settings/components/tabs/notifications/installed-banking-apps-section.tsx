import { RefreshCw, Smartphone } from "lucide-react";
import { Badge, Button, Checkbox } from "@/components/ui";
import {
  HOMOLOGATED_INSTITUTIONS,
  type InstitutionCategory,
} from "@/domain/notifications";
import { cn } from "@/lib/utils";
import type { InstalledBankApp } from "@/services/native";

function getCategoryLabel(category: InstitutionCategory): string {
  switch (category) {
    case "traditional_digital":
      return "Banco";
    case "payment_wallets":
      return "Carteira";
    case "investments_crypto":
      return "Investimentos";
  }
}

export interface InstalledBankingAppsSectionProps {
  installedBanks: string[];
  installedApps: InstalledBankApp[];
  monitoredBanks: string[];
  isScanning: boolean;
  onRescan: () => void;
  onSelectAllInstalled: () => void;
  onToggleBank: (bankName: string, checked: boolean) => void;
}

export function InstalledBankingAppsSection({
  installedBanks,
  installedApps,
  monitoredBanks,
  isScanning,
  onRescan,
  onSelectAllInstalled,
  onToggleBank,
}: InstalledBankingAppsSectionProps) {
  return (
    <div className="pt-2 border-t border-border/80 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Smartphone className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span className="font-semibold text-xs text-foreground">
            Aplicativos no seu Dispositivo
          </span>
          {installedBanks.length > 0 ? (
            <Badge variant="positive" size="xs">
              {installedBanks.length} detectado{installedBanks.length > 1 ? "s" : ""}
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRescan}
            disabled={isScanning}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            aria-label="Re-escanear aplicativos instalados"
          >
            <RefreshCw
              className={cn("size-3.5", isScanning && "animate-spin")}
              aria-hidden="true"
            />
            <span>{isScanning ? "Escaneando..." : "Re-escanear"}</span>
          </Button>
          {installedBanks.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSelectAllInstalled}
              className="text-primary-strong hover:text-primary font-medium"
            >
              Monitorar todos os instalados
            </Button>
          ) : null}
        </div>
      </div>

      {installedBanks.length === 0 ? (
        <div className="p-4 rounded-xl border border-dashed border-border/80 bg-surface text-center space-y-2.5">
          <div className="space-y-1">
            <p className="text-xs font-medium text-foreground">
              Nenhum aplicativo bancário suportado detectado automaticamente no dispositivo
            </p>
            <p className="text-[11px] text-muted-foreground">
              Explore o catálogo completo abaixo para ativar manualmente as instituições que você utiliza.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRescan}
            disabled={isScanning}
            className="gap-1.5 mx-auto"
          >
            <RefreshCw
              className={cn("size-3.5", isScanning && "animate-spin")}
              aria-hidden="true"
            />
            <span>{isScanning ? "Escaneando..." : "Re-escanear aplicativos"}</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {installedBanks.map((bankName) => {
            const institution = HOMOLOGATED_INSTITUTIONS.find(
              (inst) =>
                inst.name.toLowerCase() === bankName.toLowerCase() ||
                inst.packages.some((pkg) =>
                  installedApps.some(
                    (app) =>
                      app.packageName === pkg &&
                      app.bankName.toLowerCase() === bankName.toLowerCase(),
                  ),
                ),
            );
            const isChecked = monitoredBanks.includes(bankName);
            const categoryLabel = institution
              ? getCategoryLabel(institution.category)
              : "Banco";
            const checkboxId = `installed-bank-${bankName.toLowerCase().replace(/\s+/g, "-")}`;

            return (
              <label
                key={bankName}
                htmlFor={checkboxId}
                className={cn(
                  "flex items-center justify-between gap-2 p-3 rounded-xl border text-xs transition-colors cursor-pointer select-none shadow-xs",
                  isChecked
                    ? "border-primary/40 bg-primary/5 hover:bg-primary/10 font-medium text-foreground"
                    : "border-border/80 bg-surface hover:bg-surface-hover text-muted-foreground",
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-xs text-foreground truncate">
                    {bankName}
                  </span>
                  <Badge variant={isChecked ? "positive" : "muted"} size="xs">
                    {categoryLabel}
                  </Badge>
                </div>
                <Checkbox
                  id={checkboxId}
                  checked={isChecked}
                  onCheckedChange={(checked) => onToggleBank(bankName, Boolean(checked))}
                  aria-label={`Monitorar ${bankName}`}
                />
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
