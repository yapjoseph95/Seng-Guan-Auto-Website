ALTER TABLE watermark_assets ADD COLUMN default_scale REAL CHECK(default_scale BETWEEN 0.1 AND 1);
ALTER TABLE watermark_assets ADD COLUMN default_opacity REAL CHECK(default_opacity BETWEEN 0 AND 1);
