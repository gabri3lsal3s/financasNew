# PLANO DE IMPLEMENTAÇÃO: CONFIGURAÇÕES INICIAIS, EXPERIÊNCIA DE NOVOS USUÁRIOS E CATEGORIAS INTELIGENTES

> **Documento Canônico:** `docs/plans/PLANO_CONFIGURACOES_INICIAIS_E_EXPERIENCIA_NOVO_USUARIO.md`  
> **Modo de Execução:** Manual pelo Desenvolvedor (Guia passo a passo pronto para execução).  
> **Status do Repositório:** Limpo (zero alterações de código em aberto).

---

## 1. Diretrizes Estratégicas & Decisões Consolidadas

1. **Identidade Visual & Tema Padrão**:
   - **Cor de Destaque Padrão**: **Teal Vital (Oficial)** universal (`#2A9D8F`), garantindo acolhimento, autoridade bancária e calor visual nos modos Claro e Escuro.
   - **Monocromático**: Em destaque na aba Aparência com a recomendação explícita: *"Monocromático (Recomendado para OLED & Alto Contraste)"*, perfeito para telas AMOLED (`#000000`).
   - **Modo de Experiência**: **Dinâmico** (`dynamic`) por padrão (física spring, sons, hápticos e contadores numéricos ativos).
2. **Arquitetura de Navegação em `/configuracoes`**:
   - Sequência canônica das abas: **Aparência ➔ Alertas ➔ Segurança ➔ App ➔ Plano ➔ Conta**.
   - Ao acessar `/configuracoes` sem parâmetros, o aplicativo abre diretamente em **Aparência**.
3. **Gestão de Sessão & LGPD na Aba Conta**:
   - Novo card de **Sessão & Desconexão** com botão *"Sair da Conta"* e modal seguro de confirmação (via `useSignOut()`).
   - Card de **Exclusão de Conta Definitiva** (`DeleteAccountCard`) mantido **estritamente por último**, isolado na Zona de Perigo.
4. **Blindagem Estrita de Categorias (Novos vs. Usuários Existentes)**:
   - **Novos Usuários**: Recebem o seed das 11 categorias canônicas no banco de dados via trigger `AFTER INSERT ON auth.users` (`handle_new_user()`).
   - **Usuários Existentes (Proteção Total)**: **PROIBIDO** qualquer auto-seed automático no frontend. O motor de insights (`category-semantics.ts`) é resiliente e polimórfico, reconhecendo as categorias antigas dos usuários por radicais lexicais e ícones, sem jamais alterar ou poluir seus bancos de dados.

---

## 2. Estrutura de Portões de Qualidade (Quality Gates)

Ao final de cada fase, antes de prosseguir para a próxima, execute o checklist do **Portão de Qualidade**:

```bash
# 1. Verificação de Tipagem Estrita
npm run typecheck

# 2. Verificação de Linter e Regras de Governança
npm run lint

# 3. Execução dos Testes da Fase
npm run test -- <arquivos_afetados_pela_fase>

# 4. Commit e Push Semântico
git add .
git commit -m "<mensagem_padronizada_da_fase>"
git push origin main
```

---

## FASE 1: Estado Inicial Padrão, Identidade Visual & Recomendação OLED

**Objetivo:** Garantir que o Teal Vital seja o padrão oficial inicial, com o Monocromático recomendado para OLED, sem flash visual na pré-hidratação e modo Dinâmico ativo.

### Checklist de Tarefas da Fase 1

- [x] **Tarefa 1.1: Revisar `DEFAULT_CONFIG` e Fallback de Storage**
  - **Arquivo:** `src/hooks/use-visual-customization.ts`
  - **O que verificar/ajustar:**
    - Linha ~84: Confirmar que `DEFAULT_CONFIG.accent` permanece `'teal'`.
    - Linha ~85: Confirmar que `DEFAULT_CONFIG.experiencePreset` permanece `'dynamic'`.
    - Linha ~140: No fallback de `readStoredConfig`, certificar-se de que se o valor não existir no storage, retorne `'teal'`:
      ```ts
      const accent: AccentTheme =
        rawAccent && ["teal", "gold", "sapphire", "violet", "rose", "mono"].includes(rawAccent)
          ? rawAccent
          : "teal";
      ```

