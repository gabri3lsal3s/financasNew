import { useState, useRef, type MouseEvent, type KeyboardEvent } from "react";
import { Radio } from "lucide-react";
import { formatCentsAsBRL } from "@/services/masks";
import { bestPurchaseDay, cardLimitUsage } from "@/domain/cards";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";
import type { CreditCard } from "@/types";

export interface CreditCard3DProps {
  card: CreditCard;
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
 * Componente do Chip EMV com acabamento metálico, pads de contato e vetorização precisa.
 */
function EmvChip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative w-10 h-7 sm:w-11 sm:h-8 rounded-md bg-gradient-to-br from-[#E8CF72] via-[#FFF3CA] to-[#BFA145] p-[1px] shadow-[0_1px_3px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.7)] border border-[#A68832]/70 overflow-hidden shrink-0",
        className,
      )}
      aria-label="Chip EMV"
    >
      <svg
        viewBox="0 0 44 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full rounded-[3px] opacity-80"
        aria-hidden="true"
      >
        {/* Borda externa */}
        <rect x="0.5" y="0.5" width="43" height="31" rx="2.5" stroke="#7A5E12" strokeWidth="0.75" />

        {/* Linha horizontal central */}
        <line x1="0" y1="16" x2="44" y2="16" stroke="#7A5E12" strokeWidth="0.75" />

        {/* Linhas verticais laterais */}
        <line x1="14" y1="0" x2="14" y2="32" stroke="#7A5E12" strokeWidth="0.75" />
        <line x1="30" y1="0" x2="30" y2="32" stroke="#7A5E12" strokeWidth="0.75" />

        {/* Ilha de contato central arredondada */}
        <rect x="14.5" y="8.5" width="15" height="15" rx="7.5" fill="#FAF1CB" stroke="#7A5E12" strokeWidth="0.75" />
        <circle cx="22" cy="16" r="3.5" stroke="#7A5E12" strokeWidth="0.75" fill="none" />
      </svg>
    </div>
  );
}

/**
 * Gera gradiente suave com base na cor do cartão.
 */
function getCardGradient(colorHex?: string | null): string {
  if (!colorHex || colorHex.trim() === "") {
    return "linear-gradient(135deg, #162432 0%, #0F172A 100%)";
  }

  const hex = colorHex.trim();
  return `linear-gradient(135deg, ${hex}EE 0%, ${hex}99 40%, #090e15 100%)`;
}

/**
 * Renderiza a marca/bandeira com acabamento minimalista.
 */
function CardBrandBadge({ brand, name }: { brand?: string | null; name: string }) {
  const brandName = (brand || name || "").toLowerCase();

  if (brandName.includes("visa")) {
    return (
      <span className="font-serif italic font-black text-lg tracking-tight text-white drop-shadow-sm">
        VISA
      </span>
    );
  }

  if (brandName.includes("master")) {
    return (
      <div className="flex items-center" aria-label="Mastercard">
        <div className="size-5 rounded-full bg-rose-500/90 shadow-sm -mr-2" />
        <div className="size-5 rounded-full bg-amber-400/90 shadow-sm" />
      </div>
    );
  }

  if (brandName.includes("elo")) {
    return (
      <div className="flex items-center gap-0.5 font-black text-base tracking-wider text-white" aria-label="Elo">
        <span className="text-yellow-400">e</span>
        <span className="text-rose-500">l</span>
        <span className="text-sky-400">o</span>
      </div>
    );
  }

  if (brandName.includes("nubank") || brandName.includes("nu")) {
    return (
      <span className="font-bold text-base tracking-tight text-purple-300">
        nu
      </span>
    );
  }

  if (brandName.includes("inter")) {
    return (
      <span className="font-extrabold text-xs tracking-widest text-orange-400">
        INTER
      </span>
    );
  }

  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
      {brand || "Black"}
    </span>
  );
}

/**
 * Cartão de Crédito 3D com design limpo, minimalista, responsivo e sem ruídos visuais.
 * Compõe em sua própria superfície todas as informações essenciais:
 * - Nome e Bandeira
 * - Chip EMV ultra-realista e Contactless
 * - Número virtual e Fatura Atual
 * - Limite de Crédito (Total e Disponível)
 * - Melhor Dia, Fechamento e Vencimento
 */
