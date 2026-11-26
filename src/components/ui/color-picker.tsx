/* eslint-disable react-refresh/only-export-components */
import { useId, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, Droplet, X } from "lucide-react";
import { hexToRgb, relativeLuminance } from "@/domain/accessibility/index";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import { Input } from "./input";

export interface ColorPickerProps {
  /** Cor selecionada (hex `#RRGGBB` ou `#RGB`) ou vazia. */
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Normaliza um hex para `#RRGGBB` maiúsculo; `null` se inválido. */
export function normalizeHexColor(raw: string): string | null {
  const match = raw.trim().match(HEX_RE);
  if (!match) return null;
  let hex = match[1]!;
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  return `#${hex.toUpperCase()}`;
}

function isLightSwatch(hex: string): boolean {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return false;
  return relativeLuminance(hexToRgb(normalized)) > 0.179;
}

/**
 * Paleta harmonizada com a identidade (tokens.css F10): Teal (primária/receita),
 * Ouro (destaque/alerta), Coral (despesa), Sky (portfolio) e neutros petróleo.
 */
export const BRAND_COLOR_PALETTE = [
  "#0F766E",
  "#14B8A6",
  "#2A9D8F",
  "#2DD4BF",
  "#B45309",
  "#D97706",
  "#DDA726",
  "#F3C352",
  "#BE123C",
  "#E76F51",
  "#F43F5E",
  "#FB7185",
  "#1B3A4B",
  "#0369A1",
  "#38BDF8",
  "#3B82F6",
  "#142531",
  "#64748B",
] as const;

/**
 * ColorPicker próprio do app (Radix Popover) — substitui o input hex cru
 * (DESIGN_SYSTEM §13): paleta de marca + hex custom validado + limpar.
 */
export function ColorPicker({
  value,
  onValueChange,
  placeholder = "Escolha a cor",
  disabled,
  ariaLabel,
  className,
}: ColorPickerProps) {
  const hexInputId = useId();
  const [draft, setDraft] = useState("");

  const applyDraft = (raw: string) => {
    setDraft(raw);
    const normalized = normalizeHexColor(raw);
    if (normalized) onValueChange(normalized);
  };

  return (
    <PopoverPrimitive.Root
      onOpenChange={(open) => {
        if (open) setDraft(value);
      }}
    >
      <div className={cn("relative flex w-full items-center", className)}>
        <PopoverPrimitive.Trigger asChild disabled={disabled}>
          <button
            type="button"
            aria-label={ariaLabel}
            className={cn(
              "flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-surface px-3.5 text-base sm:text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
              value && !disabled && "pr-10",
              !value && "text-muted-foreground",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "size-4 shrink-0 rounded-full border border-border/60",
                  !value && "bg-muted",
                )}
                style={value ? { backgroundColor: value } : undefined}
              />
              <span className="truncate">{value || placeholder}</span>
            </span>
            {!value || disabled ? (
              <Droplet className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            ) : null}
          </button>
        </PopoverPrimitive.Trigger>

        {value && !disabled ? (
          <button
            type="button"
            aria-label="Limpar cor"
            onClick={(event) => {
              event.stopPropagation();
              setDraft("");
              onValueChange("");
              triggerSensory("selection");
            }}
            className="absolute right-2.5 flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-sm:after:absolute max-sm:after:-inset-2"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={{ top: 8, left: 8, right: 8, bottom: 80 }}
          className="z-floating-tools w-64 rounded-xl border border-primary/25 bg-surface p-3 shadow-xl backdrop-blur-md focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/40 data-[state=open]:animate-popover-in data-[state=closed]:animate-popover-out"
        >
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium text-muted-foreground">Paleta</p>
            <div
              className="grid grid-cols-6 gap-2"
              role="radiogroup"
              aria-label="Cores da paleta"
            >
              {BRAND_COLOR_PALETTE.map((swatch) => {
                const selected = normalizeHexColor(value) === swatch;
                const lightSwatch = isLightSwatch(swatch);
                return (
                  <button
                    key={swatch}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`Cor ${swatch}`}
                    onClick={() => {
                      triggerSensory("selection");
                      onValueChange(swatch);
                    }}
                    className={cn(
                      "relative flex size-8 cursor-pointer items-center justify-center rounded-full border border-border/80 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-sm:after:absolute max-sm:after:-inset-1",
                      selected && "ring-1 ring-ring ring-offset-1 ring-offset-surface",
                    )}
                    style={{ backgroundColor: swatch }}
                  >
                    {selected ? (
                      <Check
                        className={cn(
                          "size-4",
                          lightSwatch
                            ? "text-foreground dark:text-background"
                            : "text-surface dark:text-foreground drop-shadow-xs",
                        )}
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor={hexInputId} className="text-xs font-semibold text-foreground">
                Cor personalizada
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id={hexInputId}
                  value={draft}
                  onChange={(event) => applyDraft(event.target.value)}
                  onBlur={() => {
                    const normalized = normalizeHexColor(draft);
                    if (!normalized) setDraft(value);
                  }}
                  placeholder="#2A9D8F"
                  aria-label="Cor personalizada em hexadecimal"
                  className="h-9 px-3.5 text-base sm:text-sm"
                />
                {draft ? (
                  <button
                    type="button"
                    aria-label="Limpar cor personalizada"
                    onClick={() => {
                      setDraft("");
                      onValueChange("");
                    }}
                    className="relative shrink-0 cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-sm:after:absolute max-sm:after:-inset-2"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Aceita #RGB ou #RRGGBB; aplicada ao digitar.
              </p>
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
