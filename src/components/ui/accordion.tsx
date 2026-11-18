import { createContext, useCallback, useContext, useId, useMemo, useRef, useState } from "react";
import type { ButtonHTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

interface AccordionContextValue {
  openValues: readonly string[];
  toggleItem: (value: string) => void;
  navigateTrigger: (currentEl: HTMLButtonElement, key: string) => boolean;
}

interface AccordionItemContextValue {
  value: string;
  isOpen: boolean;
  disabled: boolean;
  triggerId: string;
  contentId: string;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);
const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);

function useAccordionContext(): AccordionContextValue {
  const ctx = useContext(AccordionContext);
  if (!ctx) {
    throw new Error("Componentes de Accordion devem ser usados dentro de <Accordion />.");
  }
  return ctx;
}

function useAccordionItemContext(): AccordionItemContextValue {
  const ctx = useContext(AccordionItemContext);
  if (!ctx) {
    throw new Error("<AccordionTrigger /> e <AccordionContent /> devem estar dentro de <AccordionItem />.");
  }
  return ctx;
}

export interface AccordionSingleProps {
  type?: "single";
  collapsible?: boolean;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: ReactNode;
}

export interface AccordionMultipleProps {
  type: "multiple";
  collapsible?: boolean;
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  className?: string;
  children: ReactNode;
}

export type AccordionProps = AccordionSingleProps | AccordionMultipleProps;

function normalizeInitialValues(
  type: "single" | "multiple",
  defaultValue: string | string[] | undefined,
): string[] {
  if (defaultValue === undefined) return [];
  if (type === "multiple") {
    return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
  }
  return typeof defaultValue === "string" && defaultValue ? [defaultValue] : [];
}

/**
 * Sanfona acessível WAI-ARIA em React puro com transição CSS Grid (`200ms`).
 * Suporta `type="single"` (com `collapsible`) e `type="multiple"`, controlado ou não controlado.
 */
export function Accordion(props: AccordionProps) {
  const type = props.type ?? "single";
  const collapsible = props.collapsible ?? true;
  const rootRef = useRef<HTMLDivElement>(null);

  const [internalValues, setInternalValues] = useState<string[]>(() =>
    normalizeInitialValues(type, props.defaultValue),
  );

  const isControlled = props.value !== undefined;
  const openValues = useMemo<string[]>(() => {
    if (!isControlled) return internalValues;
    if (Array.isArray(props.value)) return props.value;
    return props.value ? [props.value] : [];
  }, [internalValues, isControlled, props.value]);

  const toggleItem = useCallback(
    (itemValue: string) => {
      triggerSensory("selection");
      const currentlyOpen = openValues.includes(itemValue);

      if (props.type === "multiple") {
        const nextValues = currentlyOpen
          ? openValues.filter((v) => v !== itemValue)
          : [...openValues, itemValue];
        if (!isControlled) setInternalValues(nextValues);
        props.onValueChange?.(nextValues);
        return;
      }

      const nextValue = currentlyOpen ? (collapsible ? "" : itemValue) : itemValue;
      const nextValues = nextValue ? [nextValue] : [];
      if (!isControlled) setInternalValues(nextValues);
      props.onValueChange?.(nextValue);
    },
    [collapsible, isControlled, openValues, props],
  );

  const navigateTrigger = useCallback((currentEl: HTMLButtonElement, key: string): boolean => {
    const container = rootRef.current;
    if (!container) return false;
    const triggers = Array.from(
      container.querySelectorAll<HTMLButtonElement>("[data-accordion-trigger]:not([disabled])"),
    );
    const currentIndex = triggers.indexOf(currentEl);
    if (currentIndex === -1 || triggers.length === 0) return false;

    let targetIndex: number | null = null;
    if (key === "ArrowDown") {
      targetIndex = (currentIndex + 1) % triggers.length;
    } else if (key === "ArrowUp") {
      targetIndex = (currentIndex - 1 + triggers.length) % triggers.length;
    } else if (key === "Home") {
      targetIndex = 0;
    } else if (key === "End") {
      targetIndex = triggers.length - 1;
    }

    if (targetIndex === null) return false;
    triggers[targetIndex]?.focus();
    return true;
  }, []);

  return (
    <AccordionContext.Provider value={{ openValues, toggleItem, navigateTrigger }}>
      <div ref={rootRef} className={cn("flex flex-col gap-2", props.className)}>
        {props.children}
      </div>
    </AccordionContext.Provider>
  );
}

export interface AccordionItemProps {
  value: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export function AccordionItem({
  value,
  disabled = false,
  className,
  children,
}: AccordionItemProps) {
  const { openValues } = useAccordionContext();
  const baseId = useId();
  const isOpen = openValues.includes(value);

  return (
    <AccordionItemContext.Provider
      value={{
        value,
        isOpen,
        disabled,
        triggerId: `${baseId}-trigger`,
        contentId: `${baseId}-content`,
      }}
    >
      <div
        data-state={isOpen ? "open" : "closed"}
        data-disabled={disabled ? "true" : undefined}
        className={cn(
          "rounded-xl border border-border/80 bg-surface-raised/40 transition-colors",
          className,
        )}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

export interface AccordionTriggerProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  children: ReactNode;
}

export function AccordionTrigger({
  className,
  children,
  onClick,
  onKeyDown,
  disabled: disabledProp,
  ...props
}: AccordionTriggerProps) {
  const { toggleItem, navigateTrigger } = useAccordionContext();
  const { value, isOpen, disabled: itemDisabled, triggerId, contentId } = useAccordionItemContext();
  const disabled = Boolean(disabledProp || itemDisabled);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (navigateTrigger(event.currentTarget, event.key)) {
      event.preventDefault();
    }
    onKeyDown?.(event);
  };

  return (
    <button
      id={triggerId}
      type="button"
      data-accordion-trigger=""
      data-state={isOpen ? "open" : "closed"}
      aria-expanded={isOpen}
      aria-controls={contentId}
      disabled={disabled}
      onClick={(event) => {
        if (disabled) return;
        toggleItem(value);
        onClick?.(event);
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-foreground transition-colors select-none hover:bg-surface-hover/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="min-w-0 flex-1">{children}</span>
      <ChevronDown
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
          isOpen && "rotate-180",
        )}
        aria-hidden="true"
      />
    </button>
  );
}

export interface AccordionContentProps {
  className?: string;
  children: ReactNode;
}

export function AccordionContent({ className, children }: AccordionContentProps) {
  const { isOpen, triggerId, contentId } = useAccordionItemContext();

  return (
    <div
      id={contentId}
      role="region"
      aria-labelledby={triggerId}
      aria-hidden={!isOpen}
      data-state={isOpen ? "open" : "closed"}
      style={{ visibility: isOpen ? "visible" : "hidden" }}
      className={cn(
        "grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
        isOpen
          ? "grid-rows-[1fr] opacity-100 visible"
          : "grid-rows-[0fr] opacity-0 invisible pointer-events-none",
      )}
    >
      <div className="overflow-hidden">
        <div className={cn("px-4 pb-4 pt-1 text-sm text-foreground", className)}>
          {children}
        </div>
      </div>
    </div>
  );
}
