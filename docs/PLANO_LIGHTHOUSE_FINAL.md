# Plano mestre de encerramento da auditoria Lighthouse

## 1. Resumo executivo e estado atual

**Prioridade imediata:** confirmar a violação do beacon no Pages e decidir se a coleta deve continuar. **Prioridade de desempenho:** reduzir o tempo até a pintura do H1 em uma visita fria a `/`. Meta de homologação em mobile e desktop: 100 nas categorias Lighthouse aplicáveis, LCP < 2,5 s, CLS = 0, Acessibilidade e SEO = 100 e Navegação Agêntica 4/4.

| Evidência | Resultado | Uso na decisão |
|---|---|---|
| GET de produção em 26/11/2026 | HTTP 200. O HTML de `https://axir.com.br/` inclui `/assets/index-3IK9EHdE.js` e `https://static.cloudflareinsights.com/beacon.min.js/…`. O header CSP exclui essa origem de `script-src`. | Confirmar o desconto no JSON Lighthouse do deploy. A inspeção HTTP prova a incompatibilidade. |
| Artefato local, workspace em `main`, HEAD `8a877af4` com alterações locais | `dist/index.html:282–286` referencia `dist/assets/index-BsdgcXsL.js`, `dist/assets/vendor-react-DaePAUms.js` e `dist/assets/index-CPwLVX-L.css`. O beacon está ausente. | Comparar base e candidato gerados da mesma revisão e das mesmas alterações locais. Os hashes publicados e locais divergem. |
| Relatório informado pelo usuário | ~25 KiB de JS não usado, bloqueio estimado de ~70 ms desktop e ~290 ms mobile, 2–3 tarefas longas. | Oportunidades estimadas. Falta o trace dessa execução para atribuir tempo a funções. |
| Lighthouse 13.6.0 local das Fases 1 e 2, 4G lento | Performance 58, FCP 2,21 s, LCP 6,52 s, TBT 460 ms, CLS 0. Práticas Recomendadas, Acessibilidade e SEO 100. Categoria agêntica 98 nessa versão. | O H1 consumiu ~6,51 s de atraso de renderização. Registrar versão e rubrica agêntica em cada comparação. O 98 histórico e o requisito 4/4 pertencem a rubricas distintas. |
| Auditoria anterior do artefato local sem throttling | H1 como LCP a 1280 × 800 e 390 × 844, respectivamente 1,09 s e 2,14 s. No segundo perfil, tarefas de 53 e 129 ms antes do H1. | Identifica o elemento e a ordem dos eventos. A duração de uma tarefa isolada não determina TBT. |

Histórico preservado em [Plano das Fases 1 e 2](plans/completed/PLANO_LIGHTHOUSE_FASES_1_E_2.md). A separação dos provedores, o carregamento por proximidade do simulador e o precache do grafo público já foram entregues.

## 2. Fase 0 — Resultados da meta-análise

| Verificação no código e no artefato | Consequência para a implementação |
|---|---|
| `public/_headers:2,15,19` contém três CSPs. `dist/_headers` é idêntico. O SHA-256 recalculado sobre o conteúdo exato do script de tema em `dist/index.html:152` coincide com as três políticas. | Preservar o script e o hash. Decisão de produto pendente: manter ou desligar Analytics. |
| `src/main.tsx:39` usa `createRoot`. O HTML contém splash e `#root` vazio em `dist/index.html:312`. O H1 está em `src/features/landing/components/hero-editorial.tsx:29`. `src/app/router.tsx:54,195,223` decide o ramo e monta a landing lazy. | Medir o intervalo entre a entrada e a descoberta de `dist/assets/landing-page-BGKJMdL1.js`. Antecipar dentro do mesmo render, imediatamente antes do lazy, tem janela de ganho mínima. |
| `src/features/landing/hooks/use-scroll-spy.ts:101–109,131–144` mede o intervalo duas vezes na inicialização síncrona. O scroll usa cache com ResizeObserver. A varredura de seções na linha 124 é fallback de IntersectionObserver. | Reutilizar a inicialização já feita por `handleResize()`. Isso preserva a correção no primeiro frame mesmo quando a página abre rolada. Duas leituras não comprovam dois reflows. |
| `dist/assets/dist-DyISSMXU.js` contém `getComputedStyle` em `usePresence`. `src/features/landing/components/faq-section.tsx:86` abre a primeira pergunta por padrão. O trace histórico atribuiu ~315 ms de estilo/layout a uma tarefa de ~402 ms. | O nome do chunk React indica o contexto de execução. Atribuição do custo ao FAQ requer stack e comparação no build candidato. |
| Seis linhas do relatório histórico apontam `.animate-shimmer` e `background-position-x`. `src/features/landing/components/deferred-wealth-simulator.tsx:24,49` usa SkeletonChart com altura reservada. `src/components/ui/skeleton.test.tsx:42` verifica seis blocos. | Preservar o marcador de classe no elemento e mover somente a animação para o pseudo-elemento. Vários testes e telas compartilham esse primitivo. |
| `index.html:137–138` já fornece os dois preloads. O Vite resolve ambos para URLs com hash em `dist/index.html:137–138`. `vite.config.ts:36–47` acrescenta o segundo par nas linhas 285–286 do build. | Eliminar apenas a transformação redundante do HTML. O coletor de imports para o precache no mesmo plugin continua necessário. |

