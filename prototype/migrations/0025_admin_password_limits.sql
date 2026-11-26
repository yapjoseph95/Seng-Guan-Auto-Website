CREATE TABLE admin_password_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  window_start INTEGER NOT NULL,
  strikes INTEGER NOT NULL DEFAULT 0,
  blocked_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX admin_password_limits_window ON admin_password_limits(window_start);
