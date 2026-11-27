# Plano mestre de multiconta e isolamento de sessões

> **Classificação:** Fluxo Completo (Feature / Plano), com bump MINOR na entrega da funcionalidade.
> **Status:** arquitetura definida e plano pronto para execução a partir de T00. Implementação, provisionamento e homologação pendentes.
> **Escopo:** Web, PWA e Android Pro. React/Vite, Cloudflare Pages + Worker/Durable Objects e Supabase Auth/Postgres com RLS.
> **Execução:** seguir as dependências e os critérios de saída da seção 5. Usar as políticas da seção 3 e a [especificação técnica](../architecture/ESPECIFICACAO_TECNICA.md) como contrato.

## 1. Objetivo e limites de segurança

Permitir que até cinco contas comuns em um dispositivo pessoal sejam lembradas e que contas comuns já conectadas possam alternar com um clique dentro da janela de confiança, respeitando a trava da conta de destino. Abas diferentes podem operar contas diferentes sem trocar involuntariamente a identidade ou interromper a sessão da outra aba. O produto mantém o princípio Online First e a autorização por usuário e por recurso no servidor.

A aba define **qual conta a interface está usando**. A origem do navegador define **quais scripts têm acesso aos dados do navegador**. Chaves diferentes em `localStorage` ou `sessionStorage` organizam o estado, mas qualquer JavaScript executado na mesma origem pode acessar o armazenamento disponível naquele contexto. Um script comprometido também pode atuar em nome da sessão acessível à página. PIN e biometria local protegem contra acesso físico casual e trocas acidentais. Elevação administrativa exige autenticação comprovada pelo servidor.

### Modelo de ameaças

- Acesso entre contas por troca de aba, troca de contexto durante gravação, callback tardio, cache partilhado ou restauração da página pelo navegador.
- Roubo e reuso de sessão por XSS, dependência comprometida, terminal compartilhado, backup do Android ou cópia do perfil do navegador.
- Tomada de conta por recuperação de senha, callback de login no contexto errado, tentativa automatizada, reuso de autenticação antiga ou sessão revogada.
- Leitura e escrita fora do escopo por RLS, RPC, Edge Function, compartilhamento público, exportação, importação, fila ou canal Realtime.
- Vazamento de e-mail, identidade administrativa ou informações financeiras por URL, telemetria, clipboard, OCR, push, tela bloqueada ou histórico.
- Indisponibilidade e perda de integridade por rotação de refresh token concorrente, storage bloqueado, rede intermitente, deploy misto ou rollback.

O objetivo é impedir troca indevida de identidade, limitar o alcance de credenciais expostas e reduzir o tempo de contenção. Um dispositivo totalmente comprometido ainda pode expor operações e dados que o usuário acessa nele.

## 2. Auditoria do estado atual e do desenho anterior

Os achados de código abaixo foram observados no checkout. O impacto em produção depende da versão implantada e das configurações efetivas. Os riscos do desenho anterior descrevem o que seria introduzido pela implementação.

