import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { MoneyText } from "@/components/ui/money-text";
import {
  useMyFamily,
  usePortfolioAssets,
  useUpdateFamilyWealthSharing,
  useTogglePortfolioAssetFamily,
} from "@/state";
import { isAssetCashLike } from "@/domain/family";
import type { FamilyMemberWithProfile } from "@/data/repositories/families";
import { cn } from "@/lib/utils";

export interface FamilyShareAssetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

interface DialogContentProps {
  currentMember: FamilyMemberWithProfile;
  familyId?: string | null;
  onClose: () => void;
}

function FamilyShareAssetsContent({ currentMember, familyId, onClose }: DialogContentProps) {
  const assetsQuery = usePortfolioAssets();
  const updateWealthSharing = useUpdateFamilyWealthSharing();
  const toggleAssetFamily = useTogglePortfolioAssetFamily();

  const userAssets = assetsQuery.data ?? [];

  const [shareAll, setShareAll] = useState(() => Boolean(currentMember.share_all_portfolio));
  const [selectedClasses, setSelectedClasses] = useState<string[]>(
    () => currentMember.shared_asset_classes ?? [],
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleToggleClass = (cls: string) => {
    setSelectedClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls],
    );
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    try {
      await updateWealthSharing.mutateAsync({
        memberId: currentMember.id,
        shareAllPortfolio: shareAll,
        sharedAssetClasses: selectedClasses,
      });
      onClose();
    } catch {
      // Toast tratado na mutation
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleSingleAsset = async (assetId: string, currentIsFamily: boolean) => {
    if (!familyId) return;
    try {
      await toggleAssetFamily.mutateAsync({
        assetId,
        isFamily: !currentIsFamily,
        familyId: !currentIsFamily ? familyId : null,
      });
    } catch {
      // Erro tratado na mutation
    }
  };

  return (
    <>
      <div className="space-y-5 pt-2 max-h-[70vh] overflow-y-auto pr-1">
        {/* Nível 1: Toda a Carteira */}
        <div className="p-3.5 rounded-2xl border border-border/80 bg-surface-subtle/40 space-y-2">
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
              onCheckedChange={(checked) => setShareAll(Boolean(checked))}
              aria-label="Compartilhar toda a minha carteira de investimentos com a família"
            />
          </div>
        </div>

        {/* Nível 2: Por Classes de Ativos */}
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
                  onClick={() => handleToggleClass(cls)}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition-all text-left cursor-pointer",
                    isSelected
                      ? "border-primary/40 bg-primary/10 text-primary-strong"
                      : "border-border/70 bg-surface hover:border-border text-foreground",
                  )}
                  aria-pressed={isSelected}
                >
                  <span className="truncate">{cls}</span>
                  {isSelected && <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Nível 3: Ativo a Ativo (Granular) */}
        <div className={cn("space-y-2.5 pt-1", shareAll && "opacity-50 pointer-events-none")}>
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-foreground block">
              Ativos Individuais Específicos
            </span>
            <span className="text-[11px] text-muted-foreground block">
              Você também pode alternar ativos específicos da sua carteira para compartilhar com a família.
            </span>
          </div>

          {/* Dica de Governança e Diferenciação Patrimônio vs. Reserva */}
          <div className="p-3 rounded-xl border border-border/70 bg-surface-subtle/30 space-y-1 text-[11px] text-muted-foreground">
            <p>
              <strong className="text-foreground font-medium">Como a Reserva da Casa é calculada:</strong> Apenas ativos com perfil de liquidez imediata (Caixa, Tesouro Selic ou títulos com &ldquo;CDI&rdquo; no código ou classe Caixa) compõem a Reserva da Casa.
            </p>
            <p className="text-[10px] text-muted-foreground/80">
              Ativos de longo prazo (Tesouro IPCA, Ações, FIIs ou títulos com carência) entram no Patrimônio Total Compartilhado a valor atual de mercado.
            </p>
          </div>

          {userAssets.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-border/70 text-center text-xs text-muted-foreground">
              Nenhum ativo cadastrado na sua carteira pessoal de investimentos.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {userAssets.map((asset) => {
                const isAutoByClass = Boolean(
                  asset.asset_class && selectedClasses.includes(asset.asset_class),
                );
                const isShared = shareAll || isAutoByClass || Boolean(asset.is_family);
                const isCashLike = isAssetCashLike(asset.ticker, asset.asset_class);

                return (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 bg-surface"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">
                          {asset.ticker}
                        </span>
                        {asset.asset_class && (
                          <Badge variant="muted" size="xs">
                            {asset.asset_class}
                          </Badge>
                        )}
                        {isAutoByClass && !shareAll && (
                          <Badge variant="default" size="xs">
                            Via classe
                          </Badge>
                        )}
                        {isShared && (
                          <Badge variant={isCashLike ? "positive" : "muted"} size="xs">
                            {isCashLike ? "Conta como Reserva" : "Patrimônio Investido"}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground block">
                        Qtd: {asset.quantity} · Preço Médio:{" "}
                        <MoneyText cents={Math.round(asset.average_price * 100)} />
                      </span>
                    </div>

                    <Checkbox
                      checked={isShared}
                      disabled={shareAll || isAutoByClass || toggleAssetFamily.isPending}
                      onCheckedChange={() =>
                        handleToggleSingleAsset(asset.id, Boolean(asset.is_family))
                      }
                      aria-label={`Compartilhar ativo ${asset.ticker} com a família`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSaving}
          className="rounded-xl cursor-pointer"
        >
          Cancelar
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={handleSavePreferences}
          disabled={isSaving}
          className="rounded-xl cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
              <span>Salvando…</span>
            </>
          ) : (
            <span>Salvar Preferências</span>
          )}
        </Button>
      </ModalFooter>
    </>
  );
}

/**
 * Diálogo Canônico de Compartilhamento de Ativos e Classes com a Família.
 */
export function FamilyShareAssetsDialog({
  open,
  onOpenChange,
}: FamilyShareAssetsDialogProps) {
  const { data: myFamilyData } = useMyFamily();
  const currentMember = myFamilyData?.currentMember;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Compartilhar Meus Investimentos"
      description="Escolha quais investimentos da sua carteira pessoal compõem o patrimônio e reserva da família."
      size="lg"
    >
      {currentMember ? (
        <FamilyShareAssetsContent
          key={currentMember.id}
          currentMember={currentMember}
          familyId={myFamilyData?.family?.id}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Modal>
  );
}
