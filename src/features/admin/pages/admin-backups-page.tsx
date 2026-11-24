import { useState } from "react";
import { Copy, HardDriveDownload, LifeBuoy, ShieldCheck } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { formatDateTimeBR } from "@/lib/date";
import { fetchUserDataExport, useAdminLogBackup, useAdminSystemBackups } from "@/state";
import { downloadBlob } from "@/services/export-actions";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { BackupIntegrityVerifier } from "../components/backup-integrity-verifier";
import { BackupHistoryList } from "../components/backup-history-list";

async function computeSha256(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function AdminBackupsPage() {
  const backupsQuery = useAdminSystemBackups();
  const logBackupMutation = useAdminLogBackup();
  const [generating, setGenerating] = useState(false);

  const backups = backupsQuery.data ?? [];
  const latestBackup = backups[0] ?? null;

  const handleGenerateSnapshot = async () => {
    setGenerating(true);
    try {
      const scopedData = await fetchUserDataExport();
      const payloadString = JSON.stringify(scopedData, null, 2);
      const fileSizeBytes = new Blob([payloadString]).size;
      const checksumSha256 = await computeSha256(payloadString);

      const tableCount = Object.keys(scopedData).length;
      let recordCount = 0;
      for (const val of Object.values(scopedData)) {
        if (Array.isArray(val)) recordCount += val.length;
      }

      await logBackupMutation.mutateAsync({
        backupType: "manual",
        tableCount,
        recordCount,
        fileSizeBytes,
        checksumSha256,
        status: "completed",
        notes: "Exportação auditada (escopo RLS da conta operadora) registrada pelo console.",
      });

      const blob = new Blob([payloadString], { type: "application/json" });
      const exported = await downloadBlob(
        `axir_operator_snapshot_${new Date().toISOString().slice(0, 10)}_${checksumSha256.slice(0, 8)}.json`,
        blob,
        { silentToast: true },
      );
      if (!exported) {
        throw new Error("Falha ao exportar snapshot no dispositivo.");
      }

      triggerSensory("success");
      pushToast({
        title: "Snapshot Exportado com Sucesso",
        description: `Arquivo salvo com hash SHA-256: ${checksumSha256.slice(0, 16)}…`,
        variant: "success",
      });
    } catch {
      triggerSensory("destructive");
      pushToast({
        title: "Erro ao gerar snapshot",
        description: "Falha na exportação segura dos registros da sessão.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      triggerSensory("selection");
      pushToast({
        title: "Hash copiado",
        description: "Checksum SHA-256 copiado para a área de transferência.",
        variant: "default",
      });
    } catch {
      triggerSensory("destructive");
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full min-w-0">
      <PageHeader
        title="Backups & Continuidade"
        description="Snapshots, verificação SHA-256 e recuperação"
        actions={
          <Button
            type="button"
            variant="default"
            size="sm"
            sensoryIntent={false}
            loading={generating}
            onClick={handleGenerateSnapshot}
            disabled={generating}
            className="gap-2"
          >
            <HardDriveDownload className="size-4" aria-hidden="true" />
            <span>{generating ? "Exportando snapshot…" : "Exportar Snapshot Auditado"}</span>
          </Button>
        }
      />

      <Alert variant="info">
        <span className="text-xs leading-relaxed">
          <strong>Escopo de Isolamento RLS (LGPD):</strong> A exportação via navegador coleta exclusivamente os registros financeiros acessíveis à conta operadora autenticada e registra a assinatura SHA-256 na trilha de auditoria. Backups integrais multi-tenant (PITR) são gerenciados diretamente na infraestrutura Supabase.
        </span>
      </Alert>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Último Registro</span>
          <span className="font-semibold text-foreground text-sm">
            {latestBackup ? formatDateTimeBR(latestBackup.created_at) : "Nenhum registro"}
          </span>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Registros Exportados</span>
          <span className="font-semibold text-foreground text-sm font-mono tabular-nums">
            {latestBackup ? latestBackup.record_count.toLocaleString("pt-BR") : "0"}
          </span>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Tamanho em Disco</span>
          <span className="font-semibold text-foreground text-sm font-mono tabular-nums">
            {latestBackup ? `${(latestBackup.file_size_bytes / 1024).toFixed(1)} KB` : "0 KB"}
          </span>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Status da Salvaguarda</span>
          <div className="flex items-center gap-1.5">
            <span className="flex size-2 rounded-full bg-positive-strong" />
            <span className="font-semibold text-positive-strong text-xs">Protegido (AES-256)</span>
          </div>
        </div>
      </div>

      {latestBackup && (
        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <ShieldCheck className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
              <span>Assinatura de Integridade (SHA-256):</span>
            </div>
            <span className="font-mono text-xs text-muted-foreground break-all mt-1">
              {latestBackup.checksum_sha256}
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            sensoryIntent={false}
            onClick={() => void handleCopyHash(latestBackup.checksum_sha256)}
            className="gap-1.5 text-xs shrink-0 self-start sm:self-center"
          >
            <Copy className="size-3.5" aria-hidden="true" />
            <span>Copiar Hash</span>
          </Button>
        </div>
      )}

      <BackupIntegrityVerifier latestBackup={latestBackup} />

      <BackupHistoryList backups={backups} isLoading={backupsQuery.isLoading} />

      <section
        aria-label="Manual DRP"
        className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs flex flex-col gap-3"
      >
        <div className="flex items-center gap-2">
          <LifeBuoy className="size-4 text-primary-strong" aria-hidden="true" />
          <h2 className="text-sm font-bold text-foreground">
            Manual Operacional de DRP (Recuperação de Desastres)
          </h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Em caso de falha catastrófica na nuvem ou necessidade de restauração emergencial:
        </p>

        <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1.5 pl-1 leading-relaxed">
          <li>Localize o snapshot PITR ou arquivo validado com a assinatura SHA-256;</li>
          <li>Acesse o <strong>Supabase Dashboard &gt; Database &gt; Backups</strong> com credenciais de proprietário;</li>
          <li>Execute a verificação de integridade referencial com o script <code>restore_backup</code>;</li>
          <li>Em caso de restauração integral multi-tenant, acione o Point-in-Time Recovery (PITR) nativo do projeto;</li>
          <li>Após a conclusão, execute <code>npm run preflight</code> no terminal para homologar as checagens de prontidão.</li>
        </ol>
      </section>
    </div>
  );
}
