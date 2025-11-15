import { WebClient } from '@slack/web-api';
import { info, error } from './logger.js';
const client = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function getUserEmail(slackUserId) {
  try {
    const res = await client.users.profile.get({ user: slackUserId });
    const email = res.profile?.email;
    if (email) return email.toLowerCase();
    return null;
  } catch (err) {
    error('slackClient.getUserEmail failed', { err: err?.data || err.message });
    return null;
  }
}

export async function getUserInfo(slackUserId) {
  try {
    const res = await client.users.info({ user: slackUserId });
    return res.user;
  } catch (err) {
    error('slackClient.getUserInfo failed', { err: err?.data || err.message });
    return null;
  }
}

export async function postDM(userId, text) {
  try {
    const im = await client.conversations.open({ users: userId });
    const channel = im.channel.id;
    await client.chat.postMessage({ channel, text });
    return true;
  } catch (err) {
    error('slackClient.postDM failed', { err: err?.data || err.message });
    return false;
  }
}

export async function postEphemeral(channel, user, text) {
  try {
    await client.chat.postEphemeral({ channel, user, text });
    return true;
  } catch (err) {
    error('slackClient.postEphemeral failed', { err: err?.data || err.message });
    return false;
  }
}
