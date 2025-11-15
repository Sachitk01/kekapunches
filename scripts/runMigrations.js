import { execSync } from 'child_process';
import dotenv from 'dotenv';
dotenv.config();
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}
const migrations = ['db/migrations/001_init.sql','db/migrations/002_attendance_state.sql'];
for (const m of migrations) {
  console.log('Applying', m);
  execSync(`psql "${DATABASE_URL}" -f ${m}`, { stdio: 'inherit' });
}
console.log('Migrations applied');
