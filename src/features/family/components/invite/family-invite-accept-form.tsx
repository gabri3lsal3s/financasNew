import { Lock, UserPlus } from "lucide-react";
import { PixKeyInputFields } from "@/components/modules";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  Input,
} from "@/components/ui";
import type { PixKeyType } from "@/domain/pix";
import { FamilyInviteShell } from "./family-invite-shell";

export interface FamilyInviteAcceptFormProps {
  token?: string;
  inviterName?: string | null;
  familyName?: string | null;
  displayName: string;
  onDisplayNameChange: (val: string) => void;
  pixKey: string;
  onPixKeyChange: (val: string) => void;
  pixKeyType: string;
  onPixKeyTypeChange: (val: string) => void;
  detectedPixType?: PixKeyType | null;
  pixValidationError?: string | null;
  isAmbiguousCpfOrPhone?: boolean;
  hasInvalidPix?: boolean;
  onQuickSelectKeyType?: (type: "phone" | "cpf") => void;
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
  detectedPixType = null,
  pixValidationError = null,
  isAmbiguousCpfOrPhone = false,
  hasInvalidPix = false,
  onQuickSelectKeyType,
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

          <PixKeyInputFields
            pixKey={pixKey}
            onPixKeyChange={onPixKeyChange}
            selectedKeyType={pixKeyType}
            onSelectedKeyTypeChange={onPixKeyTypeChange}
            detectedType={detectedPixType}
            validationError={pixValidationError}
            isAmbiguousCpfOrPhone={isAmbiguousCpfOrPhone}
            onQuickSelectKeyType={onQuickSelectKeyType}
            allowCnpj={false}
            pixKeyId="family-pix-key"
            keyTypeId="family-pix-type"
            pixKeyLabel="Chave Pix (opcional)"
            pixKeyAriaLabel="Chave Pix (opcional)"
            pixKeyPlaceholder="Ex: seu-pix@email.com"
            pixKeyHelperText="Permite que seu parceiro realize o acerto do mês diretamente pelo app com 1 toque."
            keyTypeLabel="Tipo da Chave Pix"
            keyTypeAriaLabel="Tipo de Chave Pix"
            showBankRegistrationNotice={true}
            showVerificationBadge={true}
          />
        </CardContent>

        <div className="pt-1">
          <Button
            type="button"
            variant="default"
            size="lg"
            sensoryIntent={false}
            loading={isPending}
            disabled={hasInvalidPix || isPending}
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
