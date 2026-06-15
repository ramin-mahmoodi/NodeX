DROP TABLE IF EXISTS configs;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS settings;

CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE NOT NULL,
    name TEXT,
    status TEXT DEFAULT 'active',
    last_updated_at DATETIME
);

CREATE TABLE configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sub_id INTEGER NOT NULL,
    name TEXT,
    raw_uri TEXT UNIQUE,
    protocol TEXT,
    host TEXT,
    port INTEGER,
    status TEXT DEFAULT 'untested',
    ping_ms INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    last_tested_at DATETIME,
    FOREIGN KEY(sub_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

-- Insert default settings
INSERT INTO settings (key, value) VALUES ('update_interval_hours', '6');
