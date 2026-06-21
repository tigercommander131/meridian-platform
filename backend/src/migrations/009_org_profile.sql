-- Organisation profile: branding + default regions for the settings page.
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS accent     TEXT;            -- hex accent (no purple)
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS regions    TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS tagline    TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
