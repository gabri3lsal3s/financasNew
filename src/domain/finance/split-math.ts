/**
 * Algoritmo Puro de Rateio de Centavos com Balanceamento de Sobra (split-math.ts).
 *
 * Garante divisao equitativa de despesas em centavos inteiros (BRL),
 * eliminando distorcoes de arredondamento e preservando a invariante inviolavel:
 *   soma(fatias) === totalOriginalCents.
 *
 * Suporta duas politicas de distribuicao do resto euclidiano:
 * 1. "balanced" (padrao): distribui 1 centavo para os primeiros participantes,
 *    garantindo diferenca maxima de 1 centavo entre qualquer participante.
 * 2. "host": atribui toda a sobra de centavos ao anfitriao (indice 0),
 *    garantindo que todos os convidados paguem valores rigorosamente identicos
 *    (ideal para emissao de QR Code / Pix Copia e Cola unico).
 *
 * Motor 100% puro: sem dependencias de UI, React ou Supabase (AGENTS.md secao 3).
 */

import { MAX_MONEY_CENTS } from "@/domain/validation/sanitization";
import { divideIntoInstallments } from "@/domain/cards";
import type { SplitParticipantInstallment } from "@/types";

/**
 * Limite maximo defensivo de participantes em uma mesma despesa compartilhada.
 * Suficiente para grandes eventos ou viagens em grupo sem degradacao de memoria.
 */
export const MAX_SPLIT_PARTICIPANTS = 500;

/**
 * Politica de distribuicao da sobra/resto euclidiano de centavos.
 * - "balanced": distribui centavo a centavo entre os primeiros participantes.
 * - "host": atribui todo o resto ao anfitriao (indice 0); todos os convidados pagam igual.
 */
export type SplitRemainderPolicy = "balanced" | "host";

/**
 * Politica padrao de distribuicao de sobra.
 */
export const DEFAULT_SPLIT_REMAINDER_POLICY: SplitRemainderPolicy = "balanced";

/**
 * Opcoes para o rateio equitativo.
 */
export interface SplitOptions {
  /**
   * Politica para absorcao do resto de centavos.
   * Padrao: "balanced".
   */
  remainderPolicy?: SplitRemainderPolicy;
}

/**
 * Resumo consolidado de um rateio de despesa.
 */
export interface SplitExpenseSummary {
  /** Valor total da despesa em centavos */
  totalCents: number;
  /** Quantidade total de participantes (anfitriao + convidados) */
  peopleCount: number;
  /** Quantidade de convidados a pagar (peopleCount - 1) */
  guestCount: number;
  /** Valor a ser pago pelo anfitriao em centavos (indice 0) */
  hostShareCents: number;
  /** Valor uniforme sugerido para cada convidado (ou primeiro convidado) */
  guestShareCents: number;
  /** Array ordenado com o valor de cada participante em centavos */
  shares: number[];
  /** Resto da divisao euclidiana (totalCents % peopleCount) */
  remainderCents: number;
  /** Politica aplicada para balanceamento do resto */
  remainderPolicy: SplitRemainderPolicy;
  /** Soma das fatias calculadas (sempre identica ao totalOriginalCents) */
  sumCents: number;
}

/**
 * Participante para rateio proporcional customizado.
 */
export interface SplitParticipant {
  /** Identificador opcional do participante */
  id?: string;
  /** Nome ou rotulo do participante */
  name: string;
  /** Indica se o participante e o anfitriao responsavel pelo pagamento original */
  isHost?: boolean;
  /** Peso proporcional relativo (padrao 1 se nao informado valor fixo) */
  weight?: number;
  /** Valor fixo manual em centavos (tem precedencia sobre peso proporcional) */
  fixedCents?: number;
}

/**
 * Resultado individual de rateio por participante.
 */
export interface SplitParticipantResult {
  /** Identificador original (se fornecido) */
  id?: string;
  /** Nome do participante */
  name: string;
  /** Se e o anfitriao */
  isHost: boolean;
  /** Valor atribuido em centavos */
  shareCents: number;
  /** Percentual do total (0 a 100 com 2 casas decimais) */
  percentage: number;
}