- [x] **Tarefa 1.2: Revisar o Script Inline de Inicialização no `<head>`**
  - **Arquivo:** `index.html`
  - **O que verificar/ajustar:**
    - Linha ~92: Garantir que a lógica não force atributo divergente quando não houver preferência:
      ```js
      var accent = getStoredValue('accent_theme');
      if (accent && accent !== 'teal') {
        document.documentElement.setAttribute('data-accent', accent);
      }
      ```
    - Como o Teal é a variável raiz do CSS (sem `data-accent`), ausência de atributo = Teal Vital imediato sem *FOUC*.

- [x] **Tarefa 1.3: Destaque do Monocromático com Recomendação para OLED**
  - **Arquivo:** `src/features/settings/components/tabs/visual-identity-card.tsx`
  - **O que verificar/ajustar:**
    - No array `ACCENT_OPTIONS` (linha ~22), posicionar `teal` e `mono` como as primeiras opções com as descrições claras:
      ```tsx
      const ACCENT_OPTIONS: { id: AccentTheme; label: string; bgClass: string; hex: string }[] = [
        { id: "teal", label: "Teal Vital (Oficial)", bgClass: "bg-[#2A9D8F]", hex: "#2A9D8F" },
        { id: "mono", label: "Monocromático (Recomendado para OLED)", bgClass: "bg-foreground", hex: "#000000" },
        { id: "gold", label: "Ouro Âmbar", bgClass: "bg-[#DDA726]", hex: "#DDA726" },
        { id: "sapphire", label: "Safira Petróleo", bgClass: "bg-[#0284C7]", hex: "#0284C7" },
        { id: "violet", label: "Violeta Íris", bgClass: "bg-[#7C3AED]", hex: "#7C3AED" },
        { id: "rose", label: "Coral Rosé", bgClass: "bg-[#E11D48]", hex: "#E11D48" },
      ];
      ```

- [x] **Tarefa 1.4: Atualizar Texto do Card de Redefinição aos Padrões**
  - **Arquivo:** `src/features/settings/components/tabs/reset-defaults-card.tsx`
  - **O que verificar/ajustar:**
    - Linha ~28: Atualizar a descrição da redefinição aos padrões para refletir a nova composição:
      ```tsx
      <div className="text-xs text-muted-foreground mt-0.5">
        Restaura o modo de experiência Dinâmico, tema oficial Teal Vital e disposição padrão da interface.
      </div>
      ```

- [x] **Tarefa 1.5: Validar Testes Unitários da Camada Visual**
  - **Arquivo:** `src/hooks/use-visual-customization.test.ts`
  - Rodar: `npx vitest run src/hooks/use-visual-customization.test.ts`
  - Garantir que todas as asserções de default passam sem erros.

### Portão de Qualidade da Fase 1
- [x] Executar: `npm run typecheck`
- [x] Executar: `npm run lint`
- [x] Executar: `npx vitest run src/hooks/use-visual-customization.test.ts`
- [x] **Commit & Push da Fase 1:**
  ```bash
  git add src/hooks/use-visual-customization.ts src/features/settings/components/tabs/visual-identity-card.tsx src/features/settings/components/tabs/reset-defaults-card.tsx index.html
  git commit -m "feat(settings): padroniza estado inicial teal vital oficial com recomendacao monocromatica para oled"
  git push origin main
  ```

---

## FASE 2: Reordenação Estrutural da Central de Configurações

**Objetivo:** Reorganizar a ordem das abas para Aparência, Alertas, Segurança, App, Plano e Conta, tornando Aparência a aba padrão ao abrir `/configuracoes`.

