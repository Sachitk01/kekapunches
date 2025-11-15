import db from '../lib/db.js';
import { info, error } from '../lib/logger.js';
import { incrementCounter } from '../lib/metrics.js';

export async function createApproval({ slackUserId, date, requestType, reason }) {
  try {
    const { rows } = await db.query(
      `INSERT INTO approvals (slack_user_id, date, request_type, reason, status)
       VALUES ($1, $2, $3, $4, 'PENDING') RETURNING id`,
      [slackUserId, date, requestType, reason]
    );
    incrementCounter('approvals_created_total', 1);
    info('Approval created', { approvalId: rows[0].id, slackUserId, requestType });
    return rows[0].id;
  } catch (err) {
    error('Failed to create approval', { err: err.message });
    throw err;
  }
}

export async function getApprovalById(approvalId) {
  try {
    const { rows } = await db.query('SELECT * FROM approvals WHERE id = $1', [approvalId]);
    return rows[0] || null;
  } catch (err) {
    error('Failed to fetch approval', { err: err.message });
    throw err;
  }
}

export async function getPendingApprovals() {
  try {
    const { rows } = await db.query(
      `SELECT * FROM approvals WHERE status = 'PENDING' ORDER BY created_at DESC`
    );
    return rows;
  } catch (err) {
    error('Failed to fetch pending approvals', { err: err.message });
    throw err;
  }
}

export async function approveApproval(approvalId, approverId, notes) {
  try {
    const { rows } = await db.query(
      `UPDATE approvals SET status = 'APPROVED', approver_slack_id = $2, approver_notes = $3, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [approvalId, approverId, notes || '']
    );
    if (rows.length > 0) {
      incrementCounter('approvals_approved_total', 1);
      info('Approval approved', { approvalId, approverId });
    }
    return rows[0] || null;
  } catch (err) {
    error('Failed to approve', { err: err.message });
    throw err;
  }
}

export async function rejectApproval(approvalId, approverId, notes) {
  try {
    const { rows } = await db.query(
      `UPDATE approvals SET status = 'REJECTED', approver_slack_id = $2, approver_notes = $3, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [approvalId, approverId, notes || '']
    );
    if (rows.length > 0) {
      incrementCounter('approvals_rejected_total', 1);
      info('Approval rejected', { approvalId, approverId });
    }
    return rows[0] || null;
  } catch (err) {
    error('Failed to reject approval', { err: err.message });
    throw err;
  }
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
