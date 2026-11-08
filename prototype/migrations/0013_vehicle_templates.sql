CREATE TABLE IF NOT EXISTS vehicle_template_settings (
 id INTEGER PRIMARY KEY CHECK (id = 1),
 content TEXT NOT NULL CHECK (json_valid(content))
);

ALTER TABLE vehicles ADD COLUMN description_template TEXT CHECK (json_valid(description_template));
