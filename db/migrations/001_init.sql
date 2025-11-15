-- 001_init.sql
CREATE TABLE IF NOT EXISTS user_mappings (
  slack_user_id TEXT PRIMARY KEY,
  keka_employee_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
