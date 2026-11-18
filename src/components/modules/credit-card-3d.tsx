import { useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Radio } from "lucide-react";
import { Badge, MoneyText } from "@/components/ui";
import { bestPurchaseDay, cardLimitUsage } from "@/domain/cards";
import { usePrivacyMask } from "@/hooks/use-privacy-mask";
import { useVisualCustomization } from "@/hooks/use-visual-customization";
import { cn } from "@/lib/utils";
import type { CreditCard } from "@/types";
import { getCardGradient } from "./credit-card-gradient";
import {
  buildCardAriaLabel,
  systemPrefersReducedMotion,
} from "./credit-card/credit-card-helpers";
import { CardBrandBadge, EmvChip } from "./credit-card/credit-card-parts";

export { CardBrandBadge };

export interface CreditCard3DProps {
  card: CreditCard;
  /** Se o cartão é o principal da carteira. */
  isPrimary?: boolean;
  /** Valor nominal total / bruto utilizado na fatura em centavos. */
  usedLimitCents?: number;
  /** Valor ponderado com pesos de relatório em centavos. */
  usedLimitPonderadoCents?: number;
  /** Mês de competência da fatura (YYYY-MM). */
  competenceMonth?: string;
  /** Se o cartão está atualmente selecionado. */
  isSelected?: boolean;
  /** Se o cartão permite clique/seleção. */
  isInteractive?: boolean;
  /** Callback ao interagir com o cartão. */
  onClick?: () => void;
  /** Classe CSS adicional. */
  className?: string;
  /** Desativa o efeito 3D de tilt. */
  disableTilt?: boolean;
}

/**
 * Cartão de Crédito 3D com design limpo, minimalista, responsivo e sem ruídos visuais.
 * Compõe em sua própria superfície todas as informações essenciais:
 * - Nome e Bandeira, Chip EMV e Contactless
 * - Fatura Atual (protegida no Modo Privacidade), Limite e Ciclo de Datas
 */