### Checklist de Tarefas da Fase 2

- [x] **Tarefa 2.1: Reordenar o Array `tabItems`**
  - **Arquivo:** `src/features/settings/pages/settings-page.tsx`
  - **O que verificar/ajustar:**
    - No `useMemo` de `tabItems` (linha ~156), reestruturar os itens na ordem estrita:
      ```tsx
      const tabItems = useMemo(
        () => [
          {
            value: "appearance",
            label: "Aparência",
            shortLabel: "Aparência",
            icon: <Palette className="size-4" />,
            content: <AppearanceTab />,
          },
          {
            value: "notifications",
            label: "Notificações",
            shortLabel: "Alertas",
            icon: <Bell className="size-4" />,
            content: <NotificationsTab />,
          },
          {
            value: "security",
            label: "Segurança",
            shortLabel: "Segurança",
            icon: <ShieldCheck className="size-4" />,
            content: <SecurityTab />,
          },
          {
            value: "devices",
            label: "Dispositivos & App",
            shortLabel: "App",
            icon: <Smartphone className="size-4" />,
            content: <AppInstallationTab />,
          },
          {
            value: "subscription",
            label: "Plano",
            shortLabel: "Plano",
            icon: <Zap className="size-4" />,
            content: <SubscriptionTab />,
          },
          {
            value: "account",
            label: "Minha Conta",
            shortLabel: "Conta",
            icon: <User className="size-4" />,
            content: <AccountTab />,
          },
        ],
        [],
      );
      ```

- [x] **Tarefa 2.2: Atualizar o Resolvedor de Abas Padrão (`resolveSettingsTab`)**
  - **Arquivo:** `src/features/settings/pages/settings-page.tsx`
  - **O que verificar/ajustar:**
    - Linha ~30: Quando `!param`, retornar `"appearance"`.
    - Linha ~121: Fallback final deve retornar `"appearance"` (ao invés de `"account"`):
      ```tsx
      function resolveSettingsTab(param: string | null): string {
        if (!param) return "appearance";
        const p = param.toLowerCase().trim();
        // ... aliases existentes ...
        return "appearance";
      }
      ```

- [x] **Tarefa 2.3: Atualizar Testes Automatizados da Página de Configurações**
  - **Arquivo:** `src/features/settings/pages/settings-page.test.tsx`
  - **O que verificar/ajustar:**
    - Atualizar os testes para esperar que ao acessar `/configuracoes` sem parâmetros, a aba ativa seja "Aparência" (verificando a presença de "Modo de Experiência do Aplicativo").
    - Validar que deep-links como `?tab=conta` ou `?tab=perfil` continuam ativando "Minha Conta".

### Portão de Qualidade da Fase 2
- [x] Executar: `npm run typecheck`
- [x] Executar: `npm run lint`
- [x] Executar: `npx vitest run src/features/settings/pages/settings-page.test.tsx`
- [x] **Commit & Push da Fase 2:**
  ```bash
  git add src/features/settings/pages/settings-page.tsx src/features/settings/pages/settings-page.test.tsx
  git commit -m "refactor(settings): reordena abas para aparencia alertas seguranca app plano e conta"
  git push origin main
  ```

---

## FASE 3: Gestão de Sessão na Aba Conta (Logout com Confirmação & Exclusão no Fim)

**Objetivo:** Adicionar o card de encerramento de sessão seguro na aba Conta com modal amigável de confirmação, mantendo o card de exclusão permanente estritamente por último.

### Checklist de Tarefas da Fase 3

- [x] **Tarefa 3.1: Importações Necessárias em `AccountTab`**
  - **Arquivo:** `src/features/settings/components/tabs/account-tab.tsx`
  - Adicionar as importações:
    ```tsx
    import { LogOut } from "lucide-react";
    import { Modal, ModalFooter } from "@/components/ui";
    import { useSignOut } from "@/hooks/use-sign-out";
    ```