**Pré-requisitos técnicos:** confirmar Issues no Pages, registrar cinco medições frias da base por perfil, identificar o iniciador do chunk da landing e capturar o chamador dos reflows. A escolha de Analytics cabe ao produto. A intervenção no FAQ e a permanência do carregamento antecipado dependem dos resultados das medições.

## 3. Bloco 1 — Bloqueadores reais de nota

### 3.1 Práticas Recomendadas — Cloudflare Web Analytics e CSP

- [ ] Abrir janela anônima sem extensões. Antes de navegar a `/`, abrir DevTools, marcar *Network → Disable cache* e habilitar *Preserve log*. Na resposta **Document**, conferir o HTML, o hash da entrada publicada e o header efetivo.
- [ ] Filtrar `beacon.min.js`. Conferir `(blocked:csp)`, a mensagem do Console e *Issues → Content Security Policy*, incluindo URL e diretiva efetiva (`script-src-elem` com fallback para `script-src`). Conferir `errors-in-console` e `inspector-issues` no JSON da mesma execução. Investigar separadamente qualquer outra entrada com URL, status e iniciador.
- [ ] **Opção A — coleta dispensável.** Desativar a injeção automática de Web Analytics no projeto Cloudflare Pages. Registrar o estado anterior para reversão. Aceitar quando uma resposta nova do Pages deixar de incluir o script e a violação desaparecer. Zero mudança de código.
- [ ] **Opção B — manter coleta.** Em `public/_headers:2,15,19`, permitir a origem exata `https://static.cloudflareinsights.com` em `script-src` da política global e das substituições de `/assinatura` e `/assinatura/*` onde ocorre a injeção. Preservar as remoções de header nas linhas 14 e 18, Turnstile e as restrições adicionais do checkout. Preservar literalmente `sha256-bokVdDALSzUA7BYUpF9PdUoP1HPxpfcNve83Nyw4xZQ=`. No preview com beacon ativo, identificar o POST real de coleta. Manter `connect-src 'self'` entre as permissões existentes se o destino for a própria origem. Acrescentar somente a origem exata necessária se a coleta for externa. Validar carregamento do script e resposta da coleta em navegação direta nas três políticas.
- [ ] Reexecutar os dois audits no domínio com a configuração escolhida. Um preview sem injeção automática só valida o app e seus headers.

### 3.2 Desempenho — antecipar o módulo da landing

- [ ] No waterfall frio, identificar entrada → avaliação do roteador → início do download da landing → commit → LCP. Se o intervalo antes do download for menor que a variabilidade do LCP e insuficiente para o limiar abaixo, encerrar o experimento na medição.
- [ ] Em `src/app/router.tsx:54`, extrair o import dinâmico em um loader compartilhado que memoize a promessa no formato esperado por `lazy`. Para o primeiro boot, chamar o aquecimento por uma entrada explícita antes de `createRoot` em `src/main.tsx:39`, protegida pelo mesmo `isAnonymousHome(window.location.pathname)`. Preservar a nova avaliação de sessão nas navegações e o caminho lazy normal nas demais rotas. Tratar rejeição especulativa, liberar a promessa rejeitada para nova tentativa e respeitar a recuperação de chunks do Vite.
- [ ] **Regra de decisão proposta:** manter se o chunk começar mais cedo e a mediana do LCP mobile cair pelo menos 100 ms **e** mais que o desvio absoluto mediano da base, com cinco rodadas por variante. Exigir desktop sem piora além da variação da base. Reverter isoladamente se o ganho for residual, se TBT piorar de forma repetível ou se o caminho autenticado/nativo requisitar o chunk por antecipação.