export function CreditCard3D({
  card,
  isPrimary = false,
  usedLimitCents = 0,
  usedLimitPonderadoCents,
  isSelected = false,
  isInteractive = true,
  onClick,
  className,
  disableTilt = false,
}: CreditCard3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, isHovered: false });
  const masked = usePrivacyMask();
  const visual = useVisualCustomization();
  const tiltDisabled = disableTilt || visual.motionLevel !== "fluid" || systemPrefersReducedMotion();

  const background = getCardGradient(card.color);
  const limit = cardLimitUsage(card.credit_limit, usedLimitCents);
  const bestDay = bestPurchaseDay(card.closing_day);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (tiltDisabled || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((e.clientY - rect.top - centerY) / centerY) * -8;
    const rotateY = ((e.clientX - rect.left - centerX) / centerX) * 8;
    setTilt({ rotateX, rotateY, isHovered: true });
  };

  const handleMouseLeave = () => {
    if (tiltDisabled) return;
    setTilt({ rotateX: 0, rotateY: 0, isHovered: false });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive || !onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  const accessibleLabel = buildCardAriaLabel({
    name: card.name,
    masked,
    usedLimitCents,
    availableLimitCents: limit.availableLimitCents,
    usedLimitPonderadoCents,
  });

  const activeTilt = !tiltDisabled && tilt.isHovered;

  return (
    <div style={{ perspective: 1000 }} className={cn("w-full max-w-[390px] sm:max-w-[420px] select-none", className)}>
      <div
        ref={cardRef}
        role={isInteractive ? "button" : "article"}
        tabIndex={isInteractive ? 0 : undefined}
        onClick={isInteractive ? onClick : undefined}
        onKeyDown={handleKeyDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        aria-label={accessibleLabel}
        aria-pressed={isInteractive ? isSelected : undefined}
        style={{
          transform: activeTilt
            ? `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) translateZ(8px)`
            : isSelected
              ? "translateZ(4px)"
              : "rotateX(0deg) rotateY(0deg) translateZ(0)",
          boxShadow: isSelected
            ? "0 10px 24px -6px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.25)"
            : "0 6px 16px -6px rgba(0,0,0,0.35)",
          transition: activeTilt
            ? "transform 0.12s ease-out, box-shadow 0.2s ease-out"
            : "transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.4s ease-out",
        }}
        className={cn(
          "relative aspect-[1.586] min-h-[188px] sm:min-h-0 w-full rounded-2xl p-3.5 sm:p-5 text-white overflow-hidden",
          "border border-white/15 backdrop-blur-xl transition-all duration-200 flex flex-col justify-between",
          isInteractive &&
            "cursor-pointer hover:brightness-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          !card.is_active && "opacity-75 grayscale-[25%]",
        )}
      >
        <div className="absolute inset-0 z-0" style={{ background }} aria-hidden="true" />

        <div className="relative z-10 flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="text-sm sm:text-base md:text-lg font-semibold tracking-tight text-white drop-shadow-sm truncate">
              {card.name}
            </span>
            {isPrimary && (
              <Badge size="xs" variant="muted" className="bg-white/20 text-white border border-white/30 backdrop-blur-xs font-semibold shrink-0">
                Principal
              </Badge>
            )}
            {!card.is_active && (
              <Badge size="xs" variant="warning" className="bg-surface/90 border border-warning/40 uppercase shrink-0">
                Inativo
              </Badge>
            )}
          </div>
          <CardBrandBadge brand={card.brand} name={card.name} />
        </div>

        <div className="relative z-10 my-auto flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <EmvChip />
            <Radio className="size-3.5 sm:size-4 rotate-90 text-white/70 shrink-0" aria-label="Aproximação" />
          </div>

          <div className="flex flex-col items-end text-right min-w-0">
            <span className="text-[10px] sm:text-[11px] uppercase font-medium tracking-wider text-white/75 whitespace-nowrap">
              Fatura Total (Bruto)
            </span>
            <MoneyText
              cents={usedLimitCents}
              variant="hero"
              tone="default"
              deemphasizeCents
              animated
              aria-hidden={masked || undefined}
              className="text-sm sm:text-base md:text-lg font-bold text-white drop-shadow-xs tracking-tight"
            />
            {usedLimitPonderadoCents !== undefined && usedLimitPonderadoCents !== usedLimitCents && (
              <div className="flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded bg-black/40 border border-white/10 max-w-full">
                <span className="text-[10px] uppercase tracking-wider text-white/75 shrink-0">Ponderada:</span>
                <MoneyText
                  cents={usedLimitPonderadoCents}
                  variant="caption"
                  tone="default"
                  deemphasizeCents={false}
                  animated
                  aria-hidden={masked || undefined}
                  className="text-[10px] sm:text-[11px] font-semibold text-white"
                />
              </div>
            )}
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-2 border-t border-white/15 text-[10px] sm:text-xs text-white/85 font-mono">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
            <span className="text-white/70">•••• {card.last_four_digits || "••••"}</span>
            <span className="text-white/40" aria-hidden="true">·</span>
            <span data-tour="cards-best-day" className="whitespace-nowrap">Melhor dia: {bestDay}</span>
            <span className="text-white/40" aria-hidden="true">·</span>
            <span className="whitespace-nowrap">Fech.: {card.closing_day}</span>
            <span className="text-white/40" aria-hidden="true">·</span>
            <span className="whitespace-nowrap">Venc.: {card.due_day}</span>
          </div>

          {limit.totalLimitCents !== null && (
            <div className="shrink-0 ml-auto text-right flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
              <span className="inline-flex items-center gap-1">
                <span className="text-white/75">Disp.:</span>
                <MoneyText
                  cents={limit.availableLimitCents ?? 0}
                  variant="caption"
                  tone="default"
                  deemphasizeCents={false}
                  aria-hidden={masked || undefined}
                  className="text-white font-semibold text-[10px] sm:text-xs"
                />
              </span>
              <span className="text-white/40 hidden md:inline" aria-hidden="true">/</span>
              <span className="hidden md:inline-flex items-center gap-1">
                <span className="text-white/75">Total:</span>
                <MoneyText
                  cents={limit.totalLimitCents}
                  variant="caption"
                  tone="default"
                  deemphasizeCents={false}
                  aria-hidden={masked || undefined}
                  className="text-white/90 font-normal text-xs"
                />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
