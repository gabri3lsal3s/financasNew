# PLANO DE EXECUÇÃO: ADEQUAÇÃO LEGAL, REGULATÓRIA E CONTRATUAL INTEGRAL

> **Documento:** Plano Canônico de Adequação Legal, Regulatória e Contratual  
> **Aplicação:** Áxis Finance (Web, PWA e Android Nativo)  
> **Jurisdição:** República Federativa do Brasil  
> **Status:** Pronto para Execução por Fases  
> **Governança:** Fases sequenciais, tarefas com checklist, portões de qualidade (*quality gates*), testes automatizados, revisões de conformidade, atualização contínua da documentação e commits semânticos.

---

## 1. Visão Geral e Normas Auditadas

Este plano operacionaliza a conformidade jurídica integral do Áxis Finance com o ordenamento jurídico brasileiro:
1. **LGPD (Lei nº 13.709/2018)** e Resoluções da Autoridade Nacional de Proteção de Dados (ANPD);
2. **Marco Civil da Internet (Lei nº 12.965/2014)** e Decreto Regulamentador nº 8.771/2016;
3. **Código de Defesa do Consumidor (Lei nº 8.078/1990)**;
4. **Decreto do Comércio Eletrônico (Decreto nº 7.962/2013)**;
5. **Regulamentação CVM (Resoluções CVM nº 19/2021 e nº 20/2021)**;
6. **Normas Contábeis e Fiscais do CFC e Receita Federal do Brasil (RFB)**;
7. **Políticas de Lojas de Aplicativos (Google Play Store e Apple App Store)**;
8. **Padrões de Segurança de Pagamento (PCI-DSS)**.

---

## 2. Acervo de Contratos Oficiais da Plataforma

Abaixo constam as minutas integrais dos 5 contratos que regem a plataforma e fundamentam as implementações técnicas:

---

### CONTRATO 1: TERMOS DE SERVIÇO E CONTRATO DE ADESÃO SAAS (B2C)

**CLÁUSULA PRIMEIRA — DO OBJETO E DA NATUREZA DOS SERVIÇOS**  
1.1. O presente instrumento regula a licença de uso do software **Áxis Finance**, disponibilizado sob o modelo de *Software as a Service* (SaaS), destinado à organização financeira pessoal, controle de receitas e despesas, gestão de cartões de crédito, dívidas, orçamentos e consolidação numérica e matemática de carteiras de investimentos.  
1.2. O Áxis Finance é uma plataforma 100% *Online First*, funcionando com sincronização em nuvem e armazenamento criptografado.  
1.3. O serviço é prestado por **Áxis Tecnologia & Gestão Financeira Ltda.**, inscrita no CNPJ sob o nº `00.000.000/0001-00`, com sede em São Paulo/SP.

**CLÁUSULA SEGUNDA — DA CAPACIDADE E DO CADASTRO**  
2.1. O cadastro é restrito a pessoas naturais plenamente capazes (maiores de 18 anos de idade nos termos do Código Civil Brasileiro).  
2.2. O usuário é o único responsável pela veracidade dos dados informados e pela guarda confidencial de suas credenciais de autenticação.

**CLÁUSULA TERCEIRA — DO PERÍODO DE AVALIAÇÃO GRATUITA (TRIAL)**  
3.1. Todo novo usuário tem direito a **30 (trinta) dias de avaliação gratuita** com acesso completo aos recursos do Plano Pro.  
3.2. O início do período de teste **não exige** a inserção de dados de cartão de crédito. Encerrados os 30 dias, caso não opte pela contratação de um plano pago, a conta migrará automaticamente para o **Modo Somente-Leitura**, preservando integralmente todo o histórico financeiro cadastrado sem perda ou sequestro de dados.

**CLÁUSULA QUARTA — DOS PLANOS PAGOS, PREÇOS E FATURAMENTO**  
4.1. O usuário poderá optar pela assinatura do **Plano Pro Mensal** (R$ 19,90/mês) ou **Plano Pro Anual** (R$ 178,80/ano, equivalente a R$ 14,90/mês).  
4.2. Os pagamentos são processados através de gateways autorizados (Asaas e Stripe), admitindo cartão de crédito com renovação automática e PIX dinâmico (no plano anual).  
4.3. Os preços poderão ser reajustados anualmente mediante aviso prévio por e-mail com antecedência mínima de 30 (trinta) dias.

