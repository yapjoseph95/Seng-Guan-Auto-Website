CREATE TABLE admin_idle_sessions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  last_activity INTEGER NOT NULL
);
CREATE INDEX admin_idle_sessions_activity ON admin_idle_sessions(last_activity);
