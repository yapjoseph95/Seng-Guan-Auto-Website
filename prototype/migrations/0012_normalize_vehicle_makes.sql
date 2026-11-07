WITH official(name) AS (
  VALUES ('Audi'), ('BMW'), ('BYD'), ('Chery'), ('Ford'), ('GWM'), ('Honda'),
         ('Hyundai'), ('Isuzu'), ('Jaecoo'), ('Kia'), ('Lexus'), ('Mazda'),
         ('Mercedes-Benz'), ('MG'), ('MINI'), ('Mitsubishi'), ('Nissan'),
         ('Perodua'), ('Peugeot'), ('Porsche'), ('Proton'), ('Subaru'),
         ('Suzuki'), ('Toyota'), ('Volkswagen'), ('Volvo')
), normalized AS MATERIALIZED (
  SELECT vehicle.id, COALESCE(
    (SELECT name FROM official WHERE name = trim(vehicle.make) COLLATE NOCASE),
    (SELECT trim(previous.make) FROM vehicles previous
     WHERE trim(previous.make) = trim(vehicle.make) COLLATE NOCASE
     ORDER BY previous.created_at, previous.id LIMIT 1)
  ) AS make
  FROM vehicles vehicle
)
UPDATE vehicles
SET make = normalized.make,
    updated_at = CASE
      WHEN strftime('%Y-%m-%dT%H:%M:%fZ','now') <= vehicles.updated_at
        THEN strftime('%Y-%m-%dT%H:%M:%fZ',vehicles.updated_at,'+0.001 seconds')
      ELSE strftime('%Y-%m-%dT%H:%M:%fZ','now')
    END
FROM normalized
WHERE vehicles.id = normalized.id AND vehicles.make <> normalized.make COLLATE BINARY;
