-- seed_daily_attendance_state.sql
-- Inserts or updates a daily_attendance_state row to set first_login_approval_required = TRUE
INSERT INTO daily_attendance_state (slack_user_id, date, has_logged_in, first_login_time, first_login_approval_required, short_break_total_min, has_active_break, has_active_lunch, has_used_lunch, updated_at)
VALUES ('UTEST01', current_date, FALSE, NULL, TRUE, 0, FALSE, FALSE, FALSE, NOW())
ON CONFLICT (slack_user_id, date)
DO UPDATE SET first_login_approval_required = TRUE, updated_at = NOW();