**CLÁUSULA QUINTA — DO DIREITO DE ARREPENDIMENTO (CDC ART. 49)**  
5.1. Em estrito cumprimento ao Artigo 49 da Lei nº 8.078/1990 (Código de Defesa do Consumidor) e ao Decreto nº 7.962/2013, o usuário poderá desistir da contratação no prazo improrrogável de **7 (sete) dias corridos** a contar da confirmação do pagamento inicial ou de renovação.  
5.2. O cancelamento por arrependimento garante o **reembolso integral e imediato** de todos os valores cobrados, solicitado via suporte eletrônico (`suporte@axis.app`) ou diretamente na interface do aplicativo.

**CLÁUSULA SEXTA — DO CANCELAMENTO SEM BUROCRACIA E SEM MULTAS**  
6.1. O usuário poderá cancelar a renovação automática de sua assinatura a qualquer momento com **1 clique** diretamente na aba "Assinatura" dentro das Configurações do aplicativo.  
6.2. O cancelamento não gera multas, retenções contratuais ou cláusulas de fidelidade. O acesso Pro permanecerá vigente até o término do ciclo já pago.

**CLÁUSULA SÉTIMA — DA ISENÇÃO DE CUSTÓDIA, INTERMEDIAÇÃO E CONSULTORIA (CVM)**  
7.1. O Áxis Finance **não é instituição financeira, cooperativa de crédito, corretora de valores ou distribuidora de títulos e valores mobiliários**. A plataforma não realiza custódia de numerário, não recebe depósitos e não executa ordens de compra e venda no mercado de capitais.  
7.2. As ferramentas de cálculo patrimonial e rebalanceamento de carteira operam em modelo **estritamente matemático e automatizado**, fundamentando-se nas metas percentuais e classes de ativos definidas de forma discricionária e exclusiva pelo próprio usuário.  
7.3. O aplicativo não presta serviços de consultoria de valores mobiliários (Resolução CVM nº 19/2021) nem elabora relatórios de análise ou recomendações de investimento (Resolução CVM nº 20/2021). Rentabilidade passada não representa garantia de retorno futuro.

**CLÁUSULA OITAVA — DA ISENÇÃO DE RESPONSABILIDADE TRIBUTÁRIA E CONTÁBIL**  
8.1. Os cálculos de ganho de capital, apuração de DARF 6015 e regimes fiscais internacionais (Lei nº 14.754/2023) possuem finalidade meramente estimativa e informativa.  
8.2. A plataforma não substitui a escrituração contábil profissional habilitada perante o Conselho Federal de Contabilidade (CFC) nem a Declaração de Ajuste Anual da Receita Federal do Brasil (RFB). O usuário é o único responsável legal pela apuração, conferência e recolhimento tempestivo de seus tributos.

**CLÁUSULA NONA — DO FORO DE ELEIÇÃO**  
9.1. Para dirimir quaisquer litígios decorrentes deste contrato, fica eleito o Foro da Comarca da Capital do Estado de São Paulo, ressalvada a faculdade do consumidor de optar pelo foro de seu próprio domicílio nos termos da legislação consumerista.

---

### CONTRATO 2: POLÍTICA DE PRIVACIDADE E PROTEÇÃO DE DADOS (LGPD)

**SEÇÃO 1 — IDENTIFICAÇÃO DO CONTROLADOR E DO ENCARREGADO (DPO)**  
O controlador do tratamento de dados pessoais é a **Áxis Tecnologia & Gestão Financeira Ltda.** (CNPJ `00.000.000/0001-00`). O Encarregado pelo Tratamento de Dados Pessoais (DPO) pode ser contatado diretamente e formalmente através do canal eletrônico permanente: **`privacidade@axis.app`**.

