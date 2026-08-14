import { Construction } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
      <EmptyState
        icon={<Construction aria-hidden="true" />}
        title={`${title} — em construção`}
        description={description}
      />
    </div>
  );
}
