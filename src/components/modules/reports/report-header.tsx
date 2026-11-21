import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReportHeaderProps {
  /** Título principal do relatório (ex.: "Dossiê Executivo de Investimentos & Custódia"). */
  title: string;
  /** Subtítulo descritivo ou categoria do documento. */
  subtitle?: string;
  /** Período ou competência de referência (ex.: "Agosto de 2026", "Ano Base 2026"). */
  periodLabel?: string;
  /** Data e hora de geração formatada (padrão: data atual DD/MM/AAAA). */
  generatedAt?: string;
  /** Nome institucional da aplicação (padrão: "Axir"). */
  appName?: string;
  /** Ícone temático da seção (opcional). */
  icon?: LucideIcon;
  /** Titular ou identificação do investidor/usuário. */
  accountHolder?: string;
  className?: string;
  /** Ações ou badges adicionais no cabeçalho. */
  actions?: ReactNode;
}

export interface ReportRunningHeaderProps {
  title: string;
  periodLabel?: string;
  className?: string;
}

/**
 * Símbolo Oficial da Marca Axir em Vetor SVG de Alta Definição para Relatórios.
 *
 * Utiliza a geometria canônica oficial ("A" tridimensional com órbita dinâmica
 * em gradiente Ouro/Âmbar e facetas Verde-Petróleo/Esmeralda).
 * Zero dependência de rasterização, nitidez infinita para impressão e exportação PDF.
 */
export function AxirBrandLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-8 shrink-0 select-none", className)}
      aria-label="Axir"
      role="img"
    >
      <defs>
        <linearGradient
          id="axir-rpt-primary-grad"
          x1="100"
          y1="420"
          x2="260"
          y2="92"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#0D9488" />
          <stop offset="50%" stopColor="#14B8A6" />
          <stop offset="100%" stopColor="#2DD4BF" />
        </linearGradient>

        <linearGradient
          id="axir-rpt-primary-depth-grad"
          x1="160"
          y1="420"
          x2="295"
          y2="92"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#0F766E" />
          <stop offset="100%" stopColor="#115E59" />
        </linearGradient>

        <linearGradient
          id="axir-rpt-gold-grad"
          x1="280"
          y1="92"
          x2="430"
          y2="420"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="25%" stopColor="#F59E0B" />
          <stop offset="85%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>

        <linearGradient
          id="axir-rpt-gold-depth-grad"
          x1="260"
          y1="92"
          x2="350"
          y2="420"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>

        <linearGradient
          id="axir-rpt-orbit-grad"
          x1="40"
          y1="360"
          x2="470"
          y2="140"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#92400E" />
          <stop offset="15%" stopColor="#B45309" />
          <stop offset="35%" stopColor="#D97706" />
          <stop offset="65%" stopColor="#F59E0B" />
          <stop offset="85%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>

        <linearGradient
          id="axir-rpt-specular"
          x1="60"
          y1="360"
          x2="440"
          y2="150"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="25%" stopColor="#FFFFFF" stopOpacity="0.8" />
          <stop offset="55%" stopColor="#FFFBEB" stopOpacity="0.95" />
          <stop offset="80%" stopColor="#FEF3C7" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FDE68A" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 1. Arco Traseiro da Órbita */}
      <path
        d="M 40 347 C 45 295 100 230 190 185 C 275 142 360 115 422 108 C 450 105 470 120 472 148 C 460 130 430 125 395 135 C 335 152 255 190 185 235 C 115 280 65 325 40 347 Z"
        fill="url(#axir-rpt-orbit-grad)"
        opacity="0.92"
      />

      {/* 2. Perna Esquerda — Face de Profundidade 3D */}
      <polygon
        points="231,92 281,92 161,421 118,421 216,215"
        fill="url(#axir-rpt-primary-depth-grad)"
      />

      {/* 3. Perna Esquerda — Face Frontal Cromática */}
      <polygon
        points="231,92 281,92 133,421 82,421"
        fill="url(#axir-rpt-primary-grad)"
      />

      {/* 4. Perna Direita — Face Frontal Dourada */}
      <polygon
        points="281,92 295,92 431,421 380,421"
        fill="url(#axir-rpt-gold-grad)"
      />

      {/* 5. Perna Direita — Bevel 3D */}
      <polygon
        points="281,92 349,421 380,421"
        fill="url(#axir-rpt-gold-depth-grad)"
      />

      {/* 6. Órbita Frontal Dinâmica */}
      <path
        d="M 40 347 C 48 375 105 402 195 398 C 290 394 380 345 440 255 C 468 212 478 172 472 148 C 470 170 452 210 422 252 C 365 335 280 376 195 380 C 118 384 68 362 40 347 Z"
        fill="url(#axir-rpt-orbit-grad)"
      />

      {/* 7. Filete Luminoso Interno da Órbita */}
      <path
        d="M 58 354 C 110 380 190 383 275 365 C 355 348 420 300 452 238 C 462 218 468 190 468 172 C 462 192 450 220 422 255 C 380 308 322 348 250 366 C 180 380 110 378 68 360 C 62 357 58 354 58 354 Z"
        fill="url(#axir-rpt-specular)"
      />
    </svg>
  );
}

