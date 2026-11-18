import { CheckCheck } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { HighlightRow, ReminderItem } from "@/components/modules";
import type { ReminderItem as ReminderItemData } from "@/domain/reminders";

export interface RemindersReadTabProps {
  items: ReminderItemData[];
  highlightId: string | null;
  onMarkRead: (key: string) => void;
  onSnooze: (key: string) => void;
  onRestore: (key: string) => void;
  onOpenReminder: (item: ReminderItemData) => void;
}

export function RemindersReadTab({
  items,
  highlightId,
  onMarkRead,
  onSnooze,
  onRestore,
  onOpenReminder,
}: RemindersReadTabProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<CheckCheck className="size-6" aria-hidden="true" />}
        title="Histórico vazio"
        description="Nenhuma fatura ou dívida arquivada no histórico de lidos."
        tone="default"
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => {
        const isMatch =
          highlightId &&
          (highlightId === item.key ||
            highlightId === item.link?.params?.q ||
            highlightId === item.link?.params?.debt);
        return (
          <HighlightRow
            key={item.key}
            highlightId={highlightId}
            id={isMatch ? highlightId : item.key}
            className="rounded-2xl"
          >
            <ReminderItem
              item={item}
              stateKind="read"
              onMarkRead={onMarkRead}
              onSnooze={onSnooze}
              onRestore={onRestore}
              onOpen={() => onOpenReminder(item)}
            />
          </HighlightRow>
        );
      })}
    </div>
  );
}
