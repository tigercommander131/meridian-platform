-- Group scenarios in the picker (e.g. "Adult Cardiac", "Trauma", "Paediatric").
ALTER TABLE rubrics ADD COLUMN IF NOT EXISTS category TEXT;
