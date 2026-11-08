/**
 * Página pública de visualização e colaboração do Modo Viagem (/viagem/:token).
 * Permite que participantes sem conta visualizem despesas, saldos e adicionem gastos.
 * Cumpre regras DRY, acessibilidade e design system (zero controles nativos, zero emojis).
 */

import { useState } from "react";
import { useParams, Link } from "react-router";
import {
  Users,
  Plus,
  Receipt,
  Copy,
  Check,
  Calendar,
  MapPin,
  Share2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import {
  Button,
  Badge,
  Card,
  Tabs,
  EmptyState,
  Skeleton,
} from "@/components/ui";
import { usePublicTrip } from "@/state/queries/use-trips";
import { formatCentsAsBRL } from "@/services/masks/money";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  SharedLinkHeaderNav,
  AddPublicTripExpenseDialog,
} from "../components";

export function TripPublicPage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, error } = usePublicTrip(token);

  const [activeTab, setActiveTab] = useState<string>("expenses");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [copiedPixKey, setCopiedPixKey] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center p-4">
        <div className="w-full max-w-xl space-y-4 pt-12">
          <Skeleton className="h-10 w-48 mx-auto" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 text-center space-y-4">
          <EmptyState
            icon={<Receipt className="size-8" />}
            title="Viagem não encontrada"
            description="O link informado pode ter expirado, sido removido ou o código está incorreto."
          />
          <Link to="/">
            <Button variant="outline" className="w-full">
              Ir para a página inicial
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const { trip, members, expenses, balances, suggestedSettlements, totalExpensesCents } = data;

  const currentMember = selectedMemberId
    ? members.find((m) => m.id === selectedMemberId) ?? null
    : null;

  const currentBalance = selectedMemberId
    ? balances.find((b) => b.memberId === selectedMemberId) ?? null
    : null;

  const handleCopyPix = (pixKey: string) => {
    navigator.clipboard.writeText(pixKey);
    setCopiedPixKey(pixKey);
    triggerSensory("success");
    pushToast({
      title: "Chave Pix copiada",
      description: "Cole no seu aplicativo bancário para realizar a transferência.",
    });
    setTimeout(() => setCopiedPixKey(null), 3000);
  };

  const handleShareWhatsApp = () => {
    let message = `*Resumo da Viagem: ${trip.title}*\n`;
    if (trip.destination) message += `Destino: ${trip.destination}\n`;
    message += `Total gasto pelo grupo: ${formatCentsAsBRL(totalExpensesCents)}\n\n`;

    if (suggestedSettlements.length > 0) {
      message += `*Acerto de Contas (Quem paga para quem):*\n`;
      suggestedSettlements.forEach((s) => {
        message += `• ${s.fromMemberName} transfere ${formatCentsAsBRL(s.amountCents)} para ${s.toMemberName}`;
        if (s.toPixKey) message += ` (Pix: ${s.toPixKey})`;
        message += `\n`;
      });
    } else {
      message += `Todas as despesas estão balanceadas!\n`;
    }

    message += `\nVer extrato completo: ${window.location.href}`;

    const encoded = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
  };

  const tabItems = [
    {
      value: "expenses",
      label: `Extrato (${expenses.length})`,
      content: (
        <div className="space-y-2.5 mt-3">
          {expenses.length === 0 ? (
            <Card className="border-border/80 bg-surface p-6 text-center">
              <EmptyState
                icon={<Receipt className="size-8" />}
                title="Nenhum gasto registrado"
                description="Clique em 'Adicionar Despesa' para lançar o primeiro gasto do grupo."
              />
            </Card>
          ) : (
            expenses.map((expense) => {
              const payer = members.find((m) => m.id === expense.paid_by_member_id);
              return (
                <Card
                  key={expense.id}
                  className="border-border/80 bg-surface shadow-xs rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {expense.description}
                      </span>
                      <Badge size="xs" variant="muted">
                        {expense.category_name}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Pago por <span className="font-medium text-foreground">{payer?.name ?? "Membro"}</span> em {expense.expense_date}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold tabular-nums text-foreground">
                      {formatCentsAsBRL(expense.amount_cents)}
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      {expense.splits.length} participante(s)
                    </p>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      ),
    },
    {
      value: "settlements",
      label: `Acerto de Contas (${suggestedSettlements.length})`,
      content: (
        <div className="space-y-2.5 mt-3">
          {suggestedSettlements.length === 0 ? (
            <Card className="border-border/80 bg-surface p-6 text-center">
              <EmptyState
                icon={<ShieldCheck className="size-8" />}
                title="Tudo equilibrado"
                description="Não há transferências pendentes para liquidar esta viagem."
              />
            </Card>
          ) : (
            suggestedSettlements.map((settlement, idx) => (
              <Card
                key={`${settlement.fromMemberId}-${settlement.toMemberId}-${idx}`}
                className="border-border/80 bg-surface shadow-xs rounded-xl p-3.5 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-foreground">
                    <span>{settlement.fromMemberName}</span>
                    <span className="text-muted-foreground font-normal mx-1.5">paga para</span>
                    <span className="text-primary">{settlement.toMemberName}</span>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-foreground">
                    {formatCentsAsBRL(settlement.amountCents)}
                  </span>
                </div>

                {settlement.toPixKey && (
                  <div className="flex items-center justify-between bg-surface-raised p-2 rounded-lg text-xs">
                    <div className="min-w-0 truncate pr-2">
                      <span className="text-[10px] text-muted-foreground block">
                        Chave Pix ({settlement.toPixKeyType ?? "Pix"}):
                      </span>
                      <span className="font-mono text-[11px] text-foreground truncate block">
                        {settlement.toPixKey}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyPix(settlement.toPixKey!)}
                      className="h-7 text-xs gap-1 shrink-0"
                    >
                      {copiedPixKey === settlement.toPixKey ? (
                        <>
                          <Check className="size-3 text-positive" aria-hidden="true" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" aria-hidden="true" />
                          Copiar
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col pb-16">
      <SharedLinkHeaderNav />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Card Hero da Viagem */}
        <Card className="border-border/80 bg-surface shadow-xs rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {trip.title}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                  {trip.destination && (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      {trip.destination}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    {trip.start_date} até {trip.end_date}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <Badge size="sm" variant={trip.status === "completed" ? "positive" : "muted"}>
                  {trip.status === "completed" ? "Finalizada" : "Em andamento"}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleShareWhatsApp}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Share2 className="size-3.5" aria-hidden="true" />
                  Compartilhar
                </Button>
              </div>
            </div>

            <div className="pt-3 border-t border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Total Gasto na Viagem</p>
                <p className="text-xl font-bold tabular-nums text-foreground">
                  {formatCentsAsBRL(totalExpensesCents)}
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => setIsAddExpenseOpen(true)}
                className="h-8 gap-1.5 text-xs self-stretch sm:self-auto"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Adicionar Despesa
              </Button>
            </div>
          </div>
        </Card>

        {/* Seletor "Quem é você?" */}
        <Card className="border-border/80 bg-surface shadow-xs rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Users className="size-4 text-muted-foreground" aria-hidden="true" />
              Quem é você nesta viagem?
            </span>
            {selectedMemberId && (
              <button
                type="button"
                onClick={() => setSelectedMemberId(null)}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Limpar seleção
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => {
              const isSelected = selectedMemberId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMemberId(isSelected ? null : m.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-surface text-muted-foreground border-border/80 hover:bg-surface-hover"
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>

          {/* Resumo do Participante Selecionado */}
          {currentMember && currentBalance && (
            <div className="p-3.5 rounded-xl bg-surface-raised border border-border/80 mt-2 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Você pagou no total:</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatCentsAsBRL(currentBalance.totalPaidCents)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Sua cota nas despesas:</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatCentsAsBRL(currentBalance.totalOwedCents)}
                </span>
              </div>
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Balanço Final:</span>
                {currentBalance.netBalanceCents > 0 ? (
                  <Badge variant="positive" size="sm">
                    Você tem {formatCentsAsBRL(currentBalance.netBalanceCents)} a receber
                  </Badge>
                ) : currentBalance.netBalanceCents < 0 ? (
                  <Badge variant="critical" size="sm">
                    Você deve {formatCentsAsBRL(Math.abs(currentBalance.netBalanceCents))}
                  </Badge>
                ) : (
                  <Badge variant="muted" size="sm">
                    Contas equilibradas
                  </Badge>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Abas com Tabs nativo do app */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          items={tabItems}
          variant="pills"
          fullWidth
        />

        {/* Rodapé Institucional de Conversão */}
        <Card className="border-border/80 bg-surface shadow-xs rounded-2xl p-4 text-center space-y-2 mt-6">
          <p className="text-xs font-semibold text-foreground">
            Gostou da organização desta viagem?
          </p>
          <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
            O Áxis Finance é um aplicativo completo de gestão financeira pessoal e controle de cartões.
          </p>
          <Link to="/cadastro" className="inline-block pt-1">
            <Button size="sm" variant="default" className="gap-1.5 text-xs">
              Criar minha conta gratuita
              <ArrowRight className="size-3" aria-hidden="true" />
            </Button>
          </Link>
        </Card>
      </main>

      {/* Modal de Adicionar Despesa */}
      <AddPublicTripExpenseDialog
        open={isAddExpenseOpen}
        onOpenChange={setIsAddExpenseOpen}
        token={token!}
        members={members}
        defaultPayerId={selectedMemberId ?? undefined}
      />
    </div>
  );
}