**SEÇÃO 2 — BASES LEGAIS E FINALIDADES DO TRATAMENTO (LGPD ART. 7º E 11)**  
1. **Identificação e Acesso:** Tratamento de nome, e-mail e credenciais para autenticação, segurança e prestação dos serviços (Execução de Contrato — Art. 7º, V).  
2. **Dados Financeiros e Patrimoniais:** Tratamento de lançamentos de receitas, despesas, limites de cartões, dívidas, extratos e posições de investimentos para alimentar gráficos, cálculos orçamentários e relatórios patrimoniais solicitados pelo titular (Execução de Contrato — Art. 7º, V).  
3. **Leitura de Notificações Bancárias (Android):** Captura passiva e local de gastos com Pix e cartões baseada em permissão ativa e consentimento inequívoco do usuário (Consentimento — Art. 7º, I).  
4. **Biometria Local:** Verificação da identidade no hardware do smartphone para desbloqueio do app (Consentimento e Prevenção à Fraude — Art. 7º, IX e Art. 11, II, "g").  
5. **Faturamento e Assinaturas:** Tratamento de CPF e registros de cobrança para emissão de faturas no Asaas/Stripe e cumprimento de obrigações fiscais (Obrigação Legal e Contrato — Art. 7º, II e V).  
6. **Registros de Acesso a Aplicações:** Guarda eletrônica de endereço IP, data, hora (UTC) e ID de sessão em estrito cumprimento ao Artigo 15 da Lei nº 12.965/2014 (Marco Civil da Internet) (Obrigação Legal — Art. 7º, II).

**SEÇÃO 3 — ARQUITETURA DE PRIVACIDADE POR DESIGN (PRIVACY BY DESIGN)**  
- **Isolamento Criptográfico via Row Level Security (RLS):** 100% das 34 tabelas do banco de dados contam com políticas de isolamento por `(select auth.uid())`, impedindo terminantemente vazamento de dados entre usuários distintos.
- **Processamento 100% On-Device de Notificações:** O parser de notificações bancárias opera exclusivamente na CPU e memória RAM local do smartphone do usuário. Textos brutos de notificações nunca são enviados para a internet.
- **Proteção contra Captura de Tela (Android FLAG_SECURE):** O aplicativo oferece o recurso *Privacy Shield*, que instrui o sistema operacional a ocultar saldos no alternador de tarefas e bloquear capturas de tela.
- **Redaction de PII na Telemetria (Sentry):** Todo erro enviado para observabilidade passa por filtros de sanitização que removem senhas, números de cartão de crédito e mascaram CPFs (`[REDACTED_CPF]`).

**SEÇÃO 4 — DOS DIREITOS DO TITULAR DE DADOS (LGPD ART. 18)**  
O titular possui direito a: confirmação da existência de tratamento, acesso aos dados, correção de inconsistências, anonimização/eliminação de dados excessivos, portabilidade em formatos abertos (.csv/.json), eliminação permanente dos dados, informações de compartilhamento e revogação do consentimento. As requisições serão atendidas no prazo legal de até 15 dias (LGPD Art. 19, II).

**SEÇÃO 5 — DO DIREITO AO ESQUECIMENTO E RETENÇÃO LEGAL COMPULSÓRIA**  
5.1. O usuário pode requerer o encerramento da conta e a eliminação de seus dados diretamente na aba "Segurança" das Configurações do app ou via canal web `/privacidade#exclusao`.  
5.2. Ao acionar a exclusão, todo o histórico financeiro, cartões, dívidas, orçamentos, posições patrimoniais e cadastro são expurgados de forma definitiva e irrecuperável.  
5.3. **Harmonização com o Marco Civil da Internet:** Conforme autoriza expressamente o Artigo 16, I da LGPD, os registros técnicos de conexão e acesso a aplicações de internet (IP, data, hora UTC e sessão) serão conservados sob sigilo e ambiente controlado pelo prazo improrrogável de **6 (seis) meses** em cumprimento ao Artigo 15 da Lei nº 12.965/2014, sendo destruídos automaticamente após o decurso desse prazo.

**SEÇÃO 6 — POLÍTICA DE COOKIES E DADOS LOCAIS**  
A plataforma utiliza unicamente armazenamento local (`localStorage` e cookies técnicos) para dados **estritamente necessários ao funcionamento** (token de sessão Supabase Auth, tema de exibição e preferências de interface). A plataforma **não** utiliza cookies de terceiros para rastreamento de publicidade comportamental.

