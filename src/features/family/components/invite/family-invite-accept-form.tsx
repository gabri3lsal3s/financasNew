import { Lock, UserPlus } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  Select,
  type SelectOption,
} from "@/components/ui";
import type { FamilyPixKeyType } from "@/types";
import { FamilyInviteShell } from "./family-invite-shell";

const PIX_KEY_OPTIONS: SelectOption[] = [
  { value: "cpf", label: "CPF" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone Celular" },
  { value: "random", label: "Chave Aleatória" },
];

export interface FamilyInviteAcceptFormProps {
  token?: string;
  inviterName?: string | null;
  familyName?: string | null;
  displayName: string;
  onDisplayNameChange: (val: string) => void;
  pixKey: string;
  onPixKeyChange: (val: string) => void;
  pixKeyType: FamilyPixKeyType;
  onPixKeyTypeChange: (val: FamilyPixKeyType) => void;
  isPending: boolean;
  onSubmit: () => void;
}

export function FamilyInviteAcceptForm({
  token,
  inviterName,
  familyName,
  displayName,
  onDisplayNameChange,
  pixKey,
  onPixKeyChange,
  pixKeyType,
  onPixKeyTypeChange,
  isPending,
  onSubmit,
}: FamilyInviteAcceptFormProps) {
  return (
    <FamilyInviteShell token={token} showFooter>
      <Card className="border-border/80 bg-surface shadow-xs p-5 sm:p-8 rounded-2xl space-y-6">
        <CardHeader className="p-0 text-center space-y-2.5">
          <div className="inline-flex size-14 items-center justify-center rounded-2xl border bg-primary/10 border-primary/20 text-primary-strong mx-auto">
            <UserPlus className="size-7" aria-hidden="true" />
          </div>
          <div>
            <Badge variant="default" size="xs">
              Modo Família Colaborativo
            </Badge>
          </div>
          <CardTitle className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {inviterName || "Seu parceiro(a)"} convidou você!
          </CardTitle>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Você foi convidado para integrar o orçamento familiar da família{" "}
            <strong className="text-foreground">{familyName || "Axir"}</strong>.
          </p>
        </CardHeader>

        <div className="flex items-start sm:items-center gap-3 p-3.5 rounded-xl border border-positive/20 bg-positive/5 text-xs text-positive-strong">
          <Lock className="size-4 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
          <span>
            <strong>Privacidade 100% Preservada:</strong> Suas contas bancárias e extrato
            pessoal continuam restritos apenas a você.
          </span>
        </div>

        <CardContent className="p-0 space-y-4">
          <FormField
            label="Seu Nome de Exibição na Família"
            optional
            htmlFor="family-display-name"
            helperText="Nome exibido no extrato familiar consolidado da casa."
          >
            <Input
              id="family-display-name"
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
              placeholder="Ex: Mariana ou Mari"
              maxLength={50}
              className="text-base sm:text-sm"
            />
          </FormField>

          <div className="space-y-1.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <FormField label="Chave Pix" optional htmlFor="family-pix-key">
                <Input
                  id="family-pix-key"
                  value={pixKey}
                  onChange={(e) => onPixKeyChange(e.target.value)}
                  placeholder="Ex: seu-pix@email.com"
                  maxLength={80}
                  className="font-mono text-base sm:text-sm"
                />
              </FormField>

              <FormField label="Tipo da Chave Pix" optional htmlFor="family-pix-type">
                <Select
                  id="family-pix-type"
                  value={pixKeyType}
                  onValueChange={(val) => onPixKeyTypeChange(val as FamilyPixKeyType)}
                  options={PIX_KEY_OPTIONS}
                  ariaLabel="Tipo de Chave Pix"
                />
              </FormField>
            </div>
            <span className="text-[11px] text-muted-foreground block">
              Sua chave Pix permite que seu parceiro realize o acerto do mês diretamente pelo
              app com 1 toque.
            </span>
          </div>
        </CardContent>

        <div className="pt-1">
          <Button
            type="button"
            variant="default"
            size="lg"
            sensoryIntent={false}
            loading={isPending}
            disabled={isPending}
            onClick={onSubmit}
            className="w-full gap-2 shadow-xs"
          >
            <UserPlus className="size-4" aria-hidden="true" />
            <span>
              {isPending
                ? "Entrando na família…"
                : "Aceitar Convite e Entrar na Família"}
            </span>
          </Button>
        </div>
      </Card>
    </FamilyInviteShell>
  );
}
