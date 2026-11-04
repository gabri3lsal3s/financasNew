/**
 * scripts/generate-play-protect-appeal.ts
 *
 * Gera o relatório formatado de dados e textos prontos para submissão
 * do APK Áxis no formulário de Apelação do Google Play Protect:
 * https://support.google.com/googleplay/android-developer/contact/protectappeals
 *
 * Uso: npm run playprotect:info
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const ROOT_DIR = process.cwd();
const VERSION_JSON_PATH = path.join(ROOT_DIR, "public", "releases", "version.json");
const KEYSTORE_PATH = path.join(ROOT_DIR, "android", "app", "release-key.keystore");
const APK_DIST_PATH = path.join(ROOT_DIR, "dist-apk", "guia-financeiro-release.apk");

interface VersionManifest {
  version: string;
  versionCode: number;
  apkUrl: string;
  sha256: string;
  releaseDate: string;
}

function getManifest(): VersionManifest | null {
  if (fs.existsSync(VERSION_JSON_PATH)) {
    try {
      const raw = fs.readFileSync(VERSION_JSON_PATH, "utf-8");
      return JSON.parse(raw) as VersionManifest;
    } catch {
      return null;
    }
  }
  return null;
}

function getCertificateFingerprint(): string {
  if (!fs.existsSync(KEYSTORE_PATH)) {
    return "Keystore não encontrado em android/app/release-key.keystore";
  }

  try {
    const output = execSync(
      `LC_ALL=C keytool -list -v -keystore "${KEYSTORE_PATH}" -alias guiafinanceiro -storepass guiafinanceiro123`,
      { encoding: "utf-8" },
    );
    const match = output.match(/SHA256:\s*([A-F0-9:]+)/i);
    return match ? match[1].trim() : "Não foi possível extrair o SHA-256 via keytool";
  } catch (err) {
    return `Erro ao ler keystore: ${err instanceof Error ? err.message : String(err)}`;
  }
}

function getLocalApkSha256(): string | null {
  if (fs.existsSync(APK_DIST_PATH)) {
    const fileBuffer = fs.readFileSync(APK_DIST_PATH);
    return crypto.createHash("sha256").update(fileBuffer).digest("hex");
  }
  return null;
}

function run(): void {
  const manifest = getManifest();
  const certSha256 = getCertificateFingerprint();
  const localApkSha256 = getLocalApkSha256();

  const packageName = "com.guiafinanceiro.app";
  const appName = "Áxis — Controle Financeiro";
  const downloadUrl = manifest?.apkUrl || "https://pub-8b490da0649647f0a70d2eff96bd39e0.r2.dev/guia-financeiro-release.apk";
  const apkSha256 = localApkSha256 || manifest?.sha256 || "Execute npm run build:apk para calcular";

  console.log("===============================================================================");
  console.log("             DADOS PARA APELAÇÃO DO GOOGLE PLAY PROTECT (WHITELIST)           ");
  console.log("===============================================================================\n");

  console.log("Formulário Oficial de Submissão:");
  console.log("  -> https://support.google.com/googleplay/android-developer/contact/protectappeals\n");

  console.log("-------------------------------------------------------------------------------");
  console.log("1. CAMPOS PARA PREENCHIMENTO NO FORMULÁRIO");
  console.log("-------------------------------------------------------------------------------");
  console.log(`• Developer Name (Nome do Desenvolvedor) : Gabriel Sales`);
  console.log(`• Developer Email (E-mail de Contato)    : suporte@axisapp.com.br (ou seu Gmail pessoal de dev)`);
  console.log(`• Application Package Name (Package ID)  : ${packageName}`);
  console.log(`• App Name (Nome da Aplicação)           : ${appName}`);
  console.log(`• Download Link to APK (URL Pública)     : ${downloadUrl}`);
  console.log(`• Certificate SHA-256 Fingerprint        : ${certSha256}`);
  console.log(`• APK File SHA-256 Hash                  : ${apkSha256}`);
  console.log("\n");

  console.log("-------------------------------------------------------------------------------");
  console.log("2. JUSTIFICATIVA EM INGLÊS (RECOMENDADO PARA O GOOGLE)");
  console.log("-------------------------------------------------------------------------------");
  const justificationEn = `Dear Google Play Protect Team,

Our application "${appName}" (Package: ${packageName}) is a legitimate personal finance and portfolio management tool distributed directly to Brazilian subscribers via our website.

Recently, users reported false-positive security warnings or blocks when downloading and installing our APK.

Key technical facts regarding our application:
1. Legitimacy: The application does not contain any malware, trojan, spyware, adware, or malicious payload.
2. Code & Permissions: All permissions requested (such as INTERNET and REQUEST_INSTALL_PACKAGES for in-app self-updates) are strictly used for legitimate app features and financial calculation.
3. Cryptographic Signature: The APK is signed with our official developer certificate (SHA-256: ${certSha256}).
4. Terms & Privacy: Our transparent terms and privacy policy comply with Brazil's General Data Protection Law (LGPD).

Please review our APK at the provided download link (${downloadUrl}) and whitelist this application package and signing certificate in Google Play Protect.

Thank you for your assistance.

Sincerely,
Gabriel Sales
Lead Developer`;
  console.log(justificationEn);
  console.log("\n");

  console.log("-------------------------------------------------------------------------------");
  console.log("3. JUSTIFICATIVA EM PORTUGUÊS (OPCIONAL)");
  console.log("-------------------------------------------------------------------------------");
  const justificationPt = `Prezada equipe do Google Play Protect,

Nosso aplicativo "${appName}" (Pacote: ${packageName}) é um software legítimo de gestão financeira pessoal e rebalanceamento de carteiras, distribuído diretamente aos nossos assinantes.

Identificamos que alguns dispositivos exibem avisos de falso-positivo durante a instalação ou atualização do APK.

Esclarecemos que:
- O aplicativo não possui códigos maliciosos, adwares ou spywares.
- Todas as permissões solicitadas são estritamente necessárias para a sincronização financeira e atualizações in-app automáticas.
- O aplicativo é assinado digitalmente com nossa keystore oficial (SHA-256: ${certSha256}).

Solicitamos a análise do APK disponível em ${downloadUrl} para inclusão na lista de segurança (whitelist) do Play Protect.

Atenciosamente,
Gabriel Sales`;
  console.log(justificationPt);
  console.log("\n===============================================================================");
}

run();
