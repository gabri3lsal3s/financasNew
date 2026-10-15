#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Script de Automação de Build & Distribuição de APKs Android (Fase 6)
# Guia Financeiro — Aplicativo PWA / Capacitor Android
# ==============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="${PROJECT_ROOT}/android"
APP_DIR="${ANDROID_DIR}/app"
DIST_DIR="${PROJECT_ROOT}/dist-apk"
KEYSTORE_PATH="${APP_DIR}/release-key.keystore"
KEY_ALIAS="guiafinanceiro"
STORE_PASS="guiafinanceiro123"

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

echo "=========================================================="
echo "  Guia Financeiro — Compilação e Distribuição de APKs     "
echo "=========================================================="
echo "Diretório do projeto : ${PROJECT_ROOT}"
echo "Java Home            : ${JAVA_HOME:-$(which java)}"
echo "Android SDK          : ${ANDROID_HOME:-Não definido}"
echo "=========================================================="

# 2. Geração da chave criptográfica de release (se não existir)
if [ ! -f "${KEYSTORE_PATH}" ]; then
  echo ""
  echo "-> Gerando chave de assinatura de release (RSA 2048 bits)..."
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
  echo "Chave de assinatura existente localizada: ${KEYSTORE_PATH}"
fi

# 3. Compilação do Web App (Vite)
echo ""
echo "-> 1/4 Compilando bundle de produção Web..."
cd "${PROJECT_ROOT}"
npm run build

# 4. Sincronização do Capacitor com Android
echo ""
echo "-> 2/4 Sincronizando assets e plugins nativos com Capacitor..."
npx cap sync android

# 5. Compilação dos APKs (Debug & Release) via Gradle
echo ""
echo "-> 3/4 Compilando APKs Android via Gradle Wrapper..."
cd "${ANDROID_DIR}"
export KEYSTORE_PATH="release-key.keystore"
export KEYSTORE_PASSWORD="${STORE_PASS}"
export KEY_ALIAS="${KEY_ALIAS}"
export KEY_PASSWORD="${STORE_PASS}"

./gradlew clean assembleDebug assembleRelease

# 6. Organização e cópia dos APKs para dist-apk/
echo ""
echo "-> 4/4 Organizando artefatos finais em ${DIST_DIR}..."
mkdir -p "${DIST_DIR}"

DEBUG_SOURCE="${APP_DIR}/build/outputs/apk/debug/app-debug.apk"
RELEASE_SOURCE="${APP_DIR}/build/outputs/apk/release/app-release.apk"

if [ -f "${DEBUG_SOURCE}" ]; then
  cp -f "${DEBUG_SOURCE}" "${DIST_DIR}/guia-financeiro-debug.apk"
  echo "  [OK] Debug APK   : ${DIST_DIR}/guia-financeiro-debug.apk ($(du -h "${DIST_DIR}/guia-financeiro-debug.apk" | cut -f1))"
fi

if [ -f "${RELEASE_SOURCE}" ]; then
  cp -f "${RELEASE_SOURCE}" "${DIST_DIR}/guia-financeiro-release.apk"
  echo "  [OK] Release APK : ${DIST_DIR}/guia-financeiro-release.apk ($(du -h "${DIST_DIR}/guia-financeiro-release.apk" | cut -f1))"
fi

echo ""
echo "=========================================================="
echo "  Compilação concluída com sucesso!                       "
echo "=========================================================="
echo "APKs gerados na pasta dist-apk/:"
ls -lh "${DIST_DIR}"/*.apk

echo ""
echo "Hashes de integridade (SHA-256):"
sha256sum "${DIST_DIR}"/*.apk

echo ""
echo "Para instalar no aparelho físico via USB/WiFi:"
echo "  adb install -r dist-apk/guia-financeiro-debug.apk"
echo "  ou"
echo "  adb install -r dist-apk/guia-financeiro-release.apk"
echo "=========================================================="
