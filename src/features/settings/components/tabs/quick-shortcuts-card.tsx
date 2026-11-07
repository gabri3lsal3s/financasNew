import { useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Key,
  Plus,
  RefreshCw,
  Smartphone,
  Trash2,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Input,
} from "@/components/ui";
import { useCreateQuickToken, useQuickTokens, useRevokeQuickToken } from "@/state";
import { generateNewQuickToken, getQuickExpenseWebhookUrl } from "@/services/quick-tokens";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { formatDateBR } from "@/lib/date";

export function QuickShortcutsCard() {
  const quickTokensQuery = useQuickTokens();
  const createTokenMutation = useCreateQuickToken();
  const revokeTokenMutation = useRevokeQuickToken();

  const [tokenName, setTokenName] = useState("Atalho iPhone");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const webhookUrl = getQuickExpenseWebhookUrl();

  const handleGenerateToken = async () => {
    setIsGenerating(true);
    triggerSensory("action");
    try {
      const { rawToken, tokenHash, tokenPrefix } = await generateNewQuickToken();

      await createTokenMutation.mutateAsync({
        name: tokenName.trim() || "Atalho iPhone",
        tokenHash,
        tokenPrefix,
        scopes: ["expense:write"],
      });

      setCreatedToken(rawToken);
      triggerSensory("success");
      pushToast({
        title: "Atalho criado com sucesso",
        description: "Copie o token de acesso agora. Ele não será exibido novamente.",
        variant: "success",
      });
    } catch {
      triggerSensory("warning");
      pushToast({
        title: "Erro ao gerar atalho",
        description: "Não foi possível registrar o token de entrada rápida.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string, isUrl: boolean) => {
    void navigator.clipboard.writeText(text);
    triggerSensory("selection");
    if (isUrl) {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
    pushToast({
      title: "Copiado para a área de transferência",
      variant: "default",
    });
  };

  const handleRevokeConfirm = async () => {
    if (!revokingTokenId) return;
    try {
      await revokeTokenMutation.mutateAsync(revokingTokenId);
      triggerSensory("success");
      pushToast({
        title: "Atalho revogado",
        description: "O token foi desativado e não aceitará mais requisições.",
        variant: "default",
      });
    } catch {
      triggerSensory("warning");
      pushToast({
        title: "Erro ao revogar",
        description: "Não foi possível revogar o token.",
        variant: "destructive",
      });
    } finally {
      setRevokingTokenId(null);
    }
  };

  const tokens = quickTokensQuery.data ?? [];

  return (
    <Card className="border-border/80 bg-surface shadow-xs">
      <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between pb-3">
        <div className="flex items-center gap-2">
          <Smartphone className="size-4 text-muted-foreground" aria-hidden="true" />
          <CardTitle className="text-base font-semibold text-foreground">
            Entrada Rápida iOS & Webhooks
          </CardTitle>
        </div>
        <Badge variant="muted" size="sm">
          Atalhos Apple / Siri
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 text-xs">
        <p className="text-muted-foreground leading-relaxed">
          Permite registrar despesas em menos de 1 segundo utilizando o aplicativo Atalhos do
          iPhone, comandos da Siri ou integrações via Webhook sem precisar digitar nada no app.
        </p>

        {/* Bloco de Criação de Novo Token */}
        <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-border/80 bg-surface-raised">
          <span className="font-semibold text-foreground">Criar Novo Atalho / Token</span>
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <Input
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="Nome do atalho (ex.: iPhone Gabriel)"
              className="text-xs h-9"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => void handleGenerateToken()}
              disabled={isGenerating || !tokenName.trim()}
              className="shrink-0 gap-1.5 font-semibold"
            >
              {isGenerating ? (
                <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-3.5" aria-hidden="true" />
              )}
              <span>Gerar Atalho</span>
            </Button>
          </div>

          {/* Exibição Segura do Token Recém-Gerado */}
          {createdToken && (
            <Alert variant="warning" className="flex flex-col gap-2 mt-1">
              <span className="font-semibold text-foreground">
                Token de Acesso Rápido Gerado
              </span>
              <p className="text-[11px] text-muted-foreground">
                Copie seu token agora. Por governança de segurança criptográfica (SHA-256), ele não
                será exibido novamente:
              </p>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-surface border border-border/80 font-mono text-[11px] break-all select-all">
                <span className="flex-1">{createdToken}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => handleCopy(createdToken, false)}
                  className="shrink-0 gap-1"
                >
                  {copiedToken ? (
                    <Check className="size-3 text-positive-strong" aria-hidden="true" />
                  ) : (
                    <Copy className="size-3" aria-hidden="true" />
                  )}
                  <span>{copiedToken ? "Copiado" : "Copiar"}</span>
                </Button>
              </div>
            </Alert>
          )}

          {/* URL da API / Webhook */}
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="text-[11px] font-medium text-muted-foreground">
              Endpoint do Webhook (URL da Requisição):
            </span>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-surface border border-border/80 font-mono text-[11px] break-all select-all">
              <span className="flex-1 text-muted-foreground">{webhookUrl}</span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => handleCopy(webhookUrl, true)}
                className="shrink-0 gap-1"
              >
                {copiedUrl ? (
                  <Check className="size-3 text-positive-strong" aria-hidden="true" />
                ) : (
                  <Copy className="size-3" aria-hidden="true" />
                )}
                <span>{copiedUrl ? "Copiado" : "Copiar URL"}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Guia de Configuração no iOS Shortcuts */}
        <div className="flex flex-col gap-2 p-3.5 rounded-xl border border-border/60 bg-muted/30">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Passo a Passo de Configuração no iPhone (Atalhos da Apple)</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-muted-foreground">
            <li>Abra o aplicativo nativo <strong>Atalhos</strong> no seu iPhone ou iPad.</li>
            <li>Crie um novo atalho com a ação <strong>Obter Conteúdo do URL</strong>.</li>
            <li>Cole a <strong>URL do Webhook</strong> acima no campo de URL (Método: <strong>POST</strong>).</li>
            <li>Adicione o cabeçalho <code>Authorization</code> com o valor <code>Bearer SEU_TOKEN</code>.</li>
            <li>No corpo (JSON), envie o campo <code>text</code> com a entrada de voz da Siri ou texto compartilhado.</li>
          </ol>
        </div>

        {/* Lista de Tokens Ativos */}
        <div className="flex flex-col gap-2 pt-2">
          <span className="font-semibold text-foreground">Atalhos e Tokens Registrados</span>
          {tokens.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 italic">
              Nenhum atalho registrado no momento.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 bg-surface">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2"
                >
                  <div className="flex items-center gap-2.5">
                    <Key className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{token.name}</span>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {token.token_prefix}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 justify-between sm:justify-end">
                    <span className="text-[11px] text-muted-foreground">
                      {token.last_used_at
                        ? `Último uso: ${formatDateBR(token.last_used_at.slice(0, 10))}`
                        : `Criado em ${formatDateBR(token.created_at.slice(0, 10))}`}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setRevokingTokenId(token.id)}
                      className="text-critical-strong hover:bg-critical/10"
                      aria-label={`Revogar atalho ${token.name}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <ConfirmDialog
        open={Boolean(revokingTokenId)}
        onOpenChange={(open) => {
          if (!open) setRevokingTokenId(null);
        }}
        title="Revogar Atalho"
        description="Tem certeza de que deseja revogar este atalho? Ele deixará de aceitar novos lançamentos imediatamente."
        confirmLabel="Revogar"
        variant="destructive"
        onConfirm={() => void handleRevokeConfirm()}
      />
    </Card>
  );
}
