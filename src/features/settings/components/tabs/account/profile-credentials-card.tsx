import type { FormEvent } from "react";
import { Check, KeyRound, Loader2, Mail, User } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
} from "@/components/ui";

export interface ProfileCredentialsCardProps {
  roleLabel: string;
  name: string;
  email: string;
  isNameChanged: boolean;
  isSavingProfile: boolean;
  onNameChange: (value: string) => void;
  onSaveProfile: (event: FormEvent) => void;
  onOpenEmailModal: () => void;
  onOpenPasswordModal: () => void;
}

export function ProfileCredentialsCard({
  roleLabel,
  name,
  email,
  isNameChanged,
  isSavingProfile,
  onNameChange,
  onSaveProfile,
  onOpenEmailModal,
  onOpenPasswordModal,
}: ProfileCredentialsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>Dados Pessoais &amp; Acesso</span>
          </CardTitle>
          <Badge variant="muted" size="xs" className="font-mono uppercase w-fit">
            {roleLabel}
          </Badge>
        </div>
        <CardDescription>
          Gerencie seu nome de exibição, endereço de e-mail e credenciais de segurança da conta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={onSaveProfile} className="space-y-3.5">
          <FormField label="Nome completo" htmlFor="account-name">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <Input
                id="account-name"
                type="text"
                required
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Seu nome completo"
                className="text-base sm:text-sm flex-1"
              />
              <Button
                type="submit"
                disabled={!isNameChanged || isSavingProfile}
                className="shrink-0 gap-1.5"
              >
                {isSavingProfile ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    <span>Salvando…</span>
                  </>
                ) : (
                  <span>Salvar Alterações</span>
                )}
              </Button>
            </div>
          </FormField>
        </form>

        <div className="pt-3 border-t border-border/80 space-y-3">
          <span className="text-xs font-semibold text-foreground block">
            Credenciais de Autenticação
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-surface-raised/60 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="account-email"
                  className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-default"
                >
                  <Mail className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span>Endereço de e-mail</span>
                </label>
                <Badge variant="default" size="xs" className="gap-1">
                  <Check className="size-3" aria-hidden="true" />
                  <span>Verificado</span>
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2 min-w-0">
                <Input
                  id="account-email"
                  type="email"
                  readOnly
                  disabled
                  value={email}
                  className="h-auto border-0 bg-transparent px-0 py-0 text-base sm:text-xs font-medium text-foreground shadow-none truncate select-all flex-1 cursor-default disabled:opacity-100"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenEmailModal}
                  className="shrink-0"
                >
                  Alterar e-mail
                </Button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-raised/60 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <KeyRound className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span>Senha de acesso</span>
                </span>
                <Badge variant="muted" size="xs">
                  Protegida
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span
                  className="font-mono text-xs text-muted-foreground tracking-widest"
                  aria-label="Senha configurada"
                >
                  ************
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenPasswordModal}
                  className="shrink-0"
                >
                  Alterar senha
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
