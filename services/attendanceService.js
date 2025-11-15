import db from '../lib/db.js';
import { punchAttendance } from '../lib/kekaClient.js';
import { info, error } from '../lib/logger.js';

const SHORT_BREAK_MAX_SINGLE_MIN = Number(process.env.SHORT_BREAK_MAX_SINGLE_MIN || 15);
const SHORT_BREAK_MAX_DAILY_MIN = Number(process.env.SHORT_BREAK_MAX_DAILY_MIN || 30);
const LUNCH_MAX_MIN = Number(process.env.LUNCH_BREAK_MAX_MINUTES || 30);

function todayDateString() {
  return new Date().toISOString().slice(0,10);
}

export async function getOrInitDailyState(slackUserId, dateStr) {
  const { rows } = await db.query(
    `SELECT * FROM daily_attendance_state WHERE slack_user_id = $1 AND date = $2 LIMIT 1`,
    [slackUserId, dateStr]
  );
  if (rows[0]) return rows[0];

  const insert = await db.query(
    `INSERT INTO daily_attendance_state
    (slack_user_id, date, has_logged_in, short_break_total_min, has_active_break, has_active_lunch, has_used_lunch, first_login_approval_required)
    VALUES ($1, $2, FALSE, 0, FALSE, FALSE, FALSE, TRUE) RETURNING *`,
    [slackUserId, dateStr]
  );
  return insert.rows[0];
}

export async function registerLogin({ slackUserId, kekaEmployeeId, now }) {
  const dateStr = todayDateString();
  let state = await getOrInitDailyState(slackUserId, dateStr);
  if (!state.has_logged_in) {
    const { rows } = await db.query(
      `UPDATE daily_attendance_state SET has_logged_in = TRUE, first_login_time = $3, first_login_approval_required = TRUE, updated_at = $3
       WHERE slack_user_id = $1 AND date = $2 RETURNING *`,
      [slackUserId, dateStr, now]
    );
    state = rows[0];
    info('First login recorded', { slackUserId, date: dateStr });
  } else {
    info('User already logged in today', { slackUserId, date: dateStr });
  }

  await punchAttendance({
    employeeId: kekaEmployeeId,
    type: 'IN',
    timestamp: now.toISOString(),
    notes: 'Slack /keka login'
  });

  return state;
}

export async function startShortBreak({ slackUserId, now }) {
  const dateStr = todayDateString();
  let state = await getOrInitDailyState(slackUserId, dateStr);
  if (!state.has_logged_in) throw new Error('NOT_LOGGED_IN');
  if (state.has_active_break || state.has_active_lunch) throw new Error('BREAK_OR_LUNCH_ALREADY_ACTIVE');

  const { rows } = await db.query(
    `UPDATE daily_attendance_state SET has_active_break = TRUE, break_start_time = $3, updated_at = $3
     WHERE slack_user_id = $1 AND date = $2 RETURNING *`,
    [slackUserId, dateStr, now]
  );
  state = rows[0];
  info('Short break started', { slackUserId, date: dateStr });
  return state;
}

export async function endShortBreak({ slackUserId, now }) {
  const dateStr = todayDateString();
  let state = await getOrInitDailyState(slackUserId, dateStr);
  if (!state.has_logged_in) throw new Error('NOT_LOGGED_IN');
  if (!state.has_active_break || !state.break_start_time) throw new Error('NO_ACTIVE_BREAK');

  const start = new Date(state.break_start_time);
  const durationMin = Math.max(1, Math.round((now - start) / 60000));
  const newTotal = (state.short_break_total_min || 0) + durationMin;
  const violations = [];
  if (durationMin > SHORT_BREAK_MAX_SINGLE_MIN) violations.push('SINGLE_SHORT_BREAK_EXCEEDED');
  if (newTotal > SHORT_BREAK_MAX_DAILY_MIN) violations.push('DAILY_SHORT_BREAK_TOTAL_EXCEEDED');

  await db.query(
    `UPDATE daily_attendance_state SET has_active_break = FALSE, break_start_time = NULL, short_break_total_min = $3, updated_at = $4
     WHERE slack_user_id = $1 AND date = $2`,
    [slackUserId, dateStr, newTotal, now]
  );

  await db.query(
    `INSERT INTO break_logs (slack_user_id, date, break_type, start_time, end_time, duration_min, is_violation, violation_reason)
     VALUES ($1, $2, 'SHORT', $3, $4, $5, $6, $7)`,
    [slackUserId, dateStr, start, now, durationMin, violations.length > 0, violations.join(',')]
  );

  info('Short break ended', { slackUserId, durationMin, newTotal, violations });
  return { durationMin, newTotal, violations };
}

export async function startLunch({ slackUserId, now }) {
  const dateStr = todayDateString();
  let state = await getOrInitDailyState(slackUserId, dateStr);
  if (!state.has_logged_in) throw new Error('NOT_LOGGED_IN');
  if (state.has_used_lunch) throw new Error('LUNCH_ALREADY_USED');
  if (state.has_active_break || state.has_active_lunch) throw new Error('BREAK_OR_LUNCH_ALREADY_ACTIVE');

  const { rows } = await db.query(
    `UPDATE daily_attendance_state SET has_active_lunch = TRUE, lunch_start_time = $3, updated_at = $3 WHERE slack_user_id = $1 AND date = $2 RETURNING *`,
    [slackUserId, dateStr, now]
  );
  state = rows[0];
  info('Lunch started', { slackUserId });
  return state;
}

export async function endLunch({ slackUserId, now }) {
  const dateStr = todayDateString();
  let state = await getOrInitDailyState(slackUserId, dateStr);
  if (!state.has_logged_in) throw new Error('NOT_LOGGED_IN');
  if (!state.has_active_lunch || !state.lunch_start_time) throw new Error('NO_ACTIVE_LUNCH');

  const start = new Date(state.lunch_start_time);
  const durationMin = Math.max(1, Math.round((now - start) / 60000));
  const violations = [];
  if (durationMin > LUNCH_MAX_MIN) violations.push('LUNCH_EXCEEDED');

  await db.query(
    `UPDATE daily_attendance_state SET has_active_lunch = FALSE, lunch_start_time = NULL, has_used_lunch = TRUE, updated_at = $4 WHERE slack_user_id = $1 AND date = $2`,
    [slackUserId, dateStr, now, now]
  );

  await db.query(
    `INSERT INTO break_logs (slack_user_id, date, break_type, start_time, end_time, duration_min, is_violation, violation_reason)
     VALUES ($1, $2, 'LUNCH', $3, $4, $5, $6, $7)`,
    [slackUserId, dateStr, start, now, durationMin, violations.length > 0, violations.join(',')]
  );

  info('Lunch ended', { slackUserId, durationMin, violations });
  return { durationMin, violations };
}

export async function clearFirstLoginApprovalRequired(slackUserId, date) {
  try {
    await db.query(
      `UPDATE daily_attendance_state SET first_login_approval_required = FALSE, updated_at = NOW()
       WHERE slack_user_id = $1 AND date = $2`,
      [slackUserId, date]
    );
    info('First login approval requirement cleared', { slackUserId, date });
  } catch (err) {
    error('Failed to clear first login approval', { err: err.message });
    throw err;
  }
}
