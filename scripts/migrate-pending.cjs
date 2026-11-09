const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const k = trimmed.slice(0, eqIdx).trim();
        const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
}

loadEnv();

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('SUPABASE_DB_URL não encontrada no .env');
  process.exit(1);
}

const migrationsToApply = [
  {
    version: '20260101000106',
    name: 'admin_refactor_and_governance',
    file: path.resolve(__dirname, '..', 'supabase/migrations/20260101000106_admin_refactor_and_governance.sql')
  },
  {
    version: '20260101000107',
    name: 'superadmin_extensions',
    file: path.resolve(__dirname, '..', 'supabase/migrations/20260101000107_superadmin_extensions.sql')
  }
];

async function run() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  console.log('Conectando ao banco Supabase...');
  await client.connect();

  try {
    for (const m of migrationsToApply) {
      const checkRes = await client.query(
        'SELECT version FROM supabase_migrations.schema_migrations WHERE version = $1',
        [m.version]
      );
      if (checkRes.rows.length > 0) {
        console.log(`Migração ${m.version} (${m.name}) já foi aplicada anteriormente.`);
        continue;
      }

      console.log(`Aplicando migração ${m.version}: ${m.name}...`);
      const sql = fs.readFileSync(m.file, 'utf8');

      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ($1, $2)',
        [m.version, m.name]
      );
      await client.query('COMMIT');
      console.log(`Migração ${m.version} concluída com sucesso.`);
    }

    console.log('Todas as migrações pendentes foram aplicadas com sucesso!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao aplicar migrações:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
