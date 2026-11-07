CREATE TABLE vehicles_next (
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
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','available','reserved','sold')),
 featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE photos_next (
 id TEXT PRIMARY KEY,
 vehicle_id TEXT NOT NULL REFERENCES vehicles_next(id) ON DELETE CASCADE,
 object_key TEXT NOT NULL UNIQUE,
 content_type TEXT NOT NULL,
 size INTEGER NOT NULL,
 position INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO vehicles_next SELECT * FROM vehicles;
INSERT INTO photos_next SELECT * FROM photos;
DROP TABLE photos;
DROP TABLE vehicles;
ALTER TABLE vehicles_next RENAME TO vehicles;
ALTER TABLE photos_next RENAME TO photos;
CREATE INDEX photos_vehicle ON photos(vehicle_id,position);
CREATE INDEX vehicles_status ON vehicles(status,featured);
