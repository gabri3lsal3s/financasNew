import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface AccordionItem {
  value: string;
  title: string;
  content: ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  type?: "single" | "multiple";
  defaultValue?: string | string[];
  className?: string;
}

/** Accordion próprio do app (Radix) — substitui `<details>/<summary>` nativo (DESIGN_SYSTEM §13). */
export function Accordion({ items, type = "single", defaultValue, className }: AccordionProps) {
  const body = (
    <>
      {items.map((item) => (
        <AccordionPrimitive.Item
          key={item.value}
          value={item.value}
          className="rounded-lg border border-border bg-surface shadow-sm transition-colors data-[state=open]:border-primary/30"
        >
          <AccordionPrimitive.Header>
            <AccordionPrimitive.Trigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&[data-state=open]>svg]:rotate-180">
              {item.title}
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200" aria-hidden="true" />
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>
          <AccordionPrimitive.Content className="overflow-hidden px-4 pb-4 text-sm text-muted-foreground data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            {item.content}
          </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
      ))}
    </>
  );

  const shared = { className: cn("flex flex-col gap-2", className) };

  if (type === "multiple") {
    return (
      <AccordionPrimitive.Root type="multiple" defaultValue={defaultValue as string[] | undefined} {...shared}>
        {body}
      </AccordionPrimitive.Root>
    );
  }
  return (
    <AccordionPrimitive.Root type="single" collapsible defaultValue={defaultValue as string | undefined} {...shared}>
      {body}
    </AccordionPrimitive.Root>
  );
}
