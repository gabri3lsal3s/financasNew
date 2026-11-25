import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StatementLayoutBlueprintRow } from "@/types";
import { StatementBlueprintsCard } from "./statement-blueprints-card";

const mockRefetch = vi.fn();
const mockApproveMutate = vi.fn();
const mockSuspendMutate = vi.fn();

let mockBlueprintsState: {
  data: StatementLayoutBlueprintRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
} = {
  data: [],
  isLoading: false,
  isError: false,
  error: null,
};

vi.mock("@/state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/state")>();
  return {
    ...actual,
    useAdminStatementBlueprints: () => ({
      ...mockBlueprintsState,
      refetch: mockRefetch,
    }),
    useAdminApproveStatementBlueprint: () => ({
      mutateAsync: mockApproveMutate,
      isPending: false,
    }),
    useAdminSuspendStatementBlueprint: () => ({
      mutateAsync: mockSuspendMutate,
      isPending: false,
    }),
  };
});

function makeRow(
  overrides: Partial<StatementLayoutBlueprintRow> = {},
): StatementLayoutBlueprintRow {
  return {
    id: "bp-1",
    fingerprint: "pdf_text:itau:abc123",
    issuer_key: "itau",
    issuer_name: "Itaú Mastercard",
    file_kind: "pdf_text",
    scope: "global",
    owner_user_id: null,
    status: "pending_review",
    rules_json: {
      dateFormatHint: "dmy",
      polarity: "positive_purchase",
      totalLabels: [],
      ignoredTotalLabels: [],
    },
    exact_checksum_hits: 3,
    distinct_users_verified: 1,
    distinct_users_failed: 0,
    consecutive_failures: 0,
    promoted_at: null,
    created_at: "2026-11-20T10:00:00Z",
    updated_at: "2026-11-25T10:00:00Z",
    ...overrides,
  };
}

describe("StatementBlueprintsCard (Admin D16)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApproveMutate.mockResolvedValue(makeRow({ status: "active" }));
    mockSuspendMutate.mockResolvedValue(makeRow({ status: "suspended" }));
    mockBlueprintsState = {
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    };
  });

  it("exibe estado vazio calmo quando não há layouts aprendidos na fila", () => {
    render(<StatementBlueprintsCard />);
    expect(screen.getByText("Layouts de Fatura")).toBeInTheDocument();
    expect(screen.getByText("Nenhum layout na fila")).toBeInTheDocument();
  });

  it("permite aprovar layout pending_review em 1 clique e suspender layout ativo global após ConfirmDialog", async () => {
    const user = userEvent.setup();
    mockBlueprintsState = {
      data: [
        makeRow({ id: "bp-active", issuer_name: "Nubank Mastercard", status: "active" }),
        makeRow({ id: "bp-pending", issuer_name: "Banco Inter Visa", status: "pending_review" }),
      ],
      isLoading: false,
      isError: false,
      error: null,
    };

    render(<StatementBlueprintsCard />);

    expect(screen.getByText("1 pendente")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Aprovar global/i }));
    await waitFor(() => {
      expect(mockApproveMutate).toHaveBeenCalledWith({ blueprintId: "bp-pending" });
    });

    await user.click(screen.getByRole("button", { name: /^Suspender$/i }));
    expect(await screen.findByText(/Suspender layout global/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Suspender layout/i }));
    await waitFor(() => {
      expect(mockSuspendMutate).toHaveBeenCalledWith("bp-active");
    });
  });
});
