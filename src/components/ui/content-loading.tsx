import { Loader2 } from "lucide-react";

/** Feedback compacto para conteúdo carregado sob demanda. */
export function ContentLoading() {
  return (
    <div role="status" className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      <span>Carregando...</span>
    </div>
  );
}
