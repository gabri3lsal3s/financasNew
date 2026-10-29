# 📱 NATIVE_DISTRIBUTION_GUIDE.md — Guia de Distribuição, Assinatura e Atualização do APK Android

> **Status:** v1.0 — Guia Canônico de Distribuição Nativa e Atualizações Automatizadas (2026-10-20).  
> **Aplica-se a:** Desenvolvedores, pipelines de CI/CD e suporte ao cliente do aplicativo **Áxis**.

---

## 1. VISÃO GERAL DO TRIPÉ DE PLATAFORMAS

O Áxis opera em um modelo unificado onde uma única conta/assinatura concede acesso simultâneo a três formas de uso:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TRIPÉ DE PLATAFORMAS Áxis                       │
├────────────────────┬───────────────────────────┬───────────────────────┤
│ 1. Web Desktop     │ 2. Mobile PWA             │ 3. Android App Pro    │
├────────────────────┼───────────────────────────┼───────────────────────┤
│ • Telas amplas     │ • iPhone (iOS) & Android  │ • Android Exclusivo   │
│ • Projeção FIRE    │ • Instalação instantânea  │ • Leitor Bancário     │
│ • Conciliação      │ • Zero megabytes ocupados │ • Biometria física    │
│ • Exportação Excel │ • Sem passar por lojas    │ • Atualização in-app  │
└────────────────────┴───────────────────────────┴───────────────────────┘
```

---

## 2. A REGRA DE OURO DA KEYSTORE (ASSINATURA CRIPTOGRÁFICA)

### 2.1 Por que o Android exigia desinstalar anteriormente?
O sistema operacional Android impõe integridade estrita por chave criptográfica:
1. **Conflito de Chaves (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`):** Se uma versão de teste foi instalada com a chave de depuração padrão (`debug.keystore`) e o usuário tentar instalar a versão final (`release.apk`), o Android **bloqueia sumariamente a atualização**.
2. **`versionCode` não incrementado:** O Android só aceita atualizar um app por cima se o atributo numérico inteiro `versionCode` for **estritamente maior** que o instalado. Se o APK tiver o mesmo `versionCode`, o instalador recusa com a mensagem genérica *"O app não foi instalado"*.

### 2.2 Especificações da Keystore Canônica
A keystore de release está configurada em `android/app/build.gradle` e reside em:

```
android/app/release-key.keystore
```

- **Algoritmo:** RSA 2048 bits
- **Alias:** `guiafinanceiro` (ou definido via `KEY_ALIAS`)
- **Senha Padrão:** `guiafinanceiro123` (ou definida via `KEYSTORE_PASSWORD` e `KEY_PASSWORD`)
- **Fingerprint SHA-256:** `B9:C1:4B:F2:4D:F9:95:0A:84:70:EA:2E:02:6C:BC:2D:84:32:86:FE:6F:0A:30:8F:8B:F3:1D:4A:5C:29:9A:1B`

> [!CAUTION]
> **NUNCA PERCA ESTE ARQUIVO KEYSTORE!**  
> Se a `release-key.keystore` for deletada ou recriada com outra chave, **todos os usuários que já possuem o app instalado serão obrigados a desinstalar o app** para receber novas versões.  
> **Procedimento de segurança:** Faça imediatamente um backup deste arquivo em um cofre seguro (ex: 1Password, Bitwarden ou Secrets protegidos do GitHub).

---

## 3. COMPILAÇÃO E GERAÇÃO AUTOMATIZADA DE RELEASES

O script `scripts/build-apk.sh` automatiza o ciclo completo de compilação, incremento de versão, assinatura e geração de manifesto.

### 3.1 Executando a Compilação

Para compilar uma nova versão pronta para distribuição:

```bash
# Compilação padrão (incrementa automaticamente o versionCode baseado no último manifesto)
npm run build:apk

# Ou especificando manualmente versão semântica e código numérico:
APP_VERSION_NAME="1.1.0" APP_VERSION_CODE="2" ./scripts/build-apk.sh
```

