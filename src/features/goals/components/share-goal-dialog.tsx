import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  QrCode,
  RotateCw,
  Share2,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  DatePicker,
  Input,
  Modal,
  ModalFooter,
  MoneyInput,
  MoneyText,
  QrCodeCanvas,
  Select,
  type SelectOption,
} from "@/components/ui";
import {
  detectPixKeyType,
  generatePixBrCode,
  type PixKeyType,
} from "@/domain/pix/pix-br-code";
import { useUserAccess } from "@/state/queries/use-user-access";
import { useMyPublicShares } from "@/state/queries/use-public-shares";
import {
  useCreatePublicShare,
  useRegeneratePublicShare,
  useRevokePublicShare,
} from "@/state/mutations/use-public-share-mutations";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { Category, GoalTrackerSharePayload } from "@/types";

export interface ShareGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category;
  month: string;
  currentExpectedCents?: number;
  currentRealizedCents?: number;
}

const PIX_KEY_OPTIONS: SelectOption[] = [
  { value: "auto", label: "Detecção automática" },
  { value: "cpf", label: "CPF" },
  { value: "phone", label: "Celular (+55)" },
  { value: "email", label: "E-mail" },
  { value: "random", label: "Chave Aleatória (EVP)" },
  { value: "cnpj", label: "CNPJ" },
];