---

### CONTRATO 3: ACORDO DE NÍVEL DE SERVIÇO (SLA) & DISPONIBILIDADE

1. **Meta de Disponibilidade:** O Áxis Finance adota meta de disponibilidade mensal de **99,5%** para sua infraestrutura operacional em nuvem (hospedada em Cloudflare Pages e Supabase Enterprise Cloud).  
2. **Manutenções Programadas:** Intervenções de manutenção preventiva que impactem a disponibilidade do serviço serão informadas previamente com antecedência mínima de 24 (vinte e quatro) horas, ocorrendo preferencialmente em horários de menor tráfego (entre 01h00 e 05h00, horário de Brasília).  
3. **Plano de Contingência:** Em caso de interrupção não programada, a equipe técnica iniciará procedimentos de contenção e recuperação em até 60 minutos, mantendo status atualizado aos usuários.

---

### CONTRATO 4: TERMO DE CONSENTIMENTO ESPECÍFICO — CAPTURA PASSIVA ANDROID

1. **Objeto do Consentimento:** O usuário autoriza expressamente o Áxis Finance a utilizar a permissão de acessibilidade/leitura de notificações do sistema operacional Android (`BIND_NOTIFICATION_LISTENER_SERVICE`).  
2. **Finalidade Estrita:** A permissão destina-se exclusivamente a detectar alertas emitidos por aplicativos de instituições bancárias autorizadas pelo usuário (compras no cartão, transferências Pix e confirmações de pagamento) para transformá-los em sugestões rápidas de lançamento financeiro.  
3. **Privacidade e Descarte de Dados Críticos:** O Áxis Finance compromete-se a executar 100% da análise do texto no processador local do celular, sem envio de mensagens brutas à internet, descartando imediatamente senhas, tokens 2FA e dados confidenciais.  
4. **Revogabilidade:** O usuário pode revogar esta autorização a qualquer momento nas configurações do app ou do sistema operacional Android.

---

### CONTRATO 5: TERMO DE ISENÇÃO REGULATÓRIA CVM & RESPONSABILIDADE TRIBUTÁRIA

1. **Isenção CVM:** O usuário declara ciência inequívoca de que o Áxis Finance opera como mero instrumento tecnológico de auxílio à consolidação contábil e orçamentária pessoal. Todas as sugestões de rebalanceamento e alocação são derivadas puramente de formulações matemáticas parametrizadas pelas metas informadas pelo próprio usuário, não configurando análise de valores mobiliários, consultoria financeira (Resolução CVM 19/2021) ou recomendação de compra e venda (Resolução CVM 20/2021).  
2. **Isenção Fiscal:** O usuário reconhece que as rotinas de cálculo de DARF e controle fiscal de ganho de capital constituem estimativas informativas baseadas nos registros fornecidos. É de responsabilidade indelegável do usuário confrontar tais estimativas com os informes oficiais de suas corretoras de custódia e submeter sua Declaração de Ajuste Anual tempestivamente à Receita Federal do Brasil.

---

## 3. Fases de Execução com Checklists de Tarefas

---

### FASE 1: Infraestrutura Institucional & Rotas Públicas `/termos` e `/privacidade`

#### Objetivo
Estabelecer a identidade jurídica oficial do fornecedor (Decreto 7.962/2013) e publicar as páginas legais completas e indexáveis, acessíveis a qualquer usuário e robô de indexação de lojas de aplicativos sem exigir autenticação.