/**
 * Soma um conjunto de fatias em centavos (funcao pura utilitaria).
 */
export function sumSplitCents(shares: readonly number[]): number {
  return shares.reduce((acc, curr) => acc + curr, 0);
}

/**
 * Valida os parametros de entrada do rateio equitativo.
 * Lanca erros semanticos claros em pt-BR caso haja inconsistencia.
 */
export function validateSplitInputs(totalCents: number, peopleCount: number): void {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) {
    throw new Error("Total em centavos deve ser um inteiro nao-negativo.");
  }

  if (totalCents > MAX_MONEY_CENTS) {
    throw new Error(`Total em centavos excede o limite maximo permitido (${MAX_MONEY_CENTS}).`);
  }

  if (!Number.isSafeInteger(peopleCount) || peopleCount < 1) {
    throw new Error("Numero de participantes deve ser um inteiro maior ou igual a 1.");
  }

  if (peopleCount > MAX_SPLIT_PARTICIPANTS) {
    throw new Error(`Numero de participantes excede o limite maximo de ${MAX_SPLIT_PARTICIPANTS}.`);
  }
}

/**
 * Algoritmo Puro de Rateio Equitativo de Centavos com Balanceamento de Sobra.
 *
 * Divide o valor total em centavos entre `peopleCount` participantes de forma exata,
 * sem perder ou criar nenhum centavo.
 *
 * @param totalCents - Montante total em centavos (inteiro >= 0).
 * @param peopleCount - Quantidade de participantes (inteiro >= 1, onde indice 0 e o anfitriao).
 * @param options - Configuracoes adicionais (ex.: politica de distribuicao do resto).
 * @returns Array de inteiros com a fatia em centavos de cada participante.
 */
export function splitAmountEqually(
  totalCents: number,
  peopleCount: number,
  options?: SplitOptions,
): number[] {
  validateSplitInputs(totalCents, peopleCount);

  if (totalCents === 0) {
    return new Array<number>(peopleCount).fill(0);
  }

  if (peopleCount === 1) {
    return [totalCents];
  }

  const policy = options?.remainderPolicy ?? DEFAULT_SPLIT_REMAINDER_POLICY;
  const base = Math.floor(totalCents / peopleCount);
  const remainder = totalCents % peopleCount;

  let shares: number[];

  if (policy === "host") {
    // Toda a sobra euclidiana vai para o anfitriao (indice 0).
    // Os convidados pagam rigorosamente o valor base floor, permitindo Pix Copia e Cola uniforme.
    shares = Array.from({ length: peopleCount }, (_, index) =>
      index === 0 ? base + remainder : base,
    );
  } else {
    // Politica balanced (padrao): distribui 1 centavo para os primeiros `remainder` participantes.
    // Garante que a diferenca entre quaisquer duas fatias seja no maximo de 1 centavo.
    shares = Array.from({ length: peopleCount }, (_, index) =>
      base + (index < remainder ? 1 : 0),
    );
  }

  // Invariante matematico inviolavel: soma de todas as partes deve ser identica ao total original.
  const calculatedSum = sumSplitCents(shares);
  if (calculatedSum !== totalCents) {
    throw new Error(
      `Invariante de rateio violada: soma (${calculatedSum}) diverge do total (${totalCents}).`,
    );
  }

  return shares;
}

/**
 * Calcula o resumo financeiro estruturado de um rateio entre anfitriao e convidados.
 */
export function calculateSplitSummary(
  totalCents: number,
  peopleCount: number,
  options?: SplitOptions,
): SplitExpenseSummary {
  const policy = options?.remainderPolicy ?? DEFAULT_SPLIT_REMAINDER_POLICY;
  const shares = splitAmountEqually(totalCents, peopleCount, { remainderPolicy: policy });
  const guestCount = Math.max(0, peopleCount - 1);
  const hostShareCents = shares[0] ?? 0;
  const guestShareCents = guestCount > 0 ? (shares[1] ?? 0) : 0;
  const remainderCents = totalCents % peopleCount;

  return {
    totalCents,
    peopleCount,
    guestCount,
    hostShareCents,
    guestShareCents,
    shares,
    remainderCents,
    remainderPolicy: policy,
    sumCents: totalCents,
  };
}

