import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';

vi.mock('../../lib/slackClient.js', () => ({
  getUserEmail: async () => 'alice@example.com',
  getUserInfo: async () => ({ real_name: 'Alice', id: 'U1' }),
  postDM: vi.fn(async () => true),
  postEphemeral: vi.fn(async () => true)
}));

vi.mock('../../lib/kekaClient.js', () => ({
  findEmployeeByEmail: async (email) => ({ employeeId: 'E123', employeeNumber: '1001', email, raw: {} }),
  punchAttendance: async () => ({ ok: true })
}));

vi.mock('../../lib/db.js', () => ({ default: { query: vi.fn().mockResolvedValue({ rows: [] }) } }));

// Mock slackVerification to pass through for testing
vi.mock('../../lib/slackVerification.js', () => ({
  default: (req, res, next) => next()
}));

// Mock approvalsService
vi.mock('../../services/approvalsService.js', () => ({
  getPendingApprovals: vi.fn(async () => []),
  getApprovalById: vi.fn(async (id) => ({ id, status: 'PENDING' })),
  approveApproval: vi.fn(async (id, approverId, notes) => ({ id, status: 'APPROVED' })),
  rejectApproval: vi.fn(async (id, approverId, notes) => ({ id, status: 'REJECTED' })),
  createApproval: vi.fn(async () => ({ id: 1 }))
}));

describe('HTTP endpoints', () => {
  it('GET /health returns ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /metrics returns Prometheus metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('keka_punch_total');
    expect(res.text).toContain('approvals_created_total');
  });

  it('POST /approvals/:id/approve returns 403 without approver_id', async () => {
    const res = await request(app)
      .post('/approvals/1/approve')
      .send({})
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Unauthorized');
  });

  it('POST /approvals/:id/reject returns 403 without approver_id', async () => {
    const res = await request(app)
      .post('/approvals/1/reject')
      .send({})
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Unauthorized');
  });
});
