import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  ExternalLink,
  MessageCircle,
  Plus,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { MoneyText } from "@/components/ui/money-text";
import { Badge } from "@/components/ui/badge";
import { Select, type SelectOption } from "@/components/ui/select";
import {
  buildSplitParticipantInstallments,
  calculateSplitSummary,
  type SplitRemainderPolicy,
} from "@/domain/finance/split-math";
import {
  detectPixKeyType,
  generatePixBrCode,
  type PixKeyType,
} from "@/domain/pix/pix-br-code";
import { generateShareToken } from "@/domain/share/token";
import { useUserAccess } from "@/state/queries/use-user-access";
import { useCreatePublicShare } from "@/state/mutations/use-public-share-mutations";
import { useExpense } from "@/state";
import { useDemoSession } from "@/state/demo-mode";
import { useSplitPreferences } from "@/services/split-preferences";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { getPublicAppUrl } from "@/services/app-url";
import { todayISO } from "@/domain/debts";
import type { Expense, SplitParticipantInstallment, SplitSharePayload } from "@/types";

export interface SplitExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Despesa original opcional a ser dividida */
  expense?: Partial<Expense> | null;
  /** Se o diálogo foi acionado a partir do Wizard de lançamento */
  fromWizard?: boolean;
  /** Valor total alternativo em centavos (caso aberto sem objeto Expense) */
  initialAmountCents?: number;
  /** Descrição alternativa */
  initialDescription?: string;
  /** Data alternativa da despesa (ISO YYYY-MM-DD) */
  initialDate?: string;
  /** Quantidade inicial de participantes (ex.: definido na criação da despesa) */
  initialPeopleCount?: number;
  /** Quantidade de parcelas da despesa */
  initialInstallmentsCount?: number;
  /** Nome da categoria da despesa (para correspondência ao salvar via link) */
  categoryName?: string;
  /** Ícone da categoria */
  categoryIcon?: string;
  /** Se true e os dados Pix estiverem disponíveis, gera o link automaticamente ao abrir */
  autoGenerate?: boolean;
  /** Se true, opera em modo sandbox seguro em memória sem mutações no banco (§Plano 11) */
  isSimulation?: boolean;
}

const PIX_KEY_OPTIONS: SelectOption[] = [
  { value: "auto", label: "Detecção automática" },
  { value: "cpf", label: "CPF" },
  { value: "phone", label: "Celular (+55)" },
  { value: "email", label: "E-mail" },
  { value: "random", label: "Chave Aleatória (EVP)" },
  { value: "cnpj", label: "CNPJ" },
];

const REMAINDER_OPTIONS: SelectOption[] = [
  { value: "host", label: "Anfitrião absorve centavos (Pix uniforme)" },
  { value: "balanced", label: "Distribuir centavos entre os primeiros" },
];

const QUICK_PEOPLE_COUNTS = [2, 3, 4, 5];

