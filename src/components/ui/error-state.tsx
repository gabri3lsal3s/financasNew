import { useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export interface ErrorStateProps {
  /** Mensagem de erro já formatada (via `getErrorMessage`). */
  message: string;
  /** Ação de retry customizada; default: refetch das queries ativas da tela. */
  onRetry?: () => void;
}

/**
 * Estado de erro padrão (AGENTS.md §5): mensagem via gateway de erros +
 * ação "Tentar novamente". Sem `onRetry`, refaz as queries ativas da tela
 * (cobre falha de rede sem precisar recarregar a página).
 */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const queryClient = useQueryClient();
  const retry = onRetry ?? (() => void queryClient.refetchQueries({ type: "active" }));

  return (
    <div className="flex flex-col gap-3">
      <Alert variant="error">{message}</Alert>
      <div>
        <Button type="button" variant="outline" onClick={retry}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