- [x] **Tarefa 3.2: Estados e Handler de Encerramento de Sessão**
  - **Arquivo:** `src/features/settings/components/tabs/account-tab.tsx`
  - Adicionar dentro do componente `AccountTab`:
    ```tsx
    const { signOut } = useSignOut();
    const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);

    const handleSignOut = async () => {
      setIsSigningOut(true);
      triggerSensory("action");
      try {
        await signOut();
        pushToast({
          title: "Sessão encerrada",
          description: "Você foi desconectado com sucesso deste dispositivo.",
          variant: "default",
        });
      } catch (err) {
        triggerSensory("destructive");
        pushToast({
          title: "Não foi possível sair",
          description: getErrorMessage(err),
          variant: "destructive",
        });
        setIsSigningOut(false);
      }
    };
    ```

- [x] **Tarefa 3.3: Renderização do Card de Sessão e do Modal de Confirmação**
  - **Arquivo:** `src/features/settings/components/tabs/account-tab.tsx`
  - Inserir logo após o Card 3 (Detalhes da Conta & SaaS) e antes do Card de Exclusão:
    ```tsx
    {/* Card 4: Sessão & Desconexão */}
    <Card className="border-border/80 bg-surface shadow-xs">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <LogOut className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>Sessão &amp; Desconexão</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Encerre a sessão do aplicativo neste dispositivo com segurança. Seus dados permanecerão salvos na nuvem.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/20">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-foreground block">
              Sair da conta neste dispositivo
            </span>
            <span className="text-[11px] text-muted-foreground block">
              Você precisará inserir suas credenciais de acesso para entrar novamente.
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsSignOutModalOpen(true)}
            className="h-9 px-4 text-xs font-semibold rounded-xl shrink-0 cursor-pointer gap-1.5"
          >
            <LogOut className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Sair da Conta</span>
          </Button>
        </div>
      </CardContent>
    </Card>

    {/* Modal de Confirmação de Saída */}
    <Modal
      open={isSignOutModalOpen}
      onOpenChange={(open) => {
        if (!isSigningOut) setIsSignOutModalOpen(open);
      }}
      title="Encerrar Sessão"
      description="Tem certeza de que deseja sair da sua conta neste dispositivo?"
      size="sm"
    >
      <div className="space-y-4 pt-2">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Ao sair, suas informações e lançamentos continuam seguros na sua conta da nuvem. Você poderá se autenticar novamente a qualquer momento com seu e-mail e senha.
        </p>
        <ModalFooter className="mt-4 pt-3 border-t border-border/80">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsSignOutModalOpen(false)}
            disabled={isSigningOut}
            className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={() => { void handleSignOut(); }}
            disabled={isSigningOut}
            className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer gap-1.5"
          >
            {isSigningOut ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                <span>Saindo…</span>
              </>
            ) : (
              <>
                <LogOut className="size-3.5" aria-hidden="true" />
                <span>Confirmar Saída</span>
              </>
            )}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
    ```

- [x] **Tarefa 3.4: Garantir que o Card de Exclusão Permaneça por Último**
  - **Arquivo:** `src/features/settings/components/tabs/account-tab.tsx`
  - Certificar-se de que `<DeleteAccountCard ... />` seja o **último elemento renderizado** dentro do `div.space-y-6`.

- [x] **Tarefa 3.5: Testes Automatizados da Aba Conta**
  - **Arquivo:** `src/features/settings/components/tabs/account-tab.test.tsx`
  - Adicionar testes:
    1. Renderiza o card "Sessão & Desconexão" com botão "Sair da Conta".
    2. Clicar no botão abre o modal de confirmação.
    3. Clicar em "Cancelar" fecha o modal sem chamar `signOut`.
    4. Clicar em "Confirmar Saída" chama `signOut()` e exibe o toast de sucesso.
    5. O card "Zona de Perigo" permanece como o último card.

