ALTER TABLE vehicles ADD COLUMN published_at TEXT;

CREATE TABLE vehicle_private_details (
 vehicle_id TEXT PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
 plate_number TEXT NOT NULL CHECK(length(plate_number) <= 32)
);

CREATE TRIGGER vehicles_set_published_on_insert
AFTER INSERT ON vehicles
WHEN NEW.status != 'draft' AND NEW.published_at IS NULL
BEGIN
 UPDATE vehicles SET published_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

CREATE TRIGGER vehicles_set_published_on_update
AFTER UPDATE OF status ON vehicles
WHEN NEW.status != 'draft' AND NEW.published_at IS NULL
BEGIN
 UPDATE vehicles SET published_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

UPDATE vehicles SET published_at = created_at WHERE status != 'draft' AND published_at IS NULL;
