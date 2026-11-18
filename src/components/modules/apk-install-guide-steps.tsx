import { Check, Settings, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui";

const APK_INSTALL_STEPS = [
  {
    step: 1,
    icon: ShieldAlert,
    title: "Aviso 'Arquivo pode ser nocivo'",
    badge: "Alerta padrão Android",
    description:
      "Ao iniciar o download, seu navegador exibirá um alerta padrão do Android para qualquer arquivo baixado fora da Play Store. Toque em 'Fazer o download mesmo assim'.",
  },
  {
    step: 2,
    icon: Settings,
    title: "Permitir desta fonte",
    badge: "Configuração rápida",
    description:
      "Ao abrir o instalador baixado, o Android pode solicitar permissão para instalar fontes desconhecidas. Toque em 'Configurações' e ative 'Permitir desta fonte'.",
  },
  {
    step: 3,
    icon: ShieldCheck,
    title: "Verificação e Conclusão",
    badge: "100% Verificado",
    description:
      "Caso o Google Play Protect exiba uma mensagem de verificação, selecione 'Mais detalhes' e em seguida 'Instalar assim mesmo'. Em aparelhos Samsung Galaxy com One UI 6+, se o botão estiver bloqueado, desative temporariamente o 'Bloqueador Automático' em Configurações > Segurança.",
  },
] as const;

const PWA_BROWSER_STEPS = [
  {
    step: 1,
    title: "Abra o menu do navegador",
    description: "No Chrome, toque no menu de três pontos no canto superior direito.",
  },
  {
    step: 2,
    title: "Instalar ou Adicionar à Tela Inicial",
    description: 'Selecione "Instalar aplicativo" ou "Adicionar à tela inicial".',
  },
  {
    step: 3,
    title: "Pronto para usar",
    description: "Um ícone será criado na sua grade de apps, abrindo em tela cheia sem barras de navegação.",
  },
] as const;

/** Etapas de fallback para instalação do Axir como PWA diretamente no navegador. */
export function PwaGuideStepsContent() {
  return (
    <div className="space-y-3.5">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary-strong shrink-0" aria-hidden="true" />
          <h4 className="text-sm font-semibold text-foreground">
            Experiência 100% Funcional no PWA
          </h4>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          O PWA do Axir roda direto no seu navegador com carregamento instantâneo, funciona em qualquer smartphone (iOS ou Android) e computador, sem ocupar armazenamento do seu celular.
        </p>
      </div>

      <div className="space-y-2.5 text-xs text-muted-foreground">
        {PWA_BROWSER_STEPS.map(({ step, title, description }) => (
          <div
            key={step}
            className="flex items-start gap-3 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
              {step}
            </span>
            <div className="space-y-0.5">
              <div className="font-semibold text-foreground">{title}</div>
              <p>{description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Guia em 3 etapas para habilitar e instalar o APK Android Beta com segurança. */
export function ApkGuideStepsContent() {
  return (
    <div className="space-y-3.5">
      <div className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-muted/50 p-3 text-xs text-muted-foreground">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>
          O APK Android é uma versão beta opcional com biometria física, escudo de privacidade e navegação fluida em tela cheia.
        </span>
      </div>

      <div className="space-y-2.5">
        {APK_INSTALL_STEPS.map(({ step, icon: Icon, title, badge, description }) => (
          <div
            key={step}
            className="flex items-start gap-3.5 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-muted/50 text-muted-foreground">
              <Icon className="size-4.5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
                    {step}
                  </span>
                  <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                    {title}
                  </h4>
                </div>
                <Badge variant="muted" size="xs">
                  {badge}
                </Badge>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-positive/20 bg-positive/5 px-3 py-2 text-xs text-positive-strong">
        <Check className="size-3.5 shrink-0" aria-hidden="true" />
        <span>Assinatura SHA-256 oficial e livre de malwares ou rastreadores terceiros.</span>
      </div>
    </div>
  );
}
