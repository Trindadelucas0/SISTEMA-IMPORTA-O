/**
 * Script standalone para inserir o catálogo de 28 produtos no banco da VPS.
 * Uso: node sql/seed_produtos_vps.js
 * Seguro reexecutar: não duplica produtos (ON CONFLICT DO NOTHING por codigo_interno).
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const SQL_DIR = __dirname;

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'paulo',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  });

  await client.connect();
  console.log(`Conectado ao banco "${process.env.DB_NAME || 'paulo'}".`);

  try {
    const migratePath = path.join(SQL_DIR, 'migrate_produtos.sql');
    await client.query(fs.readFileSync(migratePath, 'utf8'));
    console.log('Tabela produtos ok.');

    const seedPath = path.join(SQL_DIR, 'seed_produtos.sql');
    await client.query(fs.readFileSync(seedPath, 'utf8'));
    console.log('Seed de produtos aplicado.');

    const { rows } = await client.query(
      'SELECT codigo_interno, nome FROM produtos ORDER BY nome ASC'
    );
    console.log(`\nTotal de produtos no banco: ${rows.length}`);
    rows.forEach((p) => console.log(`  ${p.codigo_interno}  ${p.nome}`));
  } finally {
    await client.end();
  }
}

main()
  .then(() => {
    console.log('\nConcluído com sucesso.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Falha ao inserir produtos:', err);
    process.exit(1);
  });
