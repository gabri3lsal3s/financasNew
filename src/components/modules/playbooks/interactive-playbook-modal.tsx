import { useState } from "react";
import { EyeOff, X } from "lucide-react";
import {
  Button,
  Modal,
  ModalFooter,
  Tabs,
  type TabItem,
} from "@/components/ui";
import { useVisualCustomization } from "@/hooks/use-visual-customization";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { PLAYBOOK_REGISTRY } from "@/domain/playbooks/registry";

export interface InteractivePlaybookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleKey: string;
  title: string;
  description: string;
  tabs: TabItem[];
  defaultTab?: string;
}

/**
 * Shell Canônica Reutilizável para Playbooks Educativos e Metodológicos do Axir.
 *
 * Em conformidade estrita com as Regras de Ouro de UI (AGENTS.md):
 * - Regra 4: Componente DRY universal reutilizado por todos os playbooks.
 * - Regra 8: Zero emojis. Ícones Lucide-react padronizados.
 * - Regra 9: Abas fluidas com scroll desobstruído (`variant="underline" fullWidth={false}`).
 * - Regra 15 & 18: Rodapé canônico sem margens redundantes (`borderless={true}`).
 * - Regra 17: Governança sensorial centralizada via `triggerSensory`.
 * - Regra 20: Zero autoFocus intrusivo no mobile.
 */
export function InteractivePlaybookModal({
  open,
  onOpenChange,
  moduleKey,
  title,
  description,
  tabs,
  defaultTab,
}: InteractivePlaybookModalProps) {
  const initialTab = defaultTab ?? (tabs[0]?.value || "");
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [isDismissing, setIsDismissing] = useState<boolean>(false);

  const {
    dismissPlaybook,
    setShowEducationalPlaybooks,
  } = useVisualCustomization();

  const playbookMeta = PLAYBOOK_REGISTRY[moduleKey];
  const shortLabel = playbookMeta?.shortLabel || "este";

  const handleDismissOnlyThis = () => {
    triggerSensory("selection");
    dismissPlaybook(moduleKey);
    pushToast({
      title: "Guia individual ocultado",
      description: `O ${playbookMeta?.title || "guia"} não aparecerá mais nesta página. Você pode reativá-lo a qualquer momento em Configurações > Interface.`,
    });
    setIsDismissing(false);
    onOpenChange(false);
  };

  const handleDismissAll = () => {
    triggerSensory("selection");
    setShowEducationalPlaybooks(false);
    pushToast({
      title: "Todos os guias desativados",
      description: "Os atalhos de guias educativos foram desativados em todo o aplicativo. Você pode reativá-los a qualquer momento em Configurações > Interface.",
    });
    setIsDismissing(false);
    onOpenChange(false);
  };

  const handleClose = () => {
    setIsDismissing(false);
    onOpenChange(false);
  };

  const renderFooter = () => {
    if (isDismissing) {
      return (
        <ModalFooter borderless>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 w-full">
            <span className="text-xs text-muted-foreground font-medium">
              Deseja ocultar:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleDismissOnlyThis}
                className="text-xs"
              >
                <span>Só o guia de {shortLabel}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleDismissAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <span>Todos os guias do app</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setIsDismissing(false)}
                className="text-xs"
              >
                <X className="size-3" aria-hidden="true" />
                <span>Cancelar</span>
              </Button>
            </div>
          </div>
        </ModalFooter>
      );
    }

    return (
      <ModalFooter borderless>
        <div className="flex items-center justify-between gap-3 w-full">
          <button
            type="button"
            onClick={() => {
              triggerSensory("selection");
              setIsDismissing(true);
            }}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <EyeOff className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Ocultar este guia...</span>
          </button>
          <Button type="button" variant="outline" size="sm" onClick={handleClose}>
            <span>Fechar</span>
          </Button>
        </div>
      </ModalFooter>
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="xl"
      footer={renderFooter()}
    >
      <div className="flex flex-col gap-4">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          items={tabs}
          variant="underline"
          fullWidth={false}
          ariaLabel={`Navegação do ${title}`}
        />
      </div>
    </Modal>
  );
}