#### Checklist de Tarefas da Fase 1
- [x] **Tarefa 1.1:** Criar `src/lib/institutional.ts` com a interface `InstitutionalConfig` e constante `INSTITUTIONAL_CONFIG` suportando variáveis de ambiente (`VITE_APP_COMPANY_NAME`, `VITE_APP_CNPJ`, `VITE_APP_ADDRESS`, `VITE_APP_DPO_EMAIL`, `VITE_APP_SUPPORT_EMAIL`) com fallbacks seguros.
- [x] **Tarefa 1.2:** Criar `src/features/legal/components/legal-page-shell.tsx` com layout acessível (skip-link, navegação por teclado, cabeçalho institucional, seletor de abas Termos/Privacidade, alternância de tema e rodapé completo).
- [x] **Tarefa 1.3:** Criar `src/features/legal/pages/terms-page.tsx` materializando o **Contrato 1 (Termos de Serviço SaaS)** na íntegra.
- [x] **Tarefa 1.4:** Criar `src/features/legal/pages/privacy-page.tsx` materializando o **Contrato 2 (Política de Privacidade LGPD)**, incluindo a seção de autoatendimento e contato do DPO.
- [x] **Tarefa 1.5:** Criar os barris `src/features/legal/components/index.ts`, `src/features/legal/pages/index.ts` e `src/features/legal/index.ts`.
- [x] **Tarefa 1.6:** Registrar as rotas públicas desautenticadas em `src/app/routes.tsx` e `src/app/router.tsx` (`/termos`, `/termos-de-uso`, `/privacidade`, `/politica-de-privacidade`).
- [x] **Tarefa 1.7:** Atualizar o rodapé oficial da Landing Page ([`landing-footer.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/landing-footer.tsx)) exibindo Razão Social, CNPJ, endereço físico, e-mail de suporte, contato do DPO e links diretos para `/termos` e `/privacidade`.

#### Portão de Qualidade da Fase 1
1. **Testes:** Execução de testes unitários `terms-page.test.tsx` e `privacy-page.test.tsx`.
2. **Qualidade:** `npm run test`, `npm run typecheck` e `npm run lint` 100% verdes.
3. **Auditoria:** Verificação de conformidade das cláusulas de arrependimento (CDC Art. 49) e retenção de logs por 6 meses (Marco Civil Art. 15).
4. **Documentação:** Atualizar `docs/PROJECT_STRUCTURE.md` registrando `src/features/legal/`.
5. **Commit:** `git commit -m "feat(legal): adicionar paginas publicas de termos de servico e privacidade lgpd"` e push.

---

### FASE 2: Consentimento Prévio no Cadastro e Transparência no Checkout

#### Objetivo
Garantir a validade jurídica dos contratos eletrônicos coletando consentimento expresso, livre e informado no momento da criação de conta e assegurando transparência no checkout conforme o Código de Defesa do Consumidor e o Decreto do E-commerce.

#### Checklist de Tarefas da Fase 2
- [x] **Tarefa 2.1:** Modificar [`register-page.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/auth/pages/register-page.tsx) adicionando estado `acceptedTerms` e checkbox customizado com o primitivo `Checkbox`: *"Li e concordo com os [Termos de Uso](/termos) e a [Política de Privacidade](/privacidade)."*, bloqueando o envio enquanto desmarcado.
- [x] **Tarefa 2.2:** Modificar [`subscription-checkout-page.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/subscription/pages/subscription-checkout-page.tsx) tornando os links para Termos e Privacidade clicáveis e adicionando a garantia incondicional de 7 dias com estorno integral (CDC Art. 49).

#### Portão de Qualidade da Fase 2
1. **Testes:** Atualizar e rodar `register-page.test.tsx` e `subscription-checkout-page.test.tsx`.
2. **Qualidade:** `npm run test`, `npm run typecheck` e `npm run lint` 100% verdes.
3. **Auditoria:** Garantir que o checkbox não possa ser burlado via submissão direta do formulário.
4. **Documentação:** Atualizar `docs/ROADMAP.md` com os marcos de consentimento e checkout.
5. **Commit:** `git commit -m "feat(auth): implementar consentimento expresso de termos no cadastro e checkout cdc"` e push.

---

### FASE 3: Direito ao Esquecimento — Exclusão de Conta em Cascata (LGPD Art. 18, VI)

#### Objetivo
Implementar o fluxo completo de autoatendimento para que o titular possa encerrar sua conta e purgar todos os seus dados pessoais e financeiros de forma transacional e definitiva, atendendo à LGPD e às diretrizes obrigatórias da Google Play Store e Apple App Store.

#### Checklist de Tarefas da Fase 3
- [x] **Tarefa 3.1:** Criar migração SQL `supabase/migrations/20261021000001_delete_user_account_rpc.sql` com procedimento `public.delete_current_user_account()` realizando expurgo seguro em cascata nas 34 tabelas e em `auth.users`.
- [x] **Tarefa 3.2:** Atualizar [`src/data/rpc.ts`](file:///home/gabrielsales/meus_apps/financasnew/src/data/rpc.ts) exportando o método tipado `deleteCurrentUserAccount(): Promise<void>`.
- [x] **Tarefa 3.3:** Modificar [`security-tab.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/security-tab.tsx) adicionando a seção "Zona de Perigo / Exclusão de Conta (LGPD)", modal de dupla confirmação com digitação da palavra `"EXCLUIR"`, cancelamento preventivo no gateway Asaas/Stripe, limpeza de cache, expurgo de storage e logout seguro.

#### Portão de Qualidade da Fase 3
1. **Testes:** Criar e executar teste unitário em `security-tab.test.tsx` validando a trava de digitação da palavra "EXCLUIR".
2. **Qualidade:** `npm run test`, `npm run typecheck` e `npm run lint` 100% verdes.
3. **Auditoria:** Simular exclusão de conta em base local e conferir que nenhuma linha orfã permaneça nas tabelas de dados.
4. **Documentação:** Atualizar `docs/ARCHITECTURE.md` (§12 Governança de Segurança e Privacidade).
5. **Commit:** `git commit -m "feat(security): implementar exclusao definitiva de conta e dados em cascata lgpd"` e push.

---

### FASE 4: Blindagem Regulatória CVM no Rebalanceamento de Carteira

#### Objetivo
Afastar qualquer caracterização de prestação não autorizada de consultoria ou análise de valores mobiliários (Resoluções CVM nº 19 e 20/2021) na aba de sugestão de aportes e relatórios patrimoniais.

#### Checklist de Tarefas da Fase 4
- [x] **Tarefa 4.1:** Modificar a aba de Aportes ([`aporte-tab.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/pages/aporte-tab.tsx)) inserindo alerta permanente de conformidade com o **Contrato 5 (Termo de Isenção CVM)**, frisando o cálculo estritamente matemático baseado nas metas do próprio titular.
- [x] **Tarefa 4.2:** Padronizar os disclaimers existentes em relatórios impressos e modais executivos (`WealthTearSheetModal`, `ConsolidatedWealthModal`, `DividendFreedomModal`) alinhando-os à minuta oficial.

#### Portão de Qualidade da Fase 4
1. **Testes:** Executar testes unitários do módulo de investimentos conferindo a presença do texto regulatório CVM.
2. **Qualidade:** `npm run test`, `npm run typecheck` e `npm run lint` 100% verdes.
3. **Auditoria:** Auditar código para garantir ausência de vocabulário de recomendação ativa de compra ou venda de ações/FIIs.
4. **Documentação:** Atualizar `docs/ROADMAP.md` e `docs/ARCHITECTURE.md`.
5. **Commit:** `git commit -m "feat(investments): adicionar disclaimer regulatorio cvm 19 e 20 na aba de aportes"` e push.

---

### FASE 5: Disclaimers de Inteligência Fiscal e DARF (CFC & Receita Federal)

#### Objetivo
Proteger a plataforma contra litígios por autuações fiscais ou malha fina, delimitando que o radar fiscal de ganho de capital em ações/FIIs e investimentos no exterior (Lei 14.754/2023) tem caráter puramente auxiliar e estimativo.

#### Checklist de Tarefas da Fase 5
- [x] **Tarefa 5.1:** Modificar as visualizações do Radar Fiscal de DARF e relatórios tributários inserindo o disclaimer contábil/fiscal de que o cálculo é estimativo e não substitui contador habilitado nem a Declaração de Ajuste Anual da Receita Federal.
- [x] **Tarefa 5.2:** Adicionar a mesma ressalva no dossiê de exportação executiva em planilha Excel (.xlsx).

#### Portão de Qualidade da Fase 5
1. **Testes:** Executar testes unitários de relatórios e exportação.
2. **Qualidade:** `npm run test`, `npm run typecheck` e `npm run lint` 100% verdes.
3. **Auditoria:** Confirmar clareza da ressalva de responsabilidade do contribuinte perante a Receita Federal.
4. **Documentação:** Atualizar `docs/ARCHITECTURE.md`.
5. **Commit:** `git commit -m "feat(reports): incluir aviso de isencao contabil e fiscal rfb na apuracao de darf"` e push.

---

### FASE 6: Prominent Disclosure Android & Diretrizes de Publicação em Lojas

#### Objetivo
Garantir aprovação sem atritos nas políticas de Serviços Financeiros e Notificações da Google Play Store e Apple App Store, formalizando o aviso prévio de captura bancária e a separação de builds.

#### Checklist de Tarefas da Fase 6
- [x] **Tarefa 6.1:** Atualizar a aba de Notificações ([`notifications-tab.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/settings/components/tabs/notifications-tab.tsx)) inserindo o **Prominent Disclosure (Contrato 4)** antes da solicitação da permissão nativa Android, frisando processamento 100% no dispositivo.
- [x] **Tarefa 6.2:** Atualizar a documentação de deploy e compilação nativa ([`docs/DEPLOYMENT.md`](file:///home/gabrielsales/meus_apps/financasnew/docs/DEPLOYMENT.md) e [`docs/NATIVE_DISTRIBUTION_GUIDE.md`](file:///home/gabrielsales/meus_apps/financasnew/docs/NATIVE_DISTRIBUTION_GUIDE.md)) registrando a separação de builds: distribuição direta (com auto-atualizador de APK) vs Google Play Store (sem permissão `REQUEST_INSTALL_PACKAGES`).

#### Portão de Qualidade da Fase 6
1. **Testes:** Suíte de testes completa verde (`npm run test`), typecheck sem erros (`npm run typecheck`), lint estrito sem avisos (`npm run lint`).
2. **Auditoria Final:** Auditoria cruzada de todos os 5 contratos, disclaimers, links internos e rotas públicas.
3. **Documentação:** Atualização final do índice de governança em `docs/ROADMAP.md`.
4. **Commit:** `git commit -m "docs(compliance): concluir adequacao integral legal regulatoria e diretrizes de lojas"` e push.

---

## 4. Matriz de Verificação e Rastreabilidade de Testes

| Teste | Arquivo Alvo | Requisito Legal Verificado |
| :--- | :--- | :--- |
| **VAL-01** | `src/features/legal/pages/terms-page.test.tsx` | Contrato 1: Termos de Serviço, CDC 7 dias, cancelamento 1 clique, foro. |
| **VAL-02** | `src/features/legal/pages/privacy-page.test.tsx` | Contrato 2: LGPD Art. 18, canal DPO, guarda de logs por 6 meses (Marco Civil Art. 15). |
| **VAL-03** | `src/features/auth/pages/register-page.test.tsx` | LGPD Art. 8º: Bloqueio de submissão do formulário sem aceite ativo dos termos. |
| **VAL-04** | `src/features/subscription/pages/subscription-checkout-page.test.tsx` | CDC Art. 49 e Decreto 7.962/13: Links legais e garantia de 7 dias com estorno. |
| **VAL-05** | `src/features/settings/components/tabs/security-tab.test.tsx` | LGPD Art. 18, VI e Lojas: Trava do modal exigindo a palavra "EXCLUIR" para purgar conta. |
| **VAL-06** | `src/features/investments/pages/aporte-tab.test.tsx` | Resoluções CVM 19 e 20/2021: Aviso legal sobre rebalanceamento matemático. |
| **VAL-07** | `src/features/reports/components/wealth-tear-sheet-modal.test.tsx` | Normas Contábeis/RFB: Disclaimer de apuração de DARF e isenção tributária. |
| **VAL-08** | Suíte Completa de Qualidade (`npm run typecheck && npm run lint && npm run test`) | Ausência de regressões, ausência de `any` e zero emojis decorativos. |

---

## 5. Regras de Transição e Próximos Passos

1. **Execução Estritamente Sequencial:** Nenhuma fase subsequente pode ser iniciada antes que a fase anterior cumpra todos os critérios do seu respectivo Portão de Qualidade (*Quality Gate*).
2. **Atualização do Checklist:** À medida que cada tarefa for concluída, sua caixa de seleção no checklist será marcada como concluída `[x]`.
3. **Início da Execução:** A execução terá início pela **Fase 1 (Tarefa 1.1)** mediante instrução do usuário.
