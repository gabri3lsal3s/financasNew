import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ShieldAlert,
  Users,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Skeleton,
} from "@/components/ui";
import { FamilyInviteShell } from "./family-invite-shell";

export function FamilyInviteLoadingView() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <header className="sticky top-0 z-sticky w-full bg-surface/90 backdrop-blur-md border-b border-border/80 pt-safe">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <Skeleton className="h-7 w-28 rounded-lg" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </header>
      <main className="flex-1 max-w-xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        <Card className="border-border/80 bg-surface shadow-xs p-6 space-y-6 rounded-2xl">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="size-14 rounded-2xl" />
            <Skeleton className="h-7 w-48 rounded-lg" />
            <Skeleton className="h-4 w-72 rounded-md" />
          </div>
          <div className="space-y-3 pt-2">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
        </Card>
      </main>
      <footer className="text-center text-xs text-muted-foreground pb-6">
        <Skeleton className="h-4 w-48 mx-auto" />
      </footer>
    </div>
  );
}

export interface FamilyInviteStatusCardViewProps {
  token?: string;
  kind: "not_found" | "revoked" | "expired" | "accepted" | "same_family";
  familyName?: string | null;
  hasSession: boolean;
  onNavigate: (path: string) => void;
}

export function FamilyInviteStatusCardView({
  token,
  kind,
  familyName,
  hasSession,
  onNavigate,
}: FamilyInviteStatusCardViewProps) {
  const config = {
    not_found: {
      icon: <ShieldAlert className="size-6" aria-hidden="true" />,
      tone: "default" as const,
      title: "Convite não encontrado ou inválido",
      description:
        "O link acessado não corresponde a nenhum convite ativo no momento. Peça ao titular que gere um novo convite nas configurações da família.",
      ctaLabel: hasSession ? "Ir para o Painel" : "Conhecer o Axir",
      ctaPath: hasSession ? "/" : "/apresentacao",
    },
    revoked: {
      icon: <ShieldAlert className="size-6" aria-hidden="true" />,
      tone: "default" as const,
      title: "Este convite foi cancelado",
      description:
        "O titular da família revogou este convite antes de ser aceito. Solicite que seja enviado um novo link atualizado.",
      ctaLabel: hasSession ? "Ir para o Painel" : "Ir para a Página Inicial",
      ctaPath: hasSession ? "/" : "/apresentacao",
    },
    expired: {
      icon: <Clock className="size-6" aria-hidden="true" />,
      tone: "default" as const,
      title: "Este convite expirou",
      description:
        "Por motivos de segurança, os convites familiares têm validade de 7 dias e este prazo já terminou. Solicite um novo link ao titular.",
      ctaLabel: hasSession ? "Ir para o Painel" : "Ir para a Página Inicial",
      ctaPath: hasSession ? "/" : "/apresentacao",
    },
    accepted: {
      icon: <CheckCircle2 className="size-6" aria-hidden="true" />,
      tone: "positive" as const,
      title: "Este convite já foi aceito",
      description:
        "Este link de convite já foi utilizado para vincular uma conta ao orçamento familiar.",
      ctaLabel: hasSession ? "Acessar Orçamento Familiar" : "Entrar com Minha Conta",
      ctaPath: hasSession ? "/familia" : "/entrar",
    },
    same_family: {
      icon: <CheckCircle2 className="size-6" aria-hidden="true" />,
      tone: "positive" as const,
      title: "Você já faz parte desta família",
      description: `Sua conta já está vinculada ao orçamento familiar de ${familyName || "sua família"}.`,
      ctaLabel: "Acessar Orçamento Familiar",
      ctaPath: "/familia",
    },
  }[kind];

  return (
    <FamilyInviteShell token={token}>
      <EmptyState
        headingLevel="h2"
        tone={config.tone}
        icon={config.icon}
        title={config.title}
        description={config.description}
        action={
          <Button
            type="button"
            variant="solid"
            size="default"
            onClick={() => onNavigate(config.ctaPath)}
          >
            {config.ctaLabel}
          </Button>
        }
      />
    </FamilyInviteShell>
  );
}

export interface FamilyInviteCreatorViewProps {
  token?: string;
  familyName?: string | null;
  canonicalInviteUrl: string;
  copiedLink: boolean;
  onCopyLink: () => void;
  onGoToFamily: () => void;
}

export function FamilyInviteCreatorView({
  token,
  familyName,
  canonicalInviteUrl,
  copiedLink,
  onCopyLink,
  onGoToFamily,
}: FamilyInviteCreatorViewProps) {
  return (
    <FamilyInviteShell token={token}>
      <Card className="border-border/80 bg-surface shadow-xs p-6 sm:p-8 rounded-2xl text-center space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl border bg-primary/10 border-primary/20 text-primary-strong">
            <Users className="size-7" aria-hidden="true" />
          </div>
          <Badge variant="muted" size="xs">
            Seu Convite
          </Badge>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Você é o criador deste convite
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Envie o link abaixo para seu parceiro(a) aceitar e começar a compartilhar o
            orçamento da família{" "}
            <strong className="text-foreground">{familyName || "sua família"}</strong>.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-md mx-auto w-full">
          <Input
            value={canonicalInviteUrl}
            readOnly
            className="text-base sm:text-sm font-mono text-muted-foreground select-all bg-surface-raised"
            aria-label="Link de convite para cópia"
          />
          <Button
            type="button"
            variant="outline"
            size="default"
            sensoryIntent={false}
            onClick={onCopyLink}
            className="gap-2 shrink-0 w-full sm:w-auto"
          >
            {copiedLink ? (
              <>
                <Check className="size-4 text-positive-strong" aria-hidden="true" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>Copiar Link</span>
              </>
            )}
          </Button>
        </div>

        <div className="pt-1">
          <Button
            type="button"
            variant="solid"
            size="default"
            onClick={onGoToFamily}
          >
            Ir para o Orçamento Familiar
          </Button>
        </div>
      </Card>
    </FamilyInviteShell>
  );
}
