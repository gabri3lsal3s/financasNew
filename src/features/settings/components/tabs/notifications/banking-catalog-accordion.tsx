import { useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Search,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Badge, Button, Checkbox, Input } from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import {
  HOMOLOGATED_BANKS,
  HOMOLOGATED_INSTITUTIONS,
  type HomologatedInstitution,
} from "@/domain/notifications";
import { cn } from "@/lib/utils";
import type { InstalledBankApp } from "@/services/native";

export interface BankingCatalogAccordionProps {
  monitoredBanks: string[];
  installedBanks: string[];
  installedApps: InstalledBankApp[];
  onToggleBank: (bankName: string, nextChecked: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function BankingCatalogAccordion({
  monitoredBanks,
  installedBanks,
  installedApps,
  onToggleBank,
  onSelectAll,
  onDeselectAll,
}: BankingCatalogAccordionProps) {
  const [catalogSearch, setCatalogSearch] = useState("");
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  const searchLower = catalogSearch.toLowerCase().trim();

  const traditionalBanks = HOMOLOGATED_INSTITUTIONS.filter(
    (inst) =>
      inst.category === "traditional_digital" &&
      (!searchLower || inst.name.toLowerCase().includes(searchLower)),
  );

  const paymentWallets = HOMOLOGATED_INSTITUTIONS.filter(
    (inst) =>
      inst.category === "payment_wallets" &&
      (!searchLower || inst.name.toLowerCase().includes(searchLower)),
  );

  const investmentBrokers = HOMOLOGATED_INSTITUTIONS.filter(
    (inst) =>
      inst.category === "investments_crypto" &&
      (!searchLower || inst.name.toLowerCase().includes(searchLower)),
  );

  const totalMatching =
    traditionalBanks.length + paymentWallets.length + investmentBrokers.length;

  const renderInstitutionItem = (inst: HomologatedInstitution) => {
    const isChecked = monitoredBanks.includes(inst.name);
    const isInstalled =
      installedBanks.some(
        (b) => b.trim().toLowerCase() === inst.name.trim().toLowerCase(),
      ) ||
      installedApps.some(
        (app) =>
          app.isInstalled &&
          (inst.packages.includes(app.packageName) ||
            app.bankName.trim().toLowerCase() === inst.name.trim().toLowerCase()),
      );

    return (
      <div
        key={inst.id}
        role="button"
        tabIndex={0}
        onClick={() => onToggleBank(inst.name, !isChecked)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleBank(inst.name, !isChecked);
          }
        }}
        className={cn(
          "flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors cursor-pointer select-none",
          isChecked
            ? "border-primary/40 bg-primary/5 hover:bg-primary/10 font-medium text-foreground"
            : "border-border/80 bg-surface hover:bg-surface-hover text-muted-foreground",
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 pr-1.5">
          <span className="truncate">{inst.name}</span>
          {isInstalled && (
            <Badge variant="positive" size="xs">
              Instalado
            </Badge>
          )}
        </div>
        <Checkbox
          checked={isChecked}
          onCheckedChange={(checked) => onToggleBank(inst.name, Boolean(checked))}
          aria-label={`Monitorar ${inst.name}`}
        />
      </div>
    );
  };

  return (
    <div className="pt-2 border-t border-border/80 space-y-3">
      <button
        type="button"
        onClick={() => {
          triggerSensory("toggle");
          setIsCatalogOpen((prev) => !prev);
        }}
        className="flex w-full items-center justify-between p-3.5 rounded-xl border border-border/80 bg-surface hover:bg-surface-hover shadow-xs text-xs font-semibold text-foreground transition-colors cursor-pointer select-none"
        aria-expanded={isCatalogOpen}
        aria-controls="notification-catalog-content"
      >
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>Explorar catálogo completo (25+ instituições financeiras)</span>
          <Badge variant="muted" size="xs">
            {monitoredBanks.length}/{HOMOLOGATED_BANKS.length} ativos
          </Badge>
        </div>
        {isCatalogOpen ? (
          <ChevronUp className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
        )}
      </button>

      {isCatalogOpen && (
        <div
          id="notification-catalog-content"
          className="p-4 rounded-xl border border-border/80 bg-surface shadow-xs space-y-4"
        >
          {/* Busca Instantânea e Ações Globais */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
              <Input
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Buscar banco, carteira ou corretora..."
                className="pl-8 text-xs h-9"
                aria-label="Buscar no catálogo de instituições financeiras"
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
              <Button
                variant="ghost"
                size="xs"
                onClick={onSelectAll}
                className="text-[11px] h-8 px-2"
              >
                Marcar todos
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={onDeselectAll}
                className="text-[11px] h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                Desmarcar todos
              </Button>
            </div>
          </div>

          {totalMatching === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Nenhuma instituição encontrada para &quot;{catalogSearch}&quot;.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Grupo 1: Bancos Digitais e Tradicionais */}
              {traditionalBanks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Building2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span>Bancos Digitais e Tradicionais ({traditionalBanks.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {traditionalBanks.map((inst) => renderInstitutionItem(inst))}
                  </div>
                </div>
              )}

              {/* Grupo 2: Carteiras de Pagamento */}
              {paymentWallets.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Wallet className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span>Carteiras de Pagamento ({paymentWallets.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {paymentWallets.map((inst) => renderInstitutionItem(inst))}
                  </div>
                </div>
              )}

              {/* Grupo 3: Corretoras e Cripto */}
              {investmentBrokers.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <TrendingUp className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span>Corretoras e Cripto ({investmentBrokers.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {investmentBrokers.map((inst) => renderInstitutionItem(inst))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
