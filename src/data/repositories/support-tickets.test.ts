import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createSupportTicket,
  listAdminSupportTickets,
  updateAdminSupportTicket,
} from "./support-tickets";
import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";

vi.mock("@/data/client");
vi.mock("@/data/session");

describe("createSupportTicket — Repositório de Chamados de Suporte", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(currentUserId).mockResolvedValue("usr-test-123");
  });

  it("insere chamado no banco e dispara invocação da edge function de notificação", async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: "ticket-123",
        user_id: "usr-test-123",
        type: "bug",
        subject: "Problema no cálculo",
        message: "O dividendo não apareceu no saldo.",
        user_name: "Gabriel",
        user_email: "gabriel@email.com",
        created_at: "2026-10-23T23:00:00Z",
      },
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
    const mockInvoke = vi.fn().mockResolvedValue({ data: { success: true }, error: null });

    vi.mocked(getSupabase).mockReturnValue({
      from: mockFrom,
      functions: { invoke: mockInvoke },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await createSupportTicket({
      type: "bug",
      subject: "Problema no cálculo",
      message: "O dividendo não apareceu no saldo.",
      user_name: "Gabriel",
      user_email: "gabriel@email.com",
      app_version: "1.0.0",
      current_route: "/investments",
      device_info: { platform: "Web" },
    });

    expect(result.id).toBe("ticket-123");
    expect(mockFrom).toHaveBeenCalledWith("support_tickets");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "usr-test-123",
        type: "bug",
        subject: "Problema no cálculo",
        message: "O dividendo não apareceu no saldo.",
        user_name: "Gabriel",
        user_email: "gabriel@email.com",
        current_route: "/investments",
      }),
    );

    expect(mockInvoke).toHaveBeenCalledWith("support-notify", {
      body: { ticketId: "ticket-123" },
    });
  });

  it("lista chamados com filtros de status e tipo para o painel administrativo", async () => {
    const mockOrder = vi.fn();
    const mockEqType = vi.fn().mockResolvedValue({
      data: [{ id: "t-1", type: "bug", status: "open" }],
      error: null,
    });
    const mockEqStatus = vi.fn().mockReturnValue({ eq: mockEqType });
    mockOrder.mockReturnValue({ eq: mockEqStatus });

    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(getSupabase).mockReturnValue({
      from: mockFrom,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const tickets = await listAdminSupportTickets({ status: "open", type: "bug" });

    expect(tickets).toHaveLength(1);
    expect(mockFrom).toHaveBeenCalledWith("support_tickets");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(mockEqStatus).toHaveBeenCalledWith("status", "open");
    expect(mockEqType).toHaveBeenCalledWith("type", "bug");
  });

  it("atualiza status e notas internas de atendimento do chamado", async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: "t-1",
        status: "in_progress",
        admin_notes: "Em análise pela equipe técnica",
      },
      error: null,
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

    vi.mocked(getSupabase).mockReturnValue({
      from: mockFrom,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const updated = await updateAdminSupportTicket("t-1", {
      status: "in_progress",
      admin_notes: "Em análise pela equipe técnica",
    });

    expect(updated.status).toBe("in_progress");
    expect(mockFrom).toHaveBeenCalledWith("support_tickets");
    expect(mockUpdate).toHaveBeenCalledWith({
      status: "in_progress",
      admin_notes: "Em análise pela equipe técnica",
    });
    expect(mockEq).toHaveBeenCalledWith("id", "t-1");
  });

  it("lança AppError quando o banco de dados retorna erro", async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Database connection failed", code: "PGRST000" },
    });

    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

    vi.mocked(getSupabase).mockReturnValue({
      from: mockFrom,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await expect(
      createSupportTicket({
        type: "doubt",
        message: "Como funciona?",
      }),
    ).rejects.toThrow();
  });
});
