const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env'), quiet: true });

async function migrate(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('Falta DATABASE_URL para ejecutar las migraciones SQL');
  }

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "schema_migrations" (
        "name" TEXT PRIMARY KEY,
        "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const appliedRes = await client.query('SELECT "name" FROM "schema_migrations"');
    const applied = new Set(appliedRes.rows.map((row) => row.name));

    if (applied.size === 0) {
      const schemaCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'tokenVersion'
        ) AS ready;
      `);
      if (schemaCheck.rows[0]?.ready) {
        for (const file of files) {
          await client.query(
            'INSERT INTO "schema_migrations" ("name") VALUES ($1) ON CONFLICT ("name") DO NOTHING',
            [file],
          );
          applied.add(file);
        }
        console.log('Esquema PostgreSQL existente detectado; migraciones registradas en schema_migrations.');
      }
    }

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO "schema_migrations" ("name") VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Migración aplicada: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  migrate()
    .then(() => console.log('Base de datos PostgreSQL al día.'))
    .catch((error) => {
      console.error('Error en migración SQL:', error.code || error.message);
      process.exitCode = 1;
    });
}

module.exports = { migrate };
