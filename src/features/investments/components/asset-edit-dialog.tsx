import { useState } from "react";
import { numberToCents } from "@/domain/money";
import { Alert, Button, Input, Modal, MoneyInput, Select } from "@/components/ui";
import { isCashAssetClass, isFixedIncomeClass, isTesouroAsset } from "@/domain/portfolio/valuation";
import { assetMetadataSchema } from "@/domain/portfolio/schemas";
import { DEFAULT_SECTORS_BY_CLASS, inferSectorFromTicker } from "@/domain/portfolio/tickers-catalog";
import { todayISO } from "@/domain/debts";
import { getErrorMessage } from "@/services/errors";
import { useUpdatePortfolioAsset } from "@/state";
import type { AssetCurrency, FixedIncomeMetadata, FixedIncomeRateType, PortfolioAsset } from "@/types";
import { FixedIncomeFormFields } from "./fixed-income-form-fields";

export interface AssetEditDialogProps {
  asset: PortfolioAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ASSET_CLASSES = [
  { value: "Ações", label: "Ações" },
  { value: "FIIs", label: "FIIs / Imobiliário" },
  { value: "ETFs", label: "ETFs / Índices" },
  { value: "BDRs", label: "BDRs" },
  { value: "Renda Fixa", label: "Renda Fixa" },
  { value: "Cripto", label: "Criptomoedas" },
  { value: "Caixa", label: "Caixa / Reserva" },
  { value: "Internacional", label: "Internacional (EUA)" },
];

const CURRENCIES: { value: AssetCurrency; label: string }[] = [
  { value: "BRL", label: "BRL (Reais)" },
  { value: "USD", label: "USD (Dólares)" },
];

const parseNumber = (raw: string): number => {
  if (!raw || typeof raw !== "string") return 0;
  const clean = raw.trim().replace(/\./g, "").replace(",", ".");
  const val = Number(clean);
  return Number.isFinite(val) && val >= 0 ? val : 0;
};

interface AssetEditFormContentProps {
  asset: PortfolioAsset;
  onClose: () => void;
}

function AssetEditFormContent({ asset, onClose }: AssetEditFormContentProps) {
  const updateAsset = useUpdatePortfolioAsset();

  const [ticker, setTicker] = useState(asset.ticker);
  const [assetClass, setAssetClass] = useState(asset.asset_class ?? "Ações");
  const [sector, setSector] = useState(asset.sector ?? inferSectorFromTicker(asset.ticker, asset.asset_class));
  const [currency, setCurrency] = useState<AssetCurrency>(asset.currency ?? "BRL");
  const [notes, setNotes] = useState(asset.notes ?? "");
  const [accumulatedDividendsCents, setAccumulatedDividendsCents] = useState(
    numberToCents(asset.accumulated_dividends ?? 0),
  );
  const [estimatedDividendPerShareCents, setEstimatedDividendPerShareCents] = useState(
    numberToCents(asset.estimated_monthly_dividend_per_share ?? 0),
  );

  // Parâmetros de Renda Fixa (Fase 63/72)
  const [fixedIncomeRateType, setFixedIncomeRateType] = useState<FixedIncomeRateType>(
    asset.fixed_income_metadata?.rate_type ?? "cdi",
  );
  const [fixedIncomeRateValue, setFixedIncomeRateValue] = useState<string>(
    asset.fixed_income_metadata?.rate_value !== undefined ? String(asset.fixed_income_metadata.rate_value) : "",
  );
  const [fixedIncomeBaseDate, setFixedIncomeBaseDate] = useState<string>(
    asset.fixed_income_metadata?.base_date ?? todayISO(),
  );
  const [fixedIncomeInitialInvestmentDate, setFixedIncomeInitialInvestmentDate] = useState<string>(
    asset.fixed_income_metadata?.initial_investment_date ?? "",
  );
  const [fixedIncomeMaturityDate, setFixedIncomeMaturityDate] = useState<string>(
    asset.fixed_income_metadata?.maturity_date ?? "",
  );
  const [fixedIncomeIsTaxExempt, setFixedIncomeIsTaxExempt] = useState<boolean>(
    Boolean(asset.fixed_income_metadata?.is_tax_exempt),
  );

  const [error, setError] = useState<string | null>(null);

  const isCash = isCashAssetClass(assetClass);
  const isTesouro = isTesouroAsset(ticker, assetClass);
  const isFixedIncome = isFixedIncomeClass(assetClass) || isTesouro;
  const recommendedSectors = DEFAULT_SECTORS_BY_CLASS[assetClass] ?? [];

  const handleClassChange = (newClass: string) => {
    setAssetClass(newClass);
    const suggested = inferSectorFromTicker(ticker, newClass);
    setSector(suggested);
    const upper = ticker.toUpperCase();
    if (upper.includes("LCI") || upper.includes("LCA") || upper.includes("CRI") || upper.includes("CRA")) {
      setFixedIncomeIsTaxExempt(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let fiMetadata: FixedIncomeMetadata | null = null;
    if (isFixedIncome && !isCash) {
      const rateVal = parseNumber(fixedIncomeRateValue);
      fiMetadata = {
        rate_type: fixedIncomeRateType,
        rate_value: rateVal,
        base_date: fixedIncomeBaseDate || todayISO(),
        initial_investment_date: fixedIncomeInitialInvestmentDate ? fixedIncomeInitialInvestmentDate.slice(0, 10) : null,
        maturity_date: fixedIncomeMaturityDate ? fixedIncomeMaturityDate.slice(0, 10) : null,
        is_tax_exempt: fixedIncomeIsTaxExempt,
      };
    }

    const validation = assetMetadataSchema.safeParse({
      ticker,
      asset_class: assetClass,
      sector: sector.trim() || null,
      currency,
      accumulated_dividends: accumulatedDividendsCents / 100,
      estimated_monthly_dividend_per_share: estimatedDividendPerShareCents / 100,
      fixed_income_metadata: fiMetadata,
      notes: notes.trim() || null,
    });

    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    try {
      await updateAsset.mutateAsync({
        id: asset.id,
        patch: {
          ticker: validation.data.ticker,
          asset_class: validation.data.asset_class,
          sector: validation.data.sector,
          currency: validation.data.currency,
          accumulated_dividends: validation.data.accumulated_dividends,
          estimated_monthly_dividend_per_share: validation.data.estimated_monthly_dividend_per_share,
          fixed_income_metadata: validation.data.fixed_income_metadata,
          notes: validation.data.notes,
        },
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-asset-ticker" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Código do Ativo (Ticker)
        </label>
        <Input
          id="edit-asset-ticker"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase().trim())}
          placeholder="Ex: WEGE3"
          className="font-mono uppercase font-bold"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Classe de Ativo
          </span>
          <Select
            value={assetClass}
            onValueChange={handleClassChange}
            options={ASSET_CLASSES}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Moeda
          </span>
          <Select
            value={currency}
            onValueChange={(val) => setCurrency(val as AssetCurrency)}
            options={CURRENCIES}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-asset-sector" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Setor / Segmento / Indexador
        </label>
        <Input
          id="edit-asset-sector"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          placeholder="Ex: Financeiro / Bancos, Logística, Pós-fixado..."
        />
        {recommendedSectors.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {recommendedSectors.slice(0, 4).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSector(s)}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                  sector === s
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-surface-hover/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bloco de Parâmetros de Renda Fixa e Tesouro Direto (Fase 63/72) */}
      {isFixedIncome && !isCash && (
        <FixedIncomeFormFields
          values={{
            rateType: fixedIncomeRateType,
            rateValue: fixedIncomeRateValue,
            baseDate: fixedIncomeBaseDate,
            initialInvestmentDate: fixedIncomeInitialInvestmentDate || null,
            maturityDate: fixedIncomeMaturityDate || null,
            isTaxExempt: fixedIncomeIsTaxExempt,
          }}
          onChange={(patch) => {
            if (patch.rateType !== undefined) setFixedIncomeRateType(patch.rateType);
            if (patch.rateValue !== undefined) setFixedIncomeRateValue(patch.rateValue);
            if (patch.baseDate !== undefined) setFixedIncomeBaseDate(patch.baseDate);
            if (patch.initialInvestmentDate !== undefined)
              setFixedIncomeInitialInvestmentDate(patch.initialInvestmentDate ?? "");
            if (patch.maturityDate !== undefined) setFixedIncomeMaturityDate(patch.maturityDate ?? "");
            if (patch.isTaxExempt !== undefined) setFixedIncomeIsTaxExempt(patch.isTaxExempt);
          }}
          idPrefix="edit-fi"
          isTesouro={isTesouro}
        />
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-asset-notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Anotações / Descrição
        </label>
        <Input
          id="edit-asset-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: Tese, setor, corretora..."
        />
      </div>

      {/* Proventos Acumulados — oculto para ativos de caixa */}
      {!isCash && (
        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-surface/50 p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-foreground">
              Proventos Anteriores ao Cadastro (Opcional)
            </span>
            <span className="text-[11px] text-muted-foreground">
              Alimentam o Yield on Cost e a Bola de Neve sem distorcer o extrato mensal nem o calendario.
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="edit-accumulated-dividends"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Total Acumulado Recebido ({currency})
              </label>
              <MoneyInput
                id="edit-accumulated-dividends"
                cents={accumulatedDividendsCents}
                onCentsChange={setAccumulatedDividendsCents}
                placeholder="R$ 0,00"
                aria-label="Total de proventos acumulados anteriores ao cadastro"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="edit-estimated-div-per-share"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Dividendo Estimado / Cota / Mes ({currency})
              </label>
              <MoneyInput
                id="edit-estimated-div-per-share"
                cents={estimatedDividendPerShareCents}
                onCentsChange={setEstimatedDividendPerShareCents}
                placeholder="R$ 0,00"
                aria-label="Dividendo mensal estimado por cota para calculo da Bola de Neve"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/80">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={updateAsset.isPending}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={updateAsset.isPending}
        >
          {updateAsset.isPending ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>
    </form>
  );
}

export function AssetEditDialog({
  asset,
  open,
  onOpenChange,
}: AssetEditDialogProps) {
  if (!asset) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Editar Ativo"
      description={`Atualize as informações cadastrais de ${asset.ticker}`}
      size="lg"
      showCalculator
    >
      <AssetEditFormContent
        key={asset.id}
        asset={asset}
        onClose={() => onOpenChange(false)}
      />
    </Modal>

  );
}
