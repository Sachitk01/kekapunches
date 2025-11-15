-- 003_approvals.sql
CREATE TABLE IF NOT EXISTS approvals (
  id SERIAL PRIMARY KEY,
  slack_user_id TEXT NOT NULL,
  date DATE NOT NULL,
  request_type TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  approver_slack_id TEXT,
  approver_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approvals_user_date
  ON approvals (slack_user_id, date);

CREATE INDEX IF NOT EXISTS idx_approvals_status
  ON approvals (status);
