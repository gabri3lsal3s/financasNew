import { useState } from "react";
import { useNavigate } from "react-router";
import { Check, Lock } from "lucide-react";
import { Badge } from "@/components/ui";
import { UpgradeDialog } from "@/components/modules/subscription/upgrade-dialog";
import { buildCheckoutUrl } from "@/domain/subscription/plans";
import { useIsPro } from "@/hooks/use-is-pro";
import type { AccentTheme } from "@/hooks/use-visual-customization";
import { cn } from "@/lib/utils";

const ACCENT_OPTIONS: {
  id: AccentTheme;
  label: string;
  swatchCssVar?: string;
  isProExclusive?: boolean;
}[] = [
  { id: "teal", label: "Teal Vital", swatchCssVar: "hsl(var(--accent-swatch-teal))" },
  { id: "mono", label: "Monocromático" },
  {
    id: "gold",
    label: "Ouro Âmbar",
    swatchCssVar: "hsl(var(--accent-swatch-gold))",
    isProExclusive: true,
  },
];

export interface AccentPaletteSelectorProps {
  accent: AccentTheme;
  onSelectAccent: (id: AccentTheme, label: string) => void;
  isPro?: boolean;
}

export function AccentPaletteSelector({
  accent,
  onSelectAccent,
  isPro: isProProp,
}: AccentPaletteSelectorProps) {
  const isPro = useIsPro(isProProp);
  const navigate = useNavigate();
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);

  const handleSelect = (option: (typeof ACCENT_OPTIONS)[number]) => {
    if (option.isProExclusive && !isPro) {
      setUpgradeDialogOpen(true);
      return;
    }
    onSelectAccent(option.id, option.label);
  };

  return (
    <>
      <div className="space-y-2.5 pt-2 border-t border-border/80">
        <div className="text-xs font-semibold text-foreground">Cor de Destaque (Accent)</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {ACCENT_OPTIONS.map((a) => {
            const isSelected = accent === a.id;
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handleSelect(a)}
                className={cn(
                  "flex items-center gap-2 p-2.5 rounded-xl border text-left transition-colors duration-150 select-none cursor-pointer min-w-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  isSelected
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-xs"
                    : "border-border/80 bg-surface hover:bg-surface-hover",
                )}
              >
                <span
                  className={cn(
                    "size-5 rounded-full shrink-0 shadow-xs flex items-center justify-center border border-border/80",
                    !a.swatchCssVar && "bg-foreground",
                  )}
                  style={a.swatchCssVar ? { backgroundColor: a.swatchCssVar } : undefined}
                >
                  {isSelected ? (
                    <Check
                      className={cn(
                        "size-3",
                        a.id === "mono" ? "text-background" : "text-primary-foreground",
                      )}
                      aria-hidden="true"
                    />
                  ) : a.isProExclusive && !isPro ? (
                    <Lock
                      className="size-2.5 text-primary-foreground drop-shadow-xs"
                      aria-hidden="true"
                    />
                  ) : null}
                </span>
                <span className="font-medium text-xs text-foreground leading-tight truncate">
                  {a.label}
                </span>
                {a.isProExclusive && (
                  <Badge
                    size="xs"
                    variant={isPro ? "default" : "muted"}
                    className="ml-auto shrink-0 font-bold tracking-wider"
                  >
                    PRO
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <UpgradeDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        context="Ouro Âmbar (Exclusivo Pro)"
        contextDescription="O acabamento Ouro Âmbar é a assinatura visual nobre exclusiva para membros do Axir Pro. Faça o upgrade agora para ter acesso a essa cor de destaque e a todos os recursos avançados."
        onProceedToCheckout={(plan) => {
          setUpgradeDialogOpen(false);
          navigate(buildCheckoutUrl({ plan }));
        }}
      />
    </>
  );
}
