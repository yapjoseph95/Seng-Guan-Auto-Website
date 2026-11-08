ALTER TABLE vehicles ADD COLUMN listing_updated_at TEXT;

CREATE TRIGGER vehicles_record_listing_update
AFTER UPDATE OF name, make, year, body, fuel, transmission, price, mileage,
 description, description_template, status, featured, mileage_band ON vehicles
WHEN OLD.published_at IS NOT NULL AND (
 OLD.name IS NOT NEW.name OR OLD.make IS NOT NEW.make OR OLD.year IS NOT NEW.year
 OR OLD.body IS NOT NEW.body OR OLD.fuel IS NOT NEW.fuel OR OLD.transmission IS NOT NEW.transmission
 OR OLD.price IS NOT NEW.price OR OLD.mileage IS NOT NEW.mileage OR OLD.mileage_band IS NOT NEW.mileage_band
 OR OLD.description IS NOT NEW.description OR OLD.description_template IS NOT NEW.description_template
 OR OLD.status IS NOT NEW.status OR OLD.featured IS NOT NEW.featured
)
BEGIN
 UPDATE vehicles SET listing_updated_at = NEW.updated_at WHERE id = NEW.id;
END;
