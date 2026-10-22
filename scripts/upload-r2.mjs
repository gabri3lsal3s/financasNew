#!/usr/bin/env node

/**
 * Script de Upload Automatizado de APKs para o Cloudflare R2
 *
 * Uso:
 *   node scripts/upload-r2.mjs
 *   ou via npm:
 *   npm run upload:apk
 *
 * Variáveis necessárias no seu .env ou .env.local (nunca commitados no Git):
 *   R2_ACCOUNT_ID          ID da sua conta Cloudflare
 *   R2_ACCESS_KEY_ID       Chave de acesso R2 (Access Key ID)
 *   R2_SECRET_ACCESS_KEY   Chave secreta R2 (Secret Access Key)
 *   R2_BUCKET_NAME         Nome do bucket (ex: axis-releases)
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const env = {};
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

const envLocal = loadEnvFile(join(root, ".env.local"));
const envBase = loadEnvFile(join(root, ".env"));
const env = { ...process.env, ...envBase, ...envLocal };

const accountId = env.R2_ACCOUNT_ID;
const accessKeyId = env.R2_ACCESS_KEY_ID;
const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
const bucketName = env.R2_BUCKET_NAME || "axis-releases";

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.error("\n============================================================");
  console.error("  [ERRO] Credenciais do Cloudflare R2 não configuradas!");
  console.error("============================================================");
  console.error("Para habilitar o envio automático, adicione ao seu arquivo .env ou .env.local:");
  console.error("  R2_ACCOUNT_ID=seu_account_id_aqui");
  console.error("  R2_ACCESS_KEY_ID=sua_access_key_aqui");
  console.error("  R2_SECRET_ACCESS_KEY=sua_secret_access_key_aqui");
  console.error(`  R2_BUCKET_NAME=${bucketName}`);
  console.error("============================================================\n");
  process.exit(1);
}

const apkPath = join(root, "dist-apk", "guia-financeiro-release.apk");

if (!existsSync(apkPath)) {
  console.error(`\n[ERRO] APK de release não encontrado em: ${apkPath}`);
  console.error("Execute primeiro: npm run build:apk\n");
  process.exit(1);
}

const fileSize = statSync(apkPath).size;
const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);

console.log("\n==========================================================");
console.log("  Iniciando Upload do APK para o Cloudflare R2             ");
console.log("==========================================================");
console.log(`Bucket      : ${bucketName}`);
console.log(`Arquivo     : guia-financeiro-release.apk (${sizeMB} MB)`);
console.log(`Endpoint R2 : https://${accountId}.r2.cloudflarestorage.com`);
console.log("==========================================================");

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function upload() {
  const fileBuffer = readFileSync(apkPath);

  console.log("\n-> Enviando guia-financeiro-release.apk...");
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: "guia-financeiro-release.apk",
    Body: fileBuffer,
    ContentType: "application/vnd.android.package-archive",
    ContentDisposition: 'attachment; filename="guia-financeiro-release.apk"',
  });

  const startTime = Date.now();
  await s3.send(command);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`  [OK] guia-financeiro-release.apk enviado com sucesso em ${elapsed}s!`);

  // Envia também uma cópia com alias axis-pro.apk
  console.log("-> Atualizando alias axis-pro.apk...");
  const aliasCommand = new PutObjectCommand({
    Bucket: bucketName,
    Key: "axis-pro.apk",
    Body: fileBuffer,
    ContentType: "application/vnd.android.package-archive",
    ContentDisposition: 'attachment; filename="axis-pro.apk"',
  });
  await s3.send(aliasCommand);
  console.log("  [OK] axis-pro.apk atualizado com sucesso!");

  // Garante que o bucket tenha regras de CORS públicas para que tanto o app nativo quanto a web
  // consigam consultar o version.json e baixar os APKs sem bloqueios de navegador.
  console.log("-> Configurando regras de CORS no bucket Cloudflare R2...");
  try {
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: bucketName,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ["*"],
              AllowedMethods: ["GET", "HEAD"],
              AllowedOrigins: ["*"],
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      })
    );
    console.log("  [OK] Regras de CORS (AllowedOrigins: *) aplicadas com sucesso!");
  } catch (corsErr) {
    console.warn("  [AVISO] Nao foi possivel configurar CORS automaticamente:", corsErr.message);
  }

  // Envia o manifesto version.json para viabilizar consultas remotas
  const versionPath = join(root, "public", "releases", "version.json");
  if (existsSync(versionPath)) {
    console.log("-> Enviando manifesto version.json...");
    const versionBuffer = readFileSync(versionPath);
    const versionCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: "version.json",
      Body: versionBuffer,
      ContentType: "application/json",
      CacheControl: "no-cache, no-store, must-revalidate",
    });
    await s3.send(versionCommand);
    console.log("  [OK] version.json enviado com sucesso!");
  }

  console.log("\n==========================================================");
  console.log("  Upload para o Cloudflare R2 concluído com sucesso!      ");
  console.log("==========================================================");
  console.log("URLs públicas para download direto:");
  console.log(`  https://pub-8b490da0649647f0a70d2eff96bd39e0.r2.dev/guia-financeiro-release.apk`);
  console.log(`  https://pub-8b490da0649647f0a70d2eff96bd39e0.r2.dev/axis-pro.apk`);
  console.log(`  https://pub-8b490da0649647f0a70d2eff96bd39e0.r2.dev/version.json`);
  console.log("==========================================================\n");
}

upload().catch((err) => {
  console.error("\n[FALHA NO UPLOAD R2]:", err.message || err);
  process.exit(1);
});