/**
 * Calcula o valor em centavos que cada convidado deve pagar.
 * Ideal para preenchimento de links de compartilhamento e QR Codes Pix.
 *
 * @param totalCents - Valor total da despesa.
 * @param peopleCount - Total de pessoas (anfitriao + convidados).
 * @param policy - Politica de resto (padrao: "host" para convidados pagarem valor uniforme).
 */
export function calculateGuestAmountCents(
  totalCents: number,
  peopleCount: number,
  policy: SplitRemainderPolicy = "host",
): number {
  if (peopleCount <= 1 || totalCents <= 0) {
    return 0;
  }
  const summary = calculateSplitSummary(totalCents, peopleCount, { remainderPolicy: policy });
  return summary.guestShareCents;
}

/**
 * Rateio com participantes customizados (nomes, pesos ou valores fixos).
 *
 * Regras:
 * 1. Fatias com valor fixo manual sao deduzidas do total primeiro.
 * 2. O saldo remanescente e distribuido proporcionalmente aos pesos dos demais participantes.
 * 3. Qualquer residuo em centavos e atribuido prioritariamente ao anfitriao ou ao participante
 *    com maior peso, preservando a soma exata ao centavo.
 */
export function splitCustomWithRemainder(
  totalCents: number,
  participants: readonly SplitParticipant[],
): SplitParticipantResult[] {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0 || totalCents > MAX_MONEY_CENTS) {
    throw new Error("Total em centavos deve ser um inteiro nao-negativo dentro dos limites.");
  }

  if (!Array.isArray(participants) || participants.length === 0) {
    throw new Error("Lista de participantes deve conter pelo menos 1 participante.");
  }

  if (participants.length > MAX_SPLIT_PARTICIPANTS) {
    throw new Error(`Numero de participantes excede o limite maximo de ${MAX_SPLIT_PARTICIPANTS}.`);
  }

  if (totalCents === 0) {
    return participants.map((p, idx) => ({
      id: p.id,
      name: p.name.trim() || `Participante ${idx + 1}`,
      isHost: Boolean(p.isHost ?? idx === 0),
      shareCents: 0,
      percentage: 0,
    }));
  }

  // 1. Identificar valores fixos
  let fixedSum = 0;
  const variableParticipants: Array<{ index: number; weight: number }> = [];

  participants.forEach((p, index) => {
    if (p.fixedCents !== undefined && p.fixedCents !== null) {
      if (!Number.isSafeInteger(p.fixedCents) || p.fixedCents < 0) {
        throw new Error(`Valor fixo invalido para participante ${p.name}.`);
      }
      fixedSum += p.fixedCents;
    } else {
      const weight = p.weight !== undefined && p.weight !== null ? p.weight : 1;
      if (!Number.isFinite(weight) || weight <= 0) {
        throw new Error(`Peso invalido para participante ${p.name}.`);
      }
      variableParticipants.push({ index, weight });
    }
  });

  if (fixedSum > totalCents) {
    throw new Error("Soma dos valores fixos excede o total da despesa.");
  }

  const remainingCents = totalCents - fixedSum;
  const initialShares = new Array<number>(participants.length).fill(0);

  // Atribuir valores fixos
  participants.forEach((p, index) => {
    if (p.fixedCents !== undefined && p.fixedCents !== null) {
      initialShares[index] = p.fixedCents;
    }
  });

  // Distribuir remanescente proporcionalmente aos pesos
  if (variableParticipants.length > 0 && remainingCents > 0) {
    const totalWeight = variableParticipants.reduce((sum, item) => sum + item.weight, 0);
    let allocatedVariableCents = 0;
    const fractions: Array<{ index: number; remainderFraction: number }> = [];

    variableParticipants.forEach(({ index, weight }) => {
      const rawShare = (remainingCents * weight) / totalWeight;
      const floorShare = Math.floor(rawShare);
      initialShares[index] = floorShare;
      allocatedVariableCents += floorShare;
      fractions.push({
        index,
        remainderFraction: rawShare - floorShare,
      });
    });

    // Distribuir resto pelo metodo do maior resto (Hare-Niemeyer)
    const leftoverCents = remainingCents - allocatedVariableCents;
    fractions.sort((a, b) => b.remainderFraction - a.remainderFraction);

    for (let i = 0; i < leftoverCents; i++) {
      const target = fractions[i % fractions.length];
      if (target) {
        const currentShare = initialShares[target.index] ?? 0;
        initialShares[target.index] = currentShare + 1;
      }
    }
  } else if (variableParticipants.length === 0 && fixedSum < totalCents) {
    // Se todos forem fixos mas houver sobra, atribui ao anfitriao (ou primeiro)
    const hostIdx = Math.max(
      0,
      participants.findIndex((p) => p.isHost),
    );
    const currentHostShare = initialShares[hostIdx] ?? 0;
    initialShares[hostIdx] = currentHostShare + (totalCents - fixedSum);
  }

  // Validacao de invariante
  const finalSum = sumSplitCents(initialShares);
  if (finalSum !== totalCents) {
    throw new Error(
      `Invariante violada no rateio customizado: soma (${finalSum}) diverge do total (${totalCents}).`,
    );
  }

  return participants.map((p, idx) => {
    const shareCents = initialShares[idx] ?? 0;
    const percentage = totalCents > 0 ? Number(((shareCents / totalCents) * 100).toFixed(2)) : 0;
    return {
      id: p.id,
      name: p.name.trim() || `Participante ${idx + 1}`,
      isHost: Boolean(p.isHost ?? idx === 0),
      shareCents,
      percentage,
    };
  });
}

