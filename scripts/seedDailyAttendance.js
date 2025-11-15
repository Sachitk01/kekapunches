import fs from 'fs/promises';
import path from 'path';
import db from '../lib/db.js';

async function main() {
  try {
    const seedPath = path.resolve(new URL(import.meta.url).pathname, '../../db/seeds/seed_daily_attendance_state.sql');
    // On some platforms import.meta.url pathname is prefixed with /, normalize
    const normalized = seedPath.replace(/\/+/g, '/');
    const sql = await fs.readFile(normalized, 'utf8');
    console.log('Seeding daily_attendance_state...');
    await db.query(sql);
    console.log('Seed applied successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err?.message || err);
    process.exit(1);
  }
}

main();
