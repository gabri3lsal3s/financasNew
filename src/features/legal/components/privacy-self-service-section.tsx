import { useNavigate } from "react-router";
import { FileText, Mail, Server, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, buttonVariants } from "@/components/ui";
import { INSTITUTIONAL_CONFIG } from "@/lib/institutional";
import { cn } from "@/lib/utils";

export function PrivacySelfServiceSection() {
  const navigate = useNavigate();

  return (
    <section aria-labelledby="secao-7" className="space-y-4 border-t border-border/60 pt-6 not-prose">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2
          id="secao-7"
          className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2"
        >
          <Server className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>SEÇÃO 7 — CANAL DE AUTOATENDIMENTO DO TITULAR E CONTATO DO DPO</span>
        </h2>
        <Badge variant="default" size="sm">
          Autoatendimento
        </Badge>
      </div>
      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
        Disponibilizamos atalhos diretos para que você exerça seus direitos garantidos pela LGPD sem
        intermediários ou formulários burocráticos:
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-border/80 bg-surface shadow-xs">
          <CardContent className="p-4 flex flex-col justify-between h-full gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>Portabilidade de Dados</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Exporte todo o seu histórico financeiro e patrimonial em formatos estruturados (.csv,
                .xlsx e PDF).
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/relatorios")}
              className="w-full text-xs"
            >
              Exportar Meus Dados
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-xs">
          <CardContent className="p-4 flex flex-col justify-between h-full gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                <Trash2 className="size-4 text-critical-strong" aria-hidden="true" />
                <span>Excluir Minha Conta</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Acesse a aba Dados &amp; Privacidade nas Configurações para realizar o expurgo
                definitivo dos dados.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/configuracoes?tab=security")}
              className="w-full text-xs text-critical-strong hover:text-critical-strong"
            >
              Gerenciar Exclusão
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-xs">
          <CardContent className="p-4 flex flex-col justify-between h-full gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>Falar com o DPO</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Envie requerimento formal com o assunto &quot;[LGPD] Requisição de Direitos do
                Titular&quot;.
              </p>
            </div>
            <a
              href={`mailto:${INSTITUTIONAL_CONFIG.dpoEmail}?subject=%5BLGPD%5D%20Requisicao%20de%20Direitos%20do%20Titular`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full text-xs")}
            >
              Enviar Requerimento
            </a>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
