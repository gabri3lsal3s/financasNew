import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { PROMINENT_DISCLOSURE_INFO } from "@/lib/institutional";

export interface ProminentDisclosureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ProminentDisclosureModal({
  open,
  onOpenChange,
  onConfirm,
}: ProminentDisclosureModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={PROMINENT_DISCLOSURE_INFO.title}
      description={PROMINENT_DISCLOSURE_INFO.subtitle}
      size="md"
      footer={
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 w-full [&_button]:w-full [&_button]:sm:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Agora Não
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={onConfirm}
          >
            Entendi e Habilitar no Android
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-1">
        {/* Destaque On-Device */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-1.5">
          <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
            <ShieldCheck className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>{PROMINENT_DISCLOSURE_INFO.onDeviceBadge}</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {PROMINENT_DISCLOSURE_INFO.onDeviceDescription}
          </p>
        </div>

        {/* Cláusulas do Contrato 4 */}
        <div className="space-y-3 text-xs">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <strong className="font-semibold text-foreground">
                {PROMINENT_DISCLOSURE_INFO.strictPurposeTitle}
              </strong>
              <span className="text-[11px] text-muted-foreground leading-relaxed">
                {PROMINENT_DISCLOSURE_INFO.strictPurposeDescription}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <strong className="font-semibold text-foreground">
                {PROMINENT_DISCLOSURE_INFO.dataDiscardTitle}
              </strong>
              <span className="text-[11px] text-muted-foreground leading-relaxed">
                {PROMINENT_DISCLOSURE_INFO.dataDiscardDescription}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <strong className="font-semibold text-foreground">
                {PROMINENT_DISCLOSURE_INFO.revocabilityTitle}
              </strong>
              <span className="text-[11px] text-muted-foreground leading-relaxed">
                {PROMINENT_DISCLOSURE_INFO.revocabilityDescription}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
