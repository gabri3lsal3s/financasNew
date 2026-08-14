import { Sparkles } from "lucide-react";
import { KpiCard } from "@/components/modules/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";

export function OverviewPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">Visão Geral</h1>

      {/* Demo estática dos primitivos — KPIs reais chegam com dados na Fase 2/3. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Saldo do mês" value="R$ 1.234,56" tone="positive" hint="Demo — dados na F2" />
        <KpiCard label="Despesas" value="R$ 890,12" tone="negative" hint="Demo — dados na F2" />
        <KpiCard label="Aportes" value="R$ 200,00" tone="portfolio" hint="Demo — dados na F4" />
        <KpiCard label="Taxa de poupança" value="12,4%" hint="Demo — dados na F3" />
      </div>

      <EmptyState
        icon={<Sparkles aria-hidden="true" />}
        title="Análises em breve"
        description="KPIs dinâmicos, fluxo diário e orçamentos chegam na Fase 2/3 com os contratos de estado."
      />
    </div>
  );
}
