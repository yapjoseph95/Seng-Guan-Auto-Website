ALTER TABLE watermark_assets ADD COLUMN default_x REAL CHECK(default_x BETWEEN 0 AND 1);
ALTER TABLE watermark_assets ADD COLUMN default_y REAL CHECK(default_y BETWEEN 0 AND 1);