export function SplitExpenseDialog({
  open,
  onOpenChange,
  expense,
  fromWizard = false,
  initialAmountCents,
  initialDescription,
  initialDate,
  initialPeopleCount,
  initialInstallmentsCount,
  categoryName,
  categoryIcon,
  autoGenerate = false,
  isSimulation = false,
}: SplitExpenseDialogProps) {
  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    queryClient = useQueryClient();
  } catch {
    // Fallback em testes sem QueryClientProvider
  }

  const { isDemoActive } = useDemoSession();
  const isSimulationActive = Boolean(isSimulation || isDemoActive);

  const { profile } = useUserAccess();
  const { preferences, updatePreferences } = useSplitPreferences();
  const createPublicShareMutation = useCreatePublicShare();
  const { data: fullExpense } = useExpense(expense?.id ?? null);

  const isPreconfigured = Boolean(
    fromWizard ||
    (expense && typeof expense.value === "number" && (initialPeopleCount ?? 0) >= 2)
  );

  // Sugestão de Pix a partir das preferências salvas ou perfil do usuário (Blindado contra PII leak no tour)
  const effectiveDefaultPix = isSimulationActive
    ? "pix.demo@exemplo.com"
    : preferences.pixKey || profile?.cpf || profile?.email || "financeiro.demo@exemplo.com";
  const effectiveDefaultName = isSimulationActive
    ? "Gabriel (Demonstração)"
    : preferences.merchantName || profile?.name || "Você";
  const effectiveDefaultCity = isSimulationActive
    ? "São Paulo"
    : preferences.merchantCity || "São Paulo";
  const effectiveDefaultRemainder = preferences.remainderPolicy || "host";
  const effectiveDefaultKeyType = preferences.pixKeyType || "auto";
  const effectiveInitialCount = initialPeopleCount ?? preferences.defaultPeopleCount ?? 2;

  const initialBaseCents = expense && typeof expense.value === "number"
    ? Math.round(expense.value * 100)
    : (initialAmountCents ?? 0);
  const initialDesc = expense?.description || initialDescription || "";

  const [totalCents, setTotalCents] = useState<number>(initialBaseCents);
  const [description, setDescription] = useState<string>(initialDesc);
  const [peopleCount, setPeopleCount] = useState<number>(effectiveInitialCount);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [participants, setParticipants] = useState<string[]>(() =>
    Array.from({ length: effectiveInitialCount }, (_, i) =>
      i === 0 ? "Você (Anfitrião)" : `Participante ${i + 1}`,
    ),
  );
  const [remainderPolicy, setRemainderPolicy] = useState<SplitRemainderPolicy>(effectiveDefaultRemainder);

  // Configuração Pix memorizada
  const [pixKey, setPixKey] = useState<string>(effectiveDefaultPix);
  const [selectedKeyType, setSelectedKeyType] = useState<string>(effectiveDefaultKeyType);
  const [merchantName, setMerchantName] = useState<string>(effectiveDefaultName);
  const [merchantCity, setMerchantCity] = useState<string>(effectiveDefaultCity);

  // Estado de link gerado
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Sincronização ao abrir / reabrir o modal
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setTotalCents(initialBaseCents);
      setDescription(initialDesc);
      const count = initialPeopleCount ?? preferences.defaultPeopleCount ?? 2;
      setPeopleCount(count);
      setIsCustomMode(false);
      setParticipants(
        Array.from({ length: count }, (_, i) =>
          i === 0 ? "Você (Anfitrião)" : `Participante ${i + 1}`,
        ),
      );
      setRemainderPolicy(preferences.remainderPolicy || "host");
      setGeneratedLink(null);
      setCopied(false);
      setPixKey(preferences.pixKey || profile?.cpf || profile?.email || "financeiro.demo@exemplo.com");
      setSelectedKeyType(preferences.pixKeyType || "auto");
      setMerchantName(preferences.merchantName || profile?.name || "Você");
      setMerchantCity(preferences.merchantCity || "São Paulo");
    }
  }


  // Tipo de chave detectado
  const detectedType = useMemo(() => {
    if (selectedKeyType !== "auto") return selectedKeyType as PixKeyType;
    const detected = detectPixKeyType(pixKey);
    return detected === "unknown" ? "cpf" : detected;
  }, [pixKey, selectedKeyType]);

  // Cálculo financeiro em tempo real via função pura
  const summary = useMemo(() => {
    const validCount = Math.max(1, Math.min(peopleCount, 50));
    const validCents = Math.max(0, totalCents);
    return calculateSplitSummary(validCents, validCount, { remainderPolicy });
  }, [totalCents, peopleCount, remainderPolicy]);

  // Sincroniza participantes quando a contagem altera
  const handlePeopleCountChange = (count: number) => {
    const clamped = Math.max(2, Math.min(count, 50));
    setPeopleCount(clamped);

    setParticipants((prev) => {
      const next = [...prev];
      if (clamped > next.length) {
        for (let i = next.length; i < clamped; i++) {
          next.push(`Participante ${i + 1}`);
        }
      } else if (clamped < next.length) {
        return next.slice(0, clamped);
      }
      return next;
    });
  };

  const handleParticipantNameChange = (index: number, name: string) => {
    setParticipants((prev) => {
      const next = [...prev];
      next[index] = name;
      return next;
    });
  };

  const handleAddParticipant = () => {
    if (peopleCount >= 50) return;
    const nextCount = peopleCount + 1;
    handlePeopleCountChange(nextCount);
  };

  const handleRemoveParticipant = (index: number) => {
    if (peopleCount <= 2 || index === 0) return;
    setParticipants((prev) => prev.filter((_, i) => i !== index));
    setPeopleCount((prev) => prev - 1);
  };

  // Criação do Racha e Cópia do Link
  const handleGenerateAndCopy = useCallback(async () => {
    if (totalCents <= 0 || peopleCount < 2 || !pixKey.trim()) return;

    try {
      const cleanMerchant = merchantName.trim() || profile?.name || "Anfitriao";
      const cleanCity = merchantCity.trim();
      if (!cleanCity) return;

      const pixBrCode = generatePixBrCode({
        pixKey: pixKey.trim(),
        keyType: detectedType,
        merchantName: cleanMerchant,
        merchantCity: cleanCity,
        amountCents: summary.guestShareCents,
        txId: `RACHA${Date.now().toString(36).toUpperCase()}`.slice(0, 25),
        infoAdicional: description.trim().slice(0, 25) || "Racha de conta",
      });

      const token = generateShareToken(10);
      const splitDate = expense?.date || initialDate || todayISO();
      const effectiveInstallmentsCount = Math.max(
        1,
        expense?.installments_total ?? fullExpense?.installments_total ?? initialInstallmentsCount ?? 1,
      );
      const effectiveInstallmentGroupId =
        expense?.installment_group_id ?? fullExpense?.installment_group_id ?? null;

      const participantInstallments: SplitParticipantInstallment[] = [];
      if (effectiveInstallmentsCount > 1) {
        participants.forEach((_name, i) => {
          const participantId = `p_${i + 1}`;
          const shareCents = summary.shares[i] ?? summary.guestShareCents;
          const isHost = i === 0;
          const insts = buildSplitParticipantInstallments({
            participantId,
            totalShareCents: shareCents,
            installmentsCount: effectiveInstallmentsCount,
            startDate: splitDate,
            isSettledInitial: isHost,
          });
          participantInstallments.push(...insts);
        });
      }

      const payload: SplitSharePayload = {
        title: description.trim() || "Racha de Despesa",
        total_cents: totalCents,
        date: splitDate,
        people_count: peopleCount,
        guest_share_cents: summary.guestShareCents,
        host_share_cents: summary.hostShareCents,
        participants: participants.map((name, i) => ({
          id: `p_${i + 1}`,
          name: name.trim() || (i === 0 ? "Você (Anfitrião)" : `Participante ${i + 1}`),
          share_cents: summary.shares[i] ?? summary.guestShareCents,
          is_host: i === 0,
          is_settled: i === 0,
          settled_cents: i === 0 ? (summary.shares[i] ?? summary.hostShareCents) : 0,
          settled_at: i === 0 ? new Date().toISOString() : null,
        })),
        remainder_policy: remainderPolicy,
        host_name: cleanMerchant,
        host_city: cleanCity,
        pix_key: pixKey.trim(),
        pix_key_type: detectedType,
        pix_br_code: pixBrCode,
        expense_id: expense?.id,
        installment_group_id: effectiveInstallmentGroupId,
        category_id: expense?.category_id,
        category_name: categoryName,
        category_icon: categoryIcon,
        is_completed: false,
        total_settled_cents: summary.hostShareCents,
        installments_count: effectiveInstallmentsCount > 1 ? effectiveInstallmentsCount : undefined,
        installments_mode: effectiveInstallmentsCount > 1 ? "per_installment" : undefined,
        participant_installments: participantInstallments.length > 0 ? participantInstallments : undefined,
      };

      if (isSimulationActive) {
        const demoUrl = getPublicAppUrl("r/demo-racha-480");
        setGeneratedLink(demoUrl);
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(demoUrl);
            setCopied(true);
          } catch {
            // Fallback silencioso de permissão de clipboard
          }
        }
        triggerSensory("success");
        pushToast({
          title: "Demonstração de link do racha",
          description: "Link demonstrativo gerado em memória para apresentação didática.",
          variant: "success",
        });
        return;
      }

      const share = await createPublicShareMutation.mutateAsync({
        kind: "split",
        token,
        payload: payload as unknown as Record<string, unknown>,
      });

      const url = getPublicAppUrl(`r/${share.token}`);
      setGeneratedLink(url);

      if (queryClient) {
        void queryClient.invalidateQueries({ queryKey: ["my-public-shares"] });
        void queryClient.invalidateQueries({ queryKey: ["public-shares"] });
        void queryClient.invalidateQueries({ queryKey: ["debts"] });
        void queryClient.invalidateQueries({ queryKey: ["expenses"] });
        void queryClient.invalidateQueries({ queryKey: ["overview"] });
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        } catch {
          // Fallback silencioso de permissão de clipboard
        }
      }

      // Salva e aprende as preferências Pix do usuário
      updatePreferences({
        pixKey: pixKey.trim(),
        pixKeyType: detectedType,
        merchantName: cleanMerchant,
        merchantCity: cleanCity,
        remainderPolicy,
        defaultPeopleCount: peopleCount,
      });

      triggerSensory("success");
      pushToast({
        title: "Link do racha gerado e copiado!",
        description: "Compartilhe com seus amigos para receber via Pix.",
        variant: "success",
      });
    } catch {
      // Erro tratado pela mutation e exibido via toast
    }
  }, [
    totalCents,
    peopleCount,
    pixKey,
    merchantName,
    merchantCity,
    profile,
    detectedType,
    summary.guestShareCents,
    summary.hostShareCents,
    summary.shares,
    description,
    expense,
    initialDate,
    participants,
    remainderPolicy,
    categoryName,
    categoryIcon,
    createPublicShareMutation,
    updatePreferences,
    isSimulationActive,
    initialInstallmentsCount,
    fullExpense,
    queryClient,
  ]);

  const handleShareWhatsApp = () => {
    if (!generatedLink) return;
    const guestFormatted = (summary.guestShareCents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    const cleanTitle = description.trim() || "Despesa";
    const msg = `Oi! Segue o link para o racha da conta de ${cleanTitle} (${guestFormatted} para cada): ${generatedLink}\nVocê pode pagar direto copiando o Pix!`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleCopyLinkAgain = async () => {
    if (!generatedLink) return;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(generatedLink);
        setCopied(true);
        triggerSensory("success");
        pushToast({ title: "Link copiado para a área de transferência!", variant: "default" });
        setTimeout(() => setCopied(false), 3000);
      } catch {
        pushToast({ title: "Não foi possível copiar automaticamente.", variant: "destructive" });
      }
    }
  };

  const handleShareNative = async () => {
    if (!generatedLink) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Racha: ${description.trim() || "Despesa"}`,
          text: `Sua parte na despesa ficou em R$ ${(summary.guestShareCents / 100).toFixed(2)}. Acesse o link para copiar o Pix:`,
          url: generatedLink,
        });
      } catch {
        // Cancelamento pelo usuário
      }
    } else {
      await handleCopyLinkAgain();
    }
  };

  const isFormValid =
    totalCents > 0 &&
    peopleCount >= 2 &&
    pixKey.trim().length > 0 &&
    merchantName.trim().length > 0 &&
    merchantCity.trim().length > 0;

  // Auto-geração suave quando solicitado pelo fluxo de criação integrada
  useEffect(() => {
    if (
      open &&
      autoGenerate &&
      !generatedLink &&
      isFormValid &&
      !createPublicShareMutation.isPending
    ) {
      const timer = setTimeout(() => {
        void handleGenerateAndCopy();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [
    open,
    autoGenerate,
    generatedLink,
    isFormValid,
    createPublicShareMutation.isPending,
    handleGenerateAndCopy,
  ]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isPreconfigured ? "Chave Pix & Link do Racha" : "Rachar Despesa"}
      description={
        isPreconfigured
          ? "Sua despesa já foi salva no extrato com o rateio definido. Agora confirme sua chave Pix para gerar o link e o QR Code de cobrança para os amigos."
          : "Divida o valor entre amigos e gere um link público com Pix Copia e Cola automático."
      }
      size="lg"
    >
      <div className="space-y-4 pt-1 pb-2">
        {generatedLink ? (
          /* Visão de Link Gerado com Sucesso */
          <div data-tour="split-link-actions" className="space-y-4">
            <div className="rounded-lg border border-positive/30 bg-positive/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-full bg-positive/10 flex items-center justify-center text-positive-strong shrink-0">
                  <Check className="size-4" aria-hidden="true" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Link de Racha Gerado</h4>
                  <p className="text-xs text-muted-foreground">
                    O link foi copiado para a sua área de transferência.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  value={generatedLink}
                  readOnly
                  className="font-mono text-xs bg-surface select-all"
                  aria-label="Link público do racha"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCopyLinkAgain()}
                  className="shrink-0 gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" aria-hidden="true" />
                      <span>Copiar</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Resumo do Racha */}
            <div className="rounded-lg border border-border/80 bg-surface p-3.5 space-y-2">
              <span className="text-xs font-semibold text-foreground">Resumo da Partilha</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="rounded border border-border/50 bg-background/50 p-2.5">
                  <span className="text-[11px] text-muted-foreground block">Total</span>
                  <MoneyText cents={totalCents} variant="value" className="font-semibold" />
                </div>
                <div className="rounded border border-border/50 bg-background/50 p-2.5">
                  <span className="text-[11px] text-muted-foreground block">
                    Cada Convidado ({summary.guestCount})
                  </span>
                  <MoneyText
                    cents={summary.guestShareCents}
                    tone="portfolio"
                    variant="value"
                    className="font-semibold"
                  />
                </div>
                <div className="rounded border border-border/50 bg-background/50 p-2.5">
                  <span className="text-[11px] text-muted-foreground block">Sua Parte (Anfitrião)</span>
                  <MoneyText cents={summary.hostShareCents} variant="value" className="font-semibold" />
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-border/80">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto gap-1.5"
                onClick={handleShareWhatsApp}
              >
                <MessageCircle className="size-3.5 text-positive-strong" aria-hidden="true" />
                <span>WhatsApp</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto gap-1.5"
                onClick={() => void handleShareNative()}
              >
                <Share2 className="size-3.5" aria-hidden="true" />
                <span>Compartilhar</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto gap-1.5"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.open(generatedLink, "_blank", "noopener,noreferrer");
                  }
                }}
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                <span>Ver Página Pública</span>
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => onOpenChange(false)}
              >
                Concluir
              </Button>
            </div>
          </div>
        ) : (
          /* Formulário de Configuração do Racha */
          <div className="space-y-4">
            {isPreconfigured ? (
              /* Resumo do Rateio Pré-configurado no Lançamento */
              <div className="rounded-xl border border-border/80 bg-surface/60 p-3.5 space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="size-4 text-portfolio shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-foreground truncate block">
                        {description.trim() || "Racha de Despesa"}
                      </span>
                      <span className="text-[11px] text-muted-foreground block">
                        Rateio já registrado no seu extrato
                      </span>
                    </div>
                  </div>

                  <Badge variant="portfolio" size="xs" className="shrink-0 self-start sm:self-center">
                    {peopleCount} pessoas ({summary.guestCount} {summary.guestCount === 1 ? "amigo" : "amigos"} + você)
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border/60">
                  <div className="p-2.5 rounded-lg bg-background/60">
                    <span className="text-[11px] text-muted-foreground block">Valor Total</span>
                    <MoneyText cents={totalCents} variant="value" className="font-semibold text-sm" />
                  </div>
                  <div className="p-2.5 rounded-lg bg-background/60">
                    <span className="text-[11px] text-muted-foreground block">
                      Cada Amigo ({summary.guestCount})
                    </span>
                    <MoneyText
                      cents={summary.guestShareCents}
                      tone="portfolio"
                      variant="value"
                      className="font-semibold text-sm"
                    />
                  </div>
                  <div className="p-2.5 rounded-lg bg-background/60">
                    <span className="text-[11px] text-muted-foreground block">Sua Cota (Anfitrião)</span>
                    <MoneyText cents={summary.hostShareCents} variant="value" className="font-semibold text-sm" />
                  </div>
                </div>

                {summary.remainderCents > 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    {remainderPolicy === "host"
                      ? `Diferença de ${summary.remainderCents} centavo(s) de resto atribuída ao anfitrião para que todos os amigos paguem o mesmo valor.`
                      : `Diferença de ${summary.remainderCents} centavo(s) distribuída proporcionalmente entre os primeiros participantes.`}
                  </p>
                ) : null}

                {/* Opção para customizar nomes dos amigos sem alterar contagem */}
                <div className="pt-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setIsCustomMode(!isCustomMode)}
                    className="text-xs text-muted-foreground hover:text-foreground h-6 px-1.5 cursor-pointer"
                  >
                    {isCustomMode ? "Ocultar nomes dos participantes" : "Personalizar nomes dos participantes"}
                  </Button>

                  {isCustomMode ? (
                    <div className="space-y-2 pt-2 mt-1 border-t border-border/40">
                      {participants.map((name, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="flex-1">
                            <Input
                              value={name}
                              onChange={(e) => handleParticipantNameChange(index, e.target.value)}
                              placeholder={index === 0 ? "Você (Anfitrião)" : `Amigo ${index}`}
                              className="h-8 text-xs"
                              aria-label={`Nome do participante ${index + 1}`}
                            />
                          </div>
                          <div className="w-24 text-right">
                            <MoneyText
                              cents={summary.shares[index] ?? 0}
                              variant="value"
                              className="font-medium text-xs"
                            />
                          </div>
                          {index === 0 ? (
                            <Badge size="xs" variant="muted" className="shrink-0">
                              Anfitrião
                            </Badge>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                {/* Bloco 1: Valor e Descrição */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Valor Total da Despesa
                    </label>
                    <MoneyInput
                      cents={totalCents}
                      onCentsChange={setTotalCents}
                      size="md"
                      aria-label="Valor total da despesa"
                    />
                    <span className="text-[11px] text-muted-foreground block">
                      Valor nominal a ser dividido
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Descrição ou Título <span className="font-normal text-muted-foreground">(opcional)</span>
                    </label>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ex.: Pizza de Sábado, Churrasco, Uber..."
                      maxLength={60}
                      aria-label="Descrição do racha"
                    />
                    <span className="text-[11px] text-muted-foreground block">
                      Exibida aos amigos na página pública
                    </span>
                  </div>
                </div>

                {/* Bloco 2: Rateio e Participantes */}
                <div className="rounded-lg border border-border/80 bg-surface p-3.5 space-y-3 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Users className="size-4 text-muted-foreground" aria-hidden="true" />
                      <span className="text-xs font-semibold text-foreground">Divisão entre Participantes</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant={!isCustomMode ? "secondary" : "ghost"}
                        size="xs"
                        onClick={() => setIsCustomMode(false)}
                      >
                        Quantidade
                      </Button>
                      <Button
                        type="button"
                        variant={isCustomMode ? "secondary" : "ghost"}
                        size="xs"
                        onClick={() => setIsCustomMode(true)}
                      >
                        Nomes Customizados
                      </Button>
                    </div>
                  </div>

                  {!isCustomMode ? (
                    /* Modo Rápido por Quantidade */
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {QUICK_PEOPLE_COUNTS.map((count) => (
                          <Button
                            key={count}
                            type="button"
                            variant={peopleCount === count ? "default" : "outline"}
                            size="xs"
                            onClick={() => handlePeopleCountChange(count)}
                          >
                            {count} pessoas
                          </Button>
                        ))}
                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className="text-xs text-muted-foreground">Outro número:</span>
                          <Input
                            type="number"
                            min={2}
                            max={50}
                            value={peopleCount}
                            onChange={(e) => handlePeopleCountChange(parseInt(e.target.value, 10) || 2)}
                            className="w-16 h-7 text-xs text-center"
                            aria-label="Número de pessoas para o racha"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Modo com Nomes Customizados */
                    <div className="space-y-2">
                      {participants.map((name, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="flex-1">
                            <Input
                              value={name}
                              onChange={(e) => handleParticipantNameChange(index, e.target.value)}
                              placeholder={index === 0 ? "Você (Anfitrião)" : `Participante ${index + 1}`}
                              className="h-8 text-xs"
                              aria-label={`Nome do participante ${index + 1}`}
                            />
                          </div>
                          <div className="w-24 text-right">
                            <MoneyText
                              cents={summary.shares[index] ?? 0}
                              variant="value"
                              className="font-medium"
                            />
                          </div>
                          {index === 0 ? (
                            <Badge size="xs" variant="muted" className="shrink-0">
                              Anfitrião
                            </Badge>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => handleRemoveParticipant(index)}
                              className="text-muted-foreground hover:text-critical p-1 shrink-0"
                              aria-label={`Remover participante ${index + 1}`}
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      ))}

                      {peopleCount < 50 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={handleAddParticipant}
                          className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="size-3.5" aria-hidden="true" />
                          <span>Adicionar participante</span>
                        </Button>
                      ) : null}
                    </div>
                  )}

                  {/* Indicador de Partilha Calculada */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border/60">
                    <div className="p-2 rounded bg-background/60">
                      <span className="text-[11px] text-muted-foreground block">Total</span>
                      <MoneyText cents={totalCents} variant="value" className="font-semibold" />
                    </div>
                    <div className="p-2 rounded bg-background/60">
                      <span className="text-[11px] text-muted-foreground block">
                        Cada Convidado ({summary.guestCount})
                      </span>
                      <MoneyText
                        cents={summary.guestShareCents}
                        tone="portfolio"
                        variant="value"
                        className="font-semibold"
                      />
                    </div>
                    <div className="p-2 rounded bg-background/60">
                      <span className="text-[11px] text-muted-foreground block">Sua Parte (Anfitrião)</span>
                      <MoneyText cents={summary.hostShareCents} variant="value" className="font-semibold" />
                    </div>
                  </div>

                  {summary.remainderCents > 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      {remainderPolicy === "host"
                        ? `Diferença de ${summary.remainderCents} centavo(s) de resto atribuída ao anfitrião para que todos os convidados paguem o mesmo valor.`
                        : `Diferença de ${summary.remainderCents} centavo(s) distribuída proporcionalmente entre os primeiros participantes.`}
                    </p>
                  ) : null}
                </div>
              </>
            )}

            {/* Bloco 3: Dados Pix do Anfitrião */}
            <div data-tour="split-pix-config" className="rounded-lg border border-border/80 bg-surface p-3.5 space-y-3 shadow-xs">
              <span className="text-xs font-semibold text-foreground block">
                Dados Pix para Recebimento
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">
                      Chave Pix do Anfitrião
                    </label>
                    <Badge size="xs" variant="muted">
                      {detectedType.toUpperCase()}
                    </Badge>
                  </div>
                  <Input
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    placeholder="CPF, celular, e-mail ou chave aleatória"
                    aria-label="Chave Pix do anfitrião"
                  />
                  <span className="text-[11px] text-muted-foreground block">
                    Receberá os pagamentos via QR Code e Copia e Cola
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Tipo de Chave
                  </label>
                  <Select
                    value={selectedKeyType}
                    onValueChange={setSelectedKeyType}
                    options={PIX_KEY_OPTIONS}
                    ariaLabel="Tipo de chave Pix"
                  />
                  <span className="text-[11px] text-muted-foreground block">
                    Ajuste caso o celular não tenha DDD/+55
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Nome do Titular
                  </label>
                  <Input
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    placeholder="Nome completo ou comercial"
                    maxLength={25}
                    aria-label="Nome do titular da chave Pix"
                  />
                  <span className="text-[11px] text-muted-foreground block">
                    Nome cadastrado no banco (máximo 25 caracteres)
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Cidade do Titular
                  </label>
                  <Input
                    value={merchantCity}
                    onChange={(e) => setMerchantCity(e.target.value.toUpperCase())}
                    placeholder="Sua cidade (ex.: Nossa Senhora da Glória)"
                    maxLength={60}
                    aria-label="Cidade do titular da chave Pix"
                  />
                  <span className="text-[11px] text-muted-foreground block">
                    Salva automaticamente para os próximos rachas
                  </span>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-xs font-semibold text-foreground">
                  Política de Centavos
                </label>
                <Select
                  value={remainderPolicy}
                  onValueChange={(val) => setRemainderPolicy(val as SplitRemainderPolicy)}
                  options={REMAINDER_OPTIONS}
                  ariaLabel="Política de distribuição de centavos"
                />
                <span className="text-[11px] text-muted-foreground block">
                  Define quem absorve frações não divisíveis de 1 centavo
                </span>
              </div>
            </div>

            {/* Ações do Rodapé */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-border/80">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={!isFormValid || createPublicShareMutation.isPending}
                onClick={() => void handleGenerateAndCopy()}
                className="w-full sm:w-auto gap-1.5"
              >
                <Share2 className="size-3.5" aria-hidden="true" />
                <span>
                  {createPublicShareMutation.isPending
                    ? "Gerando Link…"
                    : isPreconfigured
                      ? "Gerar Link & Copiar Pix"
                      : "Gerar Racha & Copiar Link"}
                </span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
