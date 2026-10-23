#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Script de Automação de Build & Distribuição de APKs Android
# Guia Financeiro — Aplicativo PWA / Capacitor Android
# ==============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="${PROJECT_ROOT}/android"
APP_DIR="${ANDROID_DIR}/app"
DIST_DIR="${PROJECT_ROOT}/dist-apk"
PUBLIC_RELEASES_DIR="${PROJECT_ROOT}/public/releases"

# 0. Carregamento seguro de variáveis de ambiente (.env.local / .env)
if [ -f "${PROJECT_ROOT}/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${PROJECT_ROOT}/.env.local"
  set +a
elif [ -f "${PROJECT_ROOT}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${PROJECT_ROOT}/.env"
  set +a
fi

KEYSTORE_PATH="${KEYSTORE_PATH:-${APP_DIR}/release-key.keystore}"
KEY_ALIAS="${KEY_ALIAS:-guiafinanceiro}"
STORE_PASS="${KEYSTORE_PASSWORD:-${STORE_PASS:-}}"
KEY_PASS="${KEY_PASSWORD:-${STORE_PASS}}"

if [ -z "${STORE_PASS}" ]; then
  echo "ERRO DE SEGURANCA: A variavel KEYSTORE_PASSWORD nao foi definida."
  echo "Por favor, defina KEYSTORE_PASSWORD no seu arquivo .env ou .env.local (nunca no Git)."
  exit 1
fi

# 1. Configuração do JDK compatível (prioriza JDK 21 LTS se instalado)
if [ -d "${HOME}/.local/share/jvm/jdk-21" ]; then
  export JAVA_HOME="${HOME}/.local/share/jvm/jdk-21"
  export PATH="${JAVA_HOME}/bin:${PATH}"
elif [ -z "${JAVA_HOME:-}" ]; then
  if command -v java >/dev/null 2>&1; then
    echo "Usando Java do sistema: $(java -version 2>&1 | head -n 1)"
  fi
fi

# Configuração do Android SDK
if [ -d "${HOME}/Android/Sdk" ]; then
  export ANDROID_HOME="${HOME}/Android/Sdk"
  export ANDROID_SDK_ROOT="${ANDROID_HOME}"
  export PATH="${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${PATH}"
fi

# 2. Resolução determinística de versão
PACKAGE_VERSION=$(node -p "require('${PROJECT_ROOT}/package.json').version || '1.0.0'")
CURRENT_VERSION_JSON="${PUBLIC_RELEASES_DIR}/version.json"

if [ -z "${APP_VERSION_CODE:-}" ]; then
  if [ -f "${CURRENT_VERSION_JSON}" ]; then
    PREV_CODE=$(node -p "try { require('${CURRENT_VERSION_JSON}').versionCode || 1 } catch(e) { 1 }")
    APP_VERSION_CODE=$((PREV_CODE + 1))
  else
    APP_VERSION_CODE=1
  fi
fi

APP_VERSION_NAME="${APP_VERSION_NAME:-${PACKAGE_VERSION}}"

echo "=========================================================="
echo "  Áxis / Guia Financeiro — Compilação e Distribuição      "
echo "=========================================================="
echo "Diretório do projeto : ${PROJECT_ROOT}"
echo "Versão Semântica     : ${APP_VERSION_NAME}"
echo "Código da Versão     : ${APP_VERSION_CODE}"
echo "Java Home            : ${JAVA_HOME:-$(which java 2>/dev/null || echo 'Nao encontrado')}"
echo "Android SDK          : ${ANDROID_HOME:-Nao definido}"
echo "=========================================================="

# 3. Geração da chave criptográfica de release (se não existir)
if [ ! -f "${KEYSTORE_PATH}" ]; then
  echo ""
  echo "-> Gerando chave de assinatura de release fixa (RSA 2048 bits)..."
  keytool -genkeypair \
    -v \
    -keystore "${KEYSTORE_PATH}" \
    -alias "${KEY_ALIAS}" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass "${STORE_PASS}" \
    -keypass "${STORE_PASS}" \
    -dname "CN=Guia Financeiro, OU=Mobile, O=Guia Financeiro, L=Brasilia, ST=DF, C=BR"
  echo "Chave de assinatura gerada em: ${KEYSTORE_PATH}"
else
  echo "Chave de assinatura permanente localizada: ${KEYSTORE_PATH}"
fi

# 4. Compilação do Web App (Vite)
echo ""
echo "-> 1/4 Compilando bundle de produção Web..."
cd "${PROJECT_ROOT}"
npm run build

# 5. Sincronização do Capacitor com Android
echo ""
echo "-> 2/4 Sincronizando assets e plugins nativos com Capacitor..."
npx cap sync android

# 6. Compilação dos APKs (Debug & Release) via Gradle
echo ""
echo "-> 3/4 Compilando APKs Android via Gradle Wrapper (v${APP_VERSION_NAME} - code ${APP_VERSION_CODE})..."
cd "${ANDROID_DIR}"
export KEYSTORE_PATH="release-key.keystore"
export KEYSTORE_PASSWORD="${STORE_PASS}"
export KEY_ALIAS="${KEY_ALIAS}"
export KEY_PASSWORD="${KEY_PASS}"
export APP_VERSION_CODE="${APP_VERSION_CODE}"
export APP_VERSION_NAME="${APP_VERSION_NAME}"

./gradlew clean assembleDebug assembleRelease

# 7. Organização e cópia dos APKs para dist-apk/ e public/releases/
echo ""
echo "-> 4/4 Organizando artefatos finais..."
mkdir -p "${DIST_DIR}"
mkdir -p "${PUBLIC_RELEASES_DIR}"

DEBUG_SOURCE="${APP_DIR}/build/outputs/apk/debug/app-debug.apk"
RELEASE_SOURCE="${APP_DIR}/build/outputs/apk/release/app-release.apk"

if [ -f "${DEBUG_SOURCE}" ]; then
  cp -f "${DEBUG_SOURCE}" "${DIST_DIR}/guia-financeiro-debug.apk"
  echo "  [OK] Debug APK   : ${DIST_DIR}/guia-financeiro-debug.apk ($(du -h "${DIST_DIR}/guia-financeiro-debug.apk" | cut -f1))"
fi

if [ -f "${RELEASE_SOURCE}" ]; then
  cp -f "${RELEASE_SOURCE}" "${DIST_DIR}/guia-financeiro-release.apk"
  cp -f "${RELEASE_SOURCE}" "${DIST_DIR}/axis-pro.apk"
  echo "  [OK] Release APK : ${DIST_DIR}/guia-financeiro-release.apk ($(du -h "${DIST_DIR}/guia-financeiro-release.apk" | cut -f1))"
fi

# 8. Cálculo de Hashes e Geração do Manifesto version.json
RELEASE_FILE="${DIST_DIR}/guia-financeiro-release.apk"
if [ -f "${RELEASE_FILE}" ]; then
  SHA256_HASH=$(sha256sum "${RELEASE_FILE}" | awk '{print $1}')
  FILE_SIZE=$(stat -c%s "${RELEASE_FILE}" 2>/dev/null || stat -f%z "${RELEASE_FILE}" 2>/dev/null || echo 0)
  RELEASE_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Gera o manifesto version.json
  APK_DOWNLOAD_LINK="${APK_DOWNLOAD_URL:-https://pub-8b490da0649647f0a70d2eff96bd39e0.r2.dev/guia-financeiro-release.apk}"

  cat <<EOF > "${PUBLIC_RELEASES_DIR}/version.json"
{
  "version": "${APP_VERSION_NAME}",
  "versionCode": ${APP_VERSION_CODE},
  "releaseDate": "${RELEASE_DATE}",
  "minSupportedVersion": "${APP_VERSION_NAME}",
  "apkUrl": "${APK_DOWNLOAD_LINK}",
  "sha256": "${SHA256_HASH}",
  "fileSizeBytes": ${FILE_SIZE},
  "changelog": [
    "Smart Advisor com fila sequencial de insights e microinteracoes",
    "Integracao de alertas criticos a Central Global de Notificacoes",
    "Painel de auditoria e revogacao de memoria do assistente",
    "Contextualizacao de fatura e limite disponivel no card do assistente",
    "Deteccao avancada de recorrencias anuais, semanais e parser Pix"
  ]
}
EOF

  cp -f "${PUBLIC_RELEASES_DIR}/version.json" "${DIST_DIR}/version.json"
  echo "  [OK] Manifesto   : ${PUBLIC_RELEASES_DIR}/version.json"
  echo "  [OK] Hash SHA-256: ${SHA256_HASH}"
fi

echo ""
echo "=========================================================="
echo "  Compilação concluída com sucesso!                       "
echo "=========================================================="
echo "APKs gerados na pasta dist-apk/:"
ls -lh "${DIST_DIR}"/*.apk 2>/dev/null || true

if [ -n "${R2_ACCESS_KEY_ID}" ] && [ -n "${R2_SECRET_ACCESS_KEY}" ]; then
  echo ""
  echo "-> 5/5 Credenciais Cloudflare R2 detectadas. Disparando upload automatizado..."
  cd "${PROJECT_ROOT}"
  node scripts/upload-r2.mjs || echo "  [AVISO] Falha ao enviar para o R2. Você pode rodar 'npm run upload:apk' manualmente."
else
  echo ""
  echo "Para enviar automaticamente os arquivos para o Cloudflare R2:"
  echo "  Configure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY no .env e execute:"
  echo "  npm run upload:apk"
fi

echo ""
echo "Para instalar ou atualizar no aparelho físico via USB/WiFi:"
echo "  adb install -r dist-apk/guia-financeiro-release.apk"
echo "=========================================================="
