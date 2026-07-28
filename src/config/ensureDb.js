const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const SQL_DIR = path.join(__dirname, '..', '..', 'sql');
const MIGRATIONS = [
  'migrate_custo_snapshot.sql',
  'migrate_saldo_alocacao.sql',
  'migrate_produtos.sql',
  'seed_produtos.sql',
];

function dbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  };
}

/**
 * Garante database, schema e migrations antes de subir a API.
 */
async function ensureDatabase() {
  const base = dbConfig();
  const dbName = process.env.DB_NAME || 'paulo';

  const admin = new Client({ ...base, database: 'postgres' });
  await admin.connect();
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database ${dbName} criado.`);
    } else {
      console.log(`Database ${dbName} ok.`);
    }
  } finally {
    await admin.end();
  }

  const appDb = new Client({ ...base, database: dbName });
  await appDb.connect();
  try {
    const schemaPath = path.join(SQL_DIR, 'schema.sql');
    await appDb.query(fs.readFileSync(schemaPath, 'utf8'));
    console.log('Schema ok.');

    await appDb.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const file of MIGRATIONS) {
      const migratePath = path.join(SQL_DIR, file);
      if (!fs.existsSync(migratePath)) continue;

      const already = await appDb.query('SELECT 1 FROM schema_migrations WHERE id = $1', [file]);
      if (already.rowCount > 0) {
        console.log(`Migration ${file} já aplicada.`);
        continue;
      }

      await appDb.query(fs.readFileSync(migratePath, 'utf8'));
      await appDb.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file]);
      console.log(`Migration ${file} aplicada.`);
    }
  } finally {
    await appDb.end();
  }
}

module.exports = { ensureDatabase };
