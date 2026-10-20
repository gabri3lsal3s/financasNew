import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { processPixShare } from "@/services/native";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { formatCentsAsCurrency } from "@/services/masks";

/**
 * ShareTargetPage — Rota de recepção do Web Share Target PWA (/share-target).
 *
 * Recebe texto compartilhado de comprovantes Pix e notificações bancárias
 * enviados através do menu de compartilhamento do sistema (Android/iOS/Desktop).
 *
 * Processa os parâmetros ?title=...&text=...&url=... através do motor determinístico
 * de parsing (processPixShare), enfileira na lista de sugestões pendentes e
 * redireciona o usuário para a Visão Geral com feedback sensorial e Toast.
 */
export function ShareTargetPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;

    const title = searchParams.get("title") || "";
    const text = searchParams.get("text") || "";
    const url = searchParams.get("url") || "";

    // Concatena os campos enviados pelo compartilhamento do sistema
    const rawContent = [text, title, url].filter(Boolean).join("\n").trim();

    if (!rawContent) {
      navigate("/", { replace: true });
      return;
    }

    try {
      const parsed = processPixShare(rawContent);

      if (parsed) {
        triggerSensory("success");
        const formatted = formatCentsAsCurrency(parsed.amountCents);
        pushToast({
          title: "Comprovante Pix detectado",
          description: `${parsed.description} no valor de ${formatted} pronto para confirmação.`,
          variant: "success",
        });
      } else {
        triggerSensory("warning");
        pushToast({
          title: "Comprovante não identificado",
          description: "Não foi possível extrair automaticamente os dados do comprovante compartilhado.",
          variant: "destructive",
        });
      }
    } catch {
      triggerSensory("warning");
      pushToast({
        title: "Erro ao processar comprovante",
        description: "Ocorreu uma falha ao tentar ler o texto do comprovante.",
        variant: "destructive",
      });
    }

    navigate("/", { replace: true });
  }, [navigate, searchParams]);

  return (
    <div
      role="region"
      aria-label="Processamento de comprovante compartilhado"
      className="flex flex-col items-center justify-center min-h-[50vh] p-4 max-w-md mx-auto space-y-4"
    >
      <div className="w-full space-y-3">
        <Skeleton className="h-6 w-3/4 mx-auto rounded-lg" />
        <Skeleton className="h-4 w-1/2 mx-auto rounded-md" />
        <Skeleton className="h-24 w-full rounded-2xl border border-border/80" />
      </div>
      <p className="text-xs text-muted-foreground font-medium animate-pulse">
        Processando comprovante compartilhado...
      </p>
    </div>
  );
}
