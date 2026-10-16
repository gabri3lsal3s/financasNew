import { RotateCcw } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
} from "@/components/ui";

export interface ResetDefaultsCardProps {
  onReset: () => void;
}

export function ResetDefaultsCard({ onReset }: ResetDefaultsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <RotateCcw className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>Restaurar Padrões de Personalização</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl border border-border bg-surface gap-3">
          <div>
            <div className="font-semibold text-sm text-foreground">Redefinir tudo aos valores de fábrica</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Restaura o modo de experiência Dinâmico, tema oficial, paleta Teal e disposição padrão de widgets.
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="gap-2 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-4" />
            <span>Redefinir</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
