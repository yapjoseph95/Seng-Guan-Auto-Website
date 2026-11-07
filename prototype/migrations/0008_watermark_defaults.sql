CREATE TABLE watermark_settings (
 id INTEGER PRIMARY KEY CHECK(id = 1),
 scale REAL NOT NULL CHECK(scale BETWEEN 0.1 AND 1),
 opacity REAL NOT NULL CHECK(opacity BETWEEN 0 AND 1)
);
