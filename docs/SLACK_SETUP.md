# Slack App Setup

Required scopes (Bot Token):

- `chat:write` — send messages as the bot (DMs + ephemeral)
- `conversations:open` — open IM channels
- `users:read` — read user profiles
- `users.profile:read` — read user email from profile
- `commands` — enable slash commands

Recommended app features:

- Create a Slash Command `/keka` with Request URL: `https://<your-public>/slack/slash`
- Enable Interactivity with Request URL: `https://<your-public>/slack/actions` (stub handler provided)
- Add the Bot Token to `.env` as `SLACK_BOT_TOKEN`
- Add your Signing Secret to `.env` as `SLACK_SIGNING_SECRET`

Security notes:

- Do not commit your tokens/secrets — use `.env` and secrets management.
- Rotate tokens if accidentally leaked.
