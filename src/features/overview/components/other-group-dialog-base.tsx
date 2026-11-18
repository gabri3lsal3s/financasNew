import type { ReactNode } from "react";
import { ChevronRight, Layers } from "lucide-react";
import { Badge, Modal, ModalFooter, MoneyText, Progress } from "@/components/ui";
import { CategoryIcon } from "@/components/modules/category-icon";
import { triggerSensory } from "@/services/sensory";
import type { Category } from "@/types";

export interface OtherGroupDialogRow {
  category: Category;
  percent: number;
  badgeVariant: "critical" | "warning" | "positive" | "muted";
  progressTone?: "positive" | "warning" | "critical";
  primaryContent: ReactNode;
  secondaryContent: ReactNode;
}

export interface OtherGroupDialogBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  summaryTotalCents: number;
  summaryRightMeta?: ReactNode;
  rows: OtherGroupDialogRow[];
  onSelectCategory: (categoryId: string) => void;
  progressAriaPrefix: string;
  footer: ReactNode;
}

export function OtherGroupDialogBase({
  open,
  onOpenChange,
  title,
  description,
  summaryTotalCents,
  summaryRightMeta,
  rows,
  onSelectCategory,
  progressAriaPrefix,
  footer,
}: OtherGroupDialogBaseProps) {
  const handleSelect = (categoryId: string) => {
    triggerSensory("selection");
    onOpenChange(false);
    onSelectCategory(categoryId);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="md"
      description={description}
      headerActions={<Layers className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />}
      footer={<ModalFooter borderless>{footer}</ModalFooter>}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-hover/40 border border-border/80 p-3.5">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground">
              Total em outras categorias
            </span>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <MoneyText
                cents={summaryTotalCents}
                tone="default"
                variant="hero"
                className="text-xl font-bold tracking-tight"
              />
              {summaryRightMeta}
            </div>
          </div>
          <Badge variant="muted" size="xs">
            {rows.length} {rows.length === 1 ? "categoria" : "categorias"}
          </Badge>
        </div>

        <div className="flex flex-col divide-y divide-border/80 rounded-xl border border-border/80 bg-surface overflow-hidden">
          {rows.map((row) => (
            <button
              type="button"
              key={row.category.id}
              onClick={() => handleSelect(row.category.id)}
              className="flex flex-col gap-2 p-3 text-left hover:bg-surface-hover/60 transition-colors cursor-pointer w-full min-h-11 sm:min-h-0 group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:bg-surface-hover"
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <div className="flex items-center gap-2 min-w-0">
                  <CategoryIcon
                    icon={row.category.icon}
                    color={row.category.color}
                    className="size-4 shrink-0"
                  />
                  <span className="font-semibold text-xs text-foreground group-hover:text-primary-strong transition-colors truncate">
                    {row.category.name}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={row.badgeVariant} size="xs">
                    {Math.round(row.percent)}%
                  </Badge>
                  <ChevronRight
                    className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors"
                    aria-hidden="true"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                {row.primaryContent}
                {row.secondaryContent}
              </div>

              <Progress
                value={Math.min(row.percent, 100)}
                tone={row.progressTone}
                className="h-1"
                aria-label={`${progressAriaPrefix} de ${row.category.name}: ${Math.round(row.percent)}%`}
              />
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
