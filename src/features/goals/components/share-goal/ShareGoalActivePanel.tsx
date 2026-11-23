import { Check, Copy, Edit2, ExternalLink, Eye, EyeOff, Lock, Share2 } from "lucide-react";
import { Badge, Button, Input, MoneyText } from "@/components/ui";
import { formatDateBR } from "@/lib/date";
import type { Category, PublicShare } from "@/types";
import { ShareGoalQrCard } from "./ShareGoalQrCard";

export interface ShareGoalActivePanelProps {
  activeShare: PublicShare;
  category?: Category | null;
  targetCents: number;
  pixKey: string;
  isArchived: boolean;
  isCompleted: boolean;
  isShared: boolean;
  isRevoked: boolean;
  isPending: boolean;
  showContributionsPublicly: boolean;
  shareUrl: string;
  copied: boolean;
  showQrPreview: boolean;
  effectivePixBrCode: string;
  onEdit: () => void;
  onOpenPublicPage: () => void;
  onRestoreLink: () => void;
  onCopyLink: () => void;
  onToggleQrPreview: () => void;
}

export function ShareGoalActivePanel({
  activeShare,
  category,
  targetCents,
  pixKey,
  isArchived,
  isCompleted,
  isShared,
  isRevoked,
  isPending,
  showContributionsPublicly,
  shareUrl,
  copied,
  showQrPreview,
  effectivePixBrCode,
  onEdit,
  onOpenPublicPage,
  onRestoreLink,
  onCopyLink,
  onToggleQrPreview,
}: ShareGoalActivePanelProps) {
  const statusBadge = isArchived ? (
    <Badge variant="muted" size="sm" className="gap-1 border-border/80 text-muted-foreground">
      <span>Meta Arquivada</span>
    </Badge>
  ) : !isShared ? (
    <Badge variant="default" size="sm" className="gap-1 border border-border/60 text-muted-foreground">
      <Lock className="size-3.5" aria-hidden="true" />
      <span>Meta Privada</span>
    </Badge>
  ) : isRevoked ? (
    <Badge variant="warning" size="sm" className="gap-1">
      <EyeOff className="size-3.5" aria-hidden="true" />
      <span>Link Público Pausado</span>
    </Badge>
  ) : (
    <Badge variant="default" size="sm" className="gap-1 border border-primary/40 text-primary-strong">
      <Share2 className="size-3.5" aria-hidden="true" />
      <span>Termômetro Público Ativo</span>
    </Badge>
  );

  return (
    <div className="flex flex-col gap-5 py-2">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {statusBadge}
            {isCompleted && <Badge variant="positive" size="xs">Concluída</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              sensoryIntent="selection"
              onClick={onEdit}
              className="gap-1.5 text-xs border-border/80 bg-surface hover:bg-surface-hover"
            >
              <Edit2 className="size-3 text-muted-foreground" aria-hidden="true" />
              <span>Editar Meta</span>
            </Button>
            {isShared && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onOpenPublicPage}
                className="gap-1.5 text-xs text-primary-strong hover:text-primary-strong"
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                <span>Abrir página</span>
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold text-foreground">
            {String(activeShare.payload?.title || category?.name || "Meta Coletiva")}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <span>Alvo:</span>
              <MoneyText
                cents={Number(activeShare.payload?.target_cents || targetCents)}
                tone="default"
                className="font-medium text-foreground"
              />
            </span>
            {activeShare.payload?.deadline ? (
              <span>Data Alvo: {formatDateBR(String(activeShare.payload.deadline))}</span>
            ) : null}
            {isShared && Boolean(activeShare.payload?.pix_key || pixKey) && (
              <span>Chave Pix: {String(activeShare.payload?.pix_key || pixKey)}</span>
            )}
            {isShared && (
              <span className="flex items-center gap-1">
                {showContributionsPublicly ? (
                  <>
                    <Eye className="size-3 text-positive-strong" aria-hidden="true" />
                    <span>Doações visíveis publicamente</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="size-3 text-muted-foreground" aria-hidden="true" />
                    <span>Doações ocultas publicamente</span>
                  </>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {isShared && isRevoked && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <EyeOff className="size-4 text-warning-strong shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-semibold text-foreground">Link público pausado</p>
              <p className="text-[11px] text-muted-foreground">
                Participantes não conseguem acessar o termômetro nem visualizar a chave Pix até que você reative o link.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            sensoryIntent="success"
            aria-label="Reativar link público agora"
            onClick={onRestoreLink}
            disabled={isPending}
            className="shrink-0 text-xs gap-1.5"
          >
            <Eye className="size-3.5" aria-hidden="true" />
            <span>Reativar link público agora</span>
          </Button>
        </div>
      )}

      {isShared && !isRevoked && (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="goal-share-link" className="text-xs font-semibold text-foreground">
              Link de Acesso Público
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="goal-share-link"
                readOnly
                value={shareUrl}
                className="font-mono text-base sm:text-sm select-all bg-muted/40"
                aria-label="Link público do termômetro de meta"
              />
              <Button
                type="button"
                variant={copied ? "default" : "outline"}
                sensoryIntent="selection"
                onClick={onCopyLink}
                className="shrink-0 gap-1.5"
                aria-label="Copiar link do termômetro"
              >
                {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                <span>{copied ? "Copiado" : "Copiar Link"}</span>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Qualquer pessoa com este link pode acompanhar o termômetro e copiar a chave Pix.
            </p>
          </div>

          {Boolean(activeShare.payload?.pix_key || pixKey) && (
            <ShareGoalQrCard
              pixBrCode={effectivePixBrCode || String(activeShare.payload?.pix_br_code || "")}
              showQrPreview={showQrPreview}
              onToggleQrPreview={onToggleQrPreview}
            />
          )}
        </>
      )}

      {!isShared && (
        <div className="rounded-xl border border-border/80 bg-surface p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs font-semibold text-foreground">Meta Pessoal e Privada</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Esta meta não possui link público ativo nem chave Pix cadastrada. Ela é visível exclusivamente para você no painel de metas e orçamentos.
          </p>
        </div>
      )}
    </div>
  );
}
