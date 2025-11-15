import express from 'express';
import slackVerification from '../lib/slackVerification.js';
import { getUserEmail, getUserInfo, postDM, postEphemeral } from '../lib/slackClient.js';
import { findEmployeeByEmail } from '../lib/kekaClient.js';
import db from '../lib/db.js';
import * as attendanceService from '../services/attendanceService.js';
import { info, error } from '../lib/logger.js';

const router = express.Router();
const DEFAULT_APPROVER = process.env.DEFAULT_FALLBACK_APPROVER_SLACK_ID;

async function getUserMappingBySlackUserId(slackUserId) {
  const { rows } = await db.query('SELECT slack_user_id, keka_employee_id FROM user_mappings WHERE slack_user_id = $1 LIMIT 1', [slackUserId]);
  return rows[0] || null;
}

async function createUserMapping(slackUserId, kekaEmployeeId) {
  const { rows } = await db.query(
    `INSERT INTO user_mappings (slack_user_id, keka_employee_id, created_at) VALUES ($1, $2, NOW())
     ON CONFLICT (slack_user_id) DO UPDATE SET keka_employee_id = EXCLUDED.keka_employee_id RETURNING slack_user_id, keka_employee_id`,
    [slackUserId, kekaEmployeeId]
  );
  return rows[0];
}

async function notifyApprover({ slackUserId, reason, date }) {
  if (!DEFAULT_APPROVER) {
    info('No default approver set'); return;
  }
  const userInfo = await getUserInfo(slackUserId).catch(() => null);
  const name = userInfo?.real_name || userInfo?.name || slackUserId;
  const text = `Approval required for *${name}* (${slackUserId}) on *${date}*.
Reason: ${reason}`;
  await postDM(DEFAULT_APPROVER, text);
}

router.post('/slash', slackVerification, async (req, res) => {
  const slackUserId = req.body.user_id;
  const text = (req.body.text || '').trim();
  const [command, subcommand] = text.split(/\s+/);
  info('/slack/slash', { slackUserId, text });

  try {
    if (command === 'login') {
      let mapping = await getUserMappingBySlackUserId(slackUserId);
      if (!mapping) {
        const email = await getUserEmail(slackUserId);
        if (!email) {
          return res.json({ response_type: 'ephemeral', text: 'Could not determine your Slack email. Contact admin.' });
        }
        const emp = await findEmployeeByEmail(email);
        if (!emp) {
          return res.json({ response_type: 'ephemeral', text: `Could not find a Keka employee for ${email}. Contact HR.` });
        }
        mapping = await createUserMapping(slackUserId, emp.employeeId);
      }

      const now = new Date();
      await attendanceService.registerLogin({ slackUserId, kekaEmployeeId: mapping.keka_employee_id, now });
      await notifyApprover({ slackUserId, reason: 'First login of the day', date: now.toISOString().slice(0,10) });

      return res.json({ response_type: 'ephemeral', text: '✅ Login recorded in Keka. First login requires approval.' });
    }

    if (command === 'break') {
      if (subcommand === 'start') {
        try {
          const now = new Date();
          await attendanceService.startShortBreak({ slackUserId, now });
          return res.json({ response_type: 'ephemeral', text: '☕ Short break started. Use `/keka break end` to finish.' });
        } catch (err) {
          if (err.message === 'NOT_LOGGED_IN') return res.json({ response_type: 'ephemeral', text: 'Please /keka login first.' });
          if (err.message === 'BREAK_OR_LUNCH_ALREADY_ACTIVE') return res.json({ response_type: 'ephemeral', text: 'You have an active break or lunch.' });
          error('break start error', { err: err.message }); return res.json({ response_type: 'ephemeral', text: 'Could not start break.' });
        }
      } else if (subcommand === 'end') {
        try {
          const now = new Date();
          const { durationMin, newTotal, violations } = await attendanceService.endShortBreak({ slackUserId, now });
          let text = `✅ Short break ended. Duration: ${durationMin} min. Total today: ${newTotal} min.`;
          if (violations.length) {
            text += '\n⚠️ Policy violation detected. Approval required.';
            await notifyApprover({ slackUserId, reason: `Short break violations: ${violations.join(',')}`, date: now.toISOString().slice(0,10) });
          }
          return res.json({ response_type: 'ephemeral', text });
        } catch (err) {
          if (err.message === 'NOT_LOGGED_IN') return res.json({ response_type: 'ephemeral', text: 'Please /keka login first.' });
          if (err.message === 'NO_ACTIVE_BREAK') return res.json({ response_type: 'ephemeral', text: 'No active break found.' });
          error('break end error', { err: err.message }); return res.json({ response_type: 'ephemeral', text: 'Could not end break.' });
        }
      }
    }

    if (command === 'lunch') {
      if (subcommand === 'start') {
        try {
          const now = new Date();
          await attendanceService.startLunch({ slackUserId, now });
          return res.json({ response_type: 'ephemeral', text: '🍽️ Lunch started. Use `/keka lunch end` to finish.' });
        } catch (err) {
          if (err.message === 'NOT_LOGGED_IN') return res.json({ response_type: 'ephemeral', text: 'Please /keka login first.' });
          if (err.message === 'LUNCH_ALREADY_USED') return res.json({ response_type: 'ephemeral', text: 'You have already used lunch today.' });
          if (err.message === 'BREAK_OR_LUNCH_ALREADY_ACTIVE') return res.json({ response_type: 'ephemeral', text: 'Active break/lunch exists.' });
          error('lunch start error', { err: err.message }); return res.json({ response_type: 'ephemeral', text: 'Could not start lunch.' });
        }
      } else if (subcommand === 'end') {
        try {
          const now = new Date();
          const { durationMin, violations } = await attendanceService.endLunch({ slackUserId, now });
          let text = `✅ Lunch ended. Duration: ${durationMin} min.`;
          if (violations.length) {
            text += '\n⚠️ Lunch violation. Approval required.';
            await notifyApprover({ slackUserId, reason: `Lunch violations: ${violations.join(',')}`, date: now.toISOString().slice(0,10) });
          }
          return res.json({ response_type: 'ephemeral', text });
        } catch (err) {
          if (err.message === 'NOT_LOGGED_IN') return res.json({ response_type: 'ephemeral', text: 'Please /keka login first.' });
          if (err.message === 'NO_ACTIVE_LUNCH') return res.json({ response_type: 'ephemeral', text: 'No active lunch found.' });
          error('lunch end error', { err: err.message }); return res.json({ response_type: 'ephemeral', text: 'Could not end lunch.' });
        }
      }
    }

    // default
    return res.json({ response_type: 'ephemeral', text: 'Supported: /keka login | /keka break start|end | /keka lunch start|end' });
  } catch (err) {
    error('/slack/slash generic error', { err: err?.message });
    return res.json({ response_type: 'ephemeral', text: 'Internal error processing command.' });
  }
});

export default router;
