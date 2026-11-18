import { Badge, Input, Select } from "@/components/ui";
import type { SplitRemainderPolicy } from "@/domain/finance/split-math";
import type { PixKeyType } from "@/domain/pix/pix-br-code";
import { PIX_KEY_OPTIONS, REMAINDER_OPTIONS } from "./split-constants";

export interface SplitPixConfigFieldsProps {
  pixKey: string;
  onPixKeyChange: (val: string) => void;
  selectedKeyType: string;
  onSelectedKeyTypeChange: (val: string) => void;
  detectedType: PixKeyType;
  merchantName: string;
  onMerchantNameChange: (val: string) => void;
  merchantCity: string;
  onMerchantCityChange: (val: string) => void;
  remainderPolicy: SplitRemainderPolicy;
  onRemainderPolicyChange: (val: SplitRemainderPolicy) => void;
}

/** Configuração de chave Pix do anfitrião e política de distribuição de centavos. */
export function SplitPixConfigFields({
  pixKey,
  onPixKeyChange,
  selectedKeyType,
  onSelectedKeyTypeChange,
  detectedType,
  merchantName,
  onMerchantNameChange,
  merchantCity,
  onMerchantCityChange,
  remainderPolicy,
  onRemainderPolicyChange,
}: SplitPixConfigFieldsProps) {
  return (
    <div data-tour="split-pix-config" className="rounded-xl border border-border/80 bg-surface p-3.5 space-y-3 shadow-xs">
      <span className="text-xs font-semibold text-foreground block">Dados Pix para Recebimento</span>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-foreground">Chave Pix do Anfitrião</label>
            <Badge size="xs" variant="muted">
              {detectedType.toUpperCase()}
            </Badge>
          </div>
          <Input
            value={pixKey}
            onChange={(e) => onPixKeyChange(e.target.value)}
            placeholder="CPF, celular, e-mail ou chave aleatória"
            aria-label="Chave Pix do anfitrião"
          />
          <span className="text-[11px] text-muted-foreground block">
            Receberá os pagamentos via QR Code e Copia e Cola
          </span>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">Tipo de Chave</label>
          <Select
            value={selectedKeyType}
            onValueChange={onSelectedKeyTypeChange}
            options={PIX_KEY_OPTIONS}
            ariaLabel="Tipo de chave Pix"
          />
          <span className="text-[11px] text-muted-foreground block">Ajuste caso o celular não tenha DDD/+55</span>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">Nome do Titular</label>
          <Input
            value={merchantName}
            onChange={(e) => onMerchantNameChange(e.target.value)}
            placeholder="Nome completo ou comercial"
            maxLength={25}
            aria-label="Nome do titular da chave Pix"
          />
          <span className="text-[11px] text-muted-foreground block">Nome cadastrado no banco (máximo 25 caracteres)</span>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">Cidade do Titular</label>
          <Input
            value={merchantCity}
            onChange={(e) => onMerchantCityChange(e.target.value.toUpperCase())}
            placeholder="Sua cidade (ex.: Nossa Senhora da Glória)"
            maxLength={60}
            aria-label="Cidade do titular da chave Pix"
          />
          <span className="text-[11px] text-muted-foreground block">Salva automaticamente para os próximos rachas</span>
        </div>
      </div>

      <div className="space-y-1 pt-1">
        <label className="text-xs font-semibold text-foreground">Política de Centavos</label>
        <Select
          value={remainderPolicy}
          onValueChange={(val) => onRemainderPolicyChange(val as SplitRemainderPolicy)}
          options={REMAINDER_OPTIONS}
          ariaLabel="Política de distribuição de centavos"
        />
        <span className="text-[11px] text-muted-foreground block">
          Define quem absorve frações não divisíveis de 1 centavo
        </span>
      </div>
    </div>
  );
}
