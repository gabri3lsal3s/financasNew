import { useContext, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoIcon } from "@/components/layout/brand-logo";
import { SubscriptionContext } from "@/state/subscription-context-def";

export interface ReportMarketMetadata {
  hasB3Custody?: boolean;
  b3RefLabel?: string | null;
  hasForeignCustody?: boolean;
  usdRefLabel?: string | null;
  fxRate?: number | null;
  fxSourceLabel?: string | null;
  fxRefLabel?: string | null;
}

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
  /** Força status Pro (Âmbar/Dourado). Se omitido, consulta SubscriptionContext. */
  isPro?: boolean;
  /** Força status em Período de Teste (Trial). Se omitido, consulta SubscriptionContext. */
  isTrial?: boolean;
  /** Metadados editoriais discretos das referências de cotações e câmbio USD/BRL. */
  marketMetadata?: ReportMarketMetadata | null;
}

export interface ReportRunningHeaderProps {
  title: string;
  periodLabel?: string;
  className?: string;
  isPro?: boolean;
  isTrial?: boolean;
}

/**
 * Símbolo Oficial da Marca Axir para Relatórios e Impressão A4.
 *
 * Utiliza o componente oficial `LogoIcon` com canal alfa e alta definição Retina,
 * garantindo compatibilidade com o Brand Design System e reatividade Pro / Teal.
 */
export function AxirBrandLogo({
  className,
  isPro,
}: {
  className?: string;
  isPro?: boolean;
}) {
  return (
    <LogoIcon
      className={cn("size-8 shrink-0 select-none", className)}
      isPro={isPro}
      themeMode="light"
      priority
    />
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
  isPro,
  isTrial,
}: ReportRunningHeaderProps) {
  const ctx = useContext(SubscriptionContext);
  const isProEffective = typeof isPro === "boolean" ? isPro : ctx?.isPro ?? false;
  const isTrialEffective = typeof isTrial === "boolean" ? isTrial : ctx?.isTrial ?? false;
  const isProTier = isProEffective || isTrialEffective;

  return (
    <div
      className={cn(
        "hidden print:flex items-center justify-between border-b border-border/80 pb-1.5 text-[7.5pt] font-mono text-muted-foreground w-full mb-3 print:mb-3",
        className,
      )}
      aria-hidden="true"
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <LogoIcon
          className="size-3.5 shrink-0"
          isPro={isProTier}
          themeMode="light"
          priority
        />
        <span className="font-semibold text-foreground/85 tracking-tight">AXIR · {title}</span>
      </div>
      {periodLabel && <span>{periodLabel}</span>}
    </div>
  );
}

/**
 * Cabeçalho Institucional de Relatório A4 / PDF (Anatomia 70 / 30).
 *
 * Padroniza a identidade oficial em 100% dos documentos impressos:
 * - Símbolo oficial Axir via `LogoIcon` oficial Retina do Design System;
 * - Reatividade ao status Pro (Âmbar) e Período de Teste (Trial);
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
  isPro,
  isTrial,
  marketMetadata,
}: ReportHeaderProps) {
  const emitDate = generatedAt ?? new Date().toLocaleDateString("pt-BR");
  const ctx = useContext(SubscriptionContext);
  const isProEffective = typeof isPro === "boolean" ? isPro : ctx?.isPro ?? false;
  const isTrialEffective = typeof isTrial === "boolean" ? isTrial : ctx?.isTrial ?? false;
  const isProTier = isProEffective || isTrialEffective;

  const metaParts: string[] = [];
  if (marketMetadata?.hasB3Custody && marketMetadata.b3RefLabel) {
    metaParts.push(`Cotações B3: ${marketMetadata.b3RefLabel}`);
  }
  if (marketMetadata?.hasForeignCustody) {
    if (marketMetadata.usdRefLabel) {
      metaParts.push(`Cotações Exterior (USD): ${marketMetadata.usdRefLabel}`);
    }
    if (marketMetadata.fxRate && marketMetadata.fxRate > 0) {
      const fxFormatted = marketMetadata.fxRate.toFixed(4).replace(".", ",");
      const src = marketMetadata.fxSourceLabel ?? "Cotação API";
      const refSuffix = marketMetadata.fxRefLabel ? ` - ${marketMetadata.fxRefLabel}` : "";
      metaParts.push(`Câmbio USD/BRL: R$ ${fxFormatted} (${src}${refSuffix})`);
    }
  }

  return (
    <header
      className={cn(
        "flex flex-col gap-2.5 border-b border-border/80 pb-4 print:pb-3 print:border-border/80 w-full",
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:flex-row print:items-start w-full">
        {/* 1. Lado Esquerdo (70%): Marca e Identificação do Relatório */}
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <LogoIcon
            className="size-8.5 print:size-8 shrink-0"
            isPro={isProTier}
            themeMode="light"
            priority
          />

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-widest",
                  isProTier ? "text-portfolio" : "text-primary-strong",
                )}
              >
                {appName}
              </span>

              {isTrialEffective ? (
                <span className="rounded-md border border-warning/30 bg-warning/15 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider text-warning-strong leading-none">
                  Teste Pro
                </span>
              ) : isProEffective ? (
                <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider text-primary-strong leading-none">
                  Pro
                </span>
              ) : null}

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
      </div>

      {metaParts.length > 0 ? (
        <div className="pt-2 border-t border-border/50 text-[9.5px] font-mono text-muted-foreground leading-snug">
          {metaParts.join("  |  ")}
        </div>
      ) : null}
    </header>
  );
}

/** Alias canônico SSOT para o cabeçalho institucional de capa (Página 1). */
export const ReportCoverHeader = ReportHeader;
export type ReportCoverHeaderProps = ReportHeaderProps;

/** Alias canônico SSOT para o cabeçalho contínuo de páginas subsequentes (Páginas > 1). */
export const RunningHeader = ReportRunningHeader;

