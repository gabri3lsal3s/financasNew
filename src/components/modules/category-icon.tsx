import { Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_ICON_MAP } from "@/components/modules/category-icons";

export interface CategoryIconProps {
  /** Nome do ícone (schema `categories.icon`) — fallback para Tag. */
  icon?: string | null;
  /** Cor da categoria (hex do schema `categories.color`) — fallback neutro. */
  color?: string | null;
  className?: string;
}

export function CategoryIcon({ icon, color, className }: CategoryIconProps) {
  const Icon = (icon ? CATEGORY_ICON_MAP[icon] : undefined) ?? Tag;
  return (
    <Icon
      aria-hidden="true"
      className={cn("size-4 shrink-0", className)}
      style={color ? { color } : undefined}
    />
  );
}