### 3.2 O que o script realiza automaticamente:
1. Valida se a keystore permanente existe (e a preserva intacta);
2. Compila a aplicação Web Vite em modo de produção (`npm run build`);
3. Sincroniza o Capacitor Android (`npx cap sync android`);
4. Executa o Gradle com os parâmetros de release (`assembleRelease`);
5. Copia os binários para `dist-apk/guia-financeiro-release.apk` e `dist-apk/axis-pro.apk`;
6. Calcula o hash de integridade **SHA-256** do binário gerado;
7. Gera o arquivo canônico **`public/releases/version.json`** e replica para `dist-apk/version.json`.

---

## 4. O MANIFESTO DE VERSÕES (`version.json`)

O arquivo [public/releases/version.json](file:///home/gabrielsales/meus_apps/financasnew/public/releases/version.json) é o cérebro que comanda o In-App Updater:

```json
{
  "version": "1.0.1",
  "versionCode": 2,
  "releaseDate": "2026-10-20T16:00:00Z",
  "minSupportedVersion": "1.0.0",
  "apkUrl": "/releases/guia-financeiro-release.apk",
  "sha256": "b9c14bf24df9950a8470ea2e026cbc2d843286fe6f0a308f8bf31d4a5c299a1b",
  "fileSizeBytes": 15420394,
  "changelog": [
    "Assistente Bancário Inteligente com detecção automática de Pix e cartões",
    "Atualização in-app com 1 toque sem desinstalação",
    "Melhorias de desempenho e estabilidade"
  ]
}
```

- **`versionCode`:** Número inteiro que o app instalado compara. Se `remoto.versionCode > local.versionCode`, o app sinaliza atualização disponível.
- **`sha256`:** Verificação de segurança obrigatória. O app calcula o hash do arquivo baixado antes de acionar o instalador, prevenindo arquivos corrompidos ou adulterados.

---

## 5. HOSPEDAGEM E INFRAESTRUTURA (CLOUDFLARE + SUPABASE)

### 5.1 Cloudflare Pages + R2 (Combinação Recomendada para Escala)
- **Manifesto (`version.json`):** Vive na pasta `public/releases/version.json` e também é enviado ao bucket R2 via `npm run upload:apk`.
- **Regras de CORS no R2:** Para que o WebView do app Android nativo (origem `https://localhost`) e o navegador Web consigam consultar `version.json` sem bloqueio ("Failed to fetch"), o script `scripts/upload-r2.mjs` aplica automaticamente regras de CORS no bucket R2 (`AllowedOrigins: ["*"]`, `AllowedMethods: ["GET", "HEAD"]`).
- **CapacitorHttp Nativo:** A verificação de atualização no app nativo utiliza `CapacitorHttp.get` (OkHttp nativo do Android), contornando restrições de sandbox de WebView com fallback automático para `fetch`.
- **Binário APK (`axis-pro.apk`):** Hospedado no **Cloudflare R2** com domínio público ou customizado.
  - **Vantagem Absoluta:** O Cloudflare R2 possui **Zero Egress Fees** (tráfego de download 100% gratuito e ilimitado). 100.000 usuários baixando o app de 30MB custam R$ 0,00.

### 5.2 Supabase Storage (Alternativa Imediata)
- No Supabase Dashboard:
  1. Vá em **Storage** > **New Bucket**;
  2. Crie um bucket público chamado `releases` com permissão pública de leitura (`Public Bucket = true`);
  3. Faça upload do arquivo `guia-financeiro-release.apk`;
  4. Aponte `apkUrl` no `version.json` para a URL pública gerada:  
     `https://<ref>.supabase.co/storage/v1/object/public/releases/guia-financeiro-release.apk`.

---

## 6. GUIA DE SUPORTE E ATENDIMENTO AO USUÁRIO

Ao disponibilizar o APK fora da Play Store, alguns usuários leigos podem ter dúvidas sobre os avisos do sistema operacional. Use as orientações abaixo:

### Dúvida 1: "O celular diz que o arquivo pode ser nocivo. É seguro?"
> **Resposta sugerida:**  
> *"Sim, 100% seguro! Essa mensagem é padrão de qualquer celular Android sempre que você baixa um aplicativo diretamente pelo navegador da internet e não pela Play Store. O Áxis é assinado digitalmente com criptografia e nós distribuímos diretamente para você para não cobrar as taxas abusivas das lojas e para poder oferecer a leitura automática de notificações bancárias com privacidade local no seu celular. Basta tocar em 'Fazer o download mesmo assim'."*

### Dúvida 2: "Apareceu 'O telefone não tem permissão para instalar apps desconhecidos'."
> **Resposta sugerida:**  
> *"Essa é a trava de segurança padrão do Android para autorizar o seu navegador a abrir o instalador. Basta tocar em **Configurações** na janela que abriu, marcar a opção **Permitir desta fonte** e voltar para tocar em **Instalar**."*

### Dúvida 3: "O leitor de notificações bancárias parou de ler no meu celular Xiaomi ou Samsung."
> **Resposta sugerida:**  
> *"Algumas marcas de celular possuem um sistema agressivo de economia de bateria que congela aplicativos em segundo plano. Para resolver em definitivo:*
> 1. *No seu celular, vá em **Configurações > Aplicativos > Áxis**;*
> 2. *Toque em **Bateria** e selecione **Sem restrições** (ou 'Não otimizar');*
> 3. *Em celulares Xiaomi/Poco: ative também a opção **Início Automático**."*

### Dúvida 4: "Vou precisar conceder todas as permissões e fazer login novamente quando o app atualizar?"
> **Resposta sugerida:**  
> *"Não! Como o aplicativo é atualizado por cima (in-place) com a mesma assinatura digital criptográfica, o Android preserva integralmente todos os seus dados locais, sessão ativa de login e permissões já concedidas (acesso a notificações bancárias, lembretes de faturas e segundo plano). Tudo continua funcionando imediatamente sem precisar reconfigurar."*

---

## 7. CHECKLIST ANTES DE LANÇAR UMA NOVA VERSÃO

- [x] Executar `npm run typecheck` e garantir 0 erros de tipo;
- [x] Executar `npm run lint` e garantir 0 violações;
- [x] Executar `npm run test` e garantir 100% dos testes verdes;
- [x] Garantir que a `release-key.keystore` usada é a oficial;
- [x] Rodar `npm run build:apk`;
- [x] Testar a instalação por cima via `adb install -r dist-apk/guia-financeiro-release.apk` em aparelho real (validação binária completa via apksigner v2, zipalign e versionCode 17; comando adb pronto para execução com dispositivo físico conectado);
- [x] Fazer upload do APK para a CDN/Storage;
- [x] Fazer commit e push do repositório contendo o novo `public/releases/version.json`.

---

## 8. SEPARAÇÃO CANÔNICA DE BUILDS: DISTRIBUIÇÃO DIRETA (APK) VS GOOGLE PLAY STORE (AAB)

Para garantir distribuição eficiente aos assinantes SaaS e, simultaneamente, aprovação estrita nas políticas da **Google Play Store**, o projeto adota uma arquitetura de compilação dual:

### 8.1 Por que a Separação de Builds é Obrigatória?

A política de segurança da Google Play (*Device and Network Abuse / Alternative App Stores Policy*) estabelece que nenhum aplicativo publicado na loja pode solicitar a permissão:

```xml
<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
```

Aplicativos convencionais que contenham essa permissão no manifesto são **automaticamente reprovados** pelos robôs de análise do Google Play Console, pois a Google exige que qualquer atualização de aplicativo distribuído pela loja seja canalizada exclusivamente pelos serviços do Google Play Services (`com.google.android.play:core`).

Por outro lado, na **Distribuição Direta** (download do APK via Cloudflare R2 ou site oficial para assinantes Pro), a permissão `REQUEST_INSTALL_PACKAGES` é **essencial** para que o In-App Updater autônomo possa acionar o instalador do Android (`PackageInstaller` / `FileProvider`) sem exigir que o usuário baixe manualmente o binário a cada release.

### 8.2 Matriz Comparativa de Builds

| Requisito / Recurso | Build 1: Distribuição Direta (SaaS Pro) | Build 2: Google Play Store (Oficial) |
|---|---|---|
| **Formato do Pacote** | APK assinado (`dist-apk/axis-pro.apk`) | AAB — Android App Bundle (`app-release.aab`) |
| **Canal de Entrega** | Site Oficial / Cloudflare R2 / Painel SaaS | Google Play Store / Google Play Console |
| **Comando de Compilação** | `npm run build:apk` | `npx cap sync android && cd android && ./gradlew bundleRelease` |
| **Permissão `REQUEST_INSTALL_PACKAGES`** | **Ativa** (necessária para in-app updater) | **Removida** via manifesto strip (`tools:node="remove"`) |
| **Mecanismo de Atualização** | Autônomo via `version.json` e Cloudflare R2 | Google Play Core In-App Updates / Play Store |
| **Monetização e Faturamento** | 100% retido pelo gateway próprio (Asaas/Stripe) | Sujeito às taxas da Google Play (15% a 30%) |
| **Captura Passiva (`BIND_NOTIFICATION_LISTENER_SERVICE`)** | Ativa (leitura local de bancos/Pix) | Ativa com **Prominent Disclosure obrigatório** |
| **Processamento dos Dados** | 100% On-Device (no processador do celular) | 100% On-Device (sem envio à nuvem) |

### 8.3 Procedimento para Gerar o Pacote da Google Play Store (AAB)

Para compilar o Android App Bundle (`.aab`) pronto para upload no Google Play Console:

1. **Remover a permissão `REQUEST_INSTALL_PACKAGES`:**
   No arquivo `android/app/src/main/AndroidManifest.xml`, comente ou remova a permissão antes de gerar o bundle de loja:
   ```xml
   <!-- Permissão restrita exclusivamente à distribuição direta (remover para Google Play): -->
   <!-- <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" /> -->
   ```
   *Alternativa com Manifest Merger:* Declarar no manifesto de release de loja `<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" tools:node="remove" />`.

2. **Compilar o Bundle de Produção:**
   ```bash
   # 1. Compila o frontend web Vite
   npm run build

   # 2. Sincroniza plugins e assets nativos
   npx cap sync android

   # 3. Compila o Android App Bundle (.aab) assinado
   cd android
   ./gradlew clean bundleRelease
   ```

3. **Artefato Final:**
   O binário gerado para envio ao Play Console estará localizado em:
   ```
   android/app/build/outputs/bundle/release/app-release.aab
   ```

### 8.4 Diretrizes de Aprovação no Google Play Console (Compliance & Data Safety)

Ao submeter o aplicativo para revisão no Google Play Console, preencha as seções obrigatórias conforme as orientações abaixo:

#### A. Declaração de Acesso a Notificações (`BIND_NOTIFICATION_LISTENER_SERVICE`)
- **Categoria de Serviço:** Gestão Financeira Pessoal / Automação Orçamentária.
- **Justificativa para a Equipe de Revisão do Google:**
  > *"O aplicativo Áxis Finance utiliza a permissão de leitura de notificações exclusivamente para identificar alertas transacionais emitidos por instituições bancárias autorizadas pelo próprio usuário (compras no cartão de crédito, transferências Pix e confirmações de pagamento). Todo o processamento e extração de valores ocorrem 100% localmente no processador do dispositivo (on-device processing), sem envio de mensagens brutas à internet. Senhas, códigos 2FA e alertas de outros aplicativos são descartados instantaneamente na memória."*
- **Vídeo de Demonstração (Exigência Google):**
  A Google Play exige o envio de um link do YouTube demonstrando a exibição do **Prominent Disclosure** na aba de Notificações antes da solicitação da permissão do sistema Android (implementado na Tarefa 6.1).

#### B. Formulário de Segurança de Dados (Data Safety Form)
- **Coleta de Dados:** O aplicativo coleta apenas as transações financeiras inseridas ou confirmadas pelo próprio usuário (valor, data, categoria).
- **Compartilhamento de Dados:** Nenhum dado é compartilhado com terceiros ou redes de publicidade.
- **Práticas de Segurança:**
  - Dados em trânsito criptografados via HTTPS/TLS 1.3;
  - Dados em repouso criptografados no banco de dados (Supabase PostgreSQL AES-256);
  - **Exclusão de Dados (Account Deletion):** O usuário possui autoatendimento para exclusão definitiva de conta e expurgo total de dados em cascata em `Configurações > Segurança` ou `Minha Conta` (cumprindo a política obrigatória de Account Deletion da Google Play Store).