/**
 * Entrada para divisão das parcelas de um participante no racha.
 */
export interface BuildSplitParticipantInstallmentsInput {
  participantId: string;
  totalShareCents: number;
  installmentsCount: number;
  startDate: string;
  closingDay?: number | null;
  isSettledInitial?: boolean;
}

/**
 * Constrói o plano de parcelas de um participante no racha com conservação estrita de centavos.
 * Invariante: soma(amount_cents) === totalShareCents.
 */
export function buildSplitParticipantInstallments(
  input: BuildSplitParticipantInstallmentsInput
): SplitParticipantInstallment[] {
  const { participantId, totalShareCents, installmentsCount, startDate, closingDay, isSettledInitial } = input;
  const count = Math.max(1, Math.min(60, Math.floor(installmentsCount)));

  if (count <= 1 || totalShareCents <= 0) {
    return [
      {
        id: `${participantId}_inst_1`,
        participant_id: participantId,
        installment_number: 1,
        total_installments: 1,
        amount_cents: totalShareCents,
        due_date: startDate,
        is_settled: Boolean(isSettledInitial),
        settled_at: isSettledInitial ? new Date().toISOString() : null,
        signal_status: "none",
        signaled_at: null,
      },
    ];
  }

  const items = divideIntoInstallments({
    totalCents: totalShareCents,
    count,
    startDate,
    closingDay: closingDay ?? null,
  });

  return items.map((item) => ({
    id: `${participantId}_inst_${item.installmentNumber}`,
    participant_id: participantId,
    installment_number: item.installmentNumber,
    total_installments: item.installmentsTotal,
    amount_cents: item.valueCents,
    due_date: item.date,
    is_settled: Boolean(isSettledInitial),
    settled_at: isSettledInitial ? new Date().toISOString() : null,
    signal_status: "none",
    signaled_at: null,
  }));
}

/**
 * Resumo do progresso de quitação das parcelas de um participante.
 */
export interface InstallmentsProgressSummary {
  totalCount: number;
  settledCount: number;
  pendingCount: number;
  totalCents: number;
  settledCents: number;
  remainingCents: number;
  nextPendingInstallment: SplitParticipantInstallment | null;
}