### Portão de Qualidade da Fase 3
- [x] Executar: `npm run typecheck`
- [x] Executar: `npm run lint`
- [x] Executar: `npx vitest run src/features/settings/components/tabs/account-tab.test.tsx`
- [x] **Commit & Push da Fase 3:**
  ```bash
  git add src/features/settings/components/tabs/account-tab.tsx src/features/settings/components/tabs/account-tab.test.tsx
  git commit -m "feat(account): adiciona encerramento de sessao com confirmacao e isola exclusao no fim da aba"
  git push origin main
  ```

---

## FASE 4: Categorias Padrão Canônicas para Insights & Autonomia do Usuário

**Objetivo:** Consolidar a definição canônica das 11 categorias de partida no domínio TypeScript, garantindo que alimentem os motores semânticos de insights sem jamais realizar auto-injeção em contas já existentes.

### Checklist de Tarefas da Fase 4

- [ ] **Tarefa 4.1: Exportar `CANONICAL_DEFAULT_CATEGORIES` no Domínio**
  - **Arquivo:** `src/domain/budgets/index.ts`
  - Adicionar a estrutura tipada das 11 categorias padrão brasileiras:
    ```ts
    export interface DefaultCategorySeed {
      name: string;
      type: "expense" | "income";
      icon: string;
      color: string;
    }

    export const CANONICAL_DEFAULT_CATEGORIES: readonly DefaultCategorySeed[] = [
      // Despesas Essenciais (Necessidades 50%)
      { name: "Alimentação", type: "expense", icon: "alimentacao", color: "#DDA726" },
      { name: "Moradia", type: "expense", icon: "moradia", color: "#8B5CF6" },
      { name: "Transporte", type: "expense", icon: "transporte", color: "#3B82F6" },
      { name: "Saúde", type: "expense", icon: "saude", color: "#EF4444" },
      { name: "Educação", type: "expense", icon: "educacao", color: "#2A9D8F" },
      // Despesas de Estilo de Vida (Desejos 30% / Radar de Assinaturas)
      { name: "Lazer", type: "expense", icon: "lazer", color: "#EC4899" },
      { name: "Compras", type: "expense", icon: "compras", color: "#06B6D4" },
      { name: "Assinaturas", type: "expense", icon: "assinaturas", color: "#6366F1" },
      // Receitas
      { name: "Salário", type: "income", icon: "salario", color: "#10B981" },
      { name: "Investimentos", type: "income", icon: "investimentos", color: "#3B82F6" },
      { name: "Outras Rendas", type: "income", icon: "salario", color: "#8B5CF6" },
    ] as const;
    ```

- [ ] **Tarefa 4.2: Auditar `category-semantics.ts` contra as Categorias Canônicas**
  - **Arquivo:** `src/domain/insights/category-semantics.ts`
  - Validar que cada uma das 11 categorias padrão é resolvida com determinismo estrito:
    - `Alimentação` ➔ `isEssential: true`, `isAggregator: true`, `canonicalSlug: "alimentacao"`.
    - `Moradia` ➔ `isEssential: true`, `canonicalSlug: "moradia"`.
    - `Transporte` ➔ `isEssential: true`, `isAggregator: true`, `canonicalSlug: "transporte"`.
    - `Saúde` ➔ `isEssential: true`, `tier: "essential"` (protegido contra corte).
    - `Assinaturas` ➔ `isSubscriptionCategory: true`, `canonicalSlug: "assinaturas"`.
    - `Salário` / `Investimentos` ➔ `nature: "investment"` ou renda correspondente.

- [ ] **Tarefa 4.3: Certificar a Blindagem de Usuários Existentes**
  - **Verificação no Código:**
    - Assegurar que **NENHUM** hook (`useCategories`, `useIncomes`, `useTransactions`, etc.) faça chamada a `createCategory` ou `insert` de forma automática.
    - O banco de dados já cuida do seed no signup via trigger `handle_new_user()`.
    - Usuários antigos mantêm suas categorias intactas sem qualquer alteração.

