import { Check } from "lucide-react";
import { Badge, Checkbox, MoneyText } from "@/components/ui";
import { isAssetCashLike } from "@/domain/family";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import type { PortfolioAsset } from "@/types";

const AVAILABLE_ASSET_CLASSES = [
  "Caixa",
  "Renda Fixa",
  "Ações",
  "FIIs",
  "ETFs",
  "BDRs",
  "Cripto",
  "Internacional",
];

export interface FamilyShareAssetsContentProps {
  shareAll: boolean;
  onShareAllChange: (checked: boolean) => void;
  selectedClasses: string[];
  onToggleClass: (cls: string) => void;
  userAssets: PortfolioAsset[];
  isTogglePending: boolean;
  onToggleSingleAsset: (assetId: string, currentIsFamily: boolean) => void;
}

export function FamilyShareAssetsContent({
  shareAll,
  onShareAllChange,
  selectedClasses,
  onToggleClass,
  userAssets,
  isTogglePending,
  onToggleSingleAsset,
}: FamilyShareAssetsContentProps) {
  return (
    <div className="space-y-5 pt-2">
      <div className="p-3.5 rounded-2xl border border-border/80 bg-surface-raised space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-foreground block">
              Compartilhar toda a minha carteira
            </span>
            <span className="text-[11px] text-muted-foreground block">
              Todos os seus ativos atuais e futuros serão consolidados no patrimônio familiar (ideal para casais em comunhão total).
            </span>
          </div>
          <Checkbox
            checked={shareAll}
            onCheckedChange={(checked) => onShareAllChange(Boolean(checked))}
            aria-label="Compartilhar toda a minha carteira de investimentos com a família"
          />
        </div>
      </div>

      <div className={cn("space-y-2.5 transition-opacity", shareAll && "opacity-50 pointer-events-none")}>
        <div className="space-y-0.5">
          <span className="text-xs font-semibold text-foreground block">
            Compartilhar por Classes de Ativos
          </span>
          <span className="text-[11px] text-muted-foreground block">
            Qualquer ativo pertencente às classes selecionadas entra automaticamente na reserva ou patrimônio familiar.
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {AVAILABLE_ASSET_CLASSES.map((cls) => {
            const isSelected = selectedClasses.includes(cls);
            return (
              <button
                key={cls}
                type="button"
                onClick={() => {
                  triggerSensory("selection");
                  onToggleClass(cls);
                }}
                className={cn(
                  "flex items-center justify-between min-h-11 sm:min-h-10 p-2.5 rounded-xl border text-xs font-medium transition-all text-left cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  isSelected
                    ? "border-primary/40 bg-primary/10 text-primary-strong"
                    : "border-border/80 bg-surface hover:border-border text-foreground",
                )}
                aria-pressed={isSelected}
              >
                <span className="truncate">{cls}</span>
                {isSelected && <Check className="size-3.5 shrink-0 text-primary-strong" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className={cn("space-y-2.5 pt-1", shareAll && "opacity-50 pointer-events-none")}>
        <div className="space-y-0.5">
          <span className="text-xs font-semibold text-foreground block">
            Ativos Individuais Específicos
          </span>
          <span className="text-[11px] text-muted-foreground block">
            Você também pode alternar ativos específicos da sua carteira para compartilhar com a família.
          </span>
        </div>

        <div className="p-3 rounded-xl border border-border/80 bg-surface-raised space-y-1 text-[11px] text-muted-foreground">
          <p>
            <strong className="text-foreground font-medium">Como a Reserva da Casa é calculada:</strong> Apenas ativos com perfil de liquidez imediata (Caixa, Tesouro Selic ou títulos com &ldquo;CDI&rdquo; no código ou classe Caixa) compõem a Reserva da Casa.
          </p>
          <p className="text-[10px] text-muted-foreground/80">
            Ativos de longo prazo (Tesouro IPCA, Ações, FIIs ou títulos com carência) entram no Patrimônio Total Compartilhado a valor atual de mercado.
          </p>
        </div>

        {userAssets.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground">
            Nenhum ativo cadastrado na sua carteira pessoal de investimentos.
          </div>
        ) : (
          <div className="space-y-2">
            {userAssets.map((asset) => {
              const isAutoByClass = Boolean(asset.asset_class && selectedClasses.includes(asset.asset_class));
              const isShared = shareAll || isAutoByClass || Boolean(asset.is_family);
              const isCashLike = isAssetCashLike(asset.ticker, asset.asset_class);

              return (
                <div
                  key={asset.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-border/80 bg-surface"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">{asset.ticker}</span>
                      {asset.asset_class && <Badge variant="muted" size="xs">{asset.asset_class}</Badge>}
                      {isAutoByClass && !shareAll && <Badge variant="default" size="xs">Via classe</Badge>}
                      {isShared && (
                        <Badge variant={isCashLike ? "positive" : "muted"} size="xs">
                          {isCashLike ? "Conta como Reserva" : "Patrimônio Investido"}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground block">
                      Qtd: {asset.quantity} · Preço Médio:{" "}
                      <MoneyText cents={Math.round(asset.average_price * 100)} tone="default" variant="caption" />
                    </span>
                  </div>

                  <Checkbox
                    checked={isShared}
                    disabled={shareAll || isAutoByClass || isTogglePending}
                    onCheckedChange={() => onToggleSingleAsset(asset.id, Boolean(asset.is_family))}
                    aria-label={`Compartilhar ativo ${asset.ticker} com a família`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
