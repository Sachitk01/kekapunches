import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

import healthRoutes from './routes/healthRoutes.js';
import slackRoutes from './routes/slackRoutes.js';

const app = express();

// capture raw body for Slack verification for /slack routes
app.use('/slack', express.urlencoded({ extended: false, verify: (req, res, buf) => { req.rawBody = buf.toString(); } }));

app.use(express.json());

app.use('/health', healthRoutes);
app.use('/slack', slackRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Keka-Slack middleware listening on ${port}`);
});
