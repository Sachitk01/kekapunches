import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import crypto from 'crypto';

// Mock external modules to avoid network calls
vi.mock('../lib/slackClient.js', () => ({
  getUserEmail: async () => 'alice@example.com',
  getUserInfo: async () => ({ real_name: 'Alice' }),
  postDM: async () => true,
  postEphemeral: async () => true
}));

vi.mock('../lib/kekaClient.js', () => ({
  findEmployeeByEmail: async (email) => ({ employeeId: 'E123', employeeNumber: '1001', email, raw: {} }),
  punchAttendance: async () => ({ ok: true })
}));

vi.mock('../lib/db.js', () => ({ default: { query: vi.fn().mockResolvedValue({ rows: [] }) } }));

describe('integration - http endpoints', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /slack/slash login flow (signed) returns ephemeral response', async () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = 'token=xxx&team_id=T123&team_domain=example&channel_id=C1&channel_name=general&user_id=U1&user_name=alice&command=%2Fkeka&text=login&response_url=https%3A%2F%2Fexample.com';
    const secret = 'test_signing_secret';
    process.env.SLACK_SIGNING_SECRET = secret;
    const base = `v0:${timestamp}:${rawBody}`;
    const h = crypto.createHmac('sha256', secret).update(base).digest('hex');
    const sig = `v0=${h}`;

    const res = await request(app)
      .post('/slack/slash')
      .set('x-slack-request-timestamp', timestamp)
      .set('x-slack-signature', sig)
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(res.body.response_type).toBe('ephemeral');
  });
});
