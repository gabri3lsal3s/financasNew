import { useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerSensory } from "@/services/sensory";
import { togglePrivacyMask, usePrivacyMask } from "@/hooks/use-privacy-mask";

/**
 * Modo Privacidade (F8 — Decisão 5): alterna a ofuscação de valores monetários
 * no app inteiro (blur). Atalho de teclado: P. Estado de sessão (não persistido).
 */
export function PrivacyToggle() {
  const masked = usePrivacyMask();

  // A máscara GLOBAL (html[data-privacy="masked"] → ofusca `.num`/`.privacy-mask`
  // em globals.css) é aplicada pelo PRÓPRIO store (use-privacy-mask), não aqui.

  const handleToggle = () => {
    triggerSensory("toggle");
    togglePrivacyMask();
  };

  // Atalho global: P alterna a máscara (DESIGN_SYSTEM §8 — modo privacidade).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      // Não interfere na digitação em campos de texto.
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        triggerSensory("toggle");
        togglePrivacyMask();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [masked]);

  const label = masked ? "Mostrar valores (P)" : "Ocultar valores (P)";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      aria-pressed={masked}
      onClick={handleToggle}
    >
      <span className="flex items-center justify-center transition-transform duration-200 animate-spring-pop">
        {masked ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </span>
    </Button>
  );
}
