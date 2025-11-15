import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const migrationsDir = path.resolve(process.cwd(), 'db', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    for (const f of files) {
      const full = path.join(migrationsDir, f);
      console.log('Applying', full);
      const sql = fs.readFileSync(full, 'utf8');
      await client.query(sql);
    }
    console.log('Migrations applied (pg)');
  } catch (err) {
    console.error('Migration failed', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) run();
