/**
 * Lista Interativa de Invariantes Matemáticos Forenses (forensics-invariants-list.tsx).
 *
 * Exibe as 23 asserções contábeis e matemáticas com busca, filtros por módulo
 * e status, tolerância de centavos e origem no código-fonte.
 */

import { useState } from "react";
import { CheckCircle2, Filter, Search, XCircle } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Input, Select } from "@/components/ui";
import type { AuditModule, InvariantResult } from "../core/types";
import { AUDIT_MODULE_LABELS } from "../core/types";

interface ForensicsInvariantsListProps {
  results: readonly InvariantResult[];
}

export function ForensicsInvariantsList({ results }: ForensicsInvariantsListProps) {
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredResults = results.filter((res) => {
    if (moduleFilter !== "all" && res.module !== moduleFilter) return false;
    if (statusFilter !== "all" && res.status !== statusFilter) return false;
    if (search.trim()) {
      const term = search.toLowerCase();
      const matchName = res.name.toLowerCase().includes(term);
      const matchId = res.id.toLowerCase().includes(term);
      const matchOrigin = res.origin.toLowerCase().includes(term);
      const matchMessage = res.message.toLowerCase().includes(term);
      if (!matchName && !matchId && !matchOrigin && !matchMessage) return false;
    }
    return true;
  });

  const moduleOptions = [
    { value: "all", label: "Todos os Módulos" },
    ...Object.entries(AUDIT_MODULE_LABELS).map(([key, label]) => ({
      value: key,
      label,
    })),
  ];

  const statusOptions = [
    { value: "all", label: "Todos os Status" },
    { value: "passed", label: "Aprovadas" },
    { value: "failed", label: "Com Falha" },
  ];

  return (
    <Card className="border-border/80 bg-surface shadow-xs w-full">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-sm font-bold text-foreground">
            Catálogo de Invariantes &amp; Asserções
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Exibindo {filteredResults.length} de {results.length} asserções
          </span>
        </div>

        {/* Filtros e Busca */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" aria-hidden="true" />
            <Input
              type="text"
              placeholder="Buscar por ID, nome ou origem…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>

          <Select
            value={moduleFilter}
            onValueChange={setModuleFilter}
            options={moduleOptions}
            aria-label="Filtrar por Módulo"
          />

          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={statusOptions}
            aria-label="Filtrar por Status"
          />
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {filteredResults.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <Filter className="size-5 text-muted-foreground/60" aria-hidden="true" />
            <span>Nenhuma asserção encontrada para os filtros aplicados.</span>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border/60">
            {filteredResults.map((inv) => {
              const isPassed = inv.status === "passed";
              return (
                <div key={inv.id} className="py-3 flex flex-col gap-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {inv.id}
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        {inv.name}
                      </span>
                      <Badge variant="muted" size="xs">
                        {AUDIT_MODULE_LABELS[inv.module as AuditModule] ?? inv.module}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={isPassed ? "positive" : "critical"} size="xs" className="gap-1">
                        {isPassed ? (
                          <CheckCircle2 className="size-3" aria-hidden="true" />
                        ) : (
                          <XCircle className="size-3" aria-hidden="true" />
                        )}
                        <span>{isPassed ? "Aprovado" : "Divergência"}</span>
                      </Badge>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {inv.message}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] p-2 rounded-lg bg-surface-subtle border border-border/40">
                    <div>
                      <span className="text-muted-foreground block">Esperado:</span>
                      <span className="font-mono text-foreground font-medium truncate block">
                        {String(inv.expected)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Encontrado:</span>
                      <span className="font-mono text-foreground font-medium truncate block">
                        {String(inv.found)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Diferença (Delta):</span>
                      <span className="font-mono text-foreground font-medium tabular-nums block">
                        {inv.divergence.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Origem no Código:</span>
                      <span className="font-mono text-muted-foreground text-[10px] truncate block" title={inv.origin}>
                        {inv.origin}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