export function ShareGoalDialog({
  open,
  onOpenChange,
  category,
  month,
  currentExpectedCents = 0,
  currentRealizedCents = 0,
}: ShareGoalDialogProps) {
  const { profile } = useUserAccess();
  const { data: myShares } = useMyPublicShares("goal_tracker");
  const createPublicShareMutation = useCreatePublicShare();
  const revokePublicShareMutation = useRevokePublicShare();
  const regeneratePublicShareMutation = useRegeneratePublicShare();

  const [nowMs] = useState(() => Date.now());

  // Localiza link ativo prévio para a mesma categoria
  const activeShare = useMemo(() => {
    return (myShares ?? []).find(
      (s) =>
        !s.is_revoked &&
        (!s.expires_at || new Date(s.expires_at).getTime() > nowMs) &&
        s.payload?.category_id === category.id,
    );
  }, [myShares, category.id, nowMs]);

  const profileDefaultPix = profile?.cpf || profile?.email || "";
  const profileDefaultName = profile?.name || "Organizador";

  // Campos do formulário
  const [title, setTitle] = useState(() => (activeShare?.payload?.title as string) || category.name);
  const [targetCents, setTargetCents] = useState<number>(() => {
    if (activeShare?.payload?.target_cents) {
      return Number(activeShare.payload.target_cents);
    }
    return currentExpectedCents > 0 ? currentExpectedCents : 100000;
  });
  const [initialCollectedCents, setInitialCollectedCents] = useState<number>(() => {
    if (activeShare?.payload?.current_cents !== undefined) {
      return Number(activeShare.payload.current_cents);
    }
    return currentRealizedCents;
  });
  const [deadline, setDeadline] = useState<string>(() => (activeShare?.payload?.deadline as string) || "");
  const [pixKey, setPixKey] = useState<string>(() => (activeShare?.payload?.pix_key as string) || profileDefaultPix);
  const [selectedKeyType, setSelectedKeyType] = useState<string>(() => (activeShare?.payload?.pix_key_type as string) || "auto");
  const [merchantName, setMerchantName] = useState<string>(() => (activeShare?.payload?.organizer_name as string) || profileDefaultName);
  const [merchantCity, setMerchantCity] = useState<string>(() => (activeShare?.payload?.organizer_city as string) || "SAO PAULO");

  const [copied, setCopied] = useState(false);
  const [showQrPreview, setShowQrPreview] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = activeShare ? `${origin}/meta/${activeShare.token}` : "";

  // Pré-computação segura do Pix BACEN
  const effectivePixBrCode = useMemo(() => {
    if (!pixKey.trim()) return "";
    try {
      const detected = detectPixKeyType(pixKey);
      const keyType =
        selectedKeyType === "auto"
          ? (detected !== "unknown" ? detected : undefined)
          : (selectedKeyType as PixKeyType);

      return generatePixBrCode({
        pixKey: pixKey.trim(),
        keyType,
        merchantName: merchantName.trim() || "Organizador",
        merchantCity: merchantCity.trim() || "SAO PAULO",
        txId: "***",
      });
    } catch {
      return "";
    }
  }, [pixKey, selectedKeyType, merchantName, merchantCity]);

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
      setCopied(true);
      triggerSensory("action");
      pushToast({
        title: "Link público copiado!",
        description: "Compartilhe com o grupo para acompanhar o progresso da meta.",
        variant: "default",
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      pushToast({
        title: "Não foi possível copiar o link",
        variant: "destructive",
      });
    }
  };

  const handleOpenPublicPage = () => {
    if (shareUrl && typeof window !== "undefined") {
      triggerSensory("action");
      window.open(shareUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pixKey.trim() || targetCents <= 0) return;

    try {
      const detected = detectPixKeyType(pixKey);
      const keyType =
        selectedKeyType === "auto"
          ? (detected !== "unknown" ? detected : undefined)
          : (selectedKeyType as PixKeyType);

      const brCode =
        effectivePixBrCode ||
        generatePixBrCode({
          pixKey: pixKey.trim(),
          keyType,
          merchantName: merchantName.trim() || "Organizador",
          merchantCity: merchantCity.trim() || "SAO PAULO",
          txId: "***",
        });

      const payload: GoalTrackerSharePayload = {
        title: title.trim() || category.name,
        category_id: category.id,
        month,
        target_cents: targetCents,
        current_cents: initialCollectedCents,
        deadline: deadline.trim() || null,
        organizer_name: merchantName.trim() || "Organizador",
        organizer_city: merchantCity.trim() || "SAO PAULO",
        pix_key: pixKey.trim(),
        pix_key_type: keyType ?? "unknown",
        pix_br_code: brCode,
      };

      const result = await createPublicShareMutation.mutateAsync({
        kind: "goal_tracker",
        payload: payload as unknown as Record<string, unknown>,
      });

      const generatedUrl = `${origin}/meta/${result.token}`;
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(generatedUrl).catch(() => {});
      }

      triggerSensory("action");
      pushToast({
        title: "Termômetro público ativado com sucesso!",
        description: "O link foi copiado para sua área de transferência.",
        variant: "success",
      });
    } catch (err) {
      triggerSensory("destructive");
      pushToast({
        title: "Erro ao gerar termômetro público",
        description: err instanceof Error ? err.message : "Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmRevoke = async () => {
    if (!activeShare) return;
    try {
      await revokePublicShareMutation.mutateAsync(activeShare.id);
      setIsRevokeModalOpen(false);
      triggerSensory("action");
      pushToast({
        title: "Link do termômetro revogado.",
        description: "A página pública agora exibe aviso de link inativo.",
        variant: "default",
      });
    } catch {
      triggerSensory("destructive");
    }
  };

  const handleConfirmRegenerate = async () => {
    if (!activeShare) return;
    try {
      const detected = detectPixKeyType(pixKey);
      const keyType =
        selectedKeyType === "auto"
          ? (detected !== "unknown" ? detected : undefined)
          : (selectedKeyType as PixKeyType);

      const brCode =
        effectivePixBrCode ||
        generatePixBrCode({
          pixKey: pixKey.trim(),
          keyType,
          merchantName: merchantName.trim() || "Organizador",
          merchantCity: merchantCity.trim() || "SAO PAULO",
          txId: "***",
        });

      const payload: GoalTrackerSharePayload = {
        title: title.trim() || category.name,
        category_id: category.id,
        month,
        target_cents: targetCents,
        current_cents: initialCollectedCents,
        deadline: deadline.trim() || null,
        organizer_name: merchantName.trim() || "Organizador",
        organizer_city: merchantCity.trim() || "SAO PAULO",
        pix_key: pixKey.trim(),
        pix_key_type: keyType ?? "unknown",
        pix_br_code: brCode,
      };

      const result = await regeneratePublicShareMutation.mutateAsync({
        oldId: activeShare.id,
        input: {
          kind: "goal_tracker",
          payload: payload as unknown as Record<string, unknown>,
        },
      });

      setIsRegenerateModalOpen(false);
      const generatedUrl = `${origin}/meta/${result.token}`;
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(generatedUrl).catch(() => {});
      }

      triggerSensory("action");
      pushToast({
        title: "Link regenerado com sucesso!",
        description: "Novo endereço copiado para a área de transferência.",
        variant: "success",
      });
    } catch {
      triggerSensory("destructive");
    }
  };

  const isPending =
    createPublicShareMutation.isPending ||
    revokePublicShareMutation.isPending ||
    regeneratePublicShareMutation.isPending;

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Compartilhar Progresso da Meta"
        description="Gere um termômetro público transparente com Pix para arrecadação coletiva."
        size="lg"
      >
        {activeShare ? (
          <div className="flex flex-col gap-5 py-2">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="default" size="sm" className="gap-1 border border-primary/40 text-primary">
                    <Share2 className="size-3.5" aria-hidden="true" />
                    <span>Termômetro Público Ativo</span>
                  </Badge>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenPublicPage}
                  className="gap-1.5 text-xs text-primary hover:text-primary-strong"
                >
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  <span>Abrir página</span>
                </Button>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-semibold text-foreground">
                  {String(activeShare.payload?.title || category.name)}
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
                    <span>Data Alvo: {String(activeShare.payload.deadline)}</span>
                  ) : null}
                  <span>Chave Pix: {String(activeShare.payload?.pix_key || pixKey)}</span>
                </div>
              </div>
            </div>

            {/* Caixa de Cópia do Link */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="goal-share-link" className="text-xs font-semibold text-foreground">
                Link de Acesso Público
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="goal-share-link"
                  readOnly
                  value={shareUrl}
                  className="font-mono text-xs select-all bg-muted/40"
                  aria-label="Link público do termômetro de meta"
                />
                <Button
                  type="button"
                  variant={copied ? "default" : "outline"}
                  onClick={() => void handleCopyLink()}
                  className="shrink-0 gap-1.5"
                  aria-label="Copiar link do termômetro"
                >
                  {copied ? (
                    <>
                      <Check className="size-4" aria-hidden="true" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" aria-hidden="true" />
                      <span>Copiar Link</span>
                    </>
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Qualquer pessoa com este link pode acompanhar o termômetro e copiar a chave Pix.
              </p>
            </div>

            {/* Alternância do QR Code de Arrecadação */}
            <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <QrCode className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-xs font-medium text-foreground">QR Code Pix para Arrecadação</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowQrPreview((prev) => !prev)}
                >
                  {showQrPreview ? "Ocultar" : "Visualizar"}
                </Button>
              </div>

              {showQrPreview && (
                <div className="flex flex-col items-center justify-center p-3 bg-white rounded-lg border border-border/60 self-center">
                  <QrCodeCanvas
                    text={String(activeShare.payload?.pix_br_code || effectivePixBrCode)}
                    size={180}
                    label="QR Code Pix do Organizador"
                  />
                  <p className="mt-2 text-[10px] text-slate-500 font-medium">
                    Pix Padrão Banco Central (EMV QRCPS-MPM)
                  </p>
                </div>
              )}
            </div>

            <ModalFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-critical hover:text-critical"
                  onClick={() => setIsRevokeModalOpen(true)}
                  disabled={isPending}
                >
                  <Trash2 className="size-3.5 mr-1.5" aria-hidden="true" />
                  <span>Revogar link</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsRegenerateModalOpen(true)}
                  disabled={isPending}
                >
                  <RotateCw className="size-3.5 mr-1.5" aria-hidden="true" />
                  <span>Regenerar link</span>
                </Button>
              </div>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </ModalFooter>
          </div>
        ) : (
          <form onSubmit={(e) => void handleCreateShare(e)} className="flex flex-col gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Título da Meta */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="goal-title" className="text-xs font-semibold text-foreground">
                  Título da Meta
                </label>
                <Input
                  id="goal-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Viagem de Fim de Ano"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Identificação exibida no topo da página pública.
                </p>
              </div>

              {/* Alvo da Arrecadação */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="goal-target-amount" className="text-xs font-semibold text-foreground">
                  Valor Alvo (Total pretendido)
                </label>
                <MoneyInput
                  id="goal-target-amount"
                  cents={targetCents}
                  onCentsChange={setTargetCents}
                  placeholder="Ex.: R$ 6.000,00"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Valor total a ser atingido pelo grupo.
                </p>
              </div>

              {/* Valor Já Arrecadado / Inicial */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="goal-collected-amount" className="text-xs font-semibold text-foreground">
                  Valor Já Arrecadado (Inicial)
                </label>
                <MoneyInput
                  id="goal-collected-amount"
                  cents={initialCollectedCents}
                  onCentsChange={setInitialCollectedCents}
                  placeholder="Ex.: R$ 0,00"
                />
                <p className="text-[11px] text-muted-foreground">
                  Depósitos lançados na meta no app atualizam o termômetro.
                </p>
              </div>

              {/* Data Alvo */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Data Alvo <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <DatePicker
                  value={deadline}
                  onValueChange={setDeadline}
                  placeholder="Selecione a data limite"
                  ariaLabel="Data limite para a meta"
                />
                <p className="text-[11px] text-muted-foreground">
                  Habilita contagem regressiva de dias na página pública.
                </p>
              </div>

              {/* Chave Pix */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="goal-pix-key" className="text-xs font-semibold text-foreground">
                  Chave Pix do Organizador
                </label>
                <Input
                  id="goal-pix-key"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="CPF, celular, e-mail ou aleatória"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Destino das contribuições dos participantes.
                </p>
              </div>

              {/* Tipo de Chave Pix */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Tipo de Chave Pix
                </label>
                <Select
                  value={selectedKeyType}
                  onValueChange={setSelectedKeyType}
                  options={PIX_KEY_OPTIONS}
                  ariaLabel="Tipo de Chave Pix"
                />
                <p className="text-[11px] text-muted-foreground">
                  Formatação do identificador BACEN.
                </p>
              </div>

              {/* Nome do Organizador */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="goal-merchant-name" className="text-xs font-semibold text-foreground">
                  Nome do Titular / Organizador
                </label>
                <Input
                  id="goal-merchant-name"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  placeholder="Ex.: Gabriel Sales"
                  required
                />
              </div>

              {/* Cidade do Organizador */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="goal-merchant-city" className="text-xs font-semibold text-foreground">
                  Cidade
                </label>
                <Input
                  id="goal-merchant-city"
                  value={merchantCity}
                  onChange={(e) => setMerchantCity(e.target.value)}
                  placeholder="Ex.: SAO PAULO"
                  required
                />
              </div>
            </div>

            {/* Aviso de Privacidade e Segurança */}
            <div className="rounded-xl border border-border/80 bg-surface/70 p-3 text-xs text-muted-foreground">
              O link gerado é público e somente de leitura. Nenhuma conta bancária, saldo pessoal ou
              transação privada é exposta aos participantes.
            </div>

            <ModalFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={targetCents <= 0 || !pixKey.trim() || isPending}
                className="gap-2"
              >
                <Share2 className="size-4" aria-hidden="true" />
                <span>{isPending ? "Gerando link…" : "Gerar Termômetro Público & Copiar Link"}</span>
              </Button>
            </ModalFooter>
          </form>
        )}
      </Modal>

      {/* Modal de Confirmação de Revogação */}
      <Modal
        open={isRevokeModalOpen}
        onOpenChange={setIsRevokeModalOpen}
        title="Revogar Link do Termômetro"
        description="Esta ação desativa imediatamente o acesso público à página desta meta."
        size="sm"
      >
        <p className="text-xs text-muted-foreground py-2">
          Os participantes não conseguirão mais consultar o progresso ou a chave Pix por este endereço.
          Você poderá gerar um novo link a qualquer momento.
        </p>
        <ModalFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setIsRevokeModalOpen(false)}>
            Manter ativo
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirmRevoke()}
            disabled={isPending}
          >
            {isPending ? "Revogando…" : "Confirmar revogação"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal de Confirmação de Regeneração */}
      <Modal
        open={isRegenerateModalOpen}
        onOpenChange={setIsRegenerateModalOpen}
        title="Regenerar Link do Termômetro"
        description="Um novo link público será gerado e o link anterior deixará de funcionar."
        size="sm"
      >
        <p className="text-xs text-muted-foreground py-2">
          Recomendado caso você tenha compartilhado o link por engano com pessoas não autorizadas.
        </p>
        <ModalFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setIsRegenerateModalOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirmRegenerate()}
            disabled={isPending}
          >
            {isPending ? "Regenerando…" : "Regenerar e copiar"}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
