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
 * Monograma Oficial em Vetor SVG para Relatórios Executivos.
 * Paleta corporativa Axir: Verde-Petróleo (#1B6B62) e Ouro Âmbar (#DDA726).
 */
export function AxirMonogram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-8 shrink-0", className)}
      aria-hidden="true"
    >
      <rect
        width="32"
        height="32"
        rx="8"
        fill="#1B6B62"
        className="print:fill-none print:stroke print:stroke-border"
      />
      <path
        d="M16 8L9 22H13.2L16 16.2L18.8 22H23L16 8Z"
        fill="#FFFFFF"
        className="print:fill-[#1B6B62]"
      />
      <circle cx="22.5" cy="9.5" r="2.5" fill="#DDA726" />
    </svg>
  );
}

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
      <span className="font-semibold text-foreground/85 tracking-tight">AXIR · {title}</span>
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
        <AxirMonogram className="print:size-7" />

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