### 3.3 Desempenho — reflow e tarefas longas

- [ ] Em `src/features/landing/hooks/use-scroll-spy.ts:102`, inicializar a variável de cache sem medir. Deixar `handleResize()` fazer a primeira leitura e configurar os observers. Preservar resize, listener passivo, rAF, fallback sem observers e desmontagem. Cobrir página curta, posição restaurada e mudança de altura. Comparar *Forced reflow* antes/depois.
- [ ] Para Radix, gravar uma navegação fria em *Performance → Main → Bottom-up*. Selecionar a tarefa anterior ao LCP, expandir *Recalculate Style/Layout*, conferir o chamador em *Call tree* e identificar o consumidor pelo nó/stack. Correlacionar a tarefa com a janela de TBT e o marcador do H1.
- [ ] **Só se houver custo material reproduzível do FAQ**, testar adiar o trabalho específico do consumidor. Preservar `#faq`, perguntas, primeiro conteúdo expandido, foco/teclado, semântica e altura em todos os breakpoints. Manter Radix e a implementação atual se não for possível demonstrar ganho sem regressão. Aplicar o mesmo critério caso o trace indique outro consumidor.

## 4. Bloco 2 — Melhorias de fluidez, GPU e limpeza

| Alteração isolada | Implementação e aceite |
|---|---|
| Shimmer do skeleton | Em `src/components/ui/skeleton-base.tsx:9` e `src/styles/globals.css:109,226`, manter dimensões, raio, `aria-hidden` e classe no host. Recortar um `::before` absoluto, sem eventos, com o gradiente de 110°, mesmas cores, paradas, repetição e escala. Animar somente `transform: translateX(...)` na camada, por 1,6 s com o mesmo easing e percurso visual. Comparar início, meio e fim do ciclo. As regras de movimento reduzido nas linhas 456 e 691 já abrangem pseudo-elementos. Estender a regra eco da linha 681 a `.animate-shimmer::before`. Confirmar os seis nós do simulador, claro/escuro/OLED e skeletons em telas autenticadas. |
| Barra de leitura | Em `src/features/landing/components/landing-header.tsx:213–220`, manter altura, posição e semântica da progressbar. Usar largura 100%, origem à esquerda, `scaleX(scrollProgress / 100)` e transição exclusiva de transform por 75 ms com o easing atual. Conferir 0%, 50%, 100%, resize e `aria-valuenow`. |
| Fontes | Conservar `index.html:137–138` com `crossorigin` e remover somente a reinjeção em `vite.config.ts:36–47`. Preservar `font-display: optional` em `src/styles/fonts.css:5,13`. Conferir no build e em Network um preload e uma requisição para cada uma de Inter e Sora. Confirmar precache na atualização do worker. Benefício esperado de manutenção. |
| Polimento facultativo | Em `src/features/landing/components/hero-dashboard-mockup.tsx:211–213`, as barras de 35%, 20% e 14% são estáticas. Remover `transition-all` apenas se já estiver trabalhando nesse trecho. O sétimo alerta histórico mencionou `visibility` no reveal do mockup (linha 58). `src/features/landing/components/scroll-reveal.tsx:59` já restringe a transição. Manter o reveal e o efeito de blur do header salvo evidência atual de custo. |

## 5. Bloco 3 — Escopo explicitamente descartado

