import { lazy, Suspense, useEffect, useState } from "react";
import { ContentLoading } from "@/components/ui/content-loading";
import {
  subscribeDividendReviewModal,
  type DividendReviewModalFilter,
  type DividendReviewModalTab,
} from "@/services/dividend-review-modal";

const LazyPendingDividendsDialogHostContent = lazy(() =>
  import("./pending-dividends-dialog").then((m) => ({
    default: m.PendingDividendsDialogHostContent,
  })),
);

/**
 * Host global único para o modal de revisão de proventos (montado em AuthenticatedProviders).
 * Só carrega o módulo pesado de revisão e assina `useCorporateDividends` enquanto aberto.
 */
export function PendingDividendsDialogHost() {
  const [open, setOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<DividendReviewModalTab>("review");
  const [, setInitialFilter] = useState<DividendReviewModalFilter>("all");
  const [requestSeq, setRequestSeq] = useState(0);

  useEffect(() => {
    return subscribeDividendReviewModal((opts) => {
      setInitialTab(opts.initialTab ?? "review");
      setInitialFilter(opts.initialFilter ?? "all");
      setRequestSeq((prev) => prev + 1);
      setOpen(true);
    });
  }, []);

  if (!open) return null;

  return (
    <Suspense fallback={<ContentLoading />}>
      <LazyPendingDividendsDialogHostContent
        open={open}
        onOpenChange={setOpen}
        initialTab={initialTab}
        requestSeq={requestSeq}
      />
    </Suspense>
  );
}
