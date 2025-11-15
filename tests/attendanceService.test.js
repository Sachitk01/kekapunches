import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock db module by replacing its default export with an object with query fn
vi.mock('../lib/db.js', () => {
  return { default: { query: vi.fn() } };
});

import db from '../lib/db.js';
import * as attendanceService from '../services/attendanceService.js';

beforeEach(() => {
  db.query.mockReset();
});

describe('attendanceService - error paths', () => {
  it('startShortBreak throws NOT_LOGGED_IN when user not logged in', async () => {
    // getOrInitDailyState will call SELECT and return no rows, then INSERT returns a state with has_logged_in = false
    db.query
      .mockResolvedValueOnce({ rows: [] }) // select -> not found
      .mockResolvedValueOnce({ rows: [{ slack_user_id: 'U1', date: '2025-11-15', has_logged_in: false }] }); // insert

    await expect(attendanceService.startShortBreak({ slackUserId: 'U1', now: new Date() })).rejects.toThrow('NOT_LOGGED_IN');
  });

  it('endShortBreak throws NO_ACTIVE_BREAK when no active break', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ has_logged_in: true, has_active_break: false, break_start_time: null, short_break_total_min: 0 }] });

    await expect(attendanceService.endShortBreak({ slackUserId: 'U1', now: new Date() })).rejects.toThrow('NO_ACTIVE_BREAK');
  });

  it('startLunch throws LUNCH_ALREADY_USED when user already used lunch', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ has_logged_in: true, has_used_lunch: true, has_active_break: false, has_active_lunch: false }] });

    await expect(attendanceService.startLunch({ slackUserId: 'U1', now: new Date() })).rejects.toThrow('LUNCH_ALREADY_USED');
  });
});

describe('attendanceService - basic break flow', () => {
  it('endShortBreak records violation when duration too long', async () => {
    const now = new Date();
    const startTime = new Date(now.getTime() - 20 * 60000).toISOString(); // 20 minutes ago

    // getOrInitDailyState select returns existing state with active break
    db.query
      .mockResolvedValueOnce({ rows: [{ has_logged_in: true, has_active_break: true, break_start_time: startTime, short_break_total_min: 0 }] }) // select
      .mockResolvedValueOnce({ rows: [] }) // update daily_attendance_state
      .mockResolvedValueOnce({ rows: [] }); // insert break_logs

    const result = await attendanceService.endShortBreak({ slackUserId: 'U1', now });
    expect(result.durationMin).toBeGreaterThanOrEqual(20);
    expect(result.violations).toContain('SINGLE_SHORT_BREAK_EXCEEDED');
  });
});
