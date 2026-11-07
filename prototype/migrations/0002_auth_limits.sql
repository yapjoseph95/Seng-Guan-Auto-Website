CREATE TABLE IF NOT EXISTS auth_limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL,window_start INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS auth_limits_window ON auth_limits(window_start);
