-- 002_attendance_state.sql
CREATE TABLE IF NOT EXISTS daily_attendance_state (
  slack_user_id TEXT NOT NULL,
  date DATE NOT NULL,
  has_logged_in BOOLEAN DEFAULT FALSE,
  first_login_time TIMESTAMP WITH TIME ZONE,
  first_login_approval_required BOOLEAN DEFAULT TRUE,
  short_break_total_min INTEGER DEFAULT 0,
  has_active_break BOOLEAN DEFAULT FALSE,
  break_start_time TIMESTAMP WITH TIME ZONE,
  has_active_lunch BOOLEAN DEFAULT FALSE,
  lunch_start_time TIMESTAMP WITH TIME ZONE,
  has_used_lunch BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (slack_user_id, date)
);

CREATE TABLE IF NOT EXISTS break_logs (
  id SERIAL PRIMARY KEY,
  slack_user_id TEXT NOT NULL,
  date DATE NOT NULL,
  break_type TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_min INTEGER,
  is_violation BOOLEAN DEFAULT FALSE,
  violation_reason TEXT
);
