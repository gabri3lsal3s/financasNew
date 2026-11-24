import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Compass,
  HandCoins,
  PiggyBank,
  Search,
  Sparkles,
  Tags,
  TrendingUp,
  WalletCards,
  Zap,
} from "lucide-react";
import { Button, Command } from "@/components/ui";
import type { CommandGroup, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  hasStructuredFilters,
  matchesStructuredTransactionQuery,
  monthsBetween,
  parseStructuredSearchQuery,
  recencyBonus,
  resolveSearchIntent,
  searchGlobal,
  type SearchEntryType,
  type SearchResult,
} from "@/domain/search";
import { todayISO } from "@/domain/debts";
import { categorizeDescriptionsBatchWithAi } from "@/services/ai-assistant";
import { recordBatchAiMerchantTeachings } from "@/services/merchant-learning";
import { isAppLocked } from "@/services/native";
import { useGlobalSearchEntries } from "@/state";

const TYPE_ICON: Record<SearchEntryType, typeof ArrowUpRight> = {
  action: Zap,
  page: Compass,
  investment: TrendingUp,
  expense: ArrowUpRight,
  income: ArrowDownLeft,
  debt: HandCoins,
  card: WalletCards,
  budget: PiggyBank,
  reminder: Bell,
  category: Tags,
};

const TYPE_ICON_CLASS: Record<SearchEntryType, string> = {
  action: "text-primary",
  page: "text-muted-foreground",
  investment: "text-portfolio",
  expense: "text-negative-strong",
  income: "text-positive-strong",
  debt: "text-warning-strong",
  card: "text-portfolio",
  budget: "text-warning-strong",
  reminder: "text-primary-strong",
  category: "text-primary-strong",
};

const TYPE_GROUP_LABEL: Record<SearchEntryType, string> = {
  action: "Ações Rápidas",
  page: "Navegação",
  investment: "Investimentos & Ativos",
  expense: "Despesas",
  income: "Receitas",
  debt: "Dívidas & Empréstimos",
  card: "Cartões de Crédito",
  budget: "Orçamentos",
  reminder: "Lembretes & Recorrências",
  category: "Categorias",
};

const ORDERED_TYPES: readonly SearchEntryType[] = [
  "action",
  "page",
  "investment",
  "expense",
  "income",
  "debt",
  "card",
  "budget",
  "reminder",
  "category",
];

export interface GlobalSearchProps {
  /** Classes de layout do wrapper (ex.: `lg:flex-1` no header). */
  className?: string;
}

