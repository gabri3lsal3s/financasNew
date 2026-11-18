import { useState } from "react";
import { Building2, TrendingUp, Wallet } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Checkbox,
  SearchInput,
} from "@/components/ui";
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
    const checkboxId = `catalog-bank-${inst.id}`;

    return (
      <label
        key={inst.id}
        htmlFor={checkboxId}
        className={cn(
          "flex items-center justify-between gap-2 p-2.5 rounded-lg border text-xs transition-colors cursor-pointer select-none",
          isChecked
            ? "border-primary/40 bg-primary/5 hover:bg-primary/10 font-medium text-foreground"
            : "border-border/80 bg-surface hover:bg-surface-hover text-muted-foreground",
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="truncate">{inst.name}</span>
          {isInstalled ? (
            <Badge variant="positive" size="xs">
              Instalado
            </Badge>
          ) : null}
        </div>
        <Checkbox
          id={checkboxId}
          checked={isChecked}
          onCheckedChange={(checked) => onToggleBank(inst.name, Boolean(checked))}
          aria-label={`Monitorar ${inst.name}`}
        />
      </label>
    );
  };

  return (
    <div className="pt-2 border-t border-border/80">
      <Accordion type="single" collapsible>
        <AccordionItem value="catalog">
          <AccordionTrigger className="px-3.5 py-3 text-xs">
            <span className="flex items-center gap-2 flex-wrap min-w-0">
              <Building2 className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>Explorar catálogo completo (25+ instituições financeiras)</span>
              <Badge variant="muted" size="xs">
                {monitoredBanks.length}/{HOMOLOGATED_BANKS.length} ativos
              </Badge>
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-3.5 pb-4 pt-1">
            <div id="notification-catalog-content" className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <SearchInput
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  onClear={() => setCatalogSearch("")}
                  placeholder="Buscar banco, carteira ou corretora…"
                  aria-label="Buscar no catálogo de instituições financeiras"
                  className="flex-1"
                />
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onSelectAll}
                  >
                    Marcar todos
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onDeselectAll}
                    className="text-muted-foreground hover:text-foreground"
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
                  {traditionalBanks.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Building2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        <span>Bancos Digitais e Tradicionais ({traditionalBanks.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {traditionalBanks.map((inst) => renderInstitutionItem(inst))}
                      </div>
                    </div>
                  ) : null}

                  {paymentWallets.length > 0 ? (
                    <div className="space-y-2 pt-2 border-t border-border/80">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Wallet className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        <span>Carteiras de Pagamento ({paymentWallets.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {paymentWallets.map((inst) => renderInstitutionItem(inst))}
                      </div>
                    </div>
                  ) : null}

                  {investmentBrokers.length > 0 ? (
                    <div className="space-y-2 pt-2 border-t border-border/80">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <TrendingUp className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        <span>Corretoras e Cripto ({investmentBrokers.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {investmentBrokers.map((inst) => renderInstitutionItem(inst))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
