UPDATE vehicles
SET mileage = 0,
    mileage_band = NULL,
    updated_at = CASE
      WHEN strftime('%Y-%m-%dT%H:%M:%fZ','now') <= updated_at
        THEN strftime('%Y-%m-%dT%H:%M:%fZ',updated_at,'+0.001 seconds')
      ELSE strftime('%Y-%m-%dT%H:%M:%fZ','now')
    END
WHERE mileage IS NULL AND mileage_band IS NOT NULL;