/** Mantido como alias para retrocompatibilidade. */
export const AxirMonogram = AxirBrandLogo;

/**
 * Cabeçalho de Continuação (Running Header) para Páginas 2+ em Impressão A4.
 */
export function ReportRunningHeader({
  title,
  periodLabel,
  className,
}: ReportRunningHeaderProps) {
  return (
    <div
      className={cn(
        "hidden print:flex items-center justify-between border-b border-border/80 pb-1 text-[7.5pt] font-mono text-muted-foreground w-full mb-3",
        className,
      )}
      aria-hidden="true"
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <AxirBrandLogo className="size-3.5 shrink-0" />
        <span className="font-semibold text-foreground/85 tracking-tight">AXIR · {title}</span>
      </div>
      {periodLabel && <span>{periodLabel} · Posição Consolidada</span>}
    </div>
  );
}

/**
 * Cabeçalho Institucional de Relatório A4 / PDF (Anatomia 70 / 30).
 *
 * Padroniza a identidade oficial em 100% dos documentos impressos:
 * - Monograma oficial Axir em SVG vetorial de alta definição;
 * - Tipografia font-display para títulos editoriais com tracking balanceado;
 * - Metadados de emissão (competência, data/hora e titular) alinhados à direita;
 * - Filete horizontal único contínuo de 1pt.
 */
export function ReportHeader({
  title,
  subtitle,
  periodLabel,
  generatedAt,
  appName = "Axir",
  accountHolder,
  className,
  actions,
}: ReportHeaderProps) {
  const emitDate = generatedAt ?? new Date().toLocaleDateString("pt-BR");

  return (
    <header
      className={cn(
        "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-4 print:flex-row print:items-start print:pb-3 print:border-border/80 w-full",
        className,
      )}
    >
      {/* 1. Lado Esquerdo (70%): Marca e Identificação do Relatório */}
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <AxirBrandLogo className="size-8.5 print:size-8" />

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary-strong">
              {appName}
            </span>
            <span className="text-muted-foreground/30 font-mono text-xs hidden sm:inline print:inline">|</span>
            <span className="text-[9.5pt] uppercase font-semibold tracking-wider text-muted-foreground/80 hidden sm:inline print:inline">
              Gestão Patrimonial
            </span>
            {actions}
          </div>
          <h1 className="font-display text-lg sm:text-xl font-bold tracking-tight text-foreground print:text-base print:leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground print:text-[10px] leading-tight m-0">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* 2. Lado Direito (30%): Metadados de Emissão e Competência */}
      <div className="flex flex-col items-start sm:items-end text-left sm:text-right text-xs text-muted-foreground shrink-0 print:items-end print:text-right print:text-[10px]">
        {periodLabel && (
          <span className="font-semibold text-sm text-foreground print:text-xs">
            {periodLabel}
          </span>
        )}
        <span>Emitido em {emitDate}</span>
        {accountHolder && (
          <span className="text-[11px] text-muted-foreground/90 print:text-[9.5pt]">
            Titular: <strong className="font-medium text-foreground">{accountHolder}</strong>
          </span>
        )}
      </div>
    </header>
  );
}
