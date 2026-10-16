import { cn } from "@/lib/utils";
import { useSafeTheme } from "@/app/theme-provider";
import { useIsPro } from "@/state/subscription-context";

export interface LogoIconProps extends React.HTMLAttributes<HTMLElement> {
  className?: string;
  size?: number | string;
  /**
   * Se true, exibe a arte exclusiva Âmbar/Dourada da versão Pro.
   * Se omitido, detecta automaticamente o status da assinatura do usuário.
   */
  isPro?: boolean;
  /**
   * Modo de superfície para a logo:
   * - "auto" (padrão): detecta automaticamente o tema (Dark/Light).
   * - "dark": força a versão Dark (letra 'A' branca com contorno dourado).
   * - "light": força a versão Light (letra 'A' escura/grafite).
   */
  themeMode?: "light" | "dark" | "auto";
  /**
   * Variante gráfica:
   * - "default": glifo oficial com gradiente correspondente.
   * - "monochrome": aplica escala de cinza neutra com opacidade.
   * - "white": força versão sobre fundos escuros (letra 'A' branca).
   * - "dark": força versão sobre fundos claros (letra 'A' escura).
   */
  variant?: "default" | "monochrome" | "white" | "dark";
  /** Mantido para compatibilidade de tipagem. */
  accentReactive?: boolean;
  title?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

/**
 * LogoIcon — Símbolo oficial da marca ÁXIS ("A" orbital com monograma estilizado).
 * Renderiza a arte gráfica em alta definição com canal alfa transparente (sem fundo),
 * comutando dinamicamente entre o tema Âmbar (Pro) e Teal (Gratuito) e entre
 * modos Claro e Escuro com máxima nitidez em displays de alta densidade (Retina).
 */
export function LogoIcon({
  className,
  size,
  isPro,
  themeMode = "auto",
  variant = "default",
  accentReactive: _ignored,
  title = "AXIS",
  "aria-hidden": ariaHidden,
  ...props
}: LogoIconProps) {
  void _ignored;
  const isProActive = useIsPro(isPro);
  const currentTheme = useSafeTheme();

  const isLight =
    themeMode === "light"
      ? true
      : themeMode === "dark"
        ? false
        : variant === "dark"
          ? true
          : variant === "white"
            ? false
            : currentTheme === "light";

  const colorKey = isProActive ? "amber" : "teal";
  const toneKey = isLight ? "light" : "dark";
  const assetBase = `/brand/logo-${colorKey}-${toneKey}`;

  const isAriaHidden = ariaHidden === true || ariaHidden === "true";
  const effectiveTitle = isAriaHidden ? undefined : title;

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center shrink-0 select-none overflow-hidden",
        variant === "monochrome" && "grayscale opacity-85",
        className,
      )}
      style={
        size
          ? {
              width: typeof size === "number" ? `${size}px` : size,
              height: typeof size === "number" ? `${size}px` : size,
            }
          : undefined
      }
      {...props}
    >
      <picture className="size-full flex items-center justify-center pointer-events-none select-none">
        <source
          type="image/webp"
          srcSet={`${assetBase}-64.webp 64w, ${assetBase}-128.webp 128w, ${assetBase}-256.webp 256w, ${assetBase}.webp 1024w`}
          sizes="(max-width: 64px) 64px, (max-width: 128px) 128px, 256px"
        />
        <img
          src={`${assetBase}-128.png`}
          srcSet={`${assetBase}-64.png 64w, ${assetBase}-128.png 128w, ${assetBase}-256.png 256w, ${assetBase}.png 1024w`}
          sizes="(max-width: 64px) 64px, (max-width: 128px) 128px, 256px"
          alt={effectiveTitle || ""}
          aria-hidden={isAriaHidden ? "true" : undefined}
          role={isAriaHidden ? "presentation" : "img"}
          loading="eager"
          decoding="async"
          draggable={false}
          className="size-full object-contain pointer-events-none select-none transition-transform duration-200"
        />
      </picture>
    </span>
  );
}
