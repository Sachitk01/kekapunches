import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// Idempotent migration runner: records applied migrations in schema_migrations
async function run() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    // Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      )
    `);

    const migrationsDir = path.resolve(process.cwd(), 'db', 'migrations');
    const files = fs.existsSync(migrationsDir)
      ? fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
      : [];

    for (const f of files) {
      const full = path.join(migrationsDir, f);
      const sql = fs.readFileSync(full, 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');

      const res = await client.query('SELECT checksum FROM schema_migrations WHERE filename = $1', [f]);
      if (res.rows.length > 0) {
        const existing = res.rows[0].checksum;
        if (existing === checksum) {
          console.log('Skipping already applied migration', f);
          continue;
        } else {
          console.log('Migration file changed since last applied:', f);
          throw new Error(`Checksum mismatch for applied migration ${f}`);
        }
      }

      console.log('Applying', f);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)', [f, checksum]);
        await client.query('COMMIT');
        console.log('Applied', f);
      } catch (inner) {
        await client.query('ROLLBACK');
        throw inner;
      }
    }

    console.log('Migrations applied (pg)');
  } catch (err) {
    console.error('Migration failed', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (typeof process !== 'undefined' && process && process.argv && process.argv[1] && process.argv[1].endsWith('runMigrationsPg.js')) run();
