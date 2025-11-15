import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

// E2E tests expect the server to be running on localhost:3000
const base = 'http://localhost:3000';

describe('HTTP end-to-end', () => {
  it('GET /health returns ok', async () => {
    const res = await request(base).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
