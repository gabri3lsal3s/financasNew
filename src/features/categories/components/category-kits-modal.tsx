import { useState } from "react";
import { Briefcase, Car, Check, Home, Plus, Sparkles } from "lucide-react";
import { Badge, Button, Modal, ModalFooter, Tabs, type TabItem } from "@/components/ui";
import { CategoryIcon } from "@/components/modules";
import {
  ALL_CATEGORY_KITS,
  getMissingKitItems,
  isKitItemInstalled,
  normalizeCategoryKey,
  type CategoryKit,
  type CategoryKitId,
  type CategoryKitItem,
} from "@/domain/budgets";
import { useInstallCategoryKit } from "@/state";
import { triggerSensory } from "@/services/sensory";
import type { Category } from "@/types";

export interface CategoryKitsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCategories: readonly Category[];
  initialKitId?: CategoryKitId;
}

const KIT_ICONS = {
  sparkles: Sparkles,
  briefcase: Briefcase,
  family: Home,
  car: Car,
} as const;

/**
 * Modal de Catálogo de Kits de Categorias (CategoryKitsModal).
 * Substitui a antiga restauração monolítica por um seletor visual, modular e idempotente:
 *   - Permite recuperar categorias padrão excluídas (Kit Essencial);
 *   - Permite instalar kits temáticos completos ou categorias individuais;
 *   - Identifica visualmente o que já está instalado vs o que está ausente.
 */
export function CategoryKitsModal({
  open,
  onOpenChange,
  existingCategories,
  initialKitId = "essential",
}: CategoryKitsModalProps) {
  const [selectedKitId, setSelectedKitId] = useState<CategoryKitId>(initialKitId);
  const [installingItemKey, setInstallingItemKey] = useState<string | null>(null);

  const installMutation = useInstallCategoryKit();

  const handleInstallSingle = async (item: CategoryKitItem) => {
    const key = normalizeCategoryKey(item.name, item.type);
    setInstallingItemKey(key);
    try {
      await installMutation.mutateAsync([item]);
      triggerSensory("success");
    } finally {
      setInstallingItemKey(null);
    }
  };

  const handleInstallFullKit = async (kit: CategoryKit) => {
    const missing = getMissingKitItems(kit, existingCategories);
    if (missing.length === 0) return;

    try {
      await installMutation.mutateAsync(missing);
      triggerSensory("success");
    } catch {
      // Erro gerenciado pela mutation
    }
  };

  const tabItems: TabItem[] = ALL_CATEGORY_KITS.map((kit) => {
    const Icon = KIT_ICONS[kit.iconName];
    const missing = getMissingKitItems(kit, existingCategories);
    const isFullyInstalled = missing.length === 0;

    return {
      value: kit.id,
      label: kit.title,
      icon: <Icon className="size-4 shrink-0" aria-hidden="true" />,
      badge:
        missing.length > 0 ? (
          <Badge size="xs" variant="muted" className="ml-1 font-mono">
            {missing.length}
          </Badge>
        ) : (
          <Badge size="xs" variant="positive" className="ml-1">
            <Check className="size-3" aria-hidden="true" />
          </Badge>
        ),
      content: (
        <div className="flex flex-col gap-3.5 pt-1">
          {/* Banner de resumo do kit */}
          <div className="rounded-xl border border-border/80 bg-surface-hover/30 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-foreground">{kit.title}</h3>
                {kit.badge ? (
                  <Badge size="xs" variant="muted">
                    {kit.badge}
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">{kit.description}</p>
            </div>

            <div className="shrink-0 self-start sm:self-center">
              {isFullyInstalled ? (
                <Badge size="sm" variant="positive" className="gap-1.5 py-1 px-2.5">
                  <Check className="size-3.5" aria-hidden="true" />
                  <span>Kit 100% instalado</span>
                </Badge>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  loading={installMutation.isPending && !installingItemKey}
                  disabled={installMutation.isPending}
                  onClick={() => void handleInstallFullKit(kit)}
                  className="gap-1.5 font-medium"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  <span>Instalar kit ({missing.length} restantes)</span>
                </Button>
              )}
            </div>
          </div>

          {/* Grade de itens do kit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {kit.items.map((item) => {
              const isInstalled = isKitItemInstalled(item, existingCategories);
              const itemKey = normalizeCategoryKey(item.name, item.type);
              const isItemPending = installingItemKey === itemKey;

              return (
                <div
                  key={itemKey}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface p-3 shadow-xs min-w-0 transition-colors"
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="shrink-0 mt-0.5">
                      <CategoryIcon icon={item.icon} color={item.color} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2 break-words">
                        {item.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge
                          size="xs"
                          variant={item.type === "income" ? "positive" : "muted"}
                          className="shrink-0"
                        >
                          {item.type === "income" ? "Receita" : "Despesa"}
                        </Badge>
                        {item.is_family ? (
                          <Badge size="xs" variant="positive" className="shrink-0">
                            Família
                          </Badge>
                        ) : null}
                        {item.scope === "business" ? (
                          <Badge size="xs" variant="default" className="shrink-0">
                            Profissional
                          </Badge>
                        ) : null}
                      </div>
                      {item.description ? (
                        <p
                          className="text-[11px] text-muted-foreground line-clamp-2 break-words mt-1 leading-relaxed"
                          title={item.description}
                        >
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isInstalled ? (
                      <Badge
                        size="xs"
                        variant="muted"
                        className="gap-1 text-[11px] py-1 px-2 text-muted-foreground"
                      >
                        <Check className="size-3 text-positive-strong" aria-hidden="true" />
                        <span>Adicionada</span>
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        loading={isItemPending}
                        disabled={installMutation.isPending}
                        onClick={() => void handleInstallSingle(item)}
                        className="gap-1 text-xs h-7 px-2.5"
                      >
                        <Plus className="size-3" aria-hidden="true" />
                        <span>Adicionar</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ),
    };
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title="Kits de Categorias"
      description="Explore catálogos prontos e adicione categorias profissionais, familiares ou recupere padrões excluídos."
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Fechar
          </Button>
        </ModalFooter>
      }
    >
      <div className="flex flex-col gap-4 pt-1">
        <Tabs
          value={selectedKitId}
          onValueChange={(val) => setSelectedKitId(val as CategoryKitId)}
          items={tabItems}
          variant="pills"
          className="w-full"
        />
      </div>
    </Modal>
  );
}
