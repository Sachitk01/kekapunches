import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/db.js', () => ({ default: { query: vi.fn() } }));
vi.mock('../lib/metrics.js', () => ({
  incrementCounter: vi.fn(),
  initMetrics: vi.fn(),
  getMetrics: vi.fn(() => 'test metrics')
}));

import * as approvalsService from '../services/approvalsService.js';
import db from '../lib/db.js';
import { incrementCounter } from '../lib/metrics.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('approvalsService', () => {
  it('createApproval increments counter and returns approval ID', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 42 }] });
    const id = await approvalsService.createApproval({
      slackUserId: 'U1',
      date: '2025-11-15',
      requestType: 'FIRST_LOGIN',
      reason: 'First login of the day'
    });
    expect(id).toBe(42);
    expect(incrementCounter).toHaveBeenCalledWith('approvals_created_total', 1);
  });

  it('approveApproval updates status and increments counter', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, status: 'APPROVED', request_type: 'FIRST_LOGIN' }]
    });
    const result = await approvalsService.approveApproval(1, 'U2', 'Looks good');
    expect(result.status).toBe('APPROVED');
    expect(incrementCounter).toHaveBeenCalledWith('approvals_approved_total', 1);
  });

  it('rejectApproval updates status and increments counter', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, status: 'REJECTED' }]
    });
    const result = await approvalsService.rejectApproval(1, 'U2', 'Denied');
    expect(result.status).toBe('REJECTED');
    expect(incrementCounter).toHaveBeenCalledWith('approvals_rejected_total', 1);
  });
});
