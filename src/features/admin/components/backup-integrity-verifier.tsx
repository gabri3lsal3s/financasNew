import { useState } from "react";
import { FileCheck2, RefreshCw } from "lucide-react";
import { Alert, Button, Input } from "@/components/ui";
import type { SystemBackup } from "@/types";

export interface BackupIntegrityVerifierProps {
  latestBackup: SystemBackup | null;
}

/**
 * Verificador de integridade criptográfica SHA-256 comparado ao último snapshot registrado.
 */
export function BackupIntegrityVerifier({ latestBackup }: BackupIntegrityVerifierProps) {
  const [integrityInput, setIntegrityInput] = useState("");
  const [integrityResult, setIntegrityResult] = useState<"match" | "mismatch" | null>(null);

  const handleCheckIntegrity = () => {
    if (!integrityInput.trim() || !latestBackup) return;
    if (integrityInput.trim().toLowerCase() === latestBackup.checksum_sha256.toLowerCase()) {
      setIntegrityResult("match");
    } else {
      setIntegrityResult("mismatch");
    }
  };

  return (
    <section
      aria-label="Verificador de Integridade"
      className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs flex flex-col gap-4"
    >
      <div className="flex items-center gap-2">
        <FileCheck2 className="size-4 text-primary-strong" aria-hidden="true" />
        <h2 className="text-sm font-bold text-foreground">Verificador de Integridade SHA-256</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Cole o hash de um arquivo de backup para validar matematicamente se ele corresponde ao último snapshot registrado, garantindo que o arquivo não sofreu corrupção ou adulteração.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-2">
        <Input
          value={integrityInput}
          onChange={(e) => {
            setIntegrityInput(e.target.value);
            setIntegrityResult(null);
          }}
          placeholder="Cole o hash SHA-256 de 64 caracteres aqui…"
          aria-label="Hash SHA-256 para verificação"
          className="font-mono text-base sm:text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          sensoryIntent="action"
          onClick={handleCheckIntegrity}
          disabled={!integrityInput.trim() || !latestBackup}
          className="w-full sm:w-auto shrink-0 gap-1.5 text-xs h-10"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          <span>Verificar Hash</span>
        </Button>
      </div>

      {integrityResult === "match" && (
        <Alert variant="success">
          <span className="text-xs">
            <strong>Integridade Confirmada:</strong> O hash confere exatamente com o snapshot oficial registrado no banco de dados.
          </span>
        </Alert>
      )}

      {integrityResult === "mismatch" && (
        <Alert variant="error">
          <span className="text-xs">
            <strong>Atenção:</strong> O hash informado diverge do snapshot ativo. O arquivo pode ter sido modificado ou pertencer a outra data.
          </span>
        </Alert>
      )}
    </section>
  );
}
