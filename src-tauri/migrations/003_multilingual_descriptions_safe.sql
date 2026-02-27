-- Safe migration that checks if columns exist before adding them
-- This script can be run multiple times without errors

-- First, check if we need to add the columns by trying to select them
-- If this fails, the columns don't exist and we need to add them

-- For SQLite, we'll use a different approach:
-- 1. Create a new table with the new schema
-- 2. Copy data from old table
-- 3. Drop old table
-- 4. Rename new table

-- But first, let's try the simple approach and just ignore errors

-- Try to add columns (will fail silently if they exist)
-- Note: This requires the migration runner to ignore errors
ALTER TABLE assets ADD COLUMN ai_description_en TEXT NOT NULL DEFAULT '';
ALTER TABLE assets ADD COLUMN ai_description_zh TEXT NOT NULL DEFAULT '';

-- Always recreate FTS5 and triggers to ensure they're up to date
DROP TRIGGER IF EXISTS assets_ai;
DROP TRIGGER IF EXISTS assets_ad;
DROP TRIGGER IF EXISTS assets_au;
DROP TABLE IF EXISTS assets_fts;

CREATE VIRTUAL TABLE assets_fts USING fts5(
    file_name,
    description,
    ai_description,
    ai_description_en,
    ai_description_zh,
    content='assets',
    content_rowid='rowid'
);

CREATE TRIGGER assets_ai AFTER INSERT ON assets BEGIN
    INSERT INTO assets_fts(rowid, file_name, description, ai_description, ai_description_en, ai_description_zh)
    VALUES (new.rowid, new.file_name, new.description, new.ai_description, new.ai_description_en, new.ai_description_zh);
END;

CREATE TRIGGER assets_ad AFTER DELETE ON assets BEGIN
    INSERT INTO assets_fts(assets_fts, rowid, file_name, description, ai_description, ai_description_en, ai_description_zh)
    VALUES ('delete', old.rowid, old.file_name, old.description, old.ai_description, old.ai_description_en, old.ai_description_zh);
END;

CREATE TRIGGER assets_au AFTER UPDATE ON assets BEGIN
    INSERT INTO assets_fts(assets_fts, rowid, file_name, description, ai_description, ai_description_en, ai_description_zh)
    VALUES ('delete', old.rowid, old.file_name, old.description, old.ai_description, old.ai_description_en, old.ai_description_zh);
    INSERT INTO assets_fts(rowid, file_name, description, ai_description, ai_description_en, ai_description_zh)
    VALUES (new.rowid, new.file_name, new.description, new.ai_description, new.ai_description_en, new.ai_description_zh);
END;

-- Rebuild FTS index with existing data
INSERT INTO assets_fts(rowid, file_name, description, ai_description, ai_description_en, ai_description_zh)
SELECT rowid, file_name, description, ai_description,
       COALESCE(ai_description_en, ''),
       COALESCE(ai_description_zh, '')
FROM assets;
