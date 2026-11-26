import { generatePixBrCode } from "@/domain/pix/pix-br-code";

export const DEMO_PIX_KEY = "financeiro.demo@exemplo.com";

export const DEMO_PIX_PAYLOAD = generatePixBrCode({
  pixKey: DEMO_PIX_KEY,
  merchantName: "Fam Financeiro",
  merchantCity: "Sao Paulo",
  amountCents: 12000,
});

export interface SplitDemoParticipant {
  initials: string;
  name: string;
  detail: string;
  badgeText: string;
  badgeVariant: "muted" | "positive" | "warning";
  avatarClass: string;
  detailClass: string;
  amountCents: number;
}

export const SPLIT_PARTICIPANTS: SplitDemoParticipant[] = [
  {
    initials: "VC",
    name: "Você (Anfitrião)",
    detail: "Pagou o total da conta",
    badgeText: "Pago",
    badgeVariant: "muted",
    avatarClass: "bg-primary/15 text-primary-strong dark:text-primary",
    detailClass: "text-muted-foreground",
    amountCents: 12000,
  },
  {
    initials: "MC",
    name: "Mariana Costa",
    detail: "Pix enviado às 14:28",
    badgeText: "Pix Enviado",
    badgeVariant: "positive",
    avatarClass: "bg-positive/15 text-positive-strong",
    detailClass: "text-positive-strong",
    amountCents: 12000,
  },
  {
    initials: "LO",
    name: "Lucas Oliveira",
    detail: "Pix enviado às 15:02",
    badgeText: "Pix Enviado",
    badgeVariant: "positive",
    avatarClass: "bg-positive/15 text-positive-strong",
    detailClass: "text-positive-strong",
    amountCents: 12000,
  },
  {
    initials: "BS",
    name: "Beatriz Souza",
    detail: "Lembrete pendente",
    badgeText: "Aguardando",
    badgeVariant: "warning",
    avatarClass: "bg-warning/20 text-warning-strong",
    detailClass: "text-muted-foreground",
    amountCents: 12000,
  },
];