export function CreditCard3D({
  card,
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

  const background = getCardGradient(card.color);
  const limit = cardLimitUsage(card.credit_limit, usedLimitCents);
  const bestDay = bestPurchaseDay(card.closing_day);

  // 4 dígitos virtuais
  const lastFourDigits = (card.id.replace(/\D/g, "") + "8492").slice(-4);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (disableTilt || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;

    setTilt({ rotateX, rotateY, isHovered: true });
  };

  const handleMouseLeave = () => {
    if (disableTilt) return;
    setTilt({ rotateX: 0, rotateY: 0, isHovered: false });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive || !onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      style={{ perspective: 1000 }}
      className={cn("w-full max-w-[390px] sm:max-w-[420px] select-none", className)}
    >
      <div
        ref={cardRef}
        role={isInteractive ? "button" : "article"}
        tabIndex={isInteractive ? 0 : undefined}
        onClick={isInteractive ? onClick : undefined}
        onKeyDown={handleKeyDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        aria-label={`Cartão ${card.name}, fatura atual ${formatCentsAsBRL(usedLimitCents)}${usedLimitPonderadoCents !== undefined ? `, ponderada ${formatCentsAsBRL(usedLimitPonderadoCents)}` : ""}`}
        aria-pressed={isInteractive ? isSelected : undefined}
        style={{
          transform: tilt.isHovered
            ? `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) translateZ(8px)`
            : isSelected
              ? "translateZ(4px)"
              : "rotateX(0deg) rotateY(0deg) translateZ(0)",
          boxShadow: isSelected
            ? "0 10px 24px -6px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.25)"
            : "0 6px 16px -6px rgba(0,0,0,0.35)",
          transition: tilt.isHovered
            ? "transform 0.12s ease-out, box-shadow 0.2s ease-out"
            : "transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.4s ease-out",
        }}
        className={cn(
          "relative aspect-[1.586] w-full rounded-2xl p-4 sm:p-5 text-white overflow-hidden cursor-pointer",
          "border border-white/15 backdrop-blur-xl transition-all duration-300",
          "flex flex-col justify-between",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          !card.is_active && "opacity-70 grayscale-[25%]",
        )}
      >
        {/* Fundo gradiente limpo */}
        <div
          className="absolute inset-0 z-0"
          style={{ background }}
          aria-hidden="true"
        />

        {/* Linha 1: Topo — Nome do Cartão + Bandeira */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-semibold tracking-tight text-white drop-shadow-sm truncate max-w-[220px]">
              {card.name}
            </span>
            {!card.is_active && (
              <span className="text-[10px] uppercase font-medium text-amber-300/90 px-1.5 py-0.5 rounded-full bg-black/40 border border-amber-400/30">
                Inativo
              </span>
            )}
          </div>

          <CardBrandBadge brand={card.brand} name={card.name} />
        </div>

        {/* Linha 2: Meio — Chip EMV Vector, Contactless e Fatura Atual */}
        <div className="relative z-10 my-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <EmvChip />
            <Radio className="size-4 rotate-90 text-white/70" aria-label="Aproximação" />
          </div>

          {/* Fatura Atual (Bruto + Ponderada) */}
          <div className="flex flex-col items-end text-right">
            <span className="text-[10px] uppercase font-medium tracking-wider text-white/70">
              Fatura Total (Bruto)
            </span>
            <span className="font-mono text-base sm:text-lg font-bold text-white drop-shadow-xs">
              <NumberTicker value={usedLimitCents} format={formatCentsAsBRL} />
            </span>
            {usedLimitPonderadoCents !== undefined && (
              <div className="flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded bg-black/35 border border-white/10">
                <span className="text-[9px] uppercase tracking-wider text-white/70">Ponderada:</span>
                <span className="font-mono text-[11px] font-semibold text-white">
                  <NumberTicker value={usedLimitPonderadoCents} format={formatCentsAsBRL} />
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Linha 3: Rodapé — Número Mascarado, Ciclo de Datas e Limite */}
        <div className="relative z-10 flex flex-col gap-1.5 pt-2 border-t border-white/10">
          {/* Dados do Ciclo: Melhor Dia, Fechamento, Vencimento */}
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[10px] sm:text-xs text-white/75 font-mono min-w-0">
            <span className="truncate">Melhor dia: {bestDay}</span>

            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <span>Fech.: {card.closing_day}</span>
              <span>Venc.: {card.due_day}</span>
            </div>
          </div>

          {/* Limite Total e Disponível com Barra Sutil */}
          {limit.totalLimitCents !== null && (
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex flex-wrap justify-between items-center gap-x-2 gap-y-0.5 text-[10px] text-white/70 font-mono min-w-0">
                <span className="shrink-0">•••• {lastFourDigits}</span>
                <span className="truncate">
                  Disp: <strong className="text-white">{formatCentsAsBRL(limit.availableLimitCents ?? 0)}</strong> / {formatCentsAsBRL(limit.totalLimitCents)}
                </span>
              </div>

              <div className="h-1 w-full rounded-full bg-black/40 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    limit.usagePercentage >= 90
                      ? "bg-rose-400"
                      : limit.usagePercentage >= 70
                        ? "bg-amber-300"
                        : "bg-emerald-400",
                  )}
                  style={{ width: `${Math.min(100, Math.max(3, limit.usagePercentage))}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
