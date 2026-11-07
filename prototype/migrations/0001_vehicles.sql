PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS vehicles (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 make TEXT NOT NULL,
 year INTEGER NOT NULL,
 body TEXT NOT NULL DEFAULT '',
 fuel TEXT NOT NULL DEFAULT '',
 transmission TEXT NOT NULL DEFAULT '',
 price INTEGER,
 mileage INTEGER,
 description TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','available','sold')),
 featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS photos (
 id TEXT PRIMARY KEY,
 vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
 object_key TEXT NOT NULL UNIQUE,
 content_type TEXT NOT NULL,
 size INTEGER NOT NULL,
 position INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS photos_vehicle ON photos(vehicle_id,position);
CREATE INDEX IF NOT EXISTS vehicles_status ON vehicles(status,featured);