- [ ] **Tarefa 4.4: Testes Automatizados no Domínio**
  - **Arquivo:** `src/domain/budgets/index.test.ts`
  - Adicionar testes verificando que `CANONICAL_DEFAULT_CATEGORIES` possui as 11 entradas e que casam com as regras de sugestão inteligente (`suggestCategory`).

### Portão de Qualidade da Fase 4
- [ ] Executar: `npm run typecheck`
- [ ] Executar: `npm run lint`
- [ ] Executar: `npx vitest run src/domain/budgets/index.test.ts src/domain/insights/category-semantics.test.ts`
- [ ] **Commit & Push da Fase 4:**
  ```bash
  git add src/domain/budgets/index.ts src/domain/budgets/index.test.ts
  git commit -m "feat(categories): consolida catalogo de categorias padrao canonicas integradas ao motor de insights"
  git push origin main
  ```

---

## FASE 5: Polimento de Acolhimento e Primeiro Acesso (FTUE)

**Objetivo:** Transmitir acolhimento no primeiro login sem sobrecarga cognitiva, destacando as categorias prontas e oferecendo atalho no checklist.

### Checklist de Tarefas da Fase 5

- [ ] **Tarefa 5.1: Mensagem Acolhedora no `WelcomeModal`**
  - **Arquivo:** `src/components/modules/welcome-modal.tsx`
  - Adicionar um aviso sutil no modal: *"Sua conta já inclui as 11 categorias essenciais organizadas (Alimentação, Moradia, Transporte, etc.) para você começar imediatamente."*

- [ ] **Tarefa 5.2: Testes de Onboarding**
  - **Arquivo:** `src/components/modules/welcome-modal.test.tsx`
  - Rodar: `npx vitest run src/components/modules/welcome-modal.test.tsx`

### Portão de Qualidade da Fase 5
- [ ] Executar: `npm run typecheck`
- [ ] Executar: `npm run lint`
- [ ] Executar: `npx vitest run src/components/modules/welcome-modal.test.tsx`
- [ ] **Commit & Push da Fase 5:**
  ```bash
  git add src/components/modules/welcome-modal.tsx src/components/modules/welcome-modal.test.tsx
  git commit -m "feat(onboarding): destaca categorias essenciais prontas no acolhimento de novos usuarios"
  git push origin main
  ```

---

## FASE 6: Auditoria Integrada, Build do APK & Notificação Executiva via ARGOS (Telegram)

**Objetivo:** Realizar auditoria transversal completa de todas as fases, correção imediata de bugs e fragilidades, compilação de produção web e APK Android, documentação, commit/push final e despacho do relatório executivo ao Telegram pelo bot ARGOS com parecer formal sobre migração no Supabase.

### Checklist de Tarefas da Fase 6

- [ ] **Tarefa 6.1: Varredura de Qualidade, Detecção e Correção de Bugs**
  - Executar: `npm run typecheck` (zero erros de tipagem estrita).
  - Executar: `npm run lint` (zero violações de ESLint, emojis ou controles nativos).
  - Executar suíte completa de testes: `npm run test`.
  - **Correção imediata**: Se for detectado qualquer bug, regressão visual ou fragilidade em mobile/desktop, aplicar a correção pontual e retestar até aprovação integral (100% verde).

- [ ] **Tarefa 6.2: Teste de Build Web e Build do APK Android**
  - **Build Web:**
    ```bash
    npm run build
    ```
    - Verificar ausência de chunks quebrados e integridade dos assets em `dist/`.
  - **Sincronização Capacitor & Build do APK:**
    ```bash
    npm run cap:sync
    npm run build:apk
    ```
    - Confirmar que o APK release assinado foi gerado com sucesso em `dist-apk/` ou `public/releases/`.

