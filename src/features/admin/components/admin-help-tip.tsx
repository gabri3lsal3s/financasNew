import { HelpCircle } from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@/components/ui";

interface AdminHelpTipProps {
  title: string;
  what: string;
  when: string;
  impact: string;
}

export function AdminHelpTip({ title, what, when, impact }: AdminHelpTipProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground"
          aria-label={`Ajuda sobre ${title}`}
          title={`Ajuda sobre ${title}`}
        >
          <HelpCircle aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label={title} className="max-w-[calc(100vw-1rem)]">
        <p className="text-sm font-semibold">{title}</p>
        <dl className="mt-3 space-y-2 text-xs">
          <div>
            <dt className="font-semibold">O que é</dt>
            <dd className="text-muted-foreground">{what}</dd>
          </div>
          <div>
            <dt className="font-semibold">Quando agir</dt>
            <dd className="text-muted-foreground">{when}</dd>
          </div>
          <div>
            <dt className="font-semibold">Efeito</dt>
            <dd className="text-muted-foreground">{impact}</dd>
          </div>
        </dl>
      </PopoverContent>
    </Popover>
  );
}
