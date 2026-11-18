import { cn } from "@/lib/utils";

/**
 * Componente do Chip EMV com acabamento metálico, pads de contato e vetorização precisa.
 */
export function EmvChip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative w-8 h-5.5 sm:w-10 sm:h-7 rounded-md bg-gradient-to-br from-[#E8CF72] via-[#FFF3CA] to-[#BFA145] p-[1px] shadow-[0_1px_3px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.7)] border border-[#A68832]/70 overflow-hidden shrink-0",
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
        <rect x="0.5" y="0.5" width="43" height="31" rx="2.5" stroke="#7A5E12" strokeWidth="0.75" />
        <line x1="0" y1="16" x2="44" y2="16" stroke="#7A5E12" strokeWidth="0.75" />
        <line x1="14" y1="0" x2="14" y2="32" stroke="#7A5E12" strokeWidth="0.75" />
        <line x1="30" y1="0" x2="30" y2="32" stroke="#7A5E12" strokeWidth="0.75" />
        <rect x="14.5" y="8.5" width="15" height="15" rx="7.5" fill="#FAF1CB" stroke="#7A5E12" strokeWidth="0.75" />
        <circle cx="22" cy="16" r="3.5" stroke="#7A5E12" strokeWidth="0.75" fill="none" />
      </svg>
    </div>
  );
}

/**
 * Renderiza a marca/bandeira com acabamento minimalista sobre o plástico do cartão.
 */
export function CardBrandBadge({ brand, name }: { brand?: string | null; name: string }) {
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

  if (brandName.includes("amex") || brandName.includes("american")) {
    return (
      <span className="font-sans font-bold text-xs tracking-wider text-sky-200 border border-sky-300/40 px-1.5 py-0.5 rounded">
        AMEX
      </span>
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