- [ ] **Tarefa 6.3: Atualização da Documentação Governamental**
  - Atualizar `docs/architecture/ESPECIFICACAO_TECNICA.md` consolidando a ordem oficial das abas e as diretrizes do tema padrão.
  - Marcar como concluídos os checklists em `docs/plans/PLANO_CONFIGURACOES_INICIAIS_E_EXPERIENCIA_NOVO_USUARIO.md`.

- [ ] **Tarefa 6.4: Commit & Push Final da Homologação**
  - Realizar commit atômico:
    ```bash
    git add .
    git commit -m "chore(release): homologa configuracoes iniciais categorias inteligentes e build apk"
    git push origin main
    ```

- [ ] **Tarefa 6.5: Despacho do Relatório Executivo ao Fundador via Bot ARGOS (Telegram)**
  - Enviar mensagem formatada via bot **ARGOS** (Telegram) reportando a conclusão de todos os trabalhos.
  - **Conteúdo Obrigatório da Notificação ARGOS:**
    1. **Status Geral:** Conclusão com sucesso de todas as 6 fases e aprovação nos Quality Gates.
    2. **Resumo das Entregas:**
       - Estado inicial padrão consolidado (Teal Vital Oficial + Dinâmico + recomendação OLED para Monocromático).
       - Abas de configurações reorganizadas (Aparência, Alertas, Segurança, App, Plano e Conta).
       - Card de Sessão na aba Conta com confirmação de logout seguro (`useSignOut`) e exclusão definitiva preservada no final da página (LGPD).
       - 11 categorias canônicas universais mapeadas no domínio e ativando os motores de insights.
       - Acolhimento aprimorado para novos usuários sem flash visual.
    3. **Status de Validação Técnica:**
       - Typecheck: 100% OK.
       - Lint: 100% OK (sem emojis e sem controles nativos).
       - Testes: 100% verdes.
       - Build Web & Build do APK Android: Concluído com sucesso.
    4. **Parecer de Migração Supabase:**
       - **AVISO CLARO: NÃO É NECESSÁRIA NENHUMA NOVA MIGRAÇÃO NO SUPABASE.**  
       - *Justificativa técnica*: A trigger de banco de dados `handle_new_user()` criada na migração `20260101000045_saas_asaas_and_default_categories.sql` já popula automaticamente as 11 categorias padrão no evento de cadastro de novos usuários. Como as alterações atuais foram de arquitetura de UI, domínio TypeScript e navegação, o banco de dados em produção já está 100% congruente, com zero risco de impacto ou downtime para os usuários existentes.
  - **Exemplo de Comando de Despacho (usando a API oficial do bot ARGOS via bash/curl):**
    ```bash
    # Exemplo utilizando o token do bot ARGOS e chat_id do fundador:
    curl -s -X POST "https://api.telegram.org/bot<ARGOS_BOT_TOKEN>/sendMessage" \
      -d "chat_id=<SEU_CHAT_ID>" \
      -d "parse_mode=HTML" \
      -d "text=<b>ARGOS: Relatório Executivo — Configurações Iniciais & Experiência de Usuários</b>%0A%0A<b>Status:</b> Concluído com Sucesso e Auditado.%0A%0A<b>Entregas:</b>%0A• Teal Vital padrão + Dinâmico + recomendação Monocromático OLED%0A• Abas de Configurações reordenadas (Aparência no início)%0A• Card de Sair da Conta com confirmação e exclusão no final%0A• 11 Categorias Canônicas no domínio integradas aos Insights%0A• Build Web e APK Android compilados com sucesso%0A%0A<b>Parecer Supabase:</b> NENHUMA nova migração necessária. O banco já está 100% preparado."
    ```

### Portão de Qualidade Final da Fase 6
- [ ] 100% dos testes passando sem alertas.
- [ ] Build Web e APK gerados com sucesso.
- [ ] Notificação Telegram entregue pelo bot ARGOS com o relatório executivo e parecer Supabase.
- [ ] Repositório sincronizado no GitHub (`git push origin main`).