/**
 * Calcula o progresso de pagamento das parcelas de forma pura.
 */
export function calculateInstallmentsProgress(
  installments: readonly SplitParticipantInstallment[]
): InstallmentsProgressSummary {
  const totalCount = installments.length;
  let settledCount = 0;
  let settledCents = 0;
  let totalCents = 0;
  let nextPendingInstallment: SplitParticipantInstallment | null = null;

  for (const inst of installments) {
    totalCents += inst.amount_cents;
    if (inst.is_settled) {
      settledCount++;
      settledCents += inst.amount_cents;
    } else if (!nextPendingInstallment) {
      nextPendingInstallment = inst;
    }
  }

  return {
    totalCount,
    settledCount,
    pendingCount: totalCount - settledCount,
    totalCents,
    settledCents,
    remainingCents: Math.max(0, totalCents - settledCents),
    nextPendingInstallment,
  };
}

/**
 * Avalia se um participante está 100% quitado no racha.
 * Para despesas parceladas, exige que todas as suas parcelas individuais estejam quitadas
 * e que o total recebido cubra integralmente a cota esperada.
 */
export function isParticipantFullySettled(
  participant: { id?: string; share_cents: number; settled_cents?: number | null; is_host?: boolean },
  participantInstallments?: readonly SplitParticipantInstallment[] | null
): boolean {
  if (participant.is_host) return true;
  const settledCents = Number(participant.settled_cents ?? 0);
  if (settledCents < participant.share_cents) return false;

  if (participantInstallments && participantInstallments.length > 0) {
    return participantInstallments.every((i) => i.is_settled);
  }

  return true;
}

/**
 * Avalia se o racha inteiro está 100% liquidado e pode ser marcado como concluído.
 * Retorna true exclusivamente se todos os amigos estiverem integralmente quitados.
 */
export function isSplitFullyCompleted(
  participants: readonly { id?: string; share_cents: number; settled_cents?: number | null; is_host?: boolean }[],
  installments?: readonly SplitParticipantInstallment[] | null
): boolean {
  const friends = participants.filter((p) => !p.is_host);
  if (friends.length === 0) return true;

  const hostId = participants.find((p) => p.is_host)?.id;

  // Invariante estrita: se existirem parcelas no racha, nenhuma parcela de amigo pode estar pendente
  if (installments && installments.length > 0) {
    const friendInstallments = installments.filter(
      (i) => i.participant_id !== hostId && !participants.find((p) => p.id === i.participant_id)?.is_host
    );
    if (friendInstallments.length > 0 && friendInstallments.some((i) => !i.is_settled)) {
      return false;
    }
  }

  for (let idx = 0; idx < friends.length; idx++) {
    const friend = friends[idx]!;
    const friendId = friend.id || `p_${idx + 2}`;
    let friendInsts = installments?.filter(
      (i) => i.participant_id === friend.id || i.participant_id === friendId
    );

    // Fallback defensivo para racha de 1 amigo se os IDs não baterem
    if ((!friendInsts || friendInsts.length === 0) && friends.length === 1 && installments) {
      friendInsts = installments.filter((i) => i.participant_id !== hostId);
    }

    if (!isParticipantFullySettled(friend, friendInsts)) {
      return false;
    }
  }

  return true;
}

/**
 * Calcula o peso contábil (report_weight) proporcional de uma parcela individual da despesa.
 * Exemplo: parcela de R$ 50,00 da fatura com reembolso recebido de R$ 25,00 -> peso 0.5 (50%).
 */
export function calculateInstallmentReportWeight(
  installmentBaseCents: number,
  settledReimbursementCents: number
): number {
  if (installmentBaseCents <= 0) return 1;
  const netCents = Math.max(0, installmentBaseCents - Math.max(0, settledReimbursementCents));
  const ratio = netCents / installmentBaseCents;
  return Math.min(1, Math.max(0, Number(ratio.toFixed(4))));
}

