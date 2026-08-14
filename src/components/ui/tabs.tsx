import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/services/haptics";
import { playSound } from "@/services/audio-fx";
import { getVisualCustomization } from "@/hooks/use-visual-customization";

export interface TabItem {
  value: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  items: TabItem[];
  variant?: "underline" | "pills";
  className?: string;
}

/** Tabs próprias do app (Radix) — acessível, com teclado e micro-interação (F11). */
export function Tabs({
  value,
  onValueChange,
  items,
  variant = "underline",
  className,
}: TabsProps) {
  const handleTabChange = (val: string) => {
    triggerHaptic("light");
    const visual = getVisualCustomization();
    playSound("click", visual.soundEnabled);
    onValueChange(val);
  };

  return (
    <TabsPrimitive.Root value={value} onValueChange={handleTabChange} className={className}>
      <TabsPrimitive.List
        className={cn(
          "flex gap-1 overflow-x-auto no-scrollbar",
          variant === "underline"
            ? "border-b border-border"
            : "p-1 rounded-xl bg-muted/60 border border-border/50 backdrop-blur-sm",
        )}
        aria-label="Abas de navegação"
      >
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              "inline-flex items-center justify-center gap-2 whitespace-nowrap px-3.5 py-2 text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none active:scale-[0.98]",
              variant === "underline"
                ? "border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-primary-strong data-[state=active]:font-semibold"
                : "rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface/50 data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-sm data-[state=active]:shadow-black/5",
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) => (
        <TabsPrimitive.Content
          key={item.value}
          value={item.value}
          className="mt-4 outline-none focus-visible:ring-2 focus-visible:ring-ring animate-route-in"
        >
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
