import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { PageGuideButton } from "@/components/layout";
import { Button, Modal, Popover, PopoverContent, PopoverTrigger } from "@/components/ui";
import { ADMIN_PAGE_GUIDES, type AdminPageGuideId } from "./admin-page-guide-data";

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

export function AdminPageGuide({ page }: { page: AdminPageGuideId }) {
  const [open, setOpen] = useState(false);
  const { title, steps } = ADMIN_PAGE_GUIDES[page];

  return (
    <>
      <PageGuideButton label={title} onClick={() => setOpen(true)} />
      <Modal open={open} onOpenChange={setOpen} title={title} size="md">
        <ol className="list-decimal space-y-3 ps-5 text-sm text-muted-foreground">
          {steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </Modal>
    </>
  );
}
