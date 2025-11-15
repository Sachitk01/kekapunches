import express from 'express';
import slackVerification from '../lib/slackVerification.js';
import * as approvalsService from '../services/approvalsService.js';
import * as attendanceService from '../services/attendanceService.js';
import { getUserInfo, postDM } from '../lib/slackClient.js';
import { info, error } from '../lib/logger.js';

const router = express.Router();
const DEFAULT_APPROVER = process.env.DEFAULT_FALLBACK_APPROVER_SLACK_ID;

// GET /approvals/pending - List all pending approvals
router.get('/pending', async (req, res) => {
  try {
    const approvals = await approvalsService.getPendingApprovals();
    res.json({ approvals });
  } catch (err) {
    error('Failed to fetch pending approvals', { err: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /approvals/:id/approve - Approve an approval record (requires Slack verification)
router.post('/:id/approve', slackVerification, async (req, res) => {
  try {
    const { id } = req.params;
    const { approver_id, notes } = req.body;

    if (!approver_id) {
      return res.status(403).json({ error: 'Unauthorized: approver_id required' });
    }

    const approval = await approvalsService.approveApproval(id, approver_id, notes);
    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    // If FIRST_LOGIN, clear the requirement
    if (approval.request_type === 'FIRST_LOGIN') {
      await attendanceService.clearFirstLoginApprovalRequired(
        approval.slack_user_id,
        approval.date
      );
    }

    // Send confirmations
    await postDM(approval.slack_user_id, `Your attendance request on ${approval.date} was approved.`);
    await postDM(approver_id, `You approved the request for <@${approval.slack_user_id}> on ${approval.date}.`);

    res.json({ approval });
  } catch (err) {
    error('Failed to approve', { err: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /approvals/:id/reject - Reject an approval record (requires Slack verification)
router.post('/:id/reject', slackVerification, async (req, res) => {
  try {
    const { id } = req.params;
    const { approver_id, notes } = req.body;

    if (!approver_id) {
      return res.status(403).json({ error: 'Unauthorized: approver_id required' });
    }

    const approval = await approvalsService.rejectApproval(id, approver_id, notes);
    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    // Send confirmations
    await postDM(
      approval.slack_user_id,
      `Your attendance request on ${approval.date} was rejected. Reason: ${notes || 'N/A'}`
    );
    await postDM(approver_id, `You rejected the request for <@${approval.slack_user_id}>.`);

    res.json({ approval });
  } catch (err) {
    error('Failed to reject', { err: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /slack/actions - Handle Slack interactive components (buttons)
router.post('/slack/actions', slackVerification, async (req, res) => {
  try {
    const payload = JSON.parse(req.body.payload || '{}');
    const { actions, user, response_url } = payload;

    if (!actions || !actions.length) {
      return res.json({ response_type: 'in_channel', text: 'No actions found' });
    }

    const action = actions[0];
    const { action_id, value } = action;

    if (action_id === 'approve') {
      const approvalId = value;
      const approval = await approvalsService.approveApproval(approvalId, user.id, 'Approved via button');
      if (approval && approval.request_type === 'FIRST_LOGIN') {
        await attendanceService.clearFirstLoginApprovalRequired(approval.slack_user_id, approval.date);
      }
      await postDM(user.id, `You approved request ${approvalId}.`);
      return res.json({ response_type: 'in_channel', text: `Approved request ${approvalId}.` });
    } else if (action_id === 'reject') {
      const approvalId = value;
      const approval = await approvalsService.rejectApproval(approvalId, user.id, 'Rejected via button');
      await postDM(user.id, `You rejected request ${approvalId}.`);
      return res.json({ response_type: 'in_channel', text: `Rejected request ${approvalId}.` });
    }

    res.json({ response_type: 'in_channel', text: 'Unknown action' });
  } catch (err) {
    error('/slack/actions error', { err: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