/** Busca global e Command Palette (⌘K) — paleta montada no shell, atalho ⌘K/Ctrl+K (§3.9 e Fase 64). */
export function GlobalSearch({ className }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { entries, intentContext, searchAiContext, isLoading, error } = useGlobalSearchEntries(open);
  const passiveAiAttemptedRef = useRef(false);

  // Reseta controle de ensino passivo ao reabrir Command Palette
  useEffect(() => {
    if (!open) {
      passiveAiAttemptedRef.current = false;
    }
  }, [open]);

  // Atalho global: ⌘K / Ctrl+K e tecla '/' quando fora de inputs (bloqueado durante AppLock)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isAppLocked()) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      } else if (
        event.key === "/" &&
        !open &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const today = todayISO();

  const parsedStructured = useMemo(() => {
    if (!open || query.trim().length < 2) return null;
    return parseStructuredSearchQuery(query, {
      todayISO: today,
      merchantLearning: intentContext?.merchantLearning,
    });
  }, [open, query, today, intentContext?.merchantLearning]);

  const results = useMemo(() => {
    if (!open) return [];
    const baseResults = searchGlobal(query, entries, today);
    if (!parsedStructured) return baseResults;

    const usesStructuredFilters = hasStructuredFilters(parsedStructured);
    const structuredTxMatches: SearchResult[] = entries
      .filter((entry) => entry.type === "expense" || entry.type === "income")
      .filter((entry) =>
        matchesStructuredTransactionQuery(
          {
            id: entry.id,
            kind: entry.type as "expense" | "income",
            description: entry.label,
            categoryName: entry.structuredMeta?.categoryName,
            cardName: entry.structuredMeta?.cardName,
            date: entry.date ?? today,
            billCompetence: entry.structuredMeta?.billCompetence,
            amountCents: entry.amountCents ?? 0,
            paymentMethod: entry.structuredMeta?.paymentMethod,
            installmentsTotal: entry.structuredMeta?.installmentsTotal,
            recurrenceId: entry.structuredMeta?.recurrenceId,
            isFamily: entry.structuredMeta?.isFamily,
            tripId: entry.structuredMeta?.tripId,
            chargeKind: entry.structuredMeta?.chargeKind,
            extraTerms: entry.structuredMeta?.extraTerms ?? entry.text,
          },
          parsedStructured,
        ),
      )
      .map((entry) => ({
        entry,
        score: 80 + (entry.date ? recencyBonus(monthsBetween(entry.date, today)) : 0),
      }))
      .sort((a, b) => b.score - a.score || (b.entry.amountCents ?? 0) - (a.entry.amountCents ?? 0))
      .slice(0, 8);

    if (usesStructuredFilters) {
      const nonTx = baseResults.filter(
        (r) => r.entry.type !== "expense" && r.entry.type !== "income",
      );
      return [...structuredTxMatches, ...nonTx].slice(0, 16);
    }

    if (structuredTxMatches.length === 0) {
      return baseResults;
    }

    const seenIds = new Set(baseResults.map((r) => r.entry.id));
    const extras = structuredTxMatches.filter((r) => !seenIds.has(r.entry.id));
    return [...baseResults, ...extras].slice(0, 16);
  }, [open, query, entries, today, parsedStructured]);

  // Resolução instantânea determinística de intenções analíticas (< 2ms)
  const matchedIntent = useMemo(() => {
    if (!open || query.trim().length < 3) return null;
    return resolveSearchIntent(query, intentContext);
  }, [open, query, intentContext]);

  // Ensino passivo silencioso: somente se a busca local retornar 0 itens (e sem intenção),
  // solicita à Micro-IA (prioridade passive com reserva de cota) tags semânticas dos comércios inéditos.
  useEffect(() => {
    if (!open || isLoading) return;
    if (passiveAiAttemptedRef.current) return;
    if (searchAiContext?.featureEnabled === false) return;
    if (query.trim().length < 4 || results.length > 0 || matchedIntent) return;

    const untagged = searchAiContext?.distinctUntaggedMerchants ?? [];
    const cats = searchAiContext?.categories ?? [];
    if (untagged.length === 0 || cats.length === 0) return;

    const timer = setTimeout(() => {
      passiveAiAttemptedRef.current = true;
      void categorizeDescriptionsBatchWithAi({
        descriptions: untagged,
        categories: cats,
        priority: "passive",
        userId: searchAiContext?.userId,
        featureEnabled: searchAiContext?.featureEnabled,
      })
        .then((res) => {
          if (!res.ok) return;
          recordBatchAiMerchantTeachings(
            res.data.items
              .map((item) => {
                const rawDesc = untagged[item.index];
                if (!rawDesc) return null;
                return {
                  rawDescription: rawDesc,
                  friendlyName: item.canonicalMerchant || item.friendlyName,
                  canonicalMerchant: item.canonicalMerchant,
                  categoryId: item.categoryId,
                  serviceSegment: item.serviceSegment,
                  cutTier: item.cutTier,
                  isSubscription: item.isSubscription,
                  semanticTags: item.semanticTags,
                };
              })
              .filter((x): x is NonNullable<typeof x> => x !== null),
          );
        })
        .catch(() => {
          // Silencioso: nunca interrompe busca local
        });
    }, 700);

    return () => clearTimeout(timer);
  }, [open, isLoading, query, results.length, matchedIntent, searchAiContext]);

  const toItem = (result: SearchResult): CommandItem => {
    const { entry } = result;
    const Icon = TYPE_ICON[entry.type];
    return {
      value: `${entry.type}:${entry.id}`,
      label: entry.label,
      keywords: [...entry.text, ...(entry.statusWords ?? []), entry.detail ?? ""],
      icon: <Icon className={cn("size-4", TYPE_ICON_CLASS[entry.type])} aria-hidden="true" />,
      onSelect: () => {
        const params = new URLSearchParams(entry.link.params ?? {});
        const paramStr = params.toString();
        navigate(paramStr ? `${entry.link.path}?${paramStr}` : entry.link.path);
        close();
      },
    };
  };

  const groups: CommandGroup[] = ORDERED_TYPES.map((type) => ({
    label: TYPE_GROUP_LABEL[type],
    items: results.filter((result) => result.entry.type === type).map(toItem),
  })).filter((group) => group.items.length > 0);

  const instantAnswerSlot = matchedIntent ? (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/10 p-3 sm:p-3.5 transition-all animate-fade-in shadow-xs">
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/15 text-primary">
          <Sparkles className="size-3.5" aria-hidden="true" />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
              {matchedIntent.title}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground tracking-tight truncate">
            {matchedIntent.headline}
          </p>
          {matchedIntent.detail ? (
            <p className="text-xs text-muted-foreground truncate">{matchedIntent.detail}</p>
          ) : null}
        </div>
      </div>
      {matchedIntent.action ? (
        <Button
          type="button"
          size="xs"
          onClick={() => {
            const params = new URLSearchParams(matchedIntent.action?.params ?? {});
            const paramStr = params.toString();
            navigate(paramStr ? `${matchedIntent.action!.path}?${paramStr}` : matchedIntent.action!.path);
            close();
          }}
          className="shrink-0 self-stretch sm:self-center gap-1.5 font-medium"
        >
          <span>{matchedIntent.action.label}</span>
          <ArrowRight className="size-3" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  ) : null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        data-tour="global-search-trigger"
        aria-label="Buscar ou executar comando (Ctrl+K)"
        title="Buscar ou executar comando (Ctrl+K)"
        onClick={() => setOpen(true)}
        className={cn(
          "min-w-0 h-10 w-full justify-between gap-2 rounded-lg border border-input bg-surface px-3 text-sm text-muted-foreground shadow-xs hover:bg-surface-hover",
          className,
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Buscar ou comando…</span>
        </div>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border/80 bg-surface-hover/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <Command
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
        query={query}
        onQueryChange={setQuery}
        groups={groups}
        headerSlot={instantAnswerSlot}
        placeholder="Buscar páginas, ações, investimentos, despesas…"
        emptyMessage={
          query.trim().length < 2
            ? "Digite ao menos 2 caracteres para buscar."
            : error
              ? "Falha ao carregar os dados. Feche e tente novamente."
              : isLoading
                ? "Carregando…"
                : "Nenhum resultado encontrado."
        }
      />
    </>
  );
}
