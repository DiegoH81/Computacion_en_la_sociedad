CREATE TABLE system_check (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checked_at TEXT NOT NULL
);

INSERT INTO system_check (checked_at) VALUES ('seed');