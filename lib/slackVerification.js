import crypto from 'crypto';
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

export default function slackVerification(req, res, next) {
  try {
    if (!SLACK_SIGNING_SECRET) return res.status(500).send('Slack signing secret not configured');

    const timestamp = req.headers['x-slack-request-timestamp'];
    const sig = req.headers['x-slack-signature'];
    if (!timestamp || !sig) return res.status(400).send('Bad request');

    const age = Math.floor(Date.now() / 1000) - Number(timestamp);
    if (Math.abs(age) > 60 * 5) return res.status(400).send('Stale request');

    const base = `v0:${timestamp}:${req.rawBody || ''}`;
    const h = crypto.createHmac('sha256', SLACK_SIGNING_SECRET).update(base).digest('hex');
    const computed = `v0=${h}`;
    if (!crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(sig))) {
      return res.status(401).send('Invalid signature');
    }
    next();
  } catch (err) {
    return res.status(401).send('Signature verification failed');
  }
}
