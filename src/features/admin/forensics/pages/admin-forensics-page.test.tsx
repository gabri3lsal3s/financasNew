import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { RequireAdminSession } from "@/components/routing/require-admin-session";
import { AdminForensicsPage } from "./admin-forensics-page";

const mockUseAuth = vi.fn();
const mockUseUserAccess = vi.fn();
const mockUseAdminUsers = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/state", () => ({
  useUserAccess: () => mockUseUserAccess(),
  useAdminUsers: () => mockUseAdminUsers(),
}));

describe("AdminForensicsPage & Route Guard (Fase 1)", () => {
  it("bloqueia imediatamente usuários comuns ou desautenticados redirecionando para /admin/login", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-common" } },
      loading: false,
    });
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      isAdmin: false,
    });

    render(
      <MemoryRouter initialEntries={["/admin/laboratorio-forense"]}>
        <Routes>
          <Route element={<RequireAdminSession />}>
            <Route path="/admin/laboratorio-forense" element={<AdminForensicsPage />} />
          </Route>
          <Route path="/admin/login" element={<div>Portal de Login Administrativo</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Portal de Login Administrativo")).toBeInTheDocument();
    expect(screen.queryByText("Laboratório Forense de Auditoria")).not.toBeInTheDocument();
  });

  it("renderiza o painel com sucesso para operadores com perfil admin", async () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "admin-user" } },
      loading: false,
    });
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      isAdmin: true,
    });
    mockUseAdminUsers.mockReturnValue({
      data: [{ id: "usr-12345678", name: "Gabriel Sales", email: "gabriel@axir.app", role: "admin", status: "active" }],
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={["/admin/laboratorio-forense"]}>
        <Routes>
          <Route element={<RequireAdminSession />}>
            <Route path="/admin/laboratorio-forense" element={<AdminForensicsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Laboratório Forense de Auditoria")).toBeInTheDocument();
    expect(screen.getByText("Laboratório Forense Pronto para Disparo")).toBeInTheDocument();

    const user = userEvent.setup();
    const triggerBtn = screen.getByRole("button", { name: /Disparar Auditoria Agora/i });
    await user.click(triggerBtn);

    await waitFor(() => {
      expect(screen.getByText("Confiabilidade Geral")).toBeInTheDocument();
      expect(screen.getByText("Cobertura por Módulo de Negócio")).toBeInTheDocument();
      expect(screen.getByText("Baixar Dossiê (.md)")).toBeInTheDocument();
      expect(screen.getByText("Baixar Contra-Prova (.xls)")).toBeInTheDocument();
    });

    // Alterna para a aba de Invariantes
    const invariantsTab = screen.getByRole("tab", { name: /Invariantes Forenses/i });
    await user.click(invariantsTab);
    expect(await screen.findByText("Catálogo de Invariantes & Asserções")).toBeInTheDocument();

    // Alterna para a aba de Ciclo de Vida & Transições
    const journeysTab = screen.getByRole("tab", { name: /Ciclo de Vida & Transições/i });
    await user.click(journeysTab);
    expect(await screen.findByText("Zero Escrita no Supabase")).toBeInTheDocument();
    expect(screen.getByText("JRN-AUTH-01")).toBeInTheDocument();

    // Alterna para a aba de Personas
    const personasTab = screen.getByRole("tab", { name: /Personas Teóricas/i });
    await user.click(personasTab);
    expect(await screen.findByText("Fábrica de Personas Teóricas (Golden Seeds)")).toBeInTheDocument();

    // Alterna para a aba de Snapshot Real
    const snapshotTab = screen.getByRole("tab", { name: /Snapshot Real/i });
    await user.click(snapshotTab);
    expect(await screen.findByText("Auditoria de Snapshot Real (Modo Somente Leitura)")).toBeInTheDocument();
    expect(await screen.findByText("Anonimização de PII (LGPD)")).toBeInTheDocument();
  });
});
