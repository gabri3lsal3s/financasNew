import { describe, expect, it, vi, beforeEach } from "vitest";
import { createPayment, createRefundPayment, listCardPayments } from "./card-payments";

interface Builder {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  then: (onFulfilled: (value: unknown) => unknown) => Promise<unknown>;
}

function makeBuilder(result: unknown): Builder {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled),
  } as Builder;
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  return builder;
}

let builder: Builder;

vi.mock("@/data/client", () => ({
  getSupabase: () => ({ from: () => builder }),
}));

const createCardPaymentMock = vi.fn();
const createRefundMock = vi.fn();
vi.mock("@/data/rpc", () => ({
  createCardPayment: (...args: unknown[]) => createCardPaymentMock(...args),
  createRefund: (...args: unknown[]) => createRefundMock(...args),
}));

describe("card-payments repository (entrega 5)", () => {
  beforeEach(() => {
    builder = makeBuilder({
      data: [
        {
          id: "p1",
          user_id: "u1",
          card_id: "c1",
          competence_month: "2026-08",
          amount: "150.00", // numeric chega como string
          date: "2026-08-10",
          note: null,
          is_refund: false,
        },
      ],
      error: null,
    });
  });

  it("converte amount (numeric string) para number e filtra pelo cartão", async () => {
    const payments = await listCardPayments("c1");
    expect(payments[0]?.amount).toBe(150);
    expect(builder.eq).toHaveBeenCalledWith("card_id", "c1");
  });

  it("pagamento delega ao RPC create_card_payment", async () => {
    createCardPaymentMock.mockResolvedValue("p2");
    const id = await createPayment({ cardId: "c1", competenceMonth: "2026-08", amount: 50, date: "2026-08-11", note: "Parcial" });
    expect(id).toBe("p2");
    expect(createCardPaymentMock).toHaveBeenCalledWith({
      cardId: "c1",
      competenceMonth: "2026-08",
      amount: 50,
      date: "2026-08-11",
      note: "Parcial",
    });
  });

  it("estorno delega ao RPC create_refund (renda automática)", async () => {
    createRefundMock.mockResolvedValue("r1");
    await createRefundPayment({ cardId: "c1", competenceMonth: "2026-08", amount: 20, date: "2026-08-12", note: null });
    expect(createRefundMock).toHaveBeenCalledWith({
      cardId: "c1",
      competenceMonth: "2026-08",
      amount: 20,
      date: "2026-08-12",
      note: null,
    });
  });
});
