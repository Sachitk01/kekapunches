import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

let client;
beforeAll(async () => {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) throw new Error('DATABASE_URL not set for integration test');
  client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
});

afterAll(async () => {
  if (client) await client.end();
});

describe('DB integration', () => {
  it('has user_mappings table and can insert/read', async () => {
    // ensure table exists
    const res = await client.query(`SELECT to_regclass('public.user_mappings') as exists`);
    expect(res.rows[0].exists).toBeTruthy();

    // insert a row and read it back
    await client.query(`INSERT INTO user_mappings (slack_user_id, keka_employee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, ['test-u', 'E1']);
    const r = await client.query(`SELECT slack_user_id, keka_employee_id FROM user_mappings WHERE slack_user_id = $1`, ['test-u']);
    expect(r.rows.length).toBeGreaterThanOrEqual(1);
    expect(r.rows[0].keka_employee_id).toBe('E1');
  });
});
