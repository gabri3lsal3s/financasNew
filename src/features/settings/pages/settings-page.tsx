import { useState } from "react";
import {
  Palette,
  Sparkles,
  Volume2,
  LayoutDashboard,
  User as UserIcon,
  Database,
  Check,
  Moon,
  Sun,
  Smartphone,
  Layers,
  VolumeX,
  EyeOff,
  LogOut,
  Download,
  RotateCcw,
  Zap,
  Sliders,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Tabs,
  Badge,
  LivePulseBeacon,
  Checkbox,
} from "@/components/ui";
import { useTheme } from "@/app/theme-provider";
import type { ThemePreference } from "@/app/theme-provider";
import { useDensity, setDensity } from "@/hooks/use-density";
import { usePrivacyMask, togglePrivacyMask } from "@/hooks/use-privacy-mask";
import {
  useVisualCustomization,
  type AccentTheme,
  type SurfaceStyle,
  type MotionLevel,
} from "@/hooks/use-visual-customization";
import { playSound } from "@/services/audio-fx";
import { triggerHaptic } from "@/services/haptics";
import { useAuth } from "@/hooks/use-auth";
import { getSupabase } from "@/data/client";
import { cn } from "@/lib/utils";

const ACCENT_OPTIONS: { id: AccentTheme; label: string; bgClass: string; hex: string }[] = [
  { id: "teal", label: "Teal Vital (Oficial)", bgClass: "bg-[#2A9D8F]", hex: "#2A9D8F" },
  { id: "emerald", label: "Esmeralda Fintech", bgClass: "bg-[#10B981]", hex: "#10B981" },
  { id: "gold", label: "Ouro Âmbar", bgClass: "bg-[#DDA726]", hex: "#DDA726" },
  { id: "sapphire", label: "Safira Petróleo", bgClass: "bg-[#0284C7]", hex: "#0284C7" },
  { id: "violet", label: "Violeta Íris", bgClass: "bg-[#7C3AED]", hex: "#7C3AED" },
  { id: "rose", label: "Coral Rosé", bgClass: "bg-[#E11D48]", hex: "#E11D48" },
  { id: "mono", label: "Monocromático (P&B)", bgClass: "bg-foreground", hex: "#000000" },
];

const THEME_OPTIONS: { id: ThemePreference; label: string; icon: typeof Sun; desc: string }[] = [
  { id: "light", label: "Claro", icon: Sun, desc: "Vital Petróleo & Ouro" },
  { id: "dark", label: "Escuro", icon: Moon, desc: "Abissal Teal" },
  { id: "oled", label: "OLED", icon: Smartphone, desc: "True Black + Alto Contraste P&B" },
  { id: "system", label: "Automático", icon: Sliders, desc: "Sincronizado ao sistema" },
];

const SURFACE_OPTIONS: { id: SurfaceStyle; label: string; desc: string }[] = [
  { id: "glass", label: "Glassmorphism", desc: "Translúcido com desfoque e reflexo de borda" },
  { id: "flat", label: "Minimalista Flat", desc: "Bordas nítidas sem sombras ou gradientes" },
  { id: "elevated", label: "Elevado 3D", desc: "Sombras em camadas com relevo sutil" },
];

