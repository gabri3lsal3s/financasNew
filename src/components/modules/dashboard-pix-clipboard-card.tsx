import { useCallback, useEffect, useState } from "react";
import { ClipboardPaste, Zap, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { formatCentsAsBRL } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { readClipboardText } from "@/services/clipboard";
import {
  parseClipboardTransactionCandidate,
  resolveMerchantIdentity,
  type ClipboardParsedCandidate,
  type ResolvedMerchantIdentity,
} from "@/domain/notifications";
import { useMerchantLearning } from "@/services/merchant-learning";
import { isNativePlatform } from "@/services/native/platform";

export interface DashboardPixClipboardCardProps {
  onLaunch: (params: {
    valorCents?: number;
    desc?: string;
    categoria?: string;
    tipo?: "expense" | "income";
    forma?: "pix";
    pixKey?: string;
  }) => void;
  onDismiss?: () => void;
}

export function DashboardPixClipboardCard({
  onLaunch,
  onDismiss,
}: DashboardPixClipboardCardProps) {
  const merchantLearning = useMerchantLearning();
  const [detected, setDetected] = useState<{
    candidate: ClipboardParsedCandidate;
    identity: ResolvedMerchantIdentity;
  } | null>(null);

  // Verificação passiva em segundo plano apenas quando autorizado nativamente ou via Permissions API
  const checkClipboardPassive = useCallback(async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.readText) return;

      // No navegador web, apenas consulta se a permissão já estiver previamente concedida
      if (!isNativePlatform()) {
        if (!("permissions" in navigator) || !navigator.permissions.query) return;
        const permissionStatus = await navigator.permissions
          .query({ name: "clipboard-read" as PermissionName })
          .catch(() => null);
        if (permissionStatus?.state !== "granted") {
          return;
        }
      }

      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) return;

      const candidate = parseClipboardTransactionCandidate(text.trim());
      if (candidate && (candidate.valueCents > 0 || candidate.pixKey)) {
        const identity = resolveMerchantIdentity({
          merchantOrDescription: candidate.recipientName || candidate.description,
          pixKey: candidate.pixKey,
          taxId: candidate.taxId,
          userMemory: merchantLearning.memory,
        });

        setDetected({ candidate, identity });
      }
    } catch {
      // Ignora falhas passivas silenciosamente conforme governança
    }
  }, [merchantLearning.memory]);

  useEffect(() => {
    // Verificação passiva agendada fora da fase de commit do efeito
    const initialCheck = window.setTimeout(() => void checkClipboardPassive(), 0);

    const onFocus = () => {
      void checkClipboardPassive();
    };

    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(initialCheck);
      window.removeEventListener("focus", onFocus);
    };
  }, [checkClipboardPassive]);

  // Ação explícita de toque do usuário (100% autorizada por todos os navegadores móveis e desktop)
  const handleUserTapPaste = async () => {
    triggerSensory("action");
    const result = await readClipboardText();

    if (
      result.status === "permission_denied" ||
      result.status === "unsupported" ||
      result.status === "insecure_context"
    ) {
      pushToast({
        title: "Acesso ao clipboard bloqueado",
        description: "Permita o acesso à área de transferência nas configurações do navegador.",
        variant: "default",
      });
      return;
    }

    if (result.status === "empty") {
      pushToast({
        title: "Área de transferência vazia",
        description: "Copie uma chave Pix ou código no seu banco e tente novamente.",
        variant: "default",
      });
      return;
    }

    const candidate = parseClipboardTransactionCandidate(result.text);
    if (!candidate) {
      pushToast({
        title: "Pix não identificado",
        description: "Não identificamos uma chave Pix, código ou valor no texto copiado.",
        variant: "default",
      });
      return;
    }

    const identity = resolveMerchantIdentity({
      merchantOrDescription: candidate.recipientName || candidate.description,
      pixKey: candidate.pixKey,
      taxId: candidate.taxId,
      userMemory: merchantLearning.memory,
    });

    triggerSensory("success");
    pushToast({
      title: "Pix identificado",
      description: `${identity.friendlyName || candidate.description} preenchido para lançamento.`,
      variant: "success",
    });

    onLaunch({
      valorCents: candidate.valueCents > 0 ? candidate.valueCents : undefined,
      desc: identity.friendlyName || candidate.description,
      categoria: identity.categorySlug,
      tipo: identity.defaultNature || candidate.nature,
      forma: "pix",
      pixKey: candidate.pixKey,
    });
  };

  const handleLaunchDetected = () => {
    if (!detected) return;
    triggerSensory("success");
    onLaunch({
      valorCents: detected.candidate.valueCents > 0 ? detected.candidate.valueCents : undefined,
      desc: detected.identity.friendlyName || detected.candidate.description,
      categoria: detected.identity.categorySlug,
      tipo: detected.identity.defaultNature || detected.candidate.nature,
      forma: "pix",
      pixKey: detected.candidate.pixKey,
    });
  };

  const isPreDetected = Boolean(detected);

  return (
    <div
      role="alert"
      className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 p-3.5 sm:p-4 rounded-2xl border border-border/80 bg-surface shadow-xs transition-all"
    >
      <div className="flex items-center gap-3 min-w-0 pr-6 sm:pr-0">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-portfolio/20 bg-portfolio/10 text-portfolio">
          {isPreDetected ? (
            <Zap className="size-4.5" aria-hidden="true" />
          ) : (
            <ClipboardPaste className="size-4.5" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground truncate">
              {isPreDetected
                ? detected?.identity.friendlyName || detected?.candidate.recipientName || "Pix Detectado"
                : "Lançamento Rápido via Pix"}
            </span>
            <Badge variant={isPreDetected ? "positive" : "muted"} size="xs">
              {isPreDetected ? "DETECTADO" : "CLIPBOARD"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {isPreDetected
              ? detected && detected.candidate.valueCents > 0
                ? `${formatCentsAsBRL(detected.candidate.valueCents)} • Toque para confirmar lançamento`
                : "Chave identificada • Toque para preencher"
              : "Copie uma chave Pix ou código e insira sem digitar formulários."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-stretch sm:self-center mt-auto sm:mt-0">
        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={isPreDetected ? handleLaunchDetected : handleUserTapPaste}
          className="h-8 gap-1.5 px-3 text-xs flex-1 sm:flex-initial"
        >
          {isPreDetected ? (
            <Zap className="size-3.5" aria-hidden="true" />
          ) : (
            <ClipboardPaste className="size-3.5" aria-hidden="true" />
          )}
          <span>{isPreDetected ? "Lançar Agora" : "Colar Pix"}</span>
        </Button>

        {onDismiss ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onDismiss}
            className="size-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Dispensar sugestão de Pix"
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