| ID | Prioridade | Origem | Evidência e impacto |
|---|---|---|---|
| S01 | Alta | Desenho anterior | Slots com access e refresh tokens em `localStorage`, inclusive para administradores, multiplicariam as credenciais recuperáveis por um script da mesma origem. A trava do alternador não restringe o uso direto dessas credenciais. A SPA atual já persiste uma sessão no storage padrão. [Cliente Supabase](../../src/data/client.ts#L56) |
| S02 | Alta | Código atual | O guarda administrativo depende do estado de MFA do cliente. A função `is_admin()` usada em políticas e RPCs verifica papel e status, sem exigir AAL2. Operações selecionadas de superadmin já exigem fator verificado e AAL2. Falta demonstrar cobertura uniforme de MFA, sessão ativa e reautenticação recente nos acessos privilegiados. [Guarda](../../src/components/routing/require-admin-session.tsx#L13) · [Função de autorização](../../supabase/migrations/20260101000028_access_control_and_feature_flags.sql#L111) · [Proteção de superadmin](../../supabase/migrations/20260101000164_wave1_security_rls_and_restore_hardening.sql#L145) |
| S03 | Alta | Código atual | A ação administrativa `revoke_sessions` fornece o UUID do usuário a `auth.admin.signOut`, cuja assinatura instalada recebe o JWT da sessão. O fluxo não demonstra a revogação pretendida. Deve ser tratado como falha de contenção até validação com uma conta sintética. [Edge Function](../../supabase/functions/admin-super-action/index.ts#L291) |
| S04 | Alta | Código atual e desenho anterior | A revogação por aparelho associa um `auth_session_id` a cada par usuário/aparelho e admite fallback para sinalização via Realtime quando a remoção em `auth.sessions` falha. O registro pode atualizar essa associação e limpar a marca de revogação. O desenho anterior pressupunha que `setSession` por si só confirmaria que a sessão está vigente. Um JWT pode continuar válido até `exp`, e uma segunda sessão do mesmo usuário no mesmo aparelho pode sobrescrever o vínculo. [Registro e revogação](../../supabase/migrations/20260101000152_session_devices_lifecycle_hardening.sql#L26) · [Sincronização atual](../../src/hooks/use-device-session-sync.ts#L67) · [Supabase Auth Sessions](https://supabase.com/docs/guides/auth/sessions) |
| S05 | Alta | Código atual e desenho anterior | A opção Computador compartilhado grava uma flag de aba; o cliente ainda usa persistência padrão e a leitura da flag assume modo pessoal em caso de falha. Com sessão anterior lembrada, inicialização ou restauração de aba pode abrir o contexto errado. [Login](../../src/features/auth/hooks/use-login-form.ts#L119) · [Política de sessão](../../src/services/session-policy.ts#L41) · [Cliente Supabase](../../src/data/client.ts#L56) |
| S06 | Alta | Código atual e desenho anterior | O singleton de autenticação, o ID ativo global e limpezas assíncronas sem coordenação são incompatíveis com um adaptador cujo destino muda durante uma operação. Limpar caches não cancela escritas já aceitas. Logout remove chaves amplamente, e exclusão limpa todo o storage da origem. [Estado ativo](../../src/services/user-storage.ts#L7) · [Teardown](../../src/services/auth-cleanup.ts#L22) · [Logout](../../src/hooks/use-sign-out.ts#L35) · [Exclusão](../../src/features/settings/components/tabs/delete-account-card.tsx#L56) |
| S07 | Alta | Código atual e desenho anterior | Web Push e FCM registram o mesmo endpoint ou token por usuário. O dispatcher consulta assinaturas ativas por usuário e o service worker pode apresentar o payload sem aba aberta e encaminhar o clique para a primeira janela da origem. Reassociar por aba ou no fim de um logout não evita entregas já enfileiradas, listeners concorrentes ou conteúdo na tela bloqueada. [Registro](../../src/data/repositories/push-subscriptions.ts#L44) · [Dispatcher](../../supabase/functions/push-dispatcher/index.ts#L533) · [Service worker](../../public/sw-push.js#L53) |
| S08 | Alta | Código atual | O superadmin pode obter links portadores de credencial de ativação ou recuperação. Existem fluxos de cópia para clipboard e encaminhamento de ativação. A exposição depende de quem recebe o link e dos controles do canal. Exclusão e restauração também precisam de verificação de reautenticação no servidor, pois a confirmação da UI é local. [Recuperação administrativa](../../supabase/functions/admin-super-action/index.ts#L252) · [Ativação](../../src/features/admin/components/user-create-dialog.tsx#L73) · [RPC de exclusão](../../supabase/migrations/20260101000153_harden_billing_rls_pii_and_lifecycle.sql#L569) · [RPC de restauração](../../supabase/migrations/20260101000164_wave1_security_rls_and_restore_hardening.sql#L567) |
| S09 | Média | Código atual e desenho anterior | A lista planejada persiste nome, e-mail e indicador de admin e transporta e-mail/ID por URL. A sanitização atual cobre padrões conhecidos, mas não inclui explicitamente várias chaves de credenciais de Auth nem configura filtragem equivalente das transações de tracing. Histórico e outros coletores ficam fora do `beforeSend`. [Observabilidade](../../src/services/observability.ts#L24) |
| S10 | Média, alta com persistência sensível | Código atual | O manifesto Android permite backup. O efeito depende da versão do Android, do fabricante e das regras de extração. É preciso validar backup e transferência de aparelho antes de persistir mais contas no WebView ou no armazenamento nativo. [Manifesto Android](../../android/app/src/main/AndroidManifest.xml#L5) |
| S11 | Média | Código atual | Há CSP, HSTS, proteção contra framing e cache PWA voltado a recursos estáticos. A CSP global admite scripts/workers de OCR externos e conexões amplas, o que aumenta o impacto de uma dependência comprometida. Ambientes, SW em versões antigas e configuração de autenticação Cloud exigem evidência própria. [Cabeçalhos](../../public/_headers#L1) · [Cache PWA](../../vite.config.ts#L90) · [Configuração local do Auth](../../supabase/config.toml#L155) |

Controles a preservar incluem PKCE, rotação de refresh tokens, checagem de status no servidor, RLS por `auth.uid()`, proteção AAL2 em operações selecionadas de superadmin, hardening de compartilhamentos, idempotência de faturamento e sanitização de erros. A RPC de bootstrap filtra a conta pelo `auth.uid()`. A auditoria prévia de remediação é evidência histórica. Confirmar o catálogo e a implantação efetiva antes de tomar suas contagens como garantia atual. [Bootstrap](../../supabase/migrations/20260101000168_session_bootstrap_rpc.sql) · [Governança](../operations/SECURITY_GOVERNANCE.md) · [Auditoria anterior](../security-audit/REMEDIACAO_AUDITORIA_V3_30.md)

## 3. Arquitetura definida

### 3.1 Produtos, plataformas e fronteiras

| Superfície | Comportamento da primeira entrega |
|---|---|
| Web e PWA em dispositivo pessoal | Até cinco contas comuns no dispositivo, contando conectadas e lembradas. Troca explícita na aba em um clique para uma sessão vigente e dentro da janela de confiança. PIN/biometria da conta destino é uma trava local adicional, quando configurada. Aba nova começa em tela neutra; “Abrir em nova aba” transmite preferência de destino por intenção de uso único. |
| Portal administrativo | Origem dedicada `admin.axir.com.br`, com implantação, chaves, cookie, CSP e armazenamento próprios. O alternador oferece apenas “Portal administrativo”, sem listar operadores. Papel ativo e AAL2 obrigatórios para toda superfície privilegiada. Operações sensíveis exigem prova recente e de uso único. URLs administrativas legadas encaminham apenas para destinos conhecidos no portal novo quando ele estiver homologado. |
| Computador compartilhado | Sessão efêmera selecionada antes do bootstrap, sem restauração, lista lembrada, push, agendamento local ou acesso ao contexto pessoal. Logout por inatividade de no máximo 30 minutos. Falha de storage mantém o modo efêmero. Recarga exige autenticação. |
| Android Pro | Mesmo serviço de sessão, com transporte e custódia nativos. Disponibilidade controlada por plataforma e versão homologada. Portal administrativo acessível pelo navegador externo. |
| Web Push, FCM e lembretes locais | Multiconta inicia com esses canais desativados. Só são habilitados por plataforma quando T07 comprovar vínculo único, consentimento, tratamento de entregas antigas e ausência de dados sensíveis no sistema operacional. Notificações internas permanecem no Notification Hub. |

A custódia no servidor substitui a proposta de slots de tokens no navegador e requer mudanças em infraestrutura e autorização. As regras financeiras, a propriedade das linhas no Postgres e o modelo Online First são restrições de implementação. O plano separa a entrega do portal, a implantação do transporte de sessões, a liberação do alternador e a ativação por plataforma. Se uma plataforma falhar na homologação, ela permanece com o alternador desligado até passar pelos mesmos critérios.

### 3.2 Web/PWA e autorização de dados

- **Implantação.** Cloudflare Pages continua entregando os assets. Um Cloudflare Worker recebe `/api/sessions/v1/*` e `/api/data/v1/*` na mesma origem da interface. Cada ambiente e a origem administrativa têm bindings, chaves e namespaces de Durable Objects separados. Desabilitar rotas públicas alternativas do Worker e validar hosts no runtime. Prévia usa projeto Supabase isolado e contas sintéticas. Nenhuma chamada privada deve ser atendida pelo fallback estático da SPA.
- **Custódia.** Um Durable Object por instalação coordena a admissão de contas, transições e tentativas de renovação dessa instalação. Cada sessão upstream pertence a uma única instalação e pode ter vários contextos de aba nela. Identificadores de instalação, sessão local e contexto são opacos e de alta entropia. Tokens Supabase ficam cifrados com AES-GCM e chave versionada provisionada como segredo do Worker. A rotação aceita leitura com a chave anterior durante a migração e só escreve com a chave corrente. Expurgar segredos ao revogar ou expirar. A chave pública do Supabase pode ser usada para criar o cliente servidor autenticado pelo JWT do titular. Chaves privilegiadas ficam em rotinas específicas.
- **Vínculo com a aba.** Usar cookie opaco `__Host-axir_session`, com `Secure`, `HttpOnly`, `Path=/` e `SameSite=Lax`. Cada contexto comum guarda em `sessionStorage` apenas referência opaca vinculada à instalação, conta, sessão e geração. O cookie sozinho autoriza fluxos mínimos de bootstrap e autenticação conforme a política da rota. Chamadas privadas também exigem contexto vigente e, para escritas, token CSRF vinculado ao contexto e validação exata de `Origin`. A origem administrativa usa nome de cookie e vínculo próprios. Verificar que cookies, referências e provas de um ambiente não são aceitos em outro.
- **Modo efêmero.** Login em computador compartilhado usa fluxo explícito e contexto separado mantido em memória. O backend identifica endpoint e modo antes de ler qualquer sessão pessoal. A referência efêmera indispensável às chamadas privadas é destruída na recarga e vinculada ao fluxo autenticado. Cookies pessoais remanescentes não restauram uma conta nesse fluxo. O retorno de e-mail/PKCE em computador compartilhado pode confirmar o evento e pedir login novo após a navegação. Cancelamento de login adicional não troca a sessão anterior.
- **Operações.** Definir catálogo de operações nomeadas com schemas Zod, classe de acesso e limite por operação. O Worker valida o contexto, seleciona o JWT da conta vinculada e executa a operação sob RLS. Proibir destino, tabela, RPC ou headers upstream livres definidos pela SPA. Mutação composta usa RPC transacional. Cada resposta privada usa `Cache-Control: no-store`; service worker e CDN excluem APIs e callbacks privados. O cliente recebe apenas dados de domínio, metadados mínimos e códigos de erro.
- **Realtime.** Na primeira entrega, visões migradas usam invalidação após mutação, revalidação no foco e polling só onde a paridade funcional exigir. Para estado de revogação em aba visível, consultar a cada 15 segundos, além do foco e antes de renderizar após restauração. A autorização do Worker ocorre em toda chamada privada. Transporte Realtime mediado fica para uma entrega própria com testes equivalentes. Nenhuma visão migrada conecta canal privado diretamente com JWT do usuário.
- **Administração.** Separar o build administrativo no Vite e bloquear execução de scripts externos dispensáveis e registro de service worker nessa origem. Vincular a sessão administrativa a uma concessão curta registrada no Postgres por operação interna autenticada do portal, com identidade e `session_id` validados no servidor. Guards de UI espelham a decisão; RPCs, Edge Functions e RLS privilegiam somente papel ativo, AAL2 e vínculo vigente. Ao suspender, rebaixar ou revogar, o servidor recusa a próxima operação, inclusive por acesso direto a superfícies legadas. Em ações destrutivas, comprovar desafio novo vinculado à operação e consumido sob controle do servidor. Renovar JWT ou ler `iat` não satisfaz prova de reautenticação.

### 3.3 Android Pro

O APK continua servindo assets locais do Capacitor. O plugin nativo chama apenas hosts, rotas e operações definidos para a versão. A WebView recebe resultados e erros tipados, com custódia de referência de instalação e sessão no cliente HTTP nativo. Autorizações nativas usam credencial Axir opaca de audiência Android, em transporte próprio, com persistência cifrada via Keystore quando escolhida. Cookies web e tokens Supabase ficam fora dessa interface. Login e recuperação usam App Links HTTPS verificados e PKCE, com estado vinculado à instalação. Validar backup, regras de migração de dispositivo, restauração, perda de chave, suspensão, morte de processo e bloqueio. Falha de Keystore encerra o contexto e exige login. O menu de operador abre o navegador externo.

### 3.4 Valores iniciais e semântica de sessão

| Política | Valor inicial a homologar em T02 |
|---|---|
| Contas por instalação pessoal | 5, com inserção atômica. Contas administrativas têm inventário independente. |
| Confiança pessoal para retomada ou troca | Até 7 dias desde prova de autenticação, com duração absoluta de até 30 dias para o registro de sessão. Ao vencer a confiança, pedir login novo antes de reativar ou trocar. |
| Conta lembrada sem sessão | Consentimento explícito, e-mail mascarado quando exibido e expurgo após 30 dias sem uso ou ao selecionar “Esquecer conta”. |
| Aba compartilhada | Máximo de 30 min de inatividade e 8 h absolutas. O limite mais curto prevalece. |
| Operador | Máximo de 30 min de inatividade e 8 h absolutas. Desafio sensível tem validade de 5 min, com uso único e vínculo à operação. |
| Intenções | 60 segundos para abrir em nova aba, 10 minutos para intenção de login PKCE. Validade dos códigos do provedor continua independente. |
| Revogação | Próxima requisição privada após confirmação de revogação deve falhar. Aba em primeiro plano exibe bloqueio em até 30 segundos. Medir JWT residual no acesso direto e aplicar controle server-side obrigatório para superfícies privilegiadas, financeiras e sensíveis alcançadas pelo rollout. |

Cada documento recebe vínculo próprio na memória. Após recarga, duplicação ou restauração que perde esse vínculo, uma referência persistida pode identificar somente a última conta da aba para confirmação em tela neutra. O bootstrap revalida sessão e gera um contexto independente antes de montar dados. Uma intenção “Abrir em nova aba” de uso único também pode resolver essa escolha. Contexto vencido exige nova autorização. Mudança nos valores de segurança passa por T02 com justificativa registrada e atualização dos testes.

## 4. Contratos de segurança da implementação

### 4.1 Login, troca, renovação e logout

1. Separar autenticação pendente de sessão ativa. Login para adicionar conta e recuperação usam contexto iniciado para aquela finalidade, com PKCE e callback de uso único vinculado à intenção, origem, conta quando conhecida e validade. Tratar falhas de rede na resolução de MFA de forma fechada. Fator inexistente e erro de consulta são estados distintos.
2. Fixar a identidade de um contexto ativo como `userId + session_id + geração`. Serializar o ciclo de vida por sessão, incluindo refresh e logout. O mesmo cliente/adapter conserva a chave durante toda a vida. Na versão instalada, o SDK usa `storageKey` para BroadcastChannel, lock quando configurado e verificador PKCE. Um namespace que muda durante a vida do cliente pode misturar esses fluxos. Se o lock da plataforma estiver indisponível, usar o coordenador do servidor ou pedir nova autenticação. Evitar renovação concorrente sem coordenação. Usar revisão monotônica e invalidação explícita; relógio ou expiração do token não estabelecem ordem suficiente.
3. Ao solicitar a troca, bloquear navegação/ações do destino até verificar sua identidade e cumprir MFA e AppLock exigíveis. Se o usuário cancelar ou houver falha antes da confirmação, manter a conta anterior. Ao confirmar, desativar a geração antiga antes de ativar a nova. Se ocorrer falha após desativação, retornar à conta anterior apenas após revalidação; se indisponível, ir ao estado neutro com reautenticação.
4. Cancelar consultas onde possível, remover subscriptions e isolar cliente, cache, stores e callbacks por contexto. Requisição iniciada deve manter credencial e identidade de origem até terminar, inclusive em mutações com múltiplas etapas. Invalidar resultados tardios antes de afetar UI, cache, arquivos, push ou a próxima sessão. Mudanças com efeito no servidor precisam preservar idempotência e resultado observável para a conta que iniciou a ação.
5. Distinguir **fechar contexto da aba**, **sair da sessão desta conta no dispositivo**, **esquecer conta**, **sair das contas do dispositivo**, **revogar outras sessões desta conta** e **revogar todas as sessões desta conta**. O SDK aceita `local`, `others` e `global` para uma conta; lote do dispositivo é orquestração do aplicativo. Para todas as sessões vinculadas ao mesmo dispositivo, estabelecer e testar a semântica por `session_id`. Em falha de rede, bloquear localmente de imediato, registrar revogação pendente sem reter tokens legíveis e distinguir resultado remoto confirmado de incompleto. Eventos de revogação, logout e exclusão são idempotentes e impedem que refresh pendente restaure o contexto.
6. Tratar `user_devices` como inventário e Realtime como sinal auxiliar. Verificar vínculo de sessão no servidor para admin e ações sensíveis; medir a janela residual de JWT em todas as demais superfícies. Fixar orçamento de revogação e TTL com evidência. Perfil ativo, sessão vigente, papel e AAL são verificações distintas.

### 4.2 Separação de dados e privacidade do dispositivo

- Inventariar consultas, mutações, stores, Realtime, estado de observabilidade, AppLock, Demo, tema, preferências, checkout, clipboard, OCR, sugestões bancárias e arquivos/exportações. Uma nova árvore autenticada só monta dados após verificação da nova identidade. Revisar suspensão, volta ao primeiro plano, restauração via BFCache e service worker antigo.
- Minimizar metadados, prever prazo de retenção e expurgo seletivo. Em exclusão definitiva, remover somente os vestígios da conta excluída e tratar outras abas, dispositivos, push e sessões. Arquivos já exportados ficam sujeitos aos controles da plataforma e à gestão do usuário.
- Preferir envio de recuperação ao canal verificado do titular. Restringir geração a operações necessárias, com prova recente, evento de auditoria mínimo, validade curta, uso único e teste de invalidação. Retirar credenciais e PII de query strings, fragmentos, logs, traces, breadcrumbs e notificações. Testar o evento efetivamente enviado com identificadores sintéticos. Distinguir eventos de segurança no servidor de telemetria e trilhas informativas originadas no cliente.

### 4.3 Push, lembretes e segundo plano

- Definir uma conta destinatária por instalação autorizada, de forma independente da última aba em foco. Várias abas podem estar autenticadas simultaneamente. O sistema operacional e o destinatário de push são compartilhados. Reassociação precisa ser atômica e versionada, com desativação por logout e revogação e com consentimento da conta destino.
- Usar mensagem neutra na tela de bloqueio, no transporte e em notificações locais, sem valores, nomes, descrições, e-mails ou identificadores correlacionáveis. Verificar vínculo vigente ao abrir o app e selecionar somente uma aba pertencente ao contexto autorizado. Em caso de divergência, levar a uma tela neutra sem mudar a conta da aba em foco.
- Testar mensagens em fila, atraso ou retry, push já entregue, app encerrado, modo offline, rotação de token FCM, cancelamento, primeiro plano e concorrência entre abas. Se plataforma ou backend não puderem comprovar roteamento seguro, desativar push e lembretes em modo multiconta nessa plataforma até concluir a proteção. Preservar o Notification Hub e seus critérios de consentimento e elegibilidade.

## 5. Roteiro de execução

### Ordem, ambiente e evidência

- Executar em branch de trabalho. Começar por T00, preservar mudanças não relacionadas e usar exclusivamente dados sintéticos nos testes de autorização. Revisar a documentação canônica indicada em §7. Alterações estruturais atualizam `PROJECT_STRUCTURE.md` antes de criar os caminhos previstos.
- T00 → T01 → T02 → T03 → T04. T05 depende de T01, T03 e T04. T06 e T08 dependem de T04. T07 depende de T04 e T06 e, para Android, de T08. T09 depende de T05, T06, T08 e da contenção obrigatória de T07. T10 depende de T09. A ativação dos canais externos depende da homologação completa de T07.
- Cada tarefa de código começa com o teste de regressão indicado e termina com a execução desse teste, verificação dos arquivos alterados e um commit pequeno. Registrar no PR o ambiente, a revisão, os casos testados, as limitações e o resultado sem incluir tokens, valores financeiros, PII ou credenciais. Artefatos de homologação ficam com o PR da tarefa ou na operação com acesso controlado.
- Validar banco com `npm run db:start`, `npm run db:reset -- --local` e `npx supabase test db --local` exclusivamente em instância descartável local. Usar `npx supabase migration new <nome>` para criar migrations e regenerar tipos após mudanças de schema. Prévia e produção têm aprovações, bindings e segredos independentes. Falha de pré-requisito interrompe a etapa dependente e mantém a exposição bloqueada.

### T00 — Baseline e inventário de superfícies

**Responsáveis:** engenharia de segurança e operação. **Entradas:** §2, governança, auditoria anterior e configuração efetiva de cada ambiente.

- [ ] Mapear por classe de cliente o uso de Auth, Data API, RPC, Storage, Edge, Realtime, Web Push, FCM e operações admin. Registrar para cada operação identidade esperada, validação, grants, consumidor, caminho legado e teste planejado. Busca inicial em `src/data/`, `src/state/`, `src/hooks/use-auth.ts`, `supabase/migrations/` e `supabase/functions/`.
- [ ] Conferir ambiente efetivo de Cloudflare e Supabase em leitura autorizada. Verificar JWT, MFA, Turnstile e rate limits no servidor, redirects e e-mail, permissões RLS, views/grants, assinatura e idempotência de webhooks, cron, links públicos, backups, OCR, cadeia npm/Deno/Gradle e segregação de chaves. Triar alertas de build de §7.
- [ ] Executar os testes existentes de Auth e segurança e registrar divergências de produção como itens verificáveis. Casos acima da capacidade atual de teste entram na matriz de T09 com proprietário.
- **Saída:** inventário que permita rastrear cada chamada autenticada até sua política atual e o transporte de destino, com prévia isolada, contas sintéticas A e B, operador e acesso de operação para o piloto.

### T01 — Conter riscos no fluxo atual

**Arquivos:** `supabase/functions/admin-super-action/index.ts`, migrations e `supabase/tests/database/`, `src/hooks/use-sign-out.ts`, `src/hooks/use-device-session-sync.ts`, `src/services/session-policy.ts` e `src/data/client.ts`.

- [ ] Registrar testes para revogar sessão do titular e sessões de terceiro por operador autorizado, preservar outras contas, recusar usuário comum/operador AAL1 e testar registro concorrente de aparelhos. Cobrir aba compartilhada que faria bootstrap com sessão legada pessoal.
- [ ] Corrigir S03 com operação de revogação server-side por identidade alvo validada, executada sob privilégio restrito e auditada. Confirmar o mecanismo suportado no ambiente Supabase conforme a versão implantada. Revogação global do alvo deve afetar todas as suas sessões autorizadas, com resultado verificável e idempotente.
- [ ] Fazer autorização por `session_id` e registro de revogação no servidor. Múltiplas sessões da mesma conta no mesmo aparelho devem aparecer no inventário sem sobrescrever o vínculo. Recusar qualquer tentativa de reativar sessão revogada por registro de dispositivo. A interface só confirma revogação remota após sucesso registrado no servidor.
- [ ] Fechar persistência no modo compartilhado antes do bootstrap. Validar separadamente MFA, suspensão, recuperação/ativação por canal verificado, exclusão e restauração. Preservar os fluxos administrativos existentes até T05 com autorização server-side exigindo AAL2 para acessos privilegiados. T05 adiciona a vinculação exclusiva à origem administrativa.
- **Saída:** testes focados e pgTAP verdes, resultado de revogação validado com contas sintéticas e mecanismo de contingência documentado. S02–S05 e S08 têm correção ou bloqueio explícito de acesso para as superfícies afetadas em prévia.

### T02 — Provar o transporte e provisionar prévia

**Caminhos previstos:** documentar `scripts/cloudflare/sessions/` em `PROJECT_STRUCTURE.md`, depois criar configuração Wrangler, Worker e suíte local com Miniflare. Usar `docs/platforms/DEPLOYMENT.md` para bindings, DNS e secrets.

- [ ] Provar em prévia que as rotas do Worker prevalecem sobre o fallback de Pages nos hosts escolhidos. Validar Durable Objects, isolamento entre ambientes e a disponibilidade da origem administrativa. Registrar consumo, capacidade e custos estimados para as cargas do piloto.
- [ ] Provar uma leitura e uma escrita sintéticas em repositório já existente, por exemplo categorias ou preferências, com JWT A/B selecionado pelo Worker e RLS ativo. Conferir que a superfície pública direta não amplia o acesso, que a API privada não pode ser cacheada e que o transporte mantém configurações de recuperação e CSRF.
- [ ] Validar os TTLs de §3.4 e o transporte nativo em protótipo de prévia com um App Link sintético. Medir revalidação sem Realtime e confirmar paridade das operações essenciais. Registrar URLs de prévia, versão da plataforma, bindings e comandos de reprodução sem valores de segredos.
- **Saída:** rota e armazenamento comprovados, latência e custos documentados, nenhuma credencial Supabase em respostas de navegador. Caso uma capacidade falhe, revisar a etapa mantendo a opção de multiconta desativada.

### T03 — Implementar custódia e contratos de sessão

**Arquivos previstos:** `scripts/cloudflare/sessions/` para Worker, DO, configuração e testes. `src/types/` para contrato tipado. `src/domain/auth/` para políticas puras e testes colocalizados. Registry de revogação em schema Postgres privado com grants explícitos.

- [ ] Definir `POST /api/sessions/v1/:operation` com operações fechadas `bootstrap`, `login`, `mfa`, `accounts`, `switch`, `open-tab`, `redeem-tab`, `logout`, `forget` e `logout-device`. Completar handlers separados para callback PKCE e recuperação. Schemas Zod não recebem identidade autoritativa, upstream arbitrário ou material Supabase do cliente. Erros estáveis `unauthorized`, `context_stale`, `step_up_required`, `limit_reached` e `service_unavailable` passam pelo gateway pt-BR.
- [ ] Fixar a saída de bootstrap/troca como contexto público ou estado neutro, com geração, status, referência opaca quando disponível e metadados mínimos. Troca usa geração esperada. Criar contexto de destino só após autenticação e checagens exigidas. Tornar consumo da intenção e admissão de até cinco contas atômicos.
- [ ] Implementar lifecycle no DO com revisão monotônica, ciphertext versionado, alarme/reconciliação, expurgo e atualização condicional. Cobrir rotação interrompida pelo encerramento do Worker após resposta upstream. Se a revisão ficar ambígua, exigir autenticação nova. Invalidar contexto mesmo se a confirmação upstream atrasar, registrando revogação pendente para concluir no servidor.
- [ ] Testar sexto cadastro concorrente, cancelamento, código vencido, callback de contexto errado, retry de refresh após interrupção, logout concorrente, revogação entre instalações, cookie/CSRF incompatíveis e falha de storage.
- **Saída:** suíte de integração Worker/DO e políticas puras verdes. Sem recuperação de sessão antiga por callback tardio, retry, rollback ou restauração de storage.

### T04 — Migrar dados e estado por conta

**Arquivos:** `src/data/client.ts` e repositórios, `src/state/`, `src/hooks/use-auth.ts`, `src/hooks/use-sign-out.ts`, `src/services/auth-cleanup.ts`, `src/services/user-storage.ts`, `src/app/providers.tsx` e `src/app/require-auth.tsx`.

- [ ] Implementar `POST /api/data/v1/:operation` sobre o catálogo de T00, com schema, regra de autorização e handler por operação. Começar com bootstrap, preferências e uma leitura/escrita financeira. Entregar os demais módulos em grupos testáveis do inventário, reutilizando contratos e repositórios. Cada grupo tem teste de paridade e verificação RLS.
- [ ] Instanciar cache e cliente autenticado por geração. Capturar contexto antes da mutação e usar o mesmo contexto até concluir, com descarte dos efeitos tardios. Isolar AppLock, Demo, checkout, sugestões, OCR, observabilidade e exportações. Substituir limpezas globais por limpeza seletiva.
- [ ] Migrar Realtime privado conforme §3.2 e verificar operações que combinem consultas, mutações e Edge. Manter chamadas públicas legítimas apartadas. Antes de habilitar o transporte novo, confirmar que cada rota autenticada no escopo consta do catálogo e que o cliente novo não volta ao SDK autenticado no navegador em caso de erro.
- [ ] Testar A/B em abas, cancelamento, troca durante mutação já aceita, resposta atrasada, restauração por BFCache, operações que envolvem mais de uma gravação e exclusão seletiva de A preservando B.
- **Saída:** correspondência auditável entre catálogo e superfícies autenticadas. Dados e efeitos de cada geração ficam limitados ao contexto que iniciou a operação. Preview com transporte novo atrás de controle server-side.

### T05 — Ativar o portal administrativo isolado

**Arquivos:** `src/app/router.tsx`, `vite.config.ts`, `src/components/routing/require-admin-session.tsx`, `src/features/admin/`, `supabase/functions/admin-super-action/`, migrations, configuração Worker e cabeçalhos do portal.

- [ ] Implementar build/host dedicados e bloqueio server-side do tráfego privilegiado que não tenha concessão do portal. Validar a origem, o vínculo com `session_id`, papel ativo e AAL2. Concessão é exclusivamente server-side e não renovável por token de outro contexto. Logout, mudança de papel e revogação invalidam o vínculo.
- [ ] Para operações sensíveis, emitir e consumir prova recente da seção 3.4 vinculada à operação e alvo quando aplicável. Validar novamente na execução, inclusive em RPCs/Edge acessíveis diretamente. Logar somente tipo, resultado e referência pseudonimizada.
- [ ] Testar operadora AAL2 com concessão válida, AAL1, papel removido, conta comum, concessão vencida, operação sensível sem prova e reuso da prova. Incluir testes de origem/política de cookies e redirect legado limitado ao portal.
- **Saída:** matriz de autorização privilegiada completa, portal funcional em prévia e comportamento legado definido para o corte. O fallback de produção é desligar a superfície administrativa, sem retornar à autorização antiga.

### T06 — Entregar alternador e rotas de conta

**Arquivos:** `src/components/layout/logo-profile-button.tsx`, `src/features/auth/pages/login-page.tsx`, `src/features/auth/hooks/use-login-form.ts` e contratos de ação em `src/state/`.

- [ ] Construir com primitivos existentes os estados comum, efêmero, bloqueado e neutro. Permitir adicionar, alternar, abrir em nova aba, esquecer, sair da conta e sair das contas deste dispositivo. No logout, lembrar somente mediante consentimento. “Fechar contexto” preserva outras abas. “Sair da conta neste dispositivo” revoga seus contextos nessa instalação. “Esquecer” também remove vínculo e metadados. “Sair das contas deste dispositivo” não modifica sessões de outras instalações.
- [ ] Preservar ordem e confirmação explícita da troca, tratar status vencido com login novo e exigir a trava local configurada antes de mostrar os dados de destino. Nunca mostrar e-mail inteiro nem identidade de operador na tela inicial do alternador.
- [ ] Testar foco e navegação por teclado, cancelamento, erro de rede, MFA, storage indisponível, cinco contas e nova aba. Conferir desktop, mobile e temas afetados seguindo AGENTS e DESIGN_SYSTEM.
- **Saída:** fluxos de usuário completos em prévia e aderência visual verificada. Transporte e autorização vindos de T03/T04.

### T07 — Isolar notificações e tratamento em segundo plano

**Arquivos:** `public/sw-push.js`, `src/data/repositories/push-subscriptions.ts`, `src/services/native/local-notifications.ts`, `supabase/functions/push-dispatcher/` e migração da associação de instalação, se necessária.

- [ ] **Contenção obrigatória para T09:** invalidar associações legadas antes de a instalação aderir ao multiconta, cancelar agendamentos locais identificáveis, suprimir entregas pendentes no dispatcher e impedir re-registro por cliente antigo. Verificar notificações antigas, inclusive os que já chegaram ao sistema operacional. O corte fica bloqueado nas instalações em que associação ou conteúdo legado ainda possam cruzar contas.
- [ ] **Ativação opcional por plataforma:** implementar vínculo atômico e versionado de um destinatário autorizado por instalação. Exigir opt-in do destinatário. Revalidar versão e destinatário de cada entrega pendente. O conteúdo enviado ao sistema operacional é neutro desde a origem.
- [ ] Testar fila atrasada, notificações já exibidas, duas abas, app fechado, troca de token, clique em contexto revogado, tela bloqueada e aparelho offline. Não mudar de conta no clique. Sem contexto elegível, abrir tela neutra. Preservar regras de `payable`, adiamento e horário silencioso do Notification Hub.
- **Saída:** entregas e cliques comprovadamente escopados por plataforma. Ativar só o canal que passar, com desligamento independente.

### T08 — Adaptar e homologar Android Pro

**Arquivos:** `android/app/src/main/AndroidManifest.xml`, regras de extração e plugin abaixo do pacote nativo existente, `capacitor.config.ts` e adaptador em `src/services/native/`.

- [ ] Implementar o transporte restrito da seção 3.3. Auditar roteamento do CapacitorHttp, associação de App Link, certificados de release, armazenamento/rotação de referências e remoção de material anterior.
- [ ] Testar login, troca, callback, revogação, update de APK antigo, backup/transferência, perda de chave, kill/resume e logout. Cobrir plugin rejeitando host, operação e callback fora do contrato. Homologar um APK assinado de prévia usando contas sintéticas.
- **Saída:** relatório de testes em dispositivo homologado e flag Android liberável por versão. Sem prova de isolamento, Android permanece com a flag desligada.

### T09 — Migração, verificações e homologação

**Arquivos:** `public/_headers`, configuração Workbox/Vite, `docs/operations/SECURITY_GOVERNANCE.md`, `docs/operations/FOUNDER_RUNBOOK.md`, arquitetura, especificação técnica, roadmap e guias de deploy/PWA/Android.

- [ ] Aplicar corte de sessão por autenticação nova. Não importar tokens legados. Depois da chegada ao runtime novo, retirar chaves legadas da origem e revogar sessões do dispositivo que forem identificadas com segurança. Autorizar chamadas privadas de contas migradas somente com sessão vigente registrada pelo serviço de sessão, inclusive nos caminhos diretos alcançáveis. Definir período de compatibilidade para instalações ainda fora do rollout, com encerramento explícito. Um cliente antigo incompatível recebe instrução de atualização e não reativa a sessão anterior. Testar troca de versão com service worker antigo, outra aba e APK antigo.
- [ ] Reproduzir §6. Rodar `npm run verify:full`, `npm run build`, pgTAP e testes unitários/integração de Worker, Auth, sessão e autorização. Rodar as suítes colocalizadas alteradas e as de segurança, PWA e RLS. Usar a suíte de smoke do repositório apenas para sanidade. Validar isolamento em integração dedicada e homologar Chromium/Firefox/WebKit, mobile/PWA e Android Pro. Registrar também verificações de URLs, traces, cache, bundles e controles reais de Auth.
- [ ] Atualizar runbook com deploy, desligamento por plataforma, revogação, rotação de segredos, contenção LGPD e recuperação. Registrar revisão de segurança independente antes do piloto, resultados por plataforma e riscos residuais autorizados.
- **Saída:** prévia aprovada, rollback ensaiado, zero achados de prioridade alta abertos nas superfícies liberadas e aprovação operacional para ativação.

### T10 — Piloto, expansão e encerramento do plano

- [ ] Aplicar bump MINOR em `package.json` e lockfile, atualizar o roadmap e rodar novamente `npm run verify:full` sobre o candidato final antes do deploy do release.
- [ ] Implantar em sequência migrations compatíveis, Worker/bindings, portal, clientes e flags. Conferir proteção de rotas diretas e práticas de autenticação do ambiente antes de liberar. Ligar para contas sintéticas, depois piloto opt-in e, após pelo menos 7 dias de observação, ampliar após verificação dos indicadores. Habilitar Android e push só com suas evidências.
- [ ] Monitorar falhas de autenticação, MFA, troca, refresh, revogação e latência. Fixar os limites operacionais com a medição de T02, antes do piloto. Um evento confirmado de identidade cruzada, privilégio sem prova, revogação além do limite ou dado privado em push/cache/log interrompe a expansão. Desligar a flag afetada, bloquear o contexto inseguro, revogar sessões afetadas e executar o runbook.
- [ ] Em rollback, desligar alternador e canais afetados no servidor, manter custódia, guardas e revogações, usar cliente compatível e exigir login se houver dúvida. Nenhum rollback restaura tokens legados. Retomar somente após reproduzir a causa em ambiente isolado, corrigir e rerodar os gates afetados.
- [ ] Arquivar em `docs/plans/completed/` após aceite das plataformas previstas e fechamento do rollout. Registrar canais opcionais ainda desativados, se houver.
- **Saída:** entrega verificada nos ambientes e versões anunciados, com reversão testada e evidências registradas.

## 6. Matriz de aceite da segurança

| Cenário | Evidência exigida | Tarefa |
|---|---|---|
| A/B em duas abas ou troca durante leitura e escrita | Identidade do servidor, cache e UI permanecem coerentes. A resposta que chega depois da troca não afeta B. Canais, exports, logs e ler/gravar após voltar do histórico preservam o escopo. | T03, T04, T06 |
| Usuário comum, admin AAL1, admin AAL2, sessão revogada, papel removido e operador sem prova recente | Cada leitura e ação privilegiada tem resultado esperado no servidor, incluindo acesso por RLS, RPC e Edge. A autorização e seu prazo de revogação são medidos além da UI. | T01, T05 |
| Conta A revoga uma sessão, outras sessões ou todas | Verificar estado de refresh e janela residual de JWT em cada escopo. Contas distintas continuam disponíveis. Desconexão pendente recebe estado explícito. | T01, T03 |
| Login adicional, recuperação, links vencidos ou consumidos e abas duplicadas | Cancelamento preserva a sessão anterior. Sucesso ativa apenas a conta verificada na intenção correta. Histórico, referer, erros, tracing e clipboard não retêm credencial nem identificadores desnecessários. | T03, T06, T08 |
| Storage indisponível, rede perdida, relógios divergentes, duas rotações e logout concorrente | Não há promoção automática de modo efêmero a pessoal, nem troca de conta por evento atrasado, nem sessão regravada após logout. A interface volta a um estado neutro recuperável. | T01, T03, T04 |
| Compartilhamento familiar, viagem, links públicos, importação/restore e exclusão | Usuários sintéticos acessam apenas linhas e ações autorizadas. Referências cruzadas são validadas e escritas compostas dão rollback. Expurgo preserva as demais contas e elimina dados e referências da conta excluída segundo sua política de retenção. | T01, T04 |
| Push antigo, app fechado e notificação na tela bloqueada | Nenhum conteúdo financeiro ou identificador de conta aparece fora da sessão. Clique preserva a identidade da aba ativa. Modo compartilhado e integrações sem isolamento ficam sem entrega. | T07, T08 |
| Limite de contas, migração repetida, rollback, reinstalação e restauração Android | Cinco contas comuns no máximo em cada instalação pessoal. Sem credenciais recuperáveis em backup/transferência nem sessão privilegiada reativada por cliente antigo. | T03, T08, T09 |
| Privacidade de valores sintéticos | Revisão de bundle, storage, cache e envelopes de telemetria confirma a política de custódia e minimização. Evitar credenciais reais ou dados de usuários nos testes. | T04, T05, T09 |
| Revisão de liberação | Registrar resultados da suíte completa, verificação SQL, homologação dos ambientes, revisão independente, plano de contenção e resolução dos bloqueios de alta prioridade ligados à entrega. | T09, T10 |

## 7. Referências e limites da revisão

- [Especificação técnica](../architecture/ESPECIFICACAO_TECNICA.md) · [Arquitetura](../architecture/ARCHITECTURE.md) · [Estrutura](../architecture/PROJECT_STRUCTURE.md) · [PWA](../platforms/PWA_GUIDELINES.md) · [Deploy](../platforms/DEPLOYMENT.md) · [Runbook](../operations/FOUNDER_RUNBOOK.md)
- [Supabase Auth Sessions](https://supabase.com/docs/guides/auth/sessions) · [Logout](https://supabase.com/docs/guides/auth/signout) · [MFA](https://supabase.com/docs/guides/auth/auth-mfa) · [Data API](https://supabase.com/docs/guides/api/securing-your-api)
- [Cloudflare Worker Routes](https://developers.cloudflare.com/workers/configuration/routing/routes/) · [Durable Objects Storage API](https://developers.cloudflare.com/durable-objects/api/storage-api/)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) · [OWASP MASVS](https://mas.owasp.org/MASVS/) · [Android Auto Backup](https://developer.android.com/identity/data/autobackup)

A revisão de segurança anterior foi estática e local. No checkout daquela revisão, `npm run verify` passou com 3.672 testes de domínio, typecheck e lint sem erros, com 12 avisos de lint. As dez suítes adicionais de segurança, PWA e sessão passaram com 134 testes. `npm audit --omit=dev` retornou zero registros de vulnerabilidade. A auditoria do lockfile completo retornou 12 registros moderados na cadeia de desenvolvimento e build, incluindo ESLint, Workbox e Vite PWA. Triar o alcance desses avisos na Fase 0, pois dependências de build também podem afetar os artefatos distribuídos.

Supabase Cloud, Cloudflare, testes SQL com banco real, entregas de push e controles do APK precisam de validação em ambiente autorizado. Os testes atuais medem regressões conhecidas. Os critérios da seção 6 definem a evidência exigida para a entrega futura.
