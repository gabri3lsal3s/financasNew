import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui";
import { pushToast } from "@/services/toast";
import { cn } from "@/lib/utils";

export interface ShareSimulationButtonProps {
  getShareUrl: () => string;
  simulationTitle?: string;
  label?: string;
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "xs" | "sm" | "default" | "lg" | "icon";
  className?: string;
}

export function ShareSimulationButton({
  getShareUrl,
  simulationTitle,
  label = "Copiar Link da Simulação",
  variant = "outline",
  size = "sm",
  className,
}: ShareSimulationButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const url = getShareUrl();

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else if (typeof document !== "undefined") {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      if (typeof window !== "undefined" && window.history?.replaceState) {
        try {
          const parsed = new URL(url, window.location.origin);
          window.history.replaceState(null, "", parsed.pathname + parsed.search + parsed.hash);
        } catch {
          // No-op seguro caso replaceState falhe
        }
      }

      setCopied(true);
      pushToast({
        title: "Link da simulação copiado!",
        description: simulationTitle
          ? `Qualquer pessoa com este link verá exatamente os números desta simulação de ${simulationTitle}.`
          : "Qualquer pessoa com este link verá exatamente os números desta simulação.",
        variant: "default",
      });

      setTimeout(() => {
        setCopied(false);
      }, 2500);
    } catch {
      pushToast({
        title: "Não foi possível copiar o link",
        description: "Copie o endereço diretamente da barra do seu navegador.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleCopy}
      className={cn(
        "gap-2 font-medium transition-colors shrink-0 shadow-xs",
        copied && "border-positive/40 text-positive-strong bg-positive/10",
        className,
      )}
      aria-label={copied ? "Link da simulação copiado" : label}
    >
      {copied ? (
        <>
          <Check className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
          <span>Link Copiado!</span>
        </>
      ) : (
        <>
          <Share2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{label}</span>
        </>
      )}
    </Button>
  );
}
