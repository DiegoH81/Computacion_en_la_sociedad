-- Los ministros se crean en cada PC, y cada base genera sus propios id:
-- client_id los identifica entre la base local y la online.
ALTER TABLE sacerdotes ADD COLUMN client_id TEXT;

UPDATE sacerdotes SET client_id = lower(hex(randomblob(16))) WHERE client_id IS NULL;

CREATE UNIQUE INDEX idx_sacerdotes_client_id ON sacerdotes (client_id) WHERE client_id IS NOT NULL;