| Não fazer | Justificativa |
|---|---|
| Fragmentar novamente o vendor React pelos ~25 KiB | Coverage é específica da visita. O trace histórico atribuiu 26.396 bytes ao vendor. O maior custo observado na tarefa principal foi layout. |
| Tornar o CSS global assíncrono | `dist/assets/index-CPwLVX-L.css` tem 227.173 bytes, cerca de 30 KiB gzip. Define geometria e tipografia da dobra. A economia estimada de bloqueio não compensa o risco de FOUC e CLS. |
| Adicionar preloads de fontes | Sora e Inter já são descobertas no HTML antes da folha externa. Mais preloads competem com o código do primeiro paint. |
| Virtualizar ou cortar o DOM editorial | A auditoria local anterior contou 1.571 elementos totais e 142 descendentes na primeira seção. O volume total por si só não localiza custo. Preservar títulos, texto, âncoras, FAQ e destinos agênticos. |
| Alterar SW, splash ou pré-renderizar a landing incondicionalmente em `/` | O LCP final é o H1. A raiz também atende sessão autenticada e app nativo. Manter registro em `src/app/pwa.ts:647`, atualização segura, instalação e App Shell offline. |

## 6. Ordem de execução, riscos e critérios de aceite

**Classificação da execução futura: Fluxo Completo (Plano).** Implementar em branch de trabalho e usar preview para homologação. Esta entrega registra somente o plano.

| Etapa | Unidade de entrega e reversão |
|---|---|
| 1 | Capturar base e traces. Registrar URL, revisão, hashes, Chrome/Lighthouse, viewport, throttling, versão do SW e configuração de Analytics. |
| 2 | Aplicar **uma** opção de Analytics. Na A, reversão pelo painel. Na B, um commit de headers e testes, conferindo cada política. |
| 3 | Um commit para o carregamento antecipado. Medir isoladamente. Manter ou reverter antes de combinar resultados. |
| 4 | Um commit para a leitura duplicada de scroll. Abrir um experimento separado para o consumidor Radix somente se a stack o justificar. |
| 5 | Separar shimmer, barra de leitura e limpeza de preloads em commits independentes. Priorizar somente após os gates de LCP e CSP. |
| 6 | Homologar o conjunto. No fechamento efetivo do plano, aplicar os gates de release do repositório, atualizar versão minor e roadmap e arquivar o plano concluído. |

**Comandos no candidato de implementação**, na raiz do projeto. O build deve preceder a auditoria de PWA, que também inspeciona o artefato emitido.

```bash
npm run typecheck
npm run build
npm exec -- vitest run src/tests/security-headers.test.ts src/tests/pwa-audit.test.ts
npm exec -- vitest run src/app/router.test.tsx src/features/landing/hooks/use-scroll-spy.test.ts src/components/ui/skeleton.test.tsx
npm run verify:full
```

**Checklist manual no preview e após deploy**

- [ ] Abrir diretamente `/`, `/assinatura` e uma subrota real de checkout em aba anônima. Conferir resposta Document, Console, Network e Issues. Confirmar a opção de Analytics e ausência de 4xx/5xx ou bloqueios inesperados. Preservar funcionamento do Turnstile.
- [ ] Rodar **cinco navegações frias por perfil e por variante**, mobile e desktop, com mesma versão, throttling e rede. Limpar armazenamento, caches e registro do worker entre rodadas. Manter o registro normal do PWA durante a visita. Salvar JSON e trace, comparar medianas e dispersão de LCP, FCP, TBT e notas. Conferir H1, requisição da landing e stacks pré-LCP.
- [ ] Exigir LCP mediano < 2,5 s por perfil, CLS = 0 em cada rodada, Acessibilidade 100, SEO 100 e Navegação Agêntica 4/4 na rubrica informada. Conferir notas 100 nas demais categorias aplicáveis e registrar qualquer distância até a meta, mesmo se um experimento isolado for benéfico.
- [ ] Conferir claro/escuro/OLED em celular e desktop, com movimento normal, reduzido e eco. Verificar foco, teclado, link de salto, âncoras, primeiro item do FAQ e progresso da leitura. Comparar a dobra durante a chegada da fonte.
- [ ] Com contas de teste, abrir `/` já autenticado, navegar, sair e entrar com outra conta. Verificar painel correto, isolamento dos dados e ausência de flash ou preload especulativo da landing no boot autenticado. Repetir a entrada no app nativo e conferir splash e navegação.
- [ ] Testar instalação, abrir em standalone, atualizar entre duas versões e verificar que uma edição ativa sobrevive. Após uma carga online completa, reabrir offline e conferir App Shell/fallback; restaurar a rede e validar navegação e nova sessão. Confirmar catálogos, ARD, sitemap e llms com o SW ativo.
