import { useState } from "react";
import {
  Check,
  Copy,
  DollarSign,
  Gift,
  QrCode,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  MoneyText,
  QrCodeCanvas,
  Select,
} from "@/components/ui";
import {
  useAffiliateDashboard,
  useGetOrCreateAffiliatePartner,
  useUpdateAffiliatePix,
} from "@/state";
import { buildReferralLink } from "@/services/referral";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";

const PIX_TYPE_OPTIONS = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Celular" },
  { value: "random", label: "Chave Aleatória (EVP)" },
];

export function AffiliateTab() {
  const { data: dashboardData, isLoading } = useAffiliateDashboard();
  const getOrCreateMutation = useGetOrCreateAffiliatePartner();
  const updatePixMutation = useUpdateAffiliatePix();

  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [pixKeyType, setPixKeyType] = useState<string>("cpf");
  const [pixKey, setPixKey] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState(false);

  const partner = dashboardData?.partner;
  const metrics = dashboardData?.metrics;

  // Sincroniza estado local da chave Pix quando os dados chegam
  if (partner && !isInitialized) {
    if (partner.pix_key_type) setPixKeyType(partner.pix_key_type);
    if (partner.pix_key) setPixKey(partner.pix_key);
    setIsInitialized(true);
  }

  const referralLink = partner ? buildReferralLink(partner.referral_code) : "";

  const handleCopy = () => {
    if (!referralLink) return;
    void navigator.clipboard.writeText(referralLink);
    triggerSensory("selection");
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    pushToast({
      title: "Link copiado",
      description: "Link de indicação pronto para compartilhar.",
      variant: "default",
    });
  };

  const handleActivatePartner = async () => {
    triggerSensory("action");
    try {
      await getOrCreateMutation.mutateAsync({});
      triggerSensory("success");
      pushToast({
        title: "Perfil ativado com sucesso",
        description: "Seu link exclusivo de parceiro foi gerado.",
        variant: "success",
      });
    } catch {
      triggerSensory("warning");
      pushToast({
        title: "Erro ao ativar perfil",
        description: "Não foi possível criar o perfil de afiliado.",
        variant: "destructive",
      });
    }
  };

  const handleSavePix = async () => {
    if (!pixKey.trim()) return;
    triggerSensory("action");
    try {
      await updatePixMutation.mutateAsync({
        pixKey: pixKey.trim(),
        pixKeyType,
      });
      triggerSensory("success");
      pushToast({
        title: "Chave Pix atualizada",
        description: "Dados para repasse salvos com sucesso.",
        variant: "success",
      });
    } catch {
      triggerSensory("warning");
      pushToast({
        title: "Erro ao salvar chave Pix",
        description: "Não foi possível atualizar seus dados de repasse.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="h-28 rounded-2xl bg-muted/30 border border-border/60" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="h-24 rounded-2xl bg-muted/30 border border-border/60" />
          <div className="h-24 rounded-2xl bg-muted/30 border border-border/60" />
          <div className="h-24 rounded-2xl bg-muted/30 border border-border/60" />
        </div>
      </div>
    );
  }

  // Estado 1: Usuário ainda não é parceiro
  if (!partner) {
    return (
      <Card className="border-border/80 bg-gradient-to-r from-primary/10 via-surface to-surface shadow-xs">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3">
          <div className="flex items-center gap-2">
            <Gift className="size-4 text-primary" aria-hidden="true" />
            <CardTitle className="text-base font-semibold text-foreground">
              Programa de Embaixadores & Afiliados B2B2C
            </CardTitle>
          </div>
          <Badge variant="muted" size="sm">
            30% Recorrente
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-xs">
          <p className="text-muted-foreground leading-relaxed">
            Recomende o Áxis Finance para seus clientes de consultoria, seguidores ou amigos e
            receba <strong>30% de comissão recorrente todo mês</strong> enquanto o usuário indicado
            permanecer no Plano Pro.
          </p>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-border/80 bg-surface">
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-foreground">
                Pronto para transformar sua recomendação em renda recorrente?
              </span>
              <span className="text-[11px] text-muted-foreground">
                Gere seu código exclusivo agora. Repasses mensais automáticos via Pix todo dia 5.
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleActivatePartner()}
              disabled={getOrCreateMutation.isPending}
              className="gap-1.5 font-semibold shrink-0"
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
              <span>
                {getOrCreateMutation.isPending ? "Ativando…" : "Ativar Meu Perfil de Parceiro"}
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Estado 2: Painel do Parceiro Ativo
  return (
    <div className="flex flex-col gap-6">
      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Card className="border-border/80 bg-surface shadow-xs">
          <CardContent className="p-4 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total de Indicados</span>
              <Users className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {metrics?.total_referred_users ?? 0}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Cadastros realizados com seu código
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-xs">
          <CardContent className="p-4 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Assinantes Pro Ativos</span>
              <Zap className="size-4 text-primary" aria-hidden="true" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {metrics?.active_pro_users ?? 0}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Usuários pagantes gerando comissão
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-xs">
          <CardContent className="p-4 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Comissão Mensal Estimada
              </span>
              <DollarSign className="size-4 text-positive-strong" aria-hidden="true" />
            </div>
            <MoneyText
              cents={metrics?.estimated_commission_cents ?? 0}
              className="text-2xl font-bold tracking-tight text-positive-strong tabular-nums"
            />
            <span className="text-[11px] text-muted-foreground">
              30% recorrente pago todo dia 5
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Link de Indicação & QR Code */}
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between pb-3">
          <div className="flex items-center gap-2">
            <Gift className="size-4 text-muted-foreground" aria-hidden="true" />
            <CardTitle className="text-base font-semibold text-foreground">
              Seu Link Exclusivo de Indicação
            </CardTitle>
          </div>
          <Badge variant="muted" size="sm">
            Código: {partner.referral_code}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-xs">
          <p className="text-muted-foreground leading-relaxed">
            Compartilhe seu link exclusivo. O visitante recebe 30 dias de teste Pro e o sistema
            vincula a indicação de forma perpétua à sua conta.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl border border-border/80 bg-surface-raised font-mono select-all">
            <span className="flex-1 text-[11px] truncate text-foreground">{referralLink}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleCopy}
                className="gap-1 font-semibold"
              >
                {copiedLink ? (
                  <Check className="size-3 text-positive-strong" aria-hidden="true" />
                ) : (
                  <Copy className="size-3" aria-hidden="true" />
                )}
                <span>{copiedLink ? "Copiado" : "Copiar Link"}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setShowQrCode((prev) => !prev)}
                className="gap-1"
              >
                <QrCode className="size-3" aria-hidden="true" />
                <span>{showQrCode ? "Ocultar QR" : "QR Code"}</span>
              </Button>
            </div>
          </div>

          {showQrCode && (
            <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/80 bg-surface gap-2 animate-in fade-in duration-150">
              <QrCodeCanvas text={referralLink} size={160} />
              <span className="text-[11px] text-muted-foreground">
                Aponte a câmera do celular para abrir o cadastro com seu cupom
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dados Bancários para Repasse Pix */}
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between pb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="size-4 text-muted-foreground" aria-hidden="true" />
            <CardTitle className="text-base font-semibold text-foreground">
              Dados para Recebimento das Comissões (Pix)
            </CardTitle>
          </div>
          <span className="text-[11px] text-muted-foreground">Repasses no 5º dia útil</span>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-xs">
          <p className="text-muted-foreground leading-relaxed">
            Cadastre a chave Pix para onde suas comissões mensais devem ser transferidas
            automaticamente todo dia 5 do mês.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-foreground">Tipo de Chave Pix</label>
              <Select
                value={pixKeyType}
                onValueChange={setPixKeyType}
                options={PIX_TYPE_OPTIONS}
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="pix-key-input" className="font-semibold text-foreground">Chave Pix</label>
              <div className="flex items-center gap-2">
                <Input
                  id="pix-key-input"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="Informe sua chave Pix para depósito"
                  className="text-xs h-9"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleSavePix()}
                  disabled={updatePixMutation.isPending || !pixKey.trim()}
                  className="shrink-0 font-semibold"
                >
                  {updatePixMutation.isPending ? "Salvando…" : "Salvar Chave"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