const MOTION_OPTIONS: { id: MotionLevel; label: string; desc: string }[] = [
  { id: "fluid", label: "Cinemática / Fluida", desc: "Física spring, tickers animados e ripple tátil" },
  { id: "eco", label: "Econômica", desc: "Transições suaves em fade com menor consumo" },
  { id: "reduced", label: "Reduzida / A11y", desc: "Movimento mínimo para conforto visual e acessibilidade" },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("aparencia");
  const { preference: themePref, setPreference: setThemePref } = useTheme();
  const density = useDensity();
  const privacyMasked = usePrivacyMask();
  const visual = useVisualCustomization();
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);

  const handleTestSound = (type: "click" | "success" | "pop") => {
    triggerHaptic("medium");
    playSound(type, true);
  };

  const handleExportData = async () => {
    try {
      setExporting(true);
      triggerHaptic("medium");
      playSound("success", visual.soundEnabled);
      const supabase = getSupabase();
      const { data: transactions } = await supabase.from("transactions").select("*").limit(500);
      const { data: accounts } = await supabase.from("accounts").select("*");
      const { data: categories } = await supabase.from("categories").select("*");

      const backup = {
        exportedAt: new Date().toISOString(),
        user: user?.email,
        categories: categories ?? [],
        accounts: accounts ?? [],
        transactions: transactions ?? [],
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `financas_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // export fallback
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = async () => {
    try {
      triggerHaptic("medium");
      const supabase = getSupabase();
      await supabase.auth.signOut();
    } catch {
      // logout fallback
    }
  };

  const tabItems = [
    {
      value: "aparencia",
      label: "Aparência",
      icon: <Palette className="size-4" />,
      content: (
        <div className="space-y-6">
          {/* Seletor de Temas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Tema Visual</span>
                <Badge variant="muted" className="text-xs font-normal">
                  4 Modos
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {THEME_OPTIONS.map((t) => {
                  const Icon = t.icon;
                  const isSelected = themePref === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setThemePref(t.id)}
                      className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all select-none cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                          : "border-border bg-surface hover:bg-surface-hover hover:border-border/80"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-2">
                        <Icon className={`size-5 ${isSelected ? "text-primary-strong" : "text-muted-foreground"}`} />
                        {isSelected && <Check className="size-4 text-primary-strong" />}
                      </div>
                      <span className="font-semibold text-sm text-foreground">{t.label}</span>
                      <span className="text-xs text-muted-foreground mt-0.5">{t.desc}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Paleta de Acento / Accent Theme */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Cor de Destaque (Accent)</span>
                <div className="flex items-center gap-1.5">
                  <LivePulseBeacon variant="primary" size="sm" />
                  <span className="text-xs text-muted-foreground">Tempo Real</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {ACCENT_OPTIONS.map((a, idx) => {
                  const isSelected = visual.accent === a.id;
                  const isLastOdd = idx === ACCENT_OPTIONS.length - 1 && ACCENT_OPTIONS.length % 2 !== 0;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => visual.setAccent(a.id)}
                      className={cn(
                        "flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all select-none cursor-pointer min-w-0",
                        isSelected
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                          : "border-border bg-surface hover:bg-surface-hover hover:border-border/80",
                        isLastOdd && "col-span-2 sm:col-span-1",
                      )}
                    >
                      <span
                        className={`size-6 rounded-full shrink-0 shadow-sm ${a.bgClass} flex items-center justify-center border border-border/60`}
                      >
                        {isSelected && (
                          <Check
                            className={`size-3.5 ${a.id === "mono" ? "text-background" : "text-white"}`}
                          />
                        )}
                      </span>
                      <span className="font-medium text-sm text-foreground leading-tight truncate">
                        {a.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Estilo de Superfície */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                <span>Estilo de Superfícies & Cards</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SURFACE_OPTIONS.map((s) => {
                  const isSelected = visual.surfaceStyle === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => visual.setSurfaceStyle(s.id)}
                      className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all select-none cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                          : "border-border bg-surface hover:bg-surface-hover hover:border-border/80"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-semibold text-sm text-foreground">{s.label}</span>
                        {isSelected && <Check className="size-4 text-primary-strong" />}
                      </div>
                      <span className="text-xs text-muted-foreground">{s.desc}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Densidade Visual */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Densidade da Interface</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setDensity("comfortable")}
                className={`flex-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  density === "comfortable"
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                    : "border-border bg-surface hover:bg-surface-hover"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-foreground">Confortável (Padrão)</span>
                  {density === "comfortable" && <Check className="size-4 text-primary-strong" />}
                </div>
                <span className="text-xs text-muted-foreground">
                  Espaçamento relaxado, botões mais amplos e excelente legibilidade.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDensity("compact")}
                className={`flex-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  density === "compact"
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                    : "border-border bg-surface hover:bg-surface-hover"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-foreground">Compacta</span>
                  {density === "compact" && <Check className="size-4 text-primary-strong" />}
                </div>
                <span className="text-xs text-muted-foreground">
                  Maior quantidade de informações e lançamentos visíveis por tela.
                </span>
              </button>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      value: "movimento",
      label: "Movimento",
      icon: <Sparkles className="size-4" />,
      content: (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="size-4 text-primary" />
                <span>Nível de Fluidez & Animações</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {MOTION_OPTIONS.map((m) => {
                  const isSelected = visual.motionLevel === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => visual.setMotionLevel(m.id)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                          : "border-border bg-surface hover:bg-surface-hover"
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-sm text-foreground">{m.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{m.desc}</div>
                      </div>
                      {isSelected && <Check className="size-4 text-primary-strong shrink-0 ml-3" />}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Efeitos Individuais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface hover:bg-surface-hover cursor-pointer">
                <div>
                  <div className="font-medium text-sm text-foreground">
                    Contagem Numérica Animada (Number Ticker)
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Anima números e saldos ao carregar ou atualizar valores
                  </div>
                </div>
                <Checkbox
                  checked={visual.numberTickerEnabled}
                  onCheckedChange={(checked) => visual.setNumberTickerEnabled(Boolean(checked))}
                />
              </label>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      value: "sensorial",
      label: "Sensorial",
      icon: <Volume2 className="size-4" />,
      content: (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {visual.soundEnabled ? (
                    <Volume2 className="size-4 text-primary" />
                  ) : (
                    <VolumeX className="size-4 text-muted-foreground" />
                  )}
                  <span>Feedback Sonoro Sintetizado</span>
                </div>
                <Badge variant={visual.soundEnabled ? "positive" : "muted"}>
                  {visual.soundEnabled ? "Ativado" : "Desativado"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-surface hover:bg-surface-hover cursor-pointer">
                <div>
                  <div className="font-semibold text-sm text-foreground">
                    Sons de Interface Sutis
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Síntese ultraleve de áudio (Web Audio API) em cliques e confirmações.
                  </div>
                </div>
                <Checkbox
                  checked={visual.soundEnabled}
                  onCheckedChange={(checked) => visual.setSoundEnabled(Boolean(checked))}
                />
              </label>

              {/* Botões de Teste */}
              <div className="p-4 rounded-xl border border-border bg-muted/40 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Testar Efeitos Sonoros
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => handleTestSound("click")}>
                    Micro-Clique
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleTestSound("pop")}>
                    Spring Pop
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleTestSound("success")}>
                    Sucesso
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <EyeOff className="size-4 text-primary" />
                <span>Modo de Privacidade</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-surface hover:bg-surface-hover cursor-pointer">
                <div>
                  <div className="font-semibold text-sm text-foreground">
                    Ocultar Valores Monetários (Blur)
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Ofusca valores de saldos e lançamentos na tela para proteção em público.
                  </div>
                </div>
                <Checkbox checked={privacyMasked} onCheckedChange={() => togglePrivacyMask()} />
              </label>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      value: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="size-4" />,
      content: (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Widgets Visíveis na Visão Geral</span>
                <span className="text-xs text-muted-foreground font-normal">Personalize seu Início</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: "kpis" as const, label: "Resumo de Saldo & KPIs (com Sparklines)", desc: "Entradas, Saídas, Investimentos e Saldo Geral" },
                { key: "summary" as const, label: "Saldo Líquido de Contas & Poupança", desc: "A receber, a pagar, faturas abertas e taxa de poupança" },
                { key: "flow" as const, label: "Gráfico de Fluxo Diário", desc: "Curva acumulada de receitas versus despesas no mês" },
                { key: "donut" as const, label: "Distribuição por Categorias", desc: "Gráfico donut com os maiores destinos do seu dinheiro" },
                { key: "budgets" as const, label: "Acompanhamento de Orçamentos", desc: "Barras de consumo e limites por categoria" },
              ].map((w) => (
                <label
                  key={w.key}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-surface hover:bg-surface-hover cursor-pointer"
                >
                  <div className="pr-4">
                    <div className="font-semibold text-sm text-foreground">{w.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{w.desc}</div>
                  </div>
                  <Checkbox
                    checked={visual.dashboardWidgets[w.key]}
                    onCheckedChange={(checked) => visual.setDashboardWidget(w.key, Boolean(checked))}
                  />
                </label>
              ))}
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      value: "perfil",
      label: "Perfil",
      icon: <UserIcon className="size-4" />,
      content: (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conta do Usuário</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/30">
                <div className="size-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-xl shadow-md">
                  {(user?.email?.[0] || "U").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-foreground truncate text-base">
                    {user?.user_metadata?.name || user?.email?.split("@")[0] || "Usuário"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <LivePulseBeacon variant="positive" size="sm" />
                    <span className="text-xs font-medium text-positive-strong">Sessão Segura Ativa</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button variant="destructive" onClick={handleLogout} className="gap-2">
                  <LogOut className="size-4" />
                  <span>Sair da Conta</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      value: "dados",
      label: "Dados",
      icon: <Database className="size-4" />,
      content: (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Backup & Exportação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl border border-border bg-surface gap-3">
                <div>
                  <div className="font-semibold text-sm text-foreground">Exportar Dados Completos (JSON)</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Baixe uma cópia estruturada de transações, contas e categorias.
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  loading={exporting}
                  onClick={handleExportData}
                  className="gap-2 shrink-0"
                >
                  <Download className="size-4" />
                  <span>Exportar JSON</span>
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl border border-border bg-surface gap-3">
                <div>
                  <div className="font-semibold text-sm text-foreground">Restaurar Padrões Visuais</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Volta temas, acentos, sons e animações para as configurações padrão de fábrica.
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    visual.resetToDefaults();
                    setThemePref("system");
                    setDensity("comfortable");
                    triggerHaptic("light");
                  }}
                  className="gap-2 shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="size-4" />
                  <span>Redefinir</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl text-foreground">Configurações & Personalização</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie temas, paletas de acento, micro-interações e preferências do seu Guia Financeiro.
        </p>
      </header>

      <div className="pb-12">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          items={tabItems}
          variant="pills"
          className="w-full"
        />
      </div>
    </div>
  );
}
