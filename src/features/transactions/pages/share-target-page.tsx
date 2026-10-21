import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import {
  autoRegisterReceipt,
  BankNotificationPlugin,
  processPixShare,
} from "@/services/native";
import { parseBankNotification, parsePixShareText } from "@/domain/notifications";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";

/**
 * ShareTargetPage — Rota de recepção do Web Share Target PWA e intents nativos (/share-target).
 *
 * Recebe texto compartilhado de comprovantes Pix e notificações bancárias
 * enviados através do menu de compartilhamento do sistema (Android/iOS/Desktop)
 * ou do buffer de Cold Start do plugin nativo.
 *
 * Efetiva o auto-cadastro imediato via RPC transacional, exibe Toast e Banner
 * persistente com opção de edição e reversão (Desfazer), e redireciona para a Home.
 */
export function ShareTargetPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;

    async function handleShare(): Promise<void> {
      const title = searchParams.get("title") || "";
      const text = searchParams.get("text") || "";
      const url = searchParams.get("url") || "";

      let rawContent = [text, title, url].filter(Boolean).join("\n").trim();

      // Se nenhum dado veio via query params, tenta consumir o buffer nativo do Android
      if (!rawContent) {
        try {
          const nativePayload = await BankNotificationPlugin.getPendingShare();
          if (nativePayload?.text && nativePayload.text.trim().length > 0) {
            rawContent = nativePayload.text.trim();
          }
        } catch {
          // ambiente web ou fallback silencioso
        }
      }

      if (!rawContent) {
        navigate("/", { replace: true });
        return;
      }

      try {
        let parsed = null;
        try {
          parsed = processPixShare(rawContent);
        } catch {
          parsed = null;
        }

        if (!parsed) {
          parsed = parsePixShareText(rawContent) || parseBankNotification({ title: "", text: rawContent });
        }

        if (parsed) {
          await autoRegisterReceipt(parsed);
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
    }

    void handleShare();
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
