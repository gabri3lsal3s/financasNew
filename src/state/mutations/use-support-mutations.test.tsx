import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCreateSupportTicketMutation } from "./use-support-mutations";
import * as supportRepo from "@/data/repositories/support-tickets";
import * as toastService from "@/services/toast";
import * as sensoryService from "@/services/sensory";
import type { SupportTicket } from "@/types";

vi.mock("@/data/repositories/support-tickets");
vi.mock("@/services/toast");
vi.mock("@/services/sensory");

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useCreateSupportTicketMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aciona feedback de sucesso e toast de confirmação ao criar chamado", async () => {
    const mockTicket: SupportTicket = {
      id: "ticket-456",
      user_id: "usr-123",
      type: "doubt",
      status: "open",
      subject: "Dúvida Pix",
      message: "Como cadastrar chave Pix?",
      user_name: "Cliente",
      user_email: "cliente@teste.com",
      app_version: "1.0.0",
      current_route: "/cards",
      device_info: {},
      admin_notes: null,
      created_at: "2026-10-23T23:00:00Z",
      updated_at: "2026-10-23T23:00:00Z",
    };

    vi.mocked(supportRepo.createSupportTicket).mockResolvedValue(mockTicket);

    const { result } = renderHook(() => useCreateSupportTicketMutation(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      type: "doubt",
      message: "Como cadastrar chave Pix?",
    });

    await waitFor(() => {
      expect(sensoryService.triggerSensory).toHaveBeenCalledWith("success");
      expect(toastService.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Mensagem enviada!",
          description: "Retornaremos o contato em breve.",
          variant: "default",
        }),
      );
    });
  });

  it("aciona feedback de erro e toast destrutivo em caso de falha", async () => {
    vi.mocked(supportRepo.createSupportTicket).mockRejectedValue(new Error("Falha no servidor"));

    const { result } = renderHook(() => useCreateSupportTicketMutation(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        type: "bug",
        message: "Erro na página",
      }),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(sensoryService.triggerSensory).toHaveBeenCalledWith("error");
      expect(toastService.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Não foi possível enviar a mensagem",
          variant: "destructive",
        }),
      );
    });
  });
});
